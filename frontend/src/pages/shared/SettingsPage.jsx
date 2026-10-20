import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArchiveRestore, Bell, Check, CheckCircle2, Clock3, Eye, EyeOff,
  KeyRound, LoaderCircle, Monitor, Moon, RefreshCw, Save,
  ShieldCheck, Sun, UserRound, X, TriangleAlert, Trash2,
} from 'lucide-react';
import axiosClient from '../../api/axiosClient.js';
import { useTheme } from '../../hooks/useTheme.js';
import AdminShell from '../../components/admin/AdminShell.jsx';
import Sidebar from '../../components/admin/Sidebar.jsx';
import Header from '../../components/admin/Header.jsx';
import AgentLayout from '../../components/admin/agent/AgentLayout.jsx';
import ResponsableLayout from '../../components/admin/responsable/ResponsableLayout.jsx';

const SECTIONS = [
  { id: 'profil', label: 'Mon profil', icon: UserRound },
  { id: 'securite', label: 'Sécurité', icon: ShieldCheck },
  { id: 'apparence', label: 'Apparence', icon: Sun },
  { id: 'notifications', label: 'Préférences de notifications', icon: Bell },
  { id: 'archives', label: 'Notifications archivées', icon: ArchiveRestore },
  { id: 'activite', label: 'Historique des activités', icon: Clock3 },
];
const DEFAULT_SETTINGS = {
  theme: 'system', compactMode: false, reduceMotion: false,
  notifications: { anomalies: true, releves: true, decisions: true },
};

function readUser() {
  try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; }
}
function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
}
function formatRole(role) {
  return ({ ADMINISTRATEUR: 'Administrateur', AGENT: 'Agent', RESPONSABLE: 'Responsable' })[role] || role;
}
function messageErreur(error) {
  if (error?.response?.status === 401 || error?.response?.status === 403) return error?.response?.data?.message || 'Session expirée ou accès refusé.';
  return error?.response?.data?.message || error?.message || 'Une erreur est survenue. Réessayez.';
}

