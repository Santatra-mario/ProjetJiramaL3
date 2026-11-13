import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CalendarDays, CheckCircle2, ClipboardCheck, ExternalLink, Gauge, MapPin, RefreshCw, Search, TriangleAlert, Users } from 'lucide-react';
import axiosClient from '../../api/axiosClient';
import AgentLayout from '../../components/admin/agent/AgentLayout';
import { ecouterChangementAbonnes } from '../../hooks/abonnesSync.js';

const STATUTS = {
  EN_ATTENTE: { label: 'En attente', cls: 'border-slate-300 bg-slate-100 text-slate-700' },
  PLANIFIEE: { label: 'Planifiée', cls: 'border-blue-200 bg-blue-50 text-blue-800' },
  EN_COURS: { label: 'En cours', cls: 'border-amber-200 bg-amber-50 text-amber-800' },
  TERMINEE: { label: 'Terminée', cls: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  A_REPROGRAMMER: { label: 'À reprogrammer', cls: 'border-orange-200 bg-orange-50 text-orange-800' },
  ANNULEE: { label: 'Annulée', cls: 'border-red-200 bg-red-50 text-red-800' },
};

/* Résultat réellement constaté pendant la visite. */
const RESULTATS_VISITE = {
  RELEVE_ENREGISTRE: 'Index relevé et enregistré',
  ABONNE_ABSENT: 'Abonné absent',
  COMPTEUR_INACCESSIBLE: 'Compteur inaccessible',
  INDEX_ILLISIBLE: 'Index illisible',
  COMPTEUR_A_INTERVENIR: 'Compteur nécessitant une intervention technique',
  AUTRE: 'Autre situation signalée',
};

const MOTIFS_EMPECHEMENT = [
  ['ABONNE_ABSENT', 'Abonné absent'],
  ['COMPTEUR_INACCESSIBLE', 'Compteur inaccessible'],
  ['INDEX_ILLISIBLE', 'Index illisible'],
  ['COMPTEUR_A_INTERVENIR', 'Compteur à intervenir'],
  ['AUTRE', 'Autre situation'],
];

const dateTexte = (value) => {
  if (!value) return 'Date à définir';
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? 'Date invalide'
    : date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
};

const coordonneesValides = (mission) => {
  if (mission.latitude === null || mission.latitude === undefined || mission.longitude === null || mission.longitude === undefined || mission.latitude === '' || mission.longitude === '') return false;
  const latitude = Number(mission.latitude);
  const longitude = Number(mission.longitude);
  return Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
};

const dateDuJour = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: import.meta.env.VITE_APP_TIME_ZONE || 'Indian/Antananarivo',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};

const estEnRetard = (mission) => {
  const deadline = mission.date_limite || mission.date_prevue;
  return ['PLANIFIEE', 'EN_COURS', 'A_REPROGRAMMER'].includes(mission.statut)
    && Boolean(deadline) && String(deadline).slice(0, 10) < dateDuJour();
};

