import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArchiveRestore,
  Bell,
  CheckCircle2,
  Clock3,
  RefreshCw,
  Trash2,
  TriangleAlert,
  Droplets,
  Zap,
} from 'lucide-react';

import axiosClient from '../../api/axiosClient.js';
import AdminShell from '../../components/admin/AdminShell.jsx';
import Sidebar from '../../components/admin/Sidebar.jsx';
import Header from '../../components/admin/Header.jsx';
import AgentLayout from '../../components/admin/agent/AgentLayout.jsx';
import ResponsableLayout from '../../components/admin/responsable/ResponsableLayout.jsx';
import NotificationConfirmDialog from '../../components/notifications/NotificationConfirmDialog.jsx';
import { signalerChangementNotifications } from '../../components/admin/agent/notificationsAgent.js';
import { signalerChangementNotificationsResponsable } from '../../components/admin/responsable/notificationsResponsable.js';

function readStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null');
  } catch {
    return null;
  }
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
}

function roleBase(role) {
  if (role === 'AGENT') return '/dashboard/agent';
  if (role === 'RESPONSABLE') return '/dashboard/responsable';
  return '/dashboard/admin';
}

function ArchiveContent({ role }) {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadArchives = useCallback(async (refresh = false) => {
    try {
      setError('');
      refresh ? setRefreshing(true) : setLoading(true);
      const response = await axiosClient.get('/notifications', {
        params: { vue: 'archivees' },
      });
      if (response.data?.status !== 'success') {
        throw new Error(response.data?.message || 'Impossible de charger les archives.');
      }
      const items = response.data?.notifications ?? response.data?.data;
      if (!Array.isArray(items)) throw new Error('La liste des archives renvoyée par le serveur est invalide.');
      setNotifications(items);
    } catch (requestError) {
      if ([401, 403].includes(requestError.response?.status)) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/', { replace: true });
        return;
      }
      setError(requestError.response?.data?.message || requestError.message || 'Impossible de charger les archives.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadArchives();
  }, [loadArchives]);

  const restoreNotification = async (notification) => {
    if (!notification || busyId !== null) return;
    try {
      setBusyId(notification.id);
      setError('');
      setSuccess('');
      const response = await axiosClient.patch(`/notifications/${notification.id}/desarchiver`);
      if (response.data?.status !== 'success') {
        throw new Error(response.data?.message || 'Impossible de restaurer cette notification.');
      }
      setNotifications((previous) => previous.filter((item) => String(item.id) !== String(notification.id)));
      if (role === 'AGENT') signalerChangementNotifications({ source: 'desarchivage', id: notification.id });
      if (role === 'RESPONSABLE') signalerChangementNotificationsResponsable({ source: 'desarchivage', id: notification.id });
      setSuccess(response.data?.message || 'Notification restaurée dans la liste active.');
    } catch (requestError) {
      if ([401, 403].includes(requestError.response?.status)) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/', { replace: true });
        return;
      }
      setError(requestError.response?.data?.message || requestError.message || 'Impossible de restaurer cette notification.');
    } finally {
      setBusyId(null);
    }
  };

  const deleteNotification = async () => {
    if (!pendingDelete || busyId !== null) return;
    const notification = pendingDelete;
    try {
      setBusyId(notification.id);
      setError('');
      setSuccess('');
      const response = await axiosClient.delete(`/notifications/${notification.id}`);
      if (response.data?.status !== 'success') {
        throw new Error(response.data?.message || 'Impossible de supprimer cette notification.');
      }
      setNotifications((previous) => previous.filter((item) => String(item.id) !== String(notification.id)));
      if (role === 'AGENT') signalerChangementNotifications({ source: 'suppression', id: notification.id });
      if (role === 'RESPONSABLE') signalerChangementNotificationsResponsable({ source: 'suppression', id: notification.id });
      setPendingDelete(null);
      setSuccess(response.data?.message || 'Notification supprimée de votre liste.');
    } catch (requestError) {
      if ([401, 403].includes(requestError.response?.status)) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/', { replace: true });
        return;
      }
      setPendingDelete(null);
      setError(requestError.response?.data?.message || requestError.message || 'Impossible de supprimer cette notification.');
    } finally {
      setBusyId(null);
    }
  };

  const activePath = `${roleBase(role)}/notifications`;

  return (
    <main className="mx-auto w-full max-w-6xl space-y-5 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col justify-between gap-4 border-b border-jr-bordure pb-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-jr-lien">Paramètres / Notifications</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-jr-titre sm:text-3xl">Notifications archivées</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-jr-doux">
            Retrouvez les notifications mises de côté et restaurez-les dans votre liste active sans modifier leur état de lecture.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-lg border border-jr-bordure bg-jr-surface px-3 py-2 text-sm font-semibold text-jr-doux">
            <ArchiveRestore size={16} /> {notifications.length} archive(s)
          </span>
          <button
            type="button"
            onClick={() => loadArchives(true)}
            disabled={refreshing || loading}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-jr-bordure-forte bg-jr-surface px-3 py-2 text-sm font-semibold text-jr-texte transition-colors hover:bg-jr-champ disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin motion-reduce:animate-none' : ''} /> Actualiser
          </button>
          <button
            type="button"
            onClick={() => navigate(activePath)}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-jr-eau px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-jr-eau-fonce focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jr-focus focus-visible:ring-offset-2 motion-reduce:transition-none"
          >
            <Bell size={16} /> Notifications actives
          </button>
        </div>
      </header>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-jr-err-bordure bg-jr-err-pale p-3 text-sm text-jr-err">
          <TriangleAlert size={17} className="mt-0.5 shrink-0" /> <span>{error}</span>
        </div>
      )}
      {success && (
        <div role="status" className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
          <CheckCircle2 size={17} className="mt-0.5 shrink-0" /> <span>{success}</span>
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-jr-bordure bg-jr-surface p-10 text-center text-sm text-jr-faible">Chargement des notifications archivées…</div>
      ) : notifications.length === 0 ? (
        <section className="rounded-xl border border-dashed border-jr-bordure-forte bg-jr-surface/90 p-10 text-center">
          <ArchiveRestore size={30} className="mx-auto text-jr-faible" />
          <h2 className="mt-3 text-base font-semibold text-jr-titre">Aucune notification archivée</h2>
          <p className="mx-auto mt-1 max-w-xl text-sm leading-6 text-jr-doux">Cette liste affiche uniquement les notifications archivées pour votre compte. Pour en ajouter une, ouvrez les notifications actives et choisissez « Archiver ». Si vous aviez déjà archivé des notifications avant la correction, appliquez la migration SQL 004 pour rattacher les anciennes notifications enregistrées par rôle à leurs destinataires.</p>
        </section>
      ) : (
        <section className="space-y-3" aria-label="Liste des notifications archivées">
          {notifications.map((notification) => {
            const water = String(notification.type_compteur || '').toUpperCase() === 'EAU';
            const unread = String(notification.statut || '').toUpperCase() === 'EN_ATTENTE';
            return (
              <article key={notification.id} className="rounded-xl border border-jr-bordure bg-jr-surface/95 p-4 shadow-sm transition-colors hover:border-jr-bordure-forte motion-reduce:transition-none sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${water ? 'bg-jr-eau-pale text-jr-lien' : 'bg-jr-elec-pale text-jr-attention'}`} aria-hidden="true">
                    {notification.anomalie_id ? <TriangleAlert size={19} /> : water ? <Droplets size={19} /> : <Zap size={19} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h2 className="font-semibold text-jr-titre">{notification.sujet || 'Notification sans titre'}</h2>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="rounded-md border border-jr-bordure px-2 py-1 text-jr-doux">{unread ? 'Non lue' : 'Lue'}</span>
                        {notification.type && <span className="rounded-md bg-jr-champ px-2 py-1 text-jr-doux">{notification.type}</span>}
                      </div>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-jr-doux">{notification.message || 'Aucun message disponible.'}</p>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-jr-faible">
                      <span className="inline-flex items-center gap-1.5"><Clock3 size={13} /> Créée le {formatDate(notification.created_at || notification.date_envoi)}</span>
                      <span>Archivée le {formatDate(notification.archive_le)}</span>
                      {notification.numero_compteur && <span>Référence client : <strong className="font-semibold text-jr-doux">{notification.numero_compteur}</strong></span>}
                      {(notification.nom_abonne || notification.prenom_abonne) && <span>Abonné : <strong className="font-semibold text-jr-doux">{[notification.nom_abonne, notification.prenom_abonne].filter(Boolean).join(' ')}</strong></span>}
                      {notification.anomalie_id && <span>Anomalie #{notification.anomalie_id}</span>}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col">
                    <button type="button" onClick={() => restoreNotification(notification)} disabled={busyId !== null} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-jr-eau px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-jr-eau-fonce disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none">
                      <ArchiveRestore size={16} /> {busyId === notification.id ? 'Restauration…' : 'Désarchiver'}
                    </button>
                    <button type="button" onClick={() => setPendingDelete(notification)} disabled={busyId !== null} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-jr-err-bordure bg-jr-err-pale px-3 py-2 text-sm font-semibold text-jr-err transition-colors hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none">
                      <Trash2 size={16} /> Supprimer
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}

      <NotificationConfirmDialog
        open={Boolean(pendingDelete)}
        action="supprimer"
        notification={pendingDelete}
        loading={busyId !== null}
        onCancel={() => { if (busyId === null) setPendingDelete(null); }}
        onConfirm={deleteNotification}
      />
    </main>
  );
}

function AdminArchiveLayout({ children }) {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user] = useState(readStoredUser);
  const [notificationCount, setNotificationCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    axiosClient.get('/notifications/count')
      .then((response) => {
        if (!cancelled) setNotificationCount(Number(response.data?.count ?? response.data?.unreadCount ?? 0));
      })
      .catch(() => { if (!cancelled) setNotificationCount(0); });
    return () => { cancelled = true; };
  }, []);

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/', { replace: true });
  };

  return (
    <AdminShell intensite="calme">
      <div className="min-h-screen">
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          activePath="/dashboard/admin/parametres"
          onNavigate={navigate}
          onLogout={logout}
          user={user}
        />
        <div className="lg:pl-72">
          <Header
            onOpenSidebar={() => setSidebarOpen(true)}
            onProfile={() => navigate('/dashboard/admin/parametres')}
            onNotifications={() => navigate('/dashboard/admin/notifications')}
            notificationCount={notificationCount}
            user={user}
          />
          {children}
        </div>
      </div>
    </AdminShell>
  );
}

export default function NotificationsArchivesPage({ role = 'ADMINISTRATEUR' }) {
  const normalizedRole = String(role || '').trim().toUpperCase();
  const content = <ArchiveContent role={normalizedRole} />;
  if (normalizedRole === 'AGENT') {
    return <AgentLayout title="Paramètres — Notifications archivées">{content}</AgentLayout>;
  }
  if (normalizedRole === 'RESPONSABLE') {
    return <ResponsableLayout title="Paramètres — Notifications archivées">{content}</ResponsableLayout>;
  }
  return <AdminArchiveLayout>{content}</AdminArchiveLayout>;
}