function SettingsContent({ role }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { theme, definirTheme, suivreSysteme } = useTheme();
  const [section, setSection] = useState(() => searchParams.get('section') || 'profil');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [profile, setProfile] = useState({ nom: '', prenom: '', email: '', identifiant: '', role });
  const [profileDraft, setProfileDraft] = useState({ nom: '', prenom: '', email: '' });
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [password, setPassword] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [showPasswords, setShowPasswords] = useState(false);
  const [archives, setArchives] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingSection, setLoadingSection] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);

  useEffect(() => {
    const requested = searchParams.get('section') || 'profil';
    if (SECTIONS.some((item) => item.id === requested) || (role === 'ADMINISTRATEUR' && requested === 'audit')) {
      setSection(requested);
    } else {
      setSection('profil');
    }
  }, [searchParams, role]);

  const applyServerTheme = useCallback((choice) => {
    if (choice === 'clair' || choice === 'sombre') definirTheme(choice);
    else suivreSysteme();
  }, [definirTheme, suivreSysteme]);

  const loadSettings = useCallback(async (refresh = false) => {
    try {
      setError('');
      if (refresh) setRefreshing(true); else setLoading(true);
      const response = await axiosClient.get('/settings');
      if (response.data?.status !== 'success') throw new Error(response.data?.message || 'Réponse invalide du serveur des paramètres.');
      const nextProfile = response.data.profile || readUser() || {};
      const nextSettings = { ...DEFAULT_SETTINGS, ...(response.data.settings || {}), notifications: { ...DEFAULT_SETTINGS.notifications, ...(response.data.settings?.notifications || {}) } };
      setProfile(nextProfile);
      setProfileDraft({ nom: nextProfile.nom || '', prenom: nextProfile.prenom || '', email: nextProfile.email || '' });
      setSettings(nextSettings);
      applyServerTheme(nextSettings.theme);
    } catch (requestError) {
      if ([401, 403].includes(requestError?.response?.status)) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/', { replace: true });
        return;
      }
      setError(messageErreur(requestError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [applyServerTheme, navigate]);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const loadSectionData = useCallback(async () => {
    if (section !== 'archives' && section !== 'activite' && !(section === 'audit' && role === 'ADMINISTRATEUR')) return;
    setLoadingSection(true);
    setError('');
    try {
      if (section === 'archives') {
        const response = await axiosClient.get('/notifications', { params: { vue: 'archivees' } });
        const rows = response.data?.notifications ?? response.data?.data;
        if (response.data?.status !== 'success' || !Array.isArray(rows)) throw new Error(response.data?.message || 'Impossible de récupérer les notifications archivées.');
        setArchives(rows);
      } else {
        const response = await axiosClient.get('/settings/audit', { params: { limit: 100 } });
        if (response.data?.status !== 'success' || !Array.isArray(response.data?.logs)) throw new Error(response.data?.message || 'Impossible de récupérer le journal d’activité.');
        setAuditLogs(response.data.logs);
      }
    } catch (requestError) {
      if ([401, 403].includes(requestError?.response?.status)) {
        localStorage.removeItem('token'); localStorage.removeItem('user'); navigate('/', { replace: true }); return;
      }
      setError(messageErreur(requestError));
    } finally { setLoadingSection(false); }
  }, [section, role, navigate]);
  useEffect(() => { loadSectionData(); }, [loadSectionData]);

  const selectSection = (id) => {
    setSection(id);
    setSuccess('');
    setError('');
    setSearchParams(id === 'profil' ? {} : { section: id }, { replace: true });
  };

  const saveProfile = async (event) => {
    event.preventDefault(); setSaving(true); setError(''); setSuccess('');
    try {
      const response = await axiosClient.patch('/settings/profile', profileDraft);
      if (response.data?.status !== 'success' || !response.data?.profile) throw new Error(response.data?.message || 'Le serveur n’a pas confirmé la mise à jour du profil.');
      const updated = response.data.profile;
      setProfile(updated); setProfileDraft({ nom: updated.nom || '', prenom: updated.prenom || '', email: updated.email || '' });
      try { localStorage.setItem('user', JSON.stringify({ ...(readUser() || {}), ...updated })); } catch { /* Le profil serveur reste la source d'autorité. */ }
      setSuccess(response.data.message || 'Profil enregistré.');
    } catch (e) {
      if ([401,403].includes(e?.response?.status)) { localStorage.removeItem('token'); localStorage.removeItem('user'); navigate('/', { replace: true }); return; }
      setError(messageErreur(e));
    } finally { setSaving(false); }
  };

  const savePreferences = async () => {
    setSaving(true); setError(''); setSuccess('');
    try {
      const response = await axiosClient.patch('/settings/preferences', { settings });
      if (response.data?.status !== 'success') throw new Error(response.data?.message || 'Le serveur n’a pas confirmé les préférences.');
      const saved = { ...DEFAULT_SETTINGS, ...(response.data.settings || settings), notifications: { ...DEFAULT_SETTINGS.notifications, ...(response.data.settings?.notifications || settings.notifications) } };
      setSettings(saved); applyServerTheme(saved.theme); setSuccess(response.data.message || 'Préférences enregistrées.');
    } catch (e) { if ([401,403].includes(e?.response?.status)) { localStorage.removeItem('token'); localStorage.removeItem('user'); navigate('/', { replace: true }); return; } setError(messageErreur(e)); }
    finally { setSaving(false); }
  };

  const changePassword = async (event) => {
    event.preventDefault(); setSaving(true); setError(''); setSuccess('');
    try {
      const response = await axiosClient.patch('/settings/password', password);
      if (response.data?.status !== 'success') throw new Error(response.data?.message || 'Le serveur n’a pas confirmé le changement de mot de passe.');
      setPassword({ currentPassword: '', newPassword: '', confirmPassword: '' }); setSuccess(response.data.message || 'Mot de passe modifié.');
    } catch (e) { if ([401,403].includes(e?.response?.status)) { localStorage.removeItem('token'); localStorage.removeItem('user'); navigate('/', { replace: true }); return; } setError(messageErreur(e)); }
    finally { setSaving(false); }
  };

  const changeArchive = async () => {
    if (!confirmAction || busyId !== null) return;
    const notification = confirmAction.notification;
    const isRestore = confirmAction.type === 'restore';
    setBusyId(notification.id); setError(''); setSuccess('');
    try {
      const response = isRestore
        ? await axiosClient.patch(`/notifications/${notification.id}/desarchiver`)
        : await axiosClient.delete(`/notifications/${notification.id}`);
      if (response.data?.status !== 'success') throw new Error(response.data?.message || 'L’opération sur la notification a échoué.');
      setArchives((items) => items.filter((item) => String(item.id) !== String(notification.id)));
      setConfirmAction(null);
      setSuccess(response.data.message || (isRestore ? 'Notification restaurée.' : 'Notification supprimée.'));
    } catch (e) { setError(messageErreur(e)); }
    finally { setBusyId(null); }
  };

  const basePath = role === 'AGENT' ? '/dashboard/agent' : role === 'RESPONSABLE' ? '/dashboard/responsable' : '/dashboard/admin';
  const navSections = role === 'ADMINISTRATEUR' ? [...SECTIONS, { id: 'audit', label: 'Journal d’audit global', icon: Clock3 }] : SECTIONS;
  const currentSection = navSections.find((item) => item.id === section) || navSections[0];
  const CurrentIcon = currentSection.icon;

  return (
    <main className={`mx-auto w-full max-w-7xl space-y-5 px-4 py-5 sm:px-6 sm:py-7 lg:px-8 ${settings.compactMode ? 'text-sm' : ''}`}>
      <header className="flex flex-col gap-4 border-b border-jr-bordure pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-jr-lien">JIRAMA / Configuration du compte</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-jr-titre sm:text-3xl">Paramètres</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-jr-doux">Gérez votre profil, vos préférences et vos notifications depuis un seul espace.</p>
        </div>
        <button type="button" onClick={() => { loadSettings(true); if (section === 'archives' || section === 'activite' || section === 'audit') loadSectionData(); }} disabled={refreshing || loading} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-jr-bordure-forte bg-jr-surface px-3 py-2 text-sm font-semibold text-jr-texte transition-colors hover:bg-jr-champ disabled:opacity-60 motion-reduce:transition-none">
          <RefreshCw size={16} className={refreshing ? 'animate-spin motion-reduce:animate-none' : ''} /> Actualiser
        </button>
      </header>

      {error && <div role="alert" className="flex items-start gap-2 rounded-lg border border-jr-err-bordure bg-jr-err-pale p-3 text-sm text-jr-err"><TriangleAlert size={18} className="mt-0.5 shrink-0" /><div className="flex-1"><p className="font-semibold">Impossible d’effectuer l’opération</p><p className="mt-1">{error}</p></div><button type="button" className="rounded p-1 hover:bg-black/5" onClick={() => setError('')} aria-label="Fermer le message"><X size={16}/></button></div>}
      {success && <div role="status" className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"><CheckCircle2 size={18} className="mt-0.5 shrink-0"/><p>{success}</p></div>}

      <div className="grid gap-5 lg:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="h-fit rounded-xl border border-jr-bordure bg-jr-surface p-2 shadow-sm" aria-label="Sections des paramètres">
          <div className="px-3 pb-3 pt-2"><p className="text-xs font-bold uppercase tracking-wider text-jr-faible">Mon espace</p><p className="mt-1 truncate text-sm font-semibold text-jr-texte">{[profile.prenom, profile.nom].filter(Boolean).join(' ') || 'Utilisateur'}</p><p className="text-xs text-jr-faible">{formatRole(role)}</p></div>
          <nav className="space-y-1">
            {navSections.map((item) => { const Icon=item.icon; const active=item.id===section; return <button key={item.id} type="button" onClick={() => selectSection(item.id)} aria-current={active?'page':undefined} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jr-focus motion-reduce:transition-none ${active?'bg-jr-eau text-white':'text-jr-doux hover:bg-jr-eau-pale hover:text-jr-lien'}`}><Icon size={17}/><span>{item.label}</span>{active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-jr-elec"/>}</button>; })}
          </nav>
        </aside>

        <section className="min-w-0 rounded-xl border border-jr-bordure bg-jr-surface shadow-sm" aria-labelledby="settings-section-heading">
          <div className="flex items-start gap-3 border-b border-jr-bordure px-5 py-4 sm:px-6"><div className="rounded-lg bg-jr-eau-pale p-2 text-jr-lien"><CurrentIcon size={20}/></div><div><h2 id="settings-section-heading" className="text-lg font-bold text-jr-titre">{currentSection.label}</h2><p className="mt-1 text-sm text-jr-doux">Paramètres associés à votre compte {formatRole(role).toLowerCase()}.</p></div></div>
          <div className="p-5 sm:p-6">
            {loading ? <div className="flex items-center gap-2 py-12 text-sm text-jr-doux"><LoaderCircle className="animate-spin motion-reduce:animate-none" size={18}/>Chargement de la configuration serveur…</div> : !profile?.id ? <div className="py-8 text-center"><p className="text-sm text-jr-doux">Les paramètres du serveur n’ont pas pu être chargés.</p><button type="button" onClick={() => loadSettings(true)} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-jr-eau px-4 py-2 text-sm font-semibold text-white hover:bg-jr-eau-fonce"><RefreshCw size={16}/>Réessayer</button></div> : null}

            {!loading && section === 'profil' && <form onSubmit={saveProfile} className="max-w-2xl space-y-5"><div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-medium text-jr-texte">Prénom<input value={profileDraft.prenom} onChange={(e)=>setProfileDraft((p)=>({...p,prenom:e.target.value}))} required maxLength={100} className="mt-1.5 min-h-11 w-full rounded-lg border border-jr-bordure-forte bg-jr-champ px-3 text-sm text-jr-texte outline-none focus:border-jr-focus focus:ring-2 focus:ring-jr-focus-anneau"/></label><label className="block text-sm font-medium text-jr-texte">Nom<input value={profileDraft.nom} onChange={(e)=>setProfileDraft((p)=>({...p,nom:e.target.value}))} required maxLength={100} className="mt-1.5 min-h-11 w-full rounded-lg border border-jr-bordure-forte bg-jr-champ px-3 text-sm text-jr-texte outline-none focus:border-jr-focus focus:ring-2 focus:ring-jr-focus-anneau"/></label><label className="block text-sm font-medium text-jr-texte sm:col-span-2">Adresse e-mail<input type="email" value={profileDraft.email} onChange={(e)=>setProfileDraft((p)=>({...p,email:e.target.value}))} required maxLength={180} className="mt-1.5 min-h-11 w-full rounded-lg border border-jr-bordure-forte bg-jr-champ px-3 text-sm text-jr-texte outline-none focus:border-jr-focus focus:ring-2 focus:ring-jr-focus-anneau"/></label></div><div className="rounded-lg bg-jr-fond p-3 text-sm text-jr-doux"><span className="font-semibold text-jr-texte">Identifiant :</span> {profile.identifiant || '—'} <span className="mx-2">·</span><span className="font-semibold text-jr-texte">Rôle :</span> {formatRole(role)} <p className="mt-1 text-xs">Le rôle et l’identifiant ne peuvent pas être modifiés depuis cette page.</p></div><div className="flex justify-end"><button disabled={saving} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-jr-eau px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-jr-eau-fonce disabled:opacity-60"><Save size={16}/>{saving?'Enregistrement…':'Enregistrer le profil'}</button></div></form>}

            {!loading && section === 'securite' && <form onSubmit={changePassword} className="max-w-xl space-y-4"><p className="text-sm leading-6 text-jr-doux">Choisissez un mot de passe d’au moins 8 caractères. Le serveur vérifie votre mot de passe actuel et enregistre uniquement son empreinte sécurisée.</p>{[['currentPassword','Mot de passe actuel'],['newPassword','Nouveau mot de passe'],['confirmPassword','Confirmer le nouveau mot de passe']].map(([key,label])=><label key={key} className="block text-sm font-medium text-jr-texte">{label}<div className="relative mt-1.5"><input required type={showPasswords?'text':'password'} autoComplete={key==='currentPassword'?'current-password':'new-password'} value={password[key]} onChange={(e)=>setPassword((p)=>({...p,[key]:e.target.value}))} className="min-h-11 w-full rounded-lg border border-jr-bordure-forte bg-jr-champ px-3 pr-12 text-sm text-jr-texte outline-none focus:border-jr-focus focus:ring-2 focus:ring-jr-focus-anneau"/></div></label>)}<button type="button" onClick={()=>setShowPasswords((v)=>!v)} className="inline-flex items-center gap-2 text-sm font-medium text-jr-lien hover:underline">{showPasswords?<EyeOff size={16}/>:<Eye size={16}/>} {showPasswords?'Masquer les mots de passe':'Afficher les mots de passe'}</button><div className="flex justify-end"><button disabled={saving} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-jr-eau px-4 py-2 text-sm font-semibold text-white hover:bg-jr-eau-fonce disabled:opacity-60"><KeyRound size={16}/>{saving?'Modification…':'Modifier le mot de passe'}</button></div></form>}

            {!loading && section === 'apparence' && <div className="max-w-2xl space-y-5"><p className="text-sm leading-6 text-jr-doux">Choisissez une apparence adaptée à votre environnement. Le thème est appliqué immédiatement puis enregistré sur le serveur.</p><div className="grid gap-3 sm:grid-cols-3">{[{id:'clair',label:'Clair',description:'Fond clair JIRAMA',Icon:Sun},{id:'sombre',label:'Sombre',description:'Surfaces bleu nuit',Icon:Moon},{id:'system',label:'Automatique',description:'Selon le système',Icon:Monitor}].map(({id,label,description,Icon})=>{const active=settings.theme===id;return <button key={id} type="button" onClick={()=>{setSettings((p)=>({...p,theme:id}));if(id==='system')suivreSysteme();else definirTheme(id);}} className={`rounded-xl border p-4 text-left transition-all duration-150 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jr-focus motion-reduce:transform-none motion-reduce:transition-none ${active?'border-jr-eau bg-jr-eau-pale ring-1 ring-jr-eau':'border-jr-bordure bg-jr-surface hover:border-jr-bordure-forte'}`}><Icon size={21} className={active?'text-jr-lien':'text-jr-doux'}/><p className="mt-3 text-sm font-bold text-jr-texte">{label}</p><p className="mt-1 text-xs text-jr-doux">{description}</p>{active&&<p className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-jr-lien"><Check size={14}/>Sélectionné</p>}</button>})}</div><label className="flex items-start gap-3 rounded-lg border border-jr-bordure p-4"><input type="checkbox" checked={settings.compactMode} onChange={(e)=>setSettings((p)=>({...p,compactMode:e.target.checked}))} className="mt-1 h-4 w-4 accent-blue-700"/><span><span className="block text-sm font-semibold text-jr-texte">Affichage compact</span><span className="mt-1 block text-sm text-jr-doux">Réduire légèrement les espacements dans cette page.</span></span></label><label className="flex items-start gap-3 rounded-lg border border-jr-bordure p-4"><input type="checkbox" checked={settings.reduceMotion} onChange={(e)=>setSettings((p)=>({...p,reduceMotion:e.target.checked}))} className="mt-1 h-4 w-4 accent-blue-700"/><span><span className="block text-sm font-semibold text-jr-texte">Réduire les animations</span><span className="mt-1 block text-sm text-jr-doux">Privilégier les transitions minimales pour limiter les mouvements.</span></span></label><div className="flex justify-end"><button disabled={saving} onClick={savePreferences} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-jr-eau px-4 py-2 text-sm font-semibold text-white hover:bg-jr-eau-fonce disabled:opacity-60"><Save size={16}/>{saving?'Enregistrement…':'Enregistrer les préférences'}</button></div></div>}

            {!loading && section === 'notifications' && <div className="max-w-2xl space-y-4"><p className="text-sm leading-6 text-jr-doux">Ces préférences sont enregistrées par utilisateur. Les alertes métier obligatoires restent soumises aux règles de l’application.</p>{[{key:'anomalies',title:'Alertes d’anomalie',description:'Afficher les préférences associées aux anomalies de consommation.'},{key:'releves',title:'Informations sur les relevés',description:'Préférences liées à la saisie et au suivi des relevés.'},{key:'decisions',title:'Retours de traitement',description:'Préférences liées aux décisions prises sur les anomalies.'}].map((item)=><label key={item.key} className="flex items-start justify-between gap-4 rounded-lg border border-jr-bordure p-4"><span><span className="block text-sm font-semibold text-jr-texte">{item.title}</span><span className="mt-1 block text-sm text-jr-doux">{item.description}</span></span><input type="checkbox" checked={settings.notifications?.[item.key] !== false} onChange={(e)=>setSettings((p)=>({...p,notifications:{...p.notifications,[item.key]:e.target.checked}}))} className="mt-1 h-4 w-4 accent-blue-700"/></label>)}<div className="flex justify-end"><button disabled={saving} onClick={savePreferences} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-jr-eau px-4 py-2 text-sm font-semibold text-white hover:bg-jr-eau-fonce disabled:opacity-60"><Save size={16}/>{saving?'Enregistrement…':'Enregistrer les préférences'}</button></div></div>}

            {!loading && section === 'archives' && <div className="space-y-4">{loadingSection ? <p className="flex items-center gap-2 py-8 text-sm text-jr-doux"><LoaderCircle size={17} className="animate-spin motion-reduce:animate-none"/>Chargement des archives…</p> : archives.length===0 ? <div className="rounded-lg border border-dashed border-jr-bordure-forte p-8 text-center"><ArchiveRestore size={28} className="mx-auto text-jr-faible"/><h3 className="mt-3 text-sm font-bold text-jr-texte">Aucune notification archivée</h3><p className="mt-1 text-sm text-jr-doux">Les notifications que vous archivez seront conservées ici.</p></div> : <div className="space-y-3">{archives.map((n)=> <article key={n.id} className="rounded-lg border border-jr-bordure p-4 transition-colors hover:border-jr-bordure-forte motion-reduce:transition-none"><div className="flex flex-col gap-3 sm:flex-row sm:items-start"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-jr-texte">{n.sujet || 'Notification'}</h3><span className="rounded-md bg-jr-eau-pale px-2 py-1 text-xs font-semibold text-jr-lien">Archivée</span></div><p className="mt-2 whitespace-pre-line text-sm leading-6 text-jr-doux">{n.message || 'Aucun message.'}</p><p className="mt-2 text-xs text-jr-faible">Créée le {formatDate(n.created_at || n.date_envoi)}{n.archive_le ? ` · Archivée le ${formatDate(n.archive_le)}` : ''}</p></div><div className="flex shrink-0 flex-wrap gap-2"><button type="button" disabled={busyId!==null} onClick={()=>setConfirmAction({type:'restore',notification:n})} className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-jr-eau px-3 py-2 text-xs font-semibold text-white hover:bg-jr-eau-fonce disabled:opacity-50"><ArchiveRestore size={15}/>Désarchiver</button><button type="button" disabled={busyId!==null} onClick={()=>setConfirmAction({type:'delete',notification:n})} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-jr-err-bordure px-3 py-2 text-xs font-semibold text-jr-err hover:bg-jr-err-pale disabled:opacity-50"><Trash2 size={15}/>Supprimer</button></div></div></article>)}</div>}</div>}

            {!loading && (section === 'activite' || section === 'audit') && <div className="space-y-3">{loadingSection ? <p className="flex items-center gap-2 py-8 text-sm text-jr-doux"><LoaderCircle size={17} className="animate-spin motion-reduce:animate-none"/>Chargement du journal…</p> : auditLogs.length===0 ? <div className="rounded-lg border border-dashed border-jr-bordure-forte p-8 text-center"><Clock3 size={28} className="mx-auto text-jr-faible"/><h3 className="mt-3 text-sm font-bold text-jr-texte">Aucune activité enregistrée</h3><p className="mt-1 text-sm text-jr-doux">Les actions prises en charge par le journal apparaîtront ici.</p></div> : <div className="overflow-x-auto rounded-lg border border-jr-bordure"><table className="w-full min-w-[620px] text-left text-sm"><thead className="bg-jr-fond text-xs uppercase tracking-wide text-jr-faible"><tr>{(role==='ADMINISTRATEUR'?['Utilisateur','Action','Date']:['Action','Date']).map(x=><th key={x} className="px-4 py-3 font-semibold">{x}</th>)}</tr></thead><tbody className="divide-y divide-jr-bordure">{auditLogs.map((l)=><tr key={l.id} className="transition-colors hover:bg-jr-champ motion-reduce:transition-none">{role==='ADMINISTRATEUR'&&<td className="px-4 py-3"><p className="font-medium text-jr-texte">{[l.prenom,l.nom].filter(Boolean).join(' ')||'Utilisateur supprimé'}</p><p className="text-xs text-jr-faible">{l.actor_role||'—'}</p></td>}<td className="px-4 py-3"><p className="font-medium text-jr-texte">{String(l.action||'Action').replaceAll('_',' ')}</p><p className="mt-1 text-xs text-jr-doux">{l.resource_type||'Paramètres'}{l.resource_id?` · ${l.resource_id}`:''}</p></td><td className="px-4 py-3 text-jr-doux">{formatDate(l.created_at)}</td></tr>)}</tbody></table></div>}</div>}
          </div>
        </section>
      </div>

      {confirmAction && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4" role="presentation" onMouseDown={(e)=>{if(e.target===e.currentTarget && busyId===null)setConfirmAction(null);}}><div role="dialog" aria-modal="true" aria-labelledby="settings-confirm-title" className="w-full max-w-md rounded-xl border border-jr-bordure bg-jr-surface p-5 shadow-2xl"><h2 id="settings-confirm-title" className="text-lg font-bold text-jr-titre">{confirmAction.type==='restore'?'Désarchiver la notification ?':'Supprimer la notification ?'}</h2><p className="mt-2 text-sm leading-6 text-jr-doux">{confirmAction.type==='restore'?'La notification retournera dans votre liste active sans modifier son état de lecture.':'Cette action retirera la notification de votre liste. Le relevé et l’anomalie associés seront conservés.'}</p><p className="mt-3 rounded-lg bg-jr-fond p-3 text-sm font-semibold text-jr-texte">{confirmAction.notification?.sujet || 'Notification'}</p><div className="mt-5 flex justify-end gap-2"><button type="button" disabled={busyId!==null} onClick={()=>setConfirmAction(null)} className="min-h-10 rounded-lg border border-jr-bordure-forte px-4 py-2 text-sm font-semibold text-jr-doux hover:bg-jr-champ disabled:opacity-50">Annuler</button><button type="button" disabled={busyId!==null} onClick={changeArchive} className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${confirmAction.type==='delete'?'bg-red-700 hover:bg-red-800':'bg-jr-eau hover:bg-jr-eau-fonce'}`}>{busyId!==null?<LoaderCircle size={16} className="animate-spin"/>:confirmAction.type==='restore'?<ArchiveRestore size={16}/>:<Trash2 size={16}/>} {busyId!==null?'Traitement…':confirmAction.type==='restore'?'Oui, désarchiver':'Oui, supprimer'}</button></div></div></div>}
    </main>
  );
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const [user] = useState(readUser);
  const role = String(user?.role || '').trim().toUpperCase();
  const [sidebarOpen,setSidebarOpen] = useState(false);
  if (role === 'AGENT') return <AgentLayout title="Paramètres"><SettingsContent role={role}/></AgentLayout>;
  if (role === 'RESPONSABLE') return <ResponsableLayout title="Paramètres"><SettingsContent role={role}/></ResponsableLayout>;
  const logout=()=>{localStorage.removeItem('token');localStorage.removeItem('user');navigate('/',{replace:true});};
  return <AdminShell intensite="calme"><div className="min-h-screen"><Sidebar isOpen={sidebarOpen} onClose={()=>setSidebarOpen(false)} activePath="/dashboard/admin/parametres" onNavigate={navigate} onLogout={logout} user={user}/><div className="lg:pl-72"><Header onOpenSidebar={()=>setSidebarOpen(true)} onProfile={()=>navigate('/dashboard/admin/parametres?section=profil')} onNotifications={()=>navigate('/dashboard/admin/notifications')} notificationCount={0} user={user}/><SettingsContent role={role || 'ADMINISTRATEUR'}/></div></div></AdminShell>;
}