const jourDuCycle = (mission) => {
  const date = String(mission?.date_prevue || '').slice(0, 10);
  const debut = String(mission?.date_debut || '').slice(0, 10);
  if (!date || !debut) return null;
  const offset = Math.round(
    (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${debut}T00:00:00Z`)) / 86400000
  );
  if (!Number.isFinite(offset) || offset < 0) return null;
  return (offset % 3) + 1;
};

function MissionCard({ mission, onStart, onReprogram, onRead }) {
  const [motif, setMotif] = useState('');
  const [resultat, setResultat] = useState('ABONNE_ABSENT');
  const [dateVisiteReelle, setDateVisiteReelle] = useState(
    mission.date_visite_reelle || dateDuJour()
  );
  const [showReason, setShowReason] = useState(false);
  const status = STATUTS[mission.statut] || STATUTS.EN_ATTENTE;
  const canAct = mission.statut_campagne === 'PUBLIEE'
    && String(mission.statut_abonne || '').trim().toLowerCase() === 'actif';
  const hasGps = coordonneesValides(mission);
  const mapUrl = hasGps
    ? `https://www.openstreetmap.org/?mlat=${mission.latitude}&mlon=${mission.longitude}#map=18/${mission.latitude}/${mission.longitude}`
    : null;

  useEffect(() => {
    setDateVisiteReelle(mission.date_visite_reelle || dateDuJour());
  }, [mission.id, mission.date_visite_reelle]);

  return (
    <article className="rounded-xl border border-jr-bordure bg-jr-surface p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-jr-titre">
            {mission.abonne_prenom} {mission.abonne_nom}
            <span className="ml-2 font-normal text-jr-faible">{mission.numero_abonne}</span>
          </p>
          <p className="mt-1 text-sm text-jr-texte">
            Compteur {mission.numero_compteur} · {mission.type_compteur === 'EAU' ? 'Eau' : 'Électricité'}
          </p>
        </div>
        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${status.cls}`}>
          {status.label}
        </span>
        {estEnRetard(mission) && <span className="inline-flex rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-800">En retard</span>}
      </div>

      <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-jr-faible">Date de visite prévue</dt>
          <dd className="mt-1 flex items-center gap-2 text-jr-texte"><CalendarDays size={15} />{dateTexte(mission.date_prevue)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-jr-faible">Date limite d’exécution</dt>
          <dd className="mt-1 text-jr-texte">{dateTexte(mission.date_limite)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-jr-faible">Date de visite réelle</dt>
          <dd className="mt-1 text-jr-texte">{mission.date_visite_reelle ? dateTexte(mission.date_visite_reelle) : 'Visite non encore effectuée'}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-jr-faible">Dernier index valide</dt>
          <dd className="mt-1 text-jr-texte">
            {mission.dernier_index !== null && mission.dernier_index !== undefined
              ? Number(mission.dernier_index).toLocaleString('fr-FR')
              : 'Non disponible'}
            {mission.dernier_releve ? ` · relevé du ${dateTexte(mission.dernier_releve)}` : ''}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-jr-faible">Quartier</dt>
          <dd className="mt-1 text-jr-texte">{mission.quartier || 'Quartier non renseigné'}{mission.commune ? ` · ${mission.commune}` : ''}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs font-semibold uppercase tracking-wide text-jr-faible">Adresse</dt>
          <dd className="mt-1 flex items-start gap-2 text-jr-texte">
            <MapPin size={15} className="mt-0.5 shrink-0 text-jr-lien" />
            <span>{mission.adresse || 'Adresse incomplète'}</span>
            {mapUrl ? (
              <a className="ml-auto inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-jr-lien underline underline-offset-2" href={mapUrl} target="_blank" rel="noreferrer">
                Carte <ExternalLink size={13} />
              </a>
            ) : <span className="ml-auto shrink-0 text-xs text-jr-faible">Géolocalisation indisponible</span>}
          </dd>
        </div>
      </dl>

      {mission.observations && (
        <p className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
          Consignes du Responsable : {mission.observations}
        </p>
      )}
      {['PLANIFIEE', 'EN_COURS'].includes(mission.statut) && canAct && (
        <p className="mt-3 text-xs leading-5 text-jr-doux">
          Sur place : vérifiez l’identité de l’abonné et le numéro du compteur, relevez l’index réel et sa date, puis enregistrez le résultat. Si l’index ne peut pas être relevé, enregistrez la visite avec le résultat constaté : la consommation ne sera pas comptée comme vérifiée.
        </p>
      )}
      {!canAct && mission.statut !== 'TERMINEE' && (
        <p role="status" className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Cette mission reste visible dans vos contrôles, mais ne peut pas être exécutée car le planning est clôturé ou l’abonné n’est plus actif. Contactez le Responsable.
        </p>
      )}
      {mission.motif_reprogrammation && (
        <p className="mt-4 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-900">
          Motif de reprogrammation : {mission.motif_reprogrammation}
        </p>
      )}
      {mission.releve_exploitable && (
        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-900">
          <p className="flex items-center gap-2 font-semibold"><CheckCircle2 size={16} />Votre intervention a été enregistrée et transmise au Responsable.</p>
          <p className="mt-1">
            Consommation vérifiée
            {mission.date_releve_realisee ? ` · relevé du ${dateTexte(mission.date_releve_realisee)}` : ''}
            {mission.index_releve !== null && mission.index_releve !== undefined
              ? ` · index ${Number(mission.index_releve).toLocaleString('fr-FR')}`
              : ''}
            {mission.consommation_releve !== null && mission.consommation_releve !== undefined
              ? ` · ${Number(mission.consommation_releve).toLocaleString('fr-FR')} consommés`
              : ''}.
          </p>
        </div>
      )}
      {mission.releve_id && mission.type_releve === 'INITIAL' && (
        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-900">
          <p className="flex items-center gap-2 font-semibold"><CheckCircle2 size={16} />Premier relevé enregistré et transmis au Responsable.</p>
          <p className="mt-1">
            Index initial
            {mission.index_releve !== null && mission.index_releve !== undefined
              ? ` ${Number(mission.index_releve).toLocaleString('fr-FR')}`
              : ''}
            {mission.date_releve_realisee ? ` · relevé du ${dateTexte(mission.date_releve_realisee)}` : ''}.
            La consommation sera calculée à partir du prochain relevé : aucun ancien index ni aucune consommation n’a été inventé.
          </p>
        </div>
      )}
      {mission.releve_id && !mission.releve_exploitable && mission.type_releve !== 'INITIAL' && (
        <p role="status" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
          Un relevé est associé à cette mission, mais ses données ne permettent pas de confirmer une consommation vérifiée.
        </p>
      )}
      {!mission.releve_id && mission.statut === 'A_REPROGRAMMER' && mission.date_visite_reelle && (
        <div className="mt-3 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2.5 text-sm text-orange-900">
          <p className="flex items-center gap-2 font-semibold"><CheckCircle2 size={16} />Visite effectuée et transmise au Responsable le {dateTexte(mission.date_visite_reelle)}.</p>
          <p className="mt-1">Consommation non vérifiée : {mission.resultat_visite ? (RESULTATS_VISITE[mission.resultat_visite] || mission.resultat_visite) : 'situation signalée'}. Le Responsable doit examiner ce dossier.</p>
        </div>
      )}
      {mission.suivi_periodique && (
        <p className="mt-3 text-xs font-medium text-jr-doux">Suivi périodique activé : le prochain contrôle sera préparé trois jours après la visite réelle.</p>
      )}

      <div className="mt-5 flex flex-wrap gap-2 border-t border-jr-bordure pt-4">
        {mission.statut === 'PLANIFIEE' && (
          <button type="button" onClick={() => onStart(mission)} disabled={!canAct} className="jr-btn jr-btn-bleu rounded-md px-3.5 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50">
            Démarrer le contrôle
          </button>
        )}
        {['PLANIFIEE', 'EN_COURS'].includes(mission.statut) && (
          <>
            <button type="button" onClick={() => onRead(mission)} disabled={!canAct} className="jr-btn jr-btn-elec rounded-md px-3.5 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50">
              Saisir le relevé réel
            </button>
            <button type="button" onClick={() => setShowReason((value) => !value)} disabled={!canAct} className="rounded-md border border-jr-bordure px-3.5 py-2.5 text-sm font-semibold text-jr-doux hover:bg-jr-eau-pale disabled:cursor-not-allowed disabled:opacity-50">
              Visite sans index exploitable
            </button>
          </>
        )}
      </div>
      {showReason && canAct && (
        <form onSubmit={(event) => { event.preventDefault(); onReprogram(mission, motif, resultat, dateVisiteReelle); }} className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,14rem)_1fr_auto]">
          <label className="text-sm font-medium text-jr-doux">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-jr-faible">Date réelle de visite</span>
            <input type="date" required max={dateDuJour()} value={dateVisiteReelle} onChange={(event) => setDateVisiteReelle(event.target.value)} className="jr-field w-full rounded-md border px-3 py-2.5 text-sm" />
          </label>
          <label className="text-sm font-medium text-jr-doux">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-jr-faible">Résultat constaté</span>
            <select value={resultat} onChange={(event) => setResultat(event.target.value)} className="jr-field w-full rounded-md border px-3 py-2.5 text-sm">
              {MOTIFS_EMPECHEMENT.map(([valeur, libelle]) => <option key={valeur} value={valeur}>{libelle}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-jr-doux">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-jr-faible">Précision transmise au Responsable</span>
            <textarea id={`motif-${mission.id}`} rows={2} minLength={3} required value={motif} onChange={(event) => setMotif(event.target.value)} placeholder="Adresse incorrecte, accès impossible, compteur inaccessible…" className="jr-field w-full rounded-md border px-3 py-2.5 text-sm" />
          </label>
          <button type="submit" className="self-end rounded-md border border-orange-300 bg-orange-50 px-3 py-2.5 text-sm font-semibold text-orange-900 hover:bg-orange-100">Enregistrer et transmettre</button>
        </form>
      )}
    </article>
  );
}

function MissionsAgent() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedMissionId = searchParams.get('mission');
  const [missions, setMissions] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [quarterFilter, setQuarterFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const utilisateur = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; }
  }, []);
  const identiteAgent = [utilisateur?.prenom, utilisateur?.nom].filter(Boolean).join(' ');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (requestedMissionId) {
        if (!/^\d+$/.test(requestedMissionId)) {
          setMissions([]);
          setError('Identifiant de mission invalide.');
          return;
        }
        const response = await axiosClient.get(`/agent/missions/${requestedMissionId}`);
        setMissions(response.data?.data ? [response.data.data] : []);
      } else {
        const response = await axiosClient.get('/agent/missions');
        setMissions(Array.isArray(response.data?.data) ? response.data.data : []);
      }
    } catch (requestError) {
      setMissions([]);
      setError(requestError.response?.data?.message || 'Impossible de charger vos missions.');
    } finally {
      setLoading(false);
    }
  }, [requestedMissionId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => ecouterChangementAbonnes(() => load()), [load]);

  const quarters = useMemo(() => [...new Set(missions.map((mission) => mission.quartier).filter(Boolean))].sort(), [missions]);
  const datesDisponibles = useMemo(
    () => [...new Set(missions.map((mission) => String(mission.date_prevue || '').slice(0, 10)).filter(Boolean))].sort(),
    [missions]
  );
  const visibleMissions = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return missions.filter((mission) =>
      (!statusFilter || mission.statut === statusFilter)
      && (!quarterFilter || (quarterFilter === '__none__' ? !mission.quartier : mission.quartier === quarterFilter))
      && (!dateFilter || String(mission.date_prevue || '').slice(0, 10) === dateFilter)
      && (!needle || [mission.abonne_nom, mission.abonne_prenom, mission.numero_abonne, mission.numero_compteur, mission.adresse, mission.quartier]
        .some((valeur) => String(valeur || '').toLowerCase().includes(needle)))
    );
  }, [missions, statusFilter, quarterFilter, dateFilter, search]);

  /* Indicateurs calculés sur l’ensemble des missions attribuées, jamais sur
     la seule page affichée. Un abonné peut avoir plusieurs compteurs. */
  const indicateurs = useMemo(() => ({
    missions: missions.length,
    abonnes: new Set(missions.map((mission) => mission.abonne_id)).size,
    compteurs: new Set(missions.map((mission) => mission.compteur_id)).size,
    enAttente: missions.filter((mission) => ['EN_ATTENTE', 'PLANIFIEE', 'EN_COURS'].includes(mission.statut)).length,
    realisees: missions.filter((mission) => Boolean(mission.date_visite_reelle)).length,
  }), [missions]);

  /* Les missions sont regroupées par campagne puis par journée de descente
     (Jour 2 / Jour 3) et triées par quartier puis par abonné. */
  const groupesMissions = useMemo(() => {
    const groupes = new Map();
    for (const mission of visibleMissions) {
      const cle = `${mission.campagne_id}|${mission.date_prevue || 'sans-date'}`;
      if (!groupes.has(cle)) {
        groupes.set(cle, {
          cle,
          date: String(mission.date_prevue || '').slice(0, 10),
          dateDebut: String(mission.date_debut || '').slice(0, 10),
          dateFin: String(mission.date_fin || '').slice(0, 10),
          statutCampagne: mission.statut_campagne || '',
          jour: jourDuCycle(mission),
          quartiers: [],
          missions: [],
        });
      }
      const groupe = groupes.get(cle);
      groupe.missions.push(mission);
      if (mission.quartier && !groupe.quartiers.includes(mission.quartier)) {
        groupe.quartiers.push(mission.quartier);
      }
    }
    return [...groupes.values()].map((groupe) => ({
      ...groupe,
      quartiers: [...groupe.quartiers].sort((a, b) => a.localeCompare(b, 'fr')),
      missions: [...groupe.missions].sort((a, b) => (
        String(a.quartier || '').localeCompare(String(b.quartier || ''), 'fr')
        || String(a.abonne_nom || '').localeCompare(String(b.abonne_nom || ''), 'fr')
      )),
    }));
  }, [visibleMissions]);

  async function updateStatus(mission, status, motif = '', resultatVisite = null, dateVisiteReelle = null) {
    setSavingId(mission.id);
    setError('');
    setNotice('');
    try {
      const response = await axiosClient.patch(`/agent/missions/${mission.id}/statut`, {
        statut: status,
        motif,
        ...(resultatVisite ? { resultat_visite: resultatVisite } : {}),
        ...(dateVisiteReelle ? { date_visite_reelle: dateVisiteReelle } : {}),
      });
      setNotice(response.data?.message || 'Mission mise à jour.');
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Impossible de mettre à jour cette mission.');
    } finally {
      setSavingId(null);
    }
  }

  return (
    <AgentLayout title="Mes contrôles">
      <div className="mx-auto max-w-6xl space-y-6">
        {requestedMissionId && <p className="rounded-lg border border-jr-eau-bordure bg-jr-eau-pale px-4 py-3 text-sm font-semibold text-jr-doux">Détail de la mission #{requestedMissionId} qui vous est attribuée.</p>}
        <section className="flex flex-wrap items-end justify-between gap-4 rounded-xl border border-jr-bordure bg-jr-surface p-5 shadow-sm">
          <div>
            <h2 className="text-lg font-bold text-jr-titre">Missions attribuées</h2>
            <p className="mt-1 max-w-2xl text-sm text-jr-faible">Seuls les contrôles attribués à votre compte sont affichés. La date prévue reste distincte de la date réelle du relevé.</p>
            {identiteAgent && (
              <p className="mt-1 text-sm font-semibold text-jr-doux">
                Agent : {identiteAgent}{utilisateur?.identifiant ? ` · ${utilisateur.identifiant}` : ''}
              </p>
            )}
          </div>
          <button type="button" onClick={load} disabled={loading} className="inline-flex items-center gap-2 rounded-md border border-jr-bordure px-3 py-2 text-sm font-semibold text-jr-doux hover:bg-jr-eau-pale disabled:opacity-60">
            <RefreshCw size={15} className={loading ? 'animate-spin motion-reduce:animate-none' : ''} />Actualiser
          </button>
        </section>

        {/* Indicateurs calculés sur toutes les missions attribuées à l’agent
            (jamais sur la page courante) : un abonné peut avoir plusieurs compteurs. */}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Volumes de vos missions">
          <IndicateurMission icone={ClipboardCheck} libelle="Missions attribuées" valeur={indicateurs.missions} detail={`${indicateurs.enAttente} en attente de contrôle`} />
          <IndicateurMission icone={Users} libelle="Abonnés affectés" valeur={indicateurs.abonnes} detail="Personnes à visiter" />
          <IndicateurMission icone={Gauge} libelle="Compteurs à contrôler" valeur={indicateurs.compteurs} detail="Eau et électricité" />
          <IndicateurMission icone={CheckCircle2} libelle="Interventions réalisées" valeur={indicateurs.realisees} detail="Date réelle enregistrée" />
        </section>

        <div className="flex flex-wrap gap-3">
          <label className="text-sm font-medium text-jr-doux">
            <span className="mb-1 block text-xs uppercase tracking-wide text-jr-faible">Rechercher</span>
            <span className="relative block">
              <Search size={15} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-jr-faible" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Abonné, référence, compteur, adresse…"
                aria-label="Rechercher un abonné ou un compteur dans mes missions"
                className="jr-field min-w-64 rounded-md border py-2.5 pl-9 pr-3 text-sm"
              />
            </span>
          </label>
          <label className="text-sm font-medium text-jr-doux">
            <span className="mb-1 block text-xs uppercase tracking-wide text-jr-faible">Statut</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="jr-field min-w-44 rounded-md border px-3 py-2.5">
              <option value="">Tous les statuts</option>
              {Object.entries(STATUTS).filter(([status]) => status !== 'ANNULEE').map(([status, value]) => <option key={status} value={status}>{value.label}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-jr-doux">
            <span className="mb-1 block text-xs uppercase tracking-wide text-jr-faible">Quartier</span>
            <select value={quarterFilter} onChange={(event) => setQuarterFilter(event.target.value)} className="jr-field min-w-44 rounded-md border px-3 py-2.5">
              <option value="">Tous les quartiers</option>
              {quarters.map((quarter) => <option key={quarter} value={quarter}>{quarter}</option>)}
              {missions.some((mission) => !mission.quartier) && <option value="__none__">Quartier non renseigné</option>}
            </select>
          </label>
          <label className="text-sm font-medium text-jr-doux">
            <span className="mb-1 block text-xs uppercase tracking-wide text-jr-faible">Journée</span>
            <select value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} className="jr-field min-w-44 rounded-md border px-3 py-2.5">
              <option value="">Toutes les journées</option>
              {datesDisponibles.map((date) => <option key={date} value={date}>{dateTexte(date)}</option>)}
            </select>
          </label>
          {(search || dateFilter || statusFilter || quarterFilter) ? (
            <button
              type="button"
              onClick={() => { setSearch(''); setDateFilter(''); setStatusFilter(''); setQuarterFilter(''); }}
              className="self-end rounded-md border border-jr-bordure px-3 py-2.5 text-sm font-semibold text-jr-doux hover:bg-jr-eau-pale"
            >
              Réinitialiser
            </button>
          ) : null}
          <p className="self-end pb-2 text-sm text-jr-faible">{visibleMissions.length} / {missions.length} mission{missions.length > 1 ? 's' : ''}</p>
        </div>

        {error && <div role="alert" className="rounded-lg border border-jr-err-bordure bg-jr-err-pale px-4 py-3 text-sm font-medium text-jr-err">{error}</div>}
        {notice && <div role="status" className="rounded-lg border border-jr-ok bg-jr-ok-pale px-4 py-3 text-sm font-medium text-jr-ok">{notice}</div>}

        {loading ? (
          <div className="rounded-xl border border-jr-bordure bg-jr-surface px-5 py-12 text-center text-sm text-jr-faible">Chargement des missions…</div>
        ) : visibleMissions.length ? (
          <div className="space-y-6">
            {groupesMissions.map((groupe) => (
              <section key={groupe.cle} className="space-y-3">
                <header className="rounded-xl border border-jr-bordure bg-jr-eau-pale/50 px-4 py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="font-bold text-jr-titre">
                      {groupe.jour === 2 ? 'Jour 2 · Première descente' : groupe.jour === 3 ? 'Jour 3 · Deuxième descente' : 'Journée de contrôle'}
                      <span className="ml-2 font-semibold text-jr-doux">{dateTexte(groupe.date)}</span>
                    </h3>
                    <span className="text-xs font-semibold text-jr-doux">
                      {groupe.missions.length} mission{groupe.missions.length > 1 ? 's' : ''}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-jr-faible">
                    Campagne {groupe.dateDebut && groupe.dateFin ? `du ${dateTexte(groupe.dateDebut)} au ${dateTexte(groupe.dateFin)}` : 'en cours'}
                    {' · '}Quartiers : {groupe.quartiers.length ? groupe.quartiers.join(', ') : 'non renseigné'}
                    {' · '}Planning : {groupe.statutCampagne === 'CLOTUREE' ? 'clôturé' : 'publié'}
                  </p>
                </header>
                {groupe.missions.map((mission) => (
                  <div key={mission.id} className={savingId === mission.id ? 'opacity-60' : ''}>
                    <MissionCard
                      mission={mission}
                      onStart={(item) => updateStatus(item, 'EN_COURS')}
                      onReprogram={(item, motif, resultatVisite, dateVisiteReelle) => updateStatus(item, 'A_REPROGRAMMER', motif, resultatVisite, dateVisiteReelle)}
                      onRead={(item) => navigate(`/dashboard/agent/releves?mission=${item.id}&compteur=${item.compteur_id}`)}
                    />
                  </div>
                ))}
              </section>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-jr-bordure bg-jr-surface px-6 py-14 text-center">
            {error ? <TriangleAlert className="mx-auto text-jr-err" size={26} /> : <ClipboardCheck className="mx-auto text-jr-faible" size={28} />}
            <h3 className="mt-3 font-semibold text-jr-titre">{missions.length ? 'Aucune mission ne correspond aux filtres' : 'Aucun contrôle attribué'}</h3>
            <p className="mx-auto mt-1 max-w-lg text-sm text-jr-faible">Les missions publiées par le Responsable apparaîtront ici.</p>
          </div>
        )}
      </div>
    </AgentLayout>
  );
}

function IndicateurMission({ icone: Icone, libelle, valeur, detail }) {
  return (
    <div className="rounded-xl border border-jr-bordure bg-jr-surface px-4 py-3 shadow-sm">
      <div className="flex items-center gap-2 text-jr-faible">
        <Icone size={15} aria-hidden="true" />
        <span className="text-xs font-semibold uppercase tracking-wide">{libelle}</span>
      </div>
      <p className="mt-1 text-2xl font-black text-jr-titre">{valeur}</p>
      <p className="text-xs text-jr-faible">{detail}</p>
    </div>
  );
}

export default function AgentMissionsPage() {
  return <MissionsAgent />;
}
