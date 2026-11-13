import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  ArrowDown,
  ArrowRight,
  Check,
  CheckCircle2,
  ClipboardList,
  Droplets,
  FileText,
  History,
  Info,
  Loader2,
  Pencil,
  RefreshCw,
  Save,
  TriangleAlert,
  X,
  Zap,
} from 'lucide-react';

import jsPDF from 'jspdf';
import axiosClient from '../../api/axiosClient';
import AgentLayout from '../../components/admin/agent/AgentLayout';
import { ecouterChangementAbonnes } from '../../hooks/abonnesSync.js';

/* ------------------------------------------------------------------ */
/* Mouvement : un seul fil conducteur, « le relevé saisi passe du       */
/* formulaire à l'historique ». Tout est en CSS (transform/opacity/     */
/* couleur) et se réduit à des fondus de couleur si prefers-reduced-    */
/* motion est actif : le changement reste visible sans déplacement.     */
/* ------------------------------------------------------------------ */
const MOTION_CSS = `
.rv-row{display:grid;grid-template-rows:1fr}
.rv-row>div{min-height:0;overflow:hidden}
.rv-row-new{animation:rv-grow 420ms cubic-bezier(.25,1,.5,1) both}
.rv-hl{animation:rv-hl 3.2s ease-out 300ms both}
.rv-flash{animation:rv-flash 1.8s ease-out both}
.rv-pop{animation:rv-pop 260ms cubic-bezier(.25,1,.5,1) both}
@keyframes rv-grow{from{grid-template-rows:0fr;opacity:0}to{grid-template-rows:1fr;opacity:1}}
@keyframes rv-hl{from{background-color:#d1fae5}to{background-color:transparent}}
@keyframes rv-flash{0%{background-color:#d1fae5;border-color:#6ee7b7}100%{background-color:#f1f5f9;border-color:#e2e8f0}}
@keyframes rv-pop{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.rv-row-new,.rv-pop{animation:none}}
`;

const CARD = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6';
const LABEL = 'mb-1.5 block text-sm font-semibold text-slate-700';
const FIELD =
  'w-full rounded-xl border px-3.5 py-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-200';
const FIELD_EDIT = `${FIELD} border-slate-300 bg-white focus:border-blue-500`;
const FIELD_LOCKED = `${FIELD} cursor-not-allowed border-slate-200 bg-slate-100 text-slate-600`;
const SECTION_TITLE = 'text-xs font-bold uppercase tracking-wider text-slate-500';

const PREVIEW = {
  empty: {
    box: 'border-slate-200 bg-slate-50 text-slate-500',
    hint: 'Saisissez le nouvel index pour la calculer.',
  },
  ok: {
    box: 'border-blue-200 bg-blue-50 text-blue-800',
    hint: 'Différence entre le nouvel et l’ancien index.',
  },
  high: {
    box: 'border-amber-200 bg-amber-50 text-amber-800',
    hint: 'Bien supérieure au dernier relevé : vérifiez l’index.',
  },
  invalid: {
    box: 'border-red-200 bg-red-50 text-red-700',
    hint: 'Le nouvel index est inférieur à l’ancien.',
  },
};

/* Indicateurs de disponibilité d'une date : vert, rouge, orange, gris. */
const TONS_DATE = {
  vert: {
    puce: 'bg-emerald-500',
    boite: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  },
  orange: {
    puce: 'bg-amber-500',
    boite: 'border-amber-200 bg-amber-50 text-amber-900',
  },
  jaune: {
    puce: 'bg-yellow-500',
    boite: 'border-yellow-300 bg-yellow-50 text-yellow-900',
  },
  rouge: {
    puce: 'bg-red-500',
    boite: 'border-red-200 bg-red-50 text-red-700',
  },
  neutre: {
    puce: 'bg-slate-400',
    boite: 'border-slate-200 bg-slate-50 text-slate-600',
  },
};

const reducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const isEau = (compteur) => String(compteur?.type || '').toUpperCase() === 'EAU';
const FUSEAU_JIRAMA = (() => {
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Antananarivo' });
    return 'Africa/Antananarivo';
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    return 'Indian/Antananarivo';
  }
})();

function getToday() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSEAU_JIRAMA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function getEndOfNextMonth() {
  const [year, month] = getToday().split('-').map(Number);
  const date = new Date(Date.UTC(year, month + 1, 0));
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

const toInputDate = (value) => (value ? String(value).slice(0, 10) : '');

function isValidInputDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;

  const nombreJours = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= nombreJours;
}

const MOIS_FRANCAIS = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
];

/*
  Une seule source d'affichage des dates : « 09 Novembre 2026 ».
  Aucune conversion de fuseau : la date est découpée telle qu'elle est
  stockée (YYYY-MM-DD), puis reconstruite en français.
*/
function formatDateLongue(value) {
  const iso = toInputDate(value);
  if (!isValidInputDate(iso)) return null;

  const [year, month, day] = iso.split('-').map(Number);

  return `${String(day).padStart(2, '0')} ${MOIS_FRANCAIS[month - 1]} ${year}`;
}

function formatDate(value) {
  return formatDateLongue(value) || '—';
}

function formatDateInstallation(value) {
  if (!value) return 'Non renseignée';

  return formatDateLongue(value) || 'Non renseignée';
}

/* Lendemain calendaire d'une date YYYY-MM-DD, sans conversion UTC locale. */
function ajouterUnJour(value) {
  const iso = toInputDate(value);
  if (!isValidInputDate(iso)) return '';

  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + 1));

  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

function isMissionTerrainDate(mission) {
  const date = toInputDate(mission?.date_prevue);
  const debut = toInputDate(mission?.date_debut);
  const fin = toInputDate(mission?.date_fin);
  if (!isValidInputDate(date) || !isValidInputDate(debut) || !isValidInputDate(fin)) return false;
  if (date < debut || date > fin) return false;

  const offset = Math.round(
    (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${debut}T00:00:00Z`)) / 86400000
  );
  const jourDuCycle = offset % 3;
  if (offset < 1 || jourDuCycle === 0) return false;

  const jourFinalisation = offset - jourDuCycle + 2;
  const dateFinalisationCycle = new Date(Date.parse(`${debut}T00:00:00Z`) + jourFinalisation * 86400000)
    .toISOString()
    .slice(0, 10);

  return dateFinalisationCycle <= fin;
}

function formatNumber(value) {
  const number = Number(value);
  return Number.isFinite(number)
    ? number.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '—';
}

function sortDescending(data = []) {
  const time = (item) => new Date(`${toInputDate(item.date_releve)}T00:00:00`).getTime();
  return [...data].sort((a, b) => {
    if (time(a) !== time(b)) return time(b) - time(a);
    return Number(b.id || 0) - Number(a.id || 0);
  });
}

function AgentRelevesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const compteurQuery = searchParams.get('compteur') || '';
  const missionQuery = searchParams.get('mission') || '';

  const [compteurs, setCompteurs] = useState([]);
  const [historique, setHistorique] = useState([]);
  const [selectedCompteur, setSelectedCompteur] = useState(compteurQuery);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [mission, setMission] = useState(null);
  const [abonnesRevision, setAbonnesRevision] = useState(0);
  const [missionLoading, setMissionLoading] = useState(Boolean(missionQuery));
  const [missionError, setMissionError] = useState('');
  const [dateError, setDateError] = useState('');
  const [dateVisiteError, setDateVisiteError] = useState('');
  const [datePrecedenteError, setDatePrecedenteError] = useState('');
  // false tant que l'historique du compteur choisi n'est pas chargé : on ne
  // peut ni saisir ni confondre une erreur de chargement avec « premier relevé ».
  const [historyReady, setHistoryReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(null);
  const [justSaved, setJustSaved] = useState(false);
  const [newReleveId, setNewReleveId] = useState(null);
  const [editReleveId, setEditReleveId] = useState(null);
  const [rollKey, setRollKey] = useState(0);
  const [form, setForm] = useState({
    compteur_id: compteurQuery,
    date_ancien_releve: '',
    date_releve: getToday(),
    date_visite_reelle: getToday(),
    ancien_index: '',
    nouvel_index: '',
    observation: '',
  });

  const historyRef = useRef(null);
  const historyCardRef = useRef(null);
  const historyReq = useRef(0);
  const datePrecedenteModifiee = useRef(false);

  const dateReleveAutomatique = missionQuery
    ? isMissionTerrainDate(mission)
      ? toInputDate(mission.date_prevue)
      : ''
    : getToday();

  // En mode correction, la date historique est conservée. Une mission
  // utilise sa journée de descente planifiée, pas la date de clôture.
  useEffect(() => {
    if (editReleveId) return undefined;

    const synchroniserDateDuJour = () => {
      const dateDuJour = missionQuery ? dateReleveAutomatique : getToday();
      setForm((previous) =>
        previous.date_releve === dateDuJour
          ? previous
          : { ...previous, date_releve: dateDuJour }
      );
    };

    synchroniserDateDuJour();
    const intervalId = window.setInterval(synchroniserDateDuJour, 60 * 1000);
    window.addEventListener('focus', synchroniserDateDuJour);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', synchroniserDateDuJour);
    };
  }, [editReleveId, missionQuery, dateReleveAutomatique]);

  const currentCompteur = useMemo(
    () => compteurs.find((item) => String(item.id) === String(selectedCompteur)) || null,
    [compteurs, selectedCompteur]
  );
  const currentUserId = useMemo(() => {
    try {
      return Number(JSON.parse(localStorage.getItem('user') || '{}')?.id) || null;
    } catch {
      return null;
    }
  }, []);

  const isEauCompteur = isEau(currentCompteur);
  const isFirstReleve = historyReady && historique.length === 0;
  const editingInitialReleve = Boolean(editReleveId && historique.some((item) => Number(item.id) === Number(editReleveId) && item.type_releve === 'INITIAL'));
  const isInitialMode = isFirstReleve || editingInitialReleve;
  const unite = historique[0]?.unite || (isEauCompteur ? 'm³' : 'kWh');

  const dateInstallationCompteur = toInputDate(currentCompteur?.date_installation);
  const modeNouveauReleve = !editReleveId;
  const missionDejaTraitee = Boolean(
    mission && (mission.releve_id || String(mission.statut || '').toUpperCase() === 'TERMINEE')
  );
  const releveDeLaMission = mission?.releve_id
    ? historique.find((item) => Number(item.id) === Number(mission.releve_id)) || null
    : null;

  // Dates réellement présentes dans l'historique du compteur sélectionné :
  // aucune date d'un autre compteur ne doit apparaître ici.
  const datesUtilisees = useMemo(
    () => new Set(historique.map((item) => toInputDate(item.date_releve)).filter(Boolean)),
    [historique]
  );

  const dernierReleve = historique[0] || null;
  const relevePrecedent = historique[1] || null;
  const releveModifie = editReleveId
    ? historique.find((item) => Number(item.id) === Number(editReleveId))
    : null;
  const releveAvantSaisie = editReleveId && releveModifie
    ? historique.find(
        (item) =>
          Number(item.id) !== Number(editReleveId) &&
          toInputDate(item.date_releve) < toInputDate(releveModifie.date_releve)
      ) || null
    : dernierReleve;

  /*
    Prochaine date réellement acceptée par le backend :
    strictement postérieure au dernier relevé, jamais antérieure à
    l'installation du compteur, et au plus tard la fin du mois prochain.
    Aucune date n'est inventée : si la fenêtre ne le permet pas, null.
  */
  const prochaineDatePossible = useMemo(() => {
    if (!selectedCompteur || !historyReady) return null;

    const finFenetre = getEndOfNextMonth();
    let candidate = getToday();

    if (dernierReleve) {
      const jourSuivant = ajouterUnJour(dernierReleve.date_releve);
      if (jourSuivant && jourSuivant > candidate) candidate = jourSuivant;
    } else if (dateInstallationCompteur && dateInstallationCompteur > candidate) {
      candidate = dateInstallationCompteur;
    }

    return candidate <= finFenetre ? candidate : null;
  }, [selectedCompteur, historyReady, dernierReleve, dateInstallationCompteur]);

  const dateReleveSaisie = editReleveId
    ? toInputDate(form.date_releve)
    : dateReleveAutomatique;
  const datePrecedenteMax = toInputDate(releveAvantSaisie?.date_releve) || dateReleveSaisie;

  const etatDateSaisie = useMemo(() => {
    if (!modeNouveauReleve) {
      return {
        ton: 'neutre',
        texte:
          'Correction d’un relevé existant : les contrôles de disponibilité ci-dessous ne s’appliquent pas.',
      };
    }

    if (!historyReady) {
      return { ton: 'neutre', texte: 'Chargement de l’historique du compteur…' };
    }

    if (!dateReleveSaisie || !isValidInputDate(dateReleveSaisie)) {
      return { ton: 'neutre', texte: 'Veuillez sélectionner une date de lecture valide.' };
    }

    if (dateInstallationCompteur && dateReleveSaisie < dateInstallationCompteur) {
      return {
        ton: 'rouge',
        texte: `Date antérieure à l’installation du compteur (${formatDate(dateInstallationCompteur)}).`,
      };
    }

    if (dernierReleve && dateReleveSaisie <= toInputDate(dernierReleve.date_releve)) {
      return {
        ton: 'jaune',
        texte: prochaineDatePossible
          ? `⚠ La date sélectionnée est antérieure au dernier relevé du ${formatDate(dernierReleve.date_releve)}. Choisissez le ${formatDate(prochaineDatePossible)} ou une date ultérieure autorisée.`
          : `⚠ La date sélectionnée est antérieure au dernier relevé du ${formatDate(dernierReleve.date_releve)}. Aucune autre date n’est disponible dans la période autorisée.`,
      };
    }

    if (datesUtilisees.has(dateReleveSaisie)) {
      return {
        ton: 'rouge',
        texte:
          'Cette date possède déjà un relevé enregistré pour ce compteur. Veuillez choisir une date autorisée.',
      };
    }

    if (dateReleveSaisie > getEndOfNextMonth()) {
      return {
        ton: 'orange',
        texte: `Date au-delà de la fenêtre autorisée (jusqu’au ${formatDate(getEndOfNextMonth())}).`,
      };
    }

    return {
      ton: 'vert',
      texte:
        'Cette date peut être utilisée pour effectuer un nouveau relevé, sous réserve de respecter les règles de saisie.',
    };
  }, [
    modeNouveauReleve,
    historyReady,
    dateReleveSaisie,
    dateInstallationCompteur,
    datesUtilisees,
    dernierReleve,
    prochaineDatePossible,
  ]);

  // Aperçu de la consommation : l'erreur de saisie se voit avant l'enregistrement.
  const hasIndexes = form.ancien_index !== '' && form.nouvel_index !== '';
  const delta = hasIndexes
    ? Math.round((Number(form.nouvel_index) - Number(form.ancien_index)) * 100) / 100
    : null;
  const lastConso = Number(historique[0]?.consommation) || 0;
  let previewState = 'empty';
  if (delta !== null) {
    if (delta < 0) previewState = 'invalid';
    else if (lastConso > 0 && delta > lastConso * 3) previewState = 'high';
    else previewState = 'ok';
  }

  /* ---------------------------- chargement ---------------------------- */

  async function loadCompteurs() {
    try {
      setLoading(true);
      setError('');

      const response = await axiosClient.get('/agent/compteurs');
      if (response.data?.status !== 'success') {
        throw new Error(response.data?.message || 'Impossible de charger les compteurs.');
      }

      const data = response.data?.data || [];
      setCompteurs(data);

      if (data.length === 0) {
        if (compteurQuery) {
          // Conserver l'identifiant demandé afin de ne pas afficher les
          // informations d'un autre compteur lorsque celui-ci est absent,
          // supprimé ou inaccessible à l'Agent.
          setSelectedCompteur(String(compteurQuery));
          setForm((previous) => ({ ...previous, compteur_id: String(compteurQuery) }));
          setHistorique([]);
          setHistoryReady(false);
          setError(`Le compteur demandé (ID ${compteurQuery}) n’est pas disponible pour votre compte. Aucun autre compteur n’a été sélectionné.`);
          return;
        }

        setSelectedCompteur('');
        setHistorique([]);
        setHistoryReady(false);
        setSearchParams({});
        return;
      }

      // Si l'URL ou l'état demande un compteur précis, ne jamais le remplacer
      // silencieusement par le premier compteur de la liste : cela mélangerait
      // potentiellement les données de deux abonnés différents.
      const compteurDemande = String(compteurQuery || selectedCompteur || '').trim();
      if (compteurDemande) {
        const compteurExisteDansListe = data.some(
          (item) => String(item.id) === compteurDemande
        );
        if (!compteurExisteDansListe) {
          setSelectedCompteur(compteurDemande);
          setForm((previous) => ({ ...previous, compteur_id: compteurDemande }));
          setHistorique([]);
          setHistoryReady(false);
          setError(`Le compteur demandé (ID ${compteurDemande}) est introuvable ou n’est pas disponible pour votre compte. Aucun autre compteur n’a été sélectionné.`);
          return;
        }

        setSelectedCompteur(compteurDemande);
        setForm((previous) => ({ ...previous, compteur_id: compteurDemande }));
        return;
      }

      // Aucun compteur n'est demandé dans l'URL : conserver le comportement
      // existant en sélectionnant le premier compteur disponible.
      const first = data[0];
      if (first) {
        setSelectedCompteur(String(first.id));
        setForm((previous) => ({ ...previous, compteur_id: String(first.id) }));
        setSearchParams({ compteur: String(first.id) });
      }
    } catch (requestError) {
      console.error('Erreur chargement compteurs Agent :', requestError);

      if (requestError.response?.status === 401 || requestError.response?.status === 403) {
        navigate('/', { replace: true });
        return;
      }

      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          'Erreur lors du chargement des compteurs.'
      );
    } finally {
      setLoading(false);
    }
  }

  // silent : recharge sans vider la liste (après un enregistrement).
  // knownIds : les ids déjà affichés, pour repérer le relevé qui vient d'arriver.
  async function loadHistory(compteurId, { silent = false, knownIds = null } = {}) {
    const requestId = ++historyReq.current;

    if (!compteurId) {
      setHistorique([]);
      setHistoryReady(false);
      setHistoryLoading(false);
      return [];
    }

    try {
      if (!silent) {
        setHistoryLoading(true);
        setHistoryReady(false);
        setError('');
      }

      const response = await axiosClient.get(`/agent/releves/compteur/${compteurId}`);
      if (response.data?.status !== 'success') {
        throw new Error(response.data?.message || 'Impossible de charger l’historique.');
      }

      const data = sortDescending(response.data?.data || []);
      if (requestId !== historyReq.current) return null; // réponse périmée

      // Même lot de mises à jour : la ligne apparaît déjà marquée « nouvelle »
      // et l'ancien index du formulaire avance au même instant.
      if (knownIds) {
        const fresh = data.find((item) => !knownIds.has(item.id));
        if (fresh) setNewReleveId(fresh.id);
        setRollKey((key) => key + 1);
      }

      const latest = data[0];
      setHistorique(data);
      setHistoryReady(true);
      setForm((previous) => ({
        ...previous,
        compteur_id: String(compteurId),
        date_ancien_releve: datePrecedenteModifiee.current
          ? previous.date_ancien_releve
          : latest
            ? toInputDate(latest.date_releve)
            : '',
        ancien_index: latest?.nouvel_index ?? '',
        nouvel_index: '',
      }));

      return data;
    } catch (requestError) {
      console.error('Erreur historique Agent :', requestError);
      if (requestId !== historyReq.current) return null;

      if (!silent) setHistorique([]);
      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          'Erreur lors du chargement de l’historique.'
      );
      return null;
    } finally {
      if (requestId === historyReq.current) setHistoryLoading(false);
    }
  }

  useEffect(() => {
    loadCompteurs();
  }, []);

  useEffect(() => ecouterChangementAbonnes(() => {
    setAbonnesRevision((revision) => revision + 1);
    loadCompteurs();
  }), []);

  useEffect(() => {
    let cancelled = false;
    if (!missionQuery) {
      setMission(null);
      setMissionError('');
      setMissionLoading(false);
      return undefined;
    }
    setMissionLoading(true);
    axiosClient
      .get(`/agent/missions/${missionQuery}`)
      .then((response) => {
        const nextMission = response.data?.data;
        if (!nextMission?.id || cancelled) return;
        setMission(nextMission);
        setMissionError('');
        setSelectedCompteur(String(nextMission.compteur_id));
        setForm((previous) => ({
          ...previous,
          compteur_id: String(nextMission.compteur_id),
          date_releve: isMissionTerrainDate(nextMission)
            ? toInputDate(nextMission.date_prevue)
            : '',
          date_visite_reelle: toInputDate(nextMission.date_visite_reelle) || getToday(),
        }));
        setSearchParams({ mission: String(nextMission.id), compteur: String(nextMission.compteur_id) });
      })
      .catch((requestError) => {
        if (cancelled) return;
        setMission(null);
        setMissionError(
          requestError.response?.data?.message ||
            'Cette mission ne vous est pas attribuée ou n’est plus disponible.'
        );
      })
      .finally(() => {
        if (!cancelled) setMissionLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [missionQuery, setSearchParams, abonnesRevision]);

  useEffect(() => {
    loadHistory(selectedCompteur);
  }, [selectedCompteur, mission?.date_prevue]);

  // Nouvelle ligne : remonter la liste, puis retirer le marquage après 5 s.
  useEffect(() => {
    if (newReleveId == null) return undefined;
    historyRef.current?.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
    const timer = setTimeout(() => setNewReleveId(null), 5000);
    return () => clearTimeout(timer);
  }, [newReleveId]);

  useEffect(() => {
    if (!justSaved) return undefined;
    const timer = setTimeout(() => setJustSaved(false), 2200);
    return () => clearTimeout(timer);
  }, [justSaved]);

  /* ----------------------------- saisie ------------------------------- */

  function handleCompteurChange(event) {
    if (missionQuery) return;
    const value = event.target.value;

    datePrecedenteModifiee.current = false;
    setSelectedCompteur(value);
    setHistoryReady(false);
    setEditReleveId(null);
    setForm((previous) => ({
      ...previous,
      compteur_id: value,
      date_ancien_releve: '',
      ancien_index: '',
      nouvel_index: '',
      observation: '',
    }));
    setSearchParams(value ? { compteur: value } : {});
    setError('');
    setDateError('');
    setDatePrecedenteError('');
    setSaved(null);
    setJustSaved(false);
    setNewReleveId(null);
    setRollKey(0);
  }

  function handleChange(event) {
    const { name, value } = event.target;

    if (name === 'date_releve') return;
    setForm((previous) => ({ ...previous, [name]: value }));
    setError('');
    if (name === 'date_ancien_releve') datePrecedenteModifiee.current = true;
    if (name === 'date_visite_reelle') setDateVisiteError('');
    if (name === 'date_releve' || name === 'date_ancien_releve') {
      setDateError('');
      setDatePrecedenteError('');
    }
    setSaved(null);
  }

  function commencerCorrection(item) {
    datePrecedenteModifiee.current = false;
    setEditReleveId(item.id);
    setForm({
      compteur_id: String(item.compteur_id),
      date_ancien_releve: toInputDate(item.date_ancien_releve),
      ancien_index: item.ancien_index ?? '',
      nouvel_index: item.nouvel_index ?? '',
      date_releve: toInputDate(item.date_releve),
      observation: item.observation ?? '',
    });
    setError('');
    setDateError('');
    setDatePrecedenteError('');
    setSaved(null);
    setJustSaved(false);
  }

  function annulerCorrection() {
    setEditReleveId(null);
    datePrecedenteModifiee.current = false;
    loadHistory(selectedCompteur);
    setError('');
    setDateError('');
    setDatePrecedenteError('');
  }

  function validateForm() {
    setDateError('');
    setDateVisiteError('');
    setDatePrecedenteError('');

    const dateReleveAValider = editReleveId ? form.date_releve : dateReleveAutomatique;

    if (!form.compteur_id) return 'Veuillez sélectionner un compteur.';
    if (missionQuery && !mission) return 'Cette mission ne vous est pas attribuée ou n’est plus disponible.';
    if (missionQuery && mission && !isMissionTerrainDate(mission)) {
      setDateError('Aucune date de descente valide n’est disponible pour cette mission dans le calendrier de la campagne.');
      return 'La date réelle du relevé est indisponible pour cette mission. Vérifiez le planning auprès du Responsable.';
    }
    if (mission && (!isValidInputDate(form.date_visite_reelle) || form.date_visite_reelle > getToday())) {
      setDateVisiteError('La date réelle de visite doit être valide et ne peut pas être future.');
      return 'Renseignez une date réelle de visite valide, qui ne peut pas être future.';
    }
    if (!isValidInputDate(dateReleveAValider)) {
      setDateError('Choisissez la date réelle du relevé.');
      return 'La date du relevé actuel est obligatoire et doit être valide.';
    }
    if (missionQuery && dateReleveAValider > getToday()) {
      setDateError('La date de la mission est future et ne peut pas encore être utilisée.');
      return 'Le relevé ne peut pas être enregistré avant la journée planifiée de la mission.';
    }
    if (dateReleveAValider > getEndOfNextMonth()) {
      setDateError('Choisissez une date au plus tard à la fin du mois prochain.');
      return 'La date du relevé actuel ne peut pas dépasser la fin du mois prochain.';
    }
    const dateInstallation = toInputDate(currentCompteur?.date_installation);
    if (dateInstallation && dateReleveAValider < dateInstallation) {
      setDateError('La date du premier relevé ne peut pas être antérieure à la date d’installation du compteur.');
      return 'La date du relevé ne peut pas être antérieure à l’installation du compteur.';
    }
    if (
      modeNouveauReleve &&
      dernierReleve &&
      dateReleveAValider <= toInputDate(dernierReleve.date_releve)
    ) {
      setDateError(`La date du relevé actuel doit être postérieure au dernier relevé valide (${formatDate(dernierReleve.date_releve)}).`);
      return 'La date du relevé actuel ne peut pas précéder ni répéter le dernier relevé valide.';
    }
    if (!isInitialMode) {
      if (!isValidInputDate(form.date_ancien_releve)) {
        setDatePrecedenteError('La date du relevé précédent est invalide.');
        return 'La date du relevé précédent est obligatoire et doit être valide.';
      }
      if (dateInstallation && form.date_ancien_releve < dateInstallation) {
        setDatePrecedenteError('La date du relevé précédent ne peut pas être antérieure à l’installation du compteur.');
        return 'La date du relevé précédent est antérieure à l’installation du compteur.';
      }
      if (releveAvantSaisie && form.date_ancien_releve > toInputDate(releveAvantSaisie.date_releve)) {
        setDatePrecedenteError('La date du relevé précédent ne peut pas être postérieure au dernier relevé valide de ce compteur.');
        return 'La date du relevé précédent dépasse le dernier relevé valide de ce compteur.';
      }
      if (form.date_ancien_releve >= dateReleveAValider) {
        setDatePrecedenteError('Choisissez une date antérieure au relevé actuel.');
        return 'La date du relevé précédent doit être antérieure à la date du relevé actuel.';
      }
    }
    if (form.nouvel_index === '' || !Number.isFinite(Number(form.nouvel_index))) return 'Veuillez saisir un index valide.';
    if (Number(form.nouvel_index) < 0) {
      return 'Le nouvel index doit être supérieur ou égal à zéro.';
    }
    if (!isInitialMode && form.ancien_index !== '' && Number(form.nouvel_index) < Number(form.ancien_index)) {
      return 'Le nouvel index doit être supérieur ou égal à l’ancien index.';
    }
    return '';
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setSaving(true);
      setError('');
      setSaved(null);

      const currentEditId = editReleveId;
      const knownIds = new Set(historique.map((item) => item.id));
      const relevePayload = {
        date_releve: currentEditId ? form.date_releve : dateReleveAutomatique,
        nouvel_index: Number(form.nouvel_index),
        observation: form.observation?.trim() || null,
        ...(!isInitialMode ? {
          date_ancien_releve: form.date_ancien_releve,
        } : {}),
      };
      const response = currentEditId
        ? await axiosClient.put(`/agent/releves/${currentEditId}`, relevePayload)
        : await axiosClient.post('/agent/releves', {
            compteur_id: Number(form.compteur_id),
            ...relevePayload,
            ...(mission ? {
              mission_id: Number(mission.id),
              date_visite_reelle: form.date_visite_reelle,
            } : {}),
          });
      if (response.data?.status !== 'success') {
        throw new Error(response.data?.message || 'Impossible d’enregistrer le relevé.');
      }

      datePrecedenteModifiee.current = false;
      const data = await loadHistory(form.compteur_id, { silent: true, knownIds });
      const fresh = currentEditId
        ? data?.find((item) => Number(item.id) === Number(currentEditId))
        : data?.find((item) => !knownIds.has(item.id));
      setEditReleveId(null);

      setSaved({
        consommation: fresh?.consommation ?? null,
        unite: fresh?.unite || unite,
        updated: Boolean(currentEditId),
        isInitial: fresh?.type_releve === 'INITIAL' || isInitialMode,
        mission: Boolean(mission) && !currentEditId,
        index: Number(form.nouvel_index),
      });
      setJustSaved(true);
    } catch (requestError) {
      console.error('Erreur création relevé Agent :', requestError);
      const serverMessage =
        requestError.response?.data?.message ||
        requestError.message ||
        'Impossible d’enregistrer le relevé.';
      if (/date du relevé précédent|date de référence du premier relevé/i.test(serverMessage)) {
        setDatePrecedenteError(serverMessage);
        setError('');
      } else if (/date|chronolog/i.test(serverMessage)) {
        if (/date réelle de visite/i.test(serverMessage)) {
          setDateVisiteError(serverMessage);
        } else {
          setDateError(serverMessage);
        }
        setError('');
      } else {
        setError(serverMessage);
      }
    } finally {
      setSaving(false);
    }
  }

  function scrollToHistory() {
    historyCardRef.current?.scrollIntoView({
      behavior: reducedMotion() ? 'auto' : 'smooth',
      block: 'start',
    });
  }

  const flash = rollKey > 0 ? 'rv-flash' : '';

  async function generateRelevePDF(releve) {
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 10;
      const contentWidth = pageWidth - margin * 2;
      const blue = [0, 78, 145];
      const orange = [235, 119, 0];
      const border = [90, 130, 175];
      const dark = [30, 45, 65];
      const formatIndex = (value) => {
        if (value === null || value === undefined || value === '') return '—';
        const number = Number(value);
        return Number.isFinite(number) ? number.toLocaleString('fr-FR') : '—';
      };
      const type = String(releve.type_compteur || currentCompteur?.type || '').toUpperCase();
      const unit = releve.unite || (type === 'EAU' ? 'm³' : 'kWh');
      const typeLabel = type === 'EAU' ? 'Eau' : 'Électricité';
      const subscriber = `${currentCompteur?.abonne_prenom || releve.abonne_prenom || ''} ${
        currentCompteur?.abonne_nom || releve.abonne_nom || ''
      }`.trim();
      const text = (value) => String(value ?? '—');
      const historyRows = historique
        .filter((entry) => Number(entry.id) !== Number(releve.id))
        .slice(0, 3);

      try {
        const response = await fetch(`${import.meta.env.BASE_URL}images/Jirama.png`);
        if (response.ok) {
          const image = await response.blob();
          const logo = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('Lecture du logo impossible.'));
            reader.readAsDataURL(image);
          });
          doc.addImage(logo, 'PNG', margin, 5, 28, 18);
        } else {
          doc.setTextColor(...blue);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(15);
          doc.text('JIRAMA', margin, 16);
        }
      } catch (logoError) {
        console.warn('Logo JIRAMA indisponible pour le PDF du relevé :', logoError);
        doc.setTextColor(...blue);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(15);
        doc.text('JIRAMA', margin, 16);
      }

      doc.setDrawColor(...blue);
      doc.setLineWidth(0.45);
      doc.line(margin, 26, pageWidth - margin, 26);
      doc.setTextColor(...blue);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text('SUIVI DES CONSOMMATIONS', pageWidth / 2 + 12, 10, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.text('RELEVÉ DE COMPTEUR · DOCUMENT NON OFFICIEL', pageWidth / 2 + 12, 16, {
        align: 'center',
      });
      doc.setTextColor(...dark);
      doc.setFontSize(8);
      doc.text(`Référence : REL-${releve.id}`, pageWidth - margin, 23, { align: 'right' });
      doc.text(`Date du relevé : ${formatDate(releve.date_releve)}`, margin, 32);
      doc.text(`Service : ${typeLabel}`, pageWidth / 2, 32);

      const infoY = 36;
      const infoHeight = 32;
      const halfWidth = contentWidth / 2;
      doc.setDrawColor(...border);
      doc.rect(margin, infoY, contentWidth, infoHeight);
      doc.line(pageWidth / 2, infoY, pageWidth / 2, infoY + infoHeight);
      doc.setFillColor(236, 243, 250);
      doc.rect(margin, infoY, halfWidth, 6, 'F');
      doc.rect(pageWidth / 2, infoY, halfWidth, 6, 'F');
      doc.setTextColor(...blue);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.text('TITULAIRE DU COMPTE', margin + 2, infoY + 4.2);
      doc.text('COMPTEUR', pageWidth / 2 + 2, infoY + 4.2);
      doc.setTextColor(...dark);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.text(`Nom : ${subscriber || 'Non renseigné'}`, margin + 2, infoY + 12);
      doc.text(`Référence abonné : ${text(currentCompteur?.numero_abonne)}`, margin + 2, infoY + 18);
      const adresseLines = doc.splitTextToSize(
        `Adresse : ${text(currentCompteur?.abonne_adresse)}`,
        halfWidth - 5
      );
      doc.text(adresseLines.slice(0, 2), margin + 2, infoY + 24);
      doc.text(`N° compteur : ${text(currentCompteur?.numero_compteur)}`, pageWidth / 2 + 2, infoY + 12);
      doc.text(`Type : ${typeLabel}`, pageWidth / 2 + 2, infoY + 18);
      doc.text(`Unité de mesure : ${unit}`, pageWidth / 2 + 2, infoY + 24);

      const titleY = 76;
      doc.setTextColor(...blue);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('DÉTAIL DU RELEVÉ', margin, titleY);

      const tableY = titleY + 3;
      const tableHeight = 19;
      const columnWidths = [contentWidth * 0.2, contentWidth * 0.2, contentWidth * 0.2, contentWidth * 0.2, contentWidth * 0.2];
      const columnTitles = ['DATE', 'ANCIEN INDEX', 'NOUVEL INDEX', 'CONSOMMATION', 'UNITÉ'];
      const columnValues = [
        formatDate(releve.date_releve),
        formatIndex(releve.ancien_index),
        formatIndex(releve.nouvel_index),
        formatIndex(releve.consommation),
        unit,
      ];
      let columnX = margin;
      doc.setFillColor(...blue);
      doc.rect(margin, tableY, contentWidth, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      columnTitles.forEach((title, index) => {
        const width = columnWidths[index];
        doc.text(title, columnX + width / 2, tableY + 5.2, { align: 'center' });
        if (index > 0) doc.line(columnX, tableY, columnX, tableY + tableHeight);
        columnX += width;
      });
      doc.setDrawColor(...border);
      doc.rect(margin, tableY, contentWidth, tableHeight);
      doc.line(margin, tableY + 8, pageWidth - margin, tableY + 8);
      doc.setTextColor(...dark);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      columnX = margin;
      columnValues.forEach((value, index) => {
        const width = columnWidths[index];
        doc.text(text(value), columnX + width / 2, tableY + 14, { align: 'center' });
        columnX += width;
      });

      let sectionY = tableY + tableHeight + 10;
      doc.setTextColor(...blue);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('HISTORIQUE DES RELEVÉS PRÉCÉDENTS', margin, sectionY);
      sectionY += 3;
      const historyHeaderHeight = 7;
      const historyRowHeight = 8;
      const historyWidths = [contentWidth * 0.4, contentWidth * 0.3, contentWidth * 0.3];
      const historyLabels = ['DATE', 'INDEX', `CONSOMMATION (${unit})`];
      let hx = margin;
      doc.setFillColor(236, 243, 250);
      doc.rect(margin, sectionY, contentWidth, historyHeaderHeight, 'F');
      doc.setDrawColor(...border);
      doc.rect(margin, sectionY, contentWidth, historyHeaderHeight + historyRowHeight * Math.max(historyRows.length, 1));
      doc.setTextColor(...blue);
      doc.setFontSize(6.5);
      historyLabels.forEach((label, index) => {
        const width = historyWidths[index];
        doc.text(label, hx + 2, sectionY + 4.7);
        if (index > 0) doc.line(hx, sectionY, hx, sectionY + historyHeaderHeight + historyRowHeight * Math.max(historyRows.length, 1));
        hx += width;
      });
      doc.setDrawColor(...border);
      doc.line(margin, sectionY + historyHeaderHeight, pageWidth - margin, sectionY + historyHeaderHeight);
      doc.setTextColor(...dark);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      if (historyRows.length === 0) {
        doc.text('Aucun relevé antérieur disponible.', margin + 2, sectionY + historyHeaderHeight + 5);
      } else {
        historyRows.forEach((entry, index) => {
          const rowY = sectionY + historyHeaderHeight + historyRowHeight * index;
          if (index > 0) {
            doc.setDrawColor(...border);
            doc.line(margin, rowY, pageWidth - margin, rowY);
          }
          doc.text(formatDate(entry.date_releve), margin + 2, rowY + 5.2);
          doc.text(formatIndex(entry.nouvel_index), margin + historyWidths[0] + 2, rowY + 5.2);
          doc.text(
            `${formatIndex(entry.consommation)} ${entry.unite || unit}`,
            margin + historyWidths[0] + historyWidths[1] + 2,
            rowY + 5.2
          );
        });
      }

      sectionY += historyHeaderHeight + historyRowHeight * Math.max(historyRows.length, 1) + 10;
      doc.setDrawColor(...border);
      doc.line(margin, sectionY, pageWidth - margin, sectionY);
      doc.setTextColor(...orange);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('DOCUMENT DE RELEVÉ — NON VALABLE COMME FACTURE', margin, sectionY + 6);
      doc.setTextColor(...dark);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.text(
        'Les tarifs, taxes, paiements et montants de facture ne sont pas inclus dans les données disponibles.',
        margin,
        sectionY + 12
      );

      const footerY = Math.max(sectionY + 24, pageHeight - 14);
      doc.setDrawColor(...blue);
      doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);
      doc.setTextColor(...blue);
      doc.setFontSize(7);
      doc.text(`Référence relevé : ${releve.id}`, margin, footerY);
      doc.text('JIRAMA · Suivi des consommations', pageWidth - margin, footerY, { align: 'right' });
      doc.save(`releve-jirama-${releve.id}.pdf`);
    } catch (pdfError) {
      console.error('Erreur génération PDF du relevé Agent :', pdfError);
      setError('Impossible de générer le PDF du relevé.');
    }
  }

  /* ------------------------------ rendu ------------------------------- */

  return (
    <AgentLayout title="Saisie des relevés">
      <style>{MOTION_CSS}</style>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        {/* FORMULAIRE */}
        <section className={CARD} aria-labelledby="releve-form-title">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
              <ClipboardList size={21} />
            </div>
            <div>
              <h2 id="releve-form-title" className="font-bold text-slate-900">
                {editReleveId ? `Corriger le relevé #${editReleveId}` : 'Nouveau relevé'}
              </h2>
              <p className="text-sm text-slate-500">{isInitialMode ? "Initialisation du compteur à partir de l’index réellement constaté." : "Saisie sécurisée par le serveur."}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-6">
            {/* Compteur */}
            <div className="space-y-3">
              <div>
                <label htmlFor="releve-compteur" className={LABEL}>
                  Compteur
                </label>
                <select
                  id="releve-compteur"
                  value={selectedCompteur}
                  onChange={handleCompteurChange}
                  disabled={loading || saving || Boolean(missionQuery)}
                  className={`${FIELD_EDIT} disabled:opacity-60`}
                >
                  <option value="">Sélectionner un compteur</option>
                  {selectedCompteur && !currentCompteur && (
                    <option value={selectedCompteur}>
                      Compteur #{selectedCompteur} — introuvable ou indisponible
                    </option>
                  )}
                  {compteurs.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.numero_compteur}
                      {' — '}
                      {isEau(item) ? 'Eau' : 'Électricité'}
                    </option>
                  ))}
                </select>
                {!loading && compteurs.length === 0 && (
                  <p className="mt-1.5 text-xs text-slate-500">Aucun compteur disponible.</p>
                )}
              </div>

              {currentCompteur && (
                <div className="flex items-center gap-3">
                  <div
                    className={`rounded-xl p-2.5 ${
                      isEauCompteur ? 'bg-sky-50 text-sky-700' : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    {isEauCompteur ? <Droplets size={18} /> : <Zap size={18} />}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-bold text-slate-800">
                      {currentCompteur.numero_compteur}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {`${currentCompteur.abonne_prenom || ''} ${
                        currentCompteur.abonne_nom || ''
                      }`.trim() || 'Abonné non renseigné'}
                      {' · '}
                      {currentCompteur.numero_abonne || '—'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {currentCompteur && (
              <section
                className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4"
                aria-labelledby="disponibilite-dates-title"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 id="disponibilite-dates-title" className={SECTION_TITLE}>
                      Disponibilité des dates de relevé
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Calculée à partir de l’historique réel du compteur {currentCompteur.numero_compteur}.
                    </p>
                  </div>
                  <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">
                    {historyLoading ? 'Chargement…' : `${historique.length} relevé(s)`}
                  </span>
                </div>

                <dl className="grid gap-2 text-sm sm:grid-cols-2">
                  <div className="flex items-start gap-2">
                    <span
                      aria-hidden="true"
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${TONS_DATE.vert.puce}`}
                    />
                    <div className="min-w-0">
                      <dt className="text-xs text-slate-500">Dernier relevé enregistré</dt>
                      <dd className="font-semibold text-slate-800">
                        {!historyReady
                          ? '—'
                          : dernierReleve
                            ? `${formatDate(dernierReleve.date_releve)} · index ${formatNumber(dernierReleve.nouvel_index)}`
                            : 'Aucun relevé enregistré'}
                      </dd>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <span
                      aria-hidden="true"
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${TONS_DATE.neutre.puce}`}
                    />
                    <div className="min-w-0">
                      <dt className="text-xs text-slate-500">Relevé précédent</dt>
                      <dd className="font-semibold text-slate-800">
                        {!historyReady
                          ? '—'
                          : relevePrecedent
                            ? formatDate(relevePrecedent.date_releve)
                            : 'Aucun relevé antérieur'}
                      </dd>
                    </div>
                  </div>
                </dl>

                <div>
                  <p className="text-xs text-slate-500">Dates déjà utilisées pour ce compteur</p>
                  {!historyReady ? (
                    <p className="mt-1 text-sm text-slate-600">—</p>
                  ) : historique.length === 0 ? (
                    <p className="mt-1 text-sm text-slate-600">
                      Aucune date utilisée : le prochain relevé sera le relevé initial du compteur.
                    </p>
                  ) : (
                    <ul className="mt-1.5 flex flex-wrap gap-1.5">
                      {historique.slice(0, 6).map((item) => (
                        <li
                          key={`date-utilisee-${item.id}`}
                          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold tabular-nums text-slate-600"
                        >
                          {formatDate(item.date_releve)}
                        </li>
                      ))}
                      {historique.length > 6 && (
                        <li className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-500">
                          +{historique.length - 6}
                        </li>
                      )}
                    </ul>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <div className="flex items-start gap-2">
                    <span
                      aria-hidden="true"
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                        prochaineDatePossible ? TONS_DATE.vert.puce : TONS_DATE.neutre.puce
                      }`}
                    />
                    <div className="min-w-0">
                      <p className="text-xs text-slate-500">Prochaine date possible</p>
                      <p className="text-sm font-semibold text-slate-800">
                        {!historyReady
                          ? '—'
                          : prochaineDatePossible
                            ? formatDate(prochaineDatePossible)
                            : 'Indisponible : aucune date acceptée dans la fenêtre autorisée'}
                      </p>
                    </div>
                  </div>

                </div>

                <p className="text-xs leading-5 text-slate-500">
                  La date actuelle est fixée automatiquement au jour de la saisie. Une même date peut être
                  utilisée pour plusieurs abonnés : seul un doublon concernant le même compteur est refusé.
                </p>
              </section>
            )}

            {mission && (
              <section className="space-y-2 border-t border-slate-100 pt-5" aria-label="Mission attribuée">
                <h3 className={SECTION_TITLE}>Mission de contrôle</h3>
                <p className="text-sm font-semibold text-slate-800">Mission #{mission.id} · {mission.statut}</p>

                {missionDejaTraitee && (
                  <div
                    role="status"
                    className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
                  >
                    <p className="font-bold">Mission déjà traitée</p>
                    <p className="mt-1">
                      {mission.releve_id
                        ? `Cette mission possède déjà un relevé enregistré le ${formatDate(
                            mission.date_releve_realisee
                          )}.`
                        : 'Cette mission possède déjà un relevé enregistré. La date de ce relevé est indisponible.'}
                    </p>

                    <dl className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
                      <div>
                        <dt className="text-amber-800">Compteur</dt>
                        <dd className="font-semibold">
                          {mission.numero_compteur || currentCompteur?.numero_compteur || '—'}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-amber-800">Abonné</dt>
                        <dd className="font-semibold">
                          {`${mission.abonne_prenom || ''} ${mission.abonne_nom || ''}`.trim() || '—'}
                          {' · '}
                          {mission.numero_abonne || '—'}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-amber-800">Type de relevé</dt>
                        <dd className="font-semibold">
                          {mission.type_releve === 'INITIAL'
                            ? 'Initial (sans consommation)'
                            : mission.type_releve || '—'}
                        </dd>
                      </div>

                      {releveDeLaMission?.ancien_index !== null &&
                        releveDeLaMission?.ancien_index !== undefined && (
                          <div>
                            <dt className="text-amber-800">Ancien index</dt>
                            <dd className="font-semibold tabular-nums">
                              {formatNumber(releveDeLaMission.ancien_index)}
                            </dd>
                          </div>
                        )}

                      <div>
                        <dt className="text-amber-800">Nouvel index enregistré</dt>
                        <dd className="font-semibold tabular-nums">
                          {mission.index_releve !== null && mission.index_releve !== undefined
                            ? formatNumber(mission.index_releve)
                            : '—'}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-amber-800">Consommation</dt>
                        <dd className="font-semibold tabular-nums">
                          {mission.consommation_releve !== null &&
                          mission.consommation_releve !== undefined
                            ? `${formatNumber(mission.consommation_releve)} ${unite}`
                            : 'Non calculée'}
                        </dd>
                      </div>
                    </dl>

                    <p className="mt-2 text-xs">
                      Aucune nouvelle saisie n’est possible pour cette mission. Consultez l’historique du compteur pour
                      vérifier le relevé transmis.
                    </p>
                  </div>
                )}
                <p className="text-sm text-slate-600">
                  {[mission.abonne_prenom, mission.abonne_nom].filter(Boolean).join(' ') || 'Abonné'}
                  {' · '}{mission.numero_abonne || 'Référence indisponible'}
                </p>
                <p className="text-sm text-slate-600">{mission.adresse || 'Adresse incomplète'} · {mission.quartier || 'Quartier non renseigné'}</p>
                <p className="text-xs text-slate-500">
                  Date de visite prévue : {formatDate(mission.date_prevue)} · Dernier index valide :{' '}
                  {mission.dernier_index !== null && mission.dernier_index !== undefined
                    ? Number(mission.dernier_index).toLocaleString('fr-FR')
                    : 'non disponible'}
                  {mission.dernier_releve ? ` (relevé du ${formatDate(mission.dernier_releve)})` : ''}.
                </p>
                {!missionDejaTraitee && (
                <div>
                  <label htmlFor="mission-date-visite-reelle" className={LABEL}>Date réelle de visite</label>
                  <input
                    id="mission-date-visite-reelle"
                    type="date"
                    value={form.date_visite_reelle}
                    max={getToday()}
                    onChange={(event) => {
                      setForm((previous) => ({
                        ...previous,
                        date_visite_reelle: event.target.value,
                      }));
                      setDateVisiteError('');
                      setError('');
                    }}
                    disabled={saving || missionLoading || Boolean(missionQuery && !mission)}
                    aria-invalid={Boolean(dateVisiteError)}
                    aria-describedby={dateVisiteError ? 'mission-date-visite-error' : undefined}
                    className={`${FIELD_EDIT} ${dateVisiteError ? 'border-red-400 focus:border-red-500' : ''}`}
                  />
                  {dateVisiteError && (
                    <p id="mission-date-visite-error" className="mt-1 text-xs font-medium text-red-700">{dateVisiteError}</p>
                  )}
                </div>
                )}
              </section>
            )}

            {missionError && (
              <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {missionError}
              </div>
            )}

            {/* Référence précédente ou initialisation d'un nouveau compteur */}
            <section className="space-y-3 border-t border-slate-100 pt-5">
              {isInitialMode ? (
                <div role="status" className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-4 text-sm text-blue-900">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-bold uppercase tracking-wider">Premier relevé — initialisation du compteur</h3>
                    <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-800">Nouveau</span>
                  </div>
                  <p className="mt-2">
                    Aucun relevé n’est encore enregistré pour ce compteur. Saisissez l’index réellement affiché sur le compteur. Il deviendra la référence des prochains relevés.
                  </p>
                  <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                    <div>
                      <dt className="text-blue-700">Date d’installation enregistrée</dt>
                      <dd className="font-semibold">{formatDateInstallation(currentCompteur?.date_installation)}</dd>
                    </div>
                    <div>
                      <dt className="text-blue-700">Abonné</dt>
                      <dd className="font-semibold">{`${currentCompteur?.abonne_prenom || ''} ${currentCompteur?.abonne_nom || ''}`.trim() || 'Non renseigné'} · {currentCompteur?.numero_abonne || '—'}</dd>
                    </div>
                  </dl>
                  <p className="mt-3 text-xs text-blue-800">La date d’installation n’est pas utilisée comme date de relevé. Aucune ancienne date, aucun ancien index et aucune consommation ne seront inventés.</p>
                </div>
              ) : (
                <>
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className={SECTION_TITLE}>Relevé précédent</h3>
                    <span className="text-xs text-slate-500">Repris du dernier relevé valide</span>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="releve-ancien-index" className={LABEL}>Ancien index</label>
                      <input
                        key={`ancien-${rollKey}`}
                        id="releve-ancien-index"
                        type="number"
                        min="0"
                        step="any"
                        inputMode="decimal"
                        name="ancien_index"
                        value={form.ancien_index}
                        readOnly
                        disabled={saving}
                        className={`${FIELD_LOCKED} font-semibold tabular-nums ${flash}`}
                      />
                    </div>
                    <div>
                      <label htmlFor="releve-date-precedent" className={LABEL}>Date du relevé précédent</label>
                      <input
                        key={`date-${rollKey}`}
                        id="releve-date-precedent"
                        type="date"
                        name="date_ancien_releve"
                        value={form.date_ancien_releve}
                        max={datePrecedenteMax || undefined}
                        onChange={handleChange}
                        disabled={saving || !historyReady}
                        aria-invalid={Boolean(datePrecedenteError)}
                        aria-describedby={datePrecedenteError ? 'releve-date-precedent-error' : undefined}
                        className={`${FIELD_EDIT} ${datePrecedenteError ? 'border-red-400 focus:border-red-500' : ''} ${flash} disabled:cursor-not-allowed disabled:opacity-60`}
                      />
                      {datePrecedenteError && <p id="releve-date-precedent-error" className="mt-1 text-xs font-medium text-red-700">{datePrecedenteError}</p>}
                    </div>
                  </div>
                </>
              )}
            </section>

            {/* Relevé actuel : la zone active */}
            <section className="space-y-3 border-t border-slate-100 pt-5">
              <h3 className={SECTION_TITLE}>Relevé actuel</h3>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="releve-nouvel-index" className={LABEL}>
                    {isInitialMode ? 'Index initial réellement constaté' : 'Nouvel index'}
                  </label>
                  <input
                    id="releve-nouvel-index"
                    type="number"
                    min="0"
                    step="any"
                    inputMode="decimal"
                    name="nouvel_index"
                    value={form.nouvel_index}
                    onChange={handleChange}
                    disabled={saving || !historyReady || Boolean(missionQuery && !mission)}
                    placeholder="Ex. 1253"
                    aria-invalid={previewState === 'invalid'}
                    className={`${FIELD} bg-white py-3.5 text-lg font-bold tabular-nums text-slate-900 ${
                      previewState === 'invalid'
                        ? 'border-red-400 focus:border-red-500'
                        : 'border-blue-300 focus:border-blue-500'
                    } disabled:bg-slate-50 disabled:opacity-60`}
                  />
                </div>

                <div>
                  <label htmlFor="releve-date" className={LABEL}>
                    {isInitialMode ? 'Date réelle du premier relevé' : 'Date du relevé actuel'}
                  </label>
                  <input
                    id="releve-date"
                    type="date"
                    name="date_releve"
                    value={editReleveId ? form.date_releve : dateReleveAutomatique}
                    max={getEndOfNextMonth()}
                    disabled
                    aria-invalid={Boolean(dateError)}
                    aria-describedby={
                      dateError ? 'releve-date-error releve-date-disponibilite' : 'releve-date-disponibilite'
                    }
                    className={`${FIELD_LOCKED} ${dateError ? 'border-red-400' : ''}`}
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    {editReleveId
                      ? 'Date historique du relevé conservée lors de la correction. Non modifiable par l’agent.'
                      : missionQuery
                        ? 'Date de la descente planifiée pour cette mission. Non modifiable par l’agent.'
                        : 'Date automatique du jour (fuseau Africa/Antananarivo). Non modifiable par l’agent.'}
                  </p>
                  {missionQuery && mission && !isMissionTerrainDate(mission) && (
                    <p role="alert" className="mt-1 text-xs font-medium text-red-700">
                      Aucune date de descente valide n’est disponible pour cette mission dans le calendrier de la campagne. L’enregistrement est bloqué.
                    </p>
                  )}

                  <div
                    id="releve-date-disponibilite"
                    role="status"
                    aria-live="polite"
                    className={`mt-2 rounded-lg border px-2.5 py-2 text-xs leading-5 ${TONS_DATE[etatDateSaisie.ton].boite}`}
                  >
                    <p className="flex items-start gap-1.5">
                      {etatDateSaisie.ton === 'jaune' ? (
                        <TriangleAlert size={14} aria-hidden="true" className="mt-0.5 shrink-0 text-yellow-700" />
                      ) : (
                        <span
                          aria-hidden="true"
                          className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${TONS_DATE[etatDateSaisie.ton].puce}`}
                        />
                      )}
                      <span>{etatDateSaisie.texte}</span>
                    </p>

                    {modeNouveauReleve && historyReady && (
                      <p className="mt-1 text-[11px] opacity-90">
                        Dernier relevé :{' '}
                        {dernierReleve ? formatDate(dernierReleve.date_releve) : 'aucun (relevé initial)'}
                        {' · '}
                        {missionQuery ? 'Date de mission : ' : 'Date proposée : '}
                        {missionQuery
                          ? dateReleveSaisie ? formatDate(dateReleveSaisie) : 'indisponible'
                          : prochaineDatePossible ? formatDate(prochaineDatePossible) : 'indisponible'}
                      </p>
                    )}
                  </div>

                  {dateError && <p id="releve-date-error" className="mt-1 text-xs font-medium text-red-700">{dateError}</p>}
                </div>
              </div>

              {isInitialMode ? (
                <div aria-live="polite" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  <p className="font-bold">Consommation non calculée pour ce premier relevé</p>
                  <p className="mt-1 text-xs">Cet index initial servira de base de comparaison lors du prochain relevé périodique.</p>
                </div>
              ) : (
                <>
                  <div aria-live="polite" className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-colors duration-200 ${PREVIEW[previewState].box}`}>
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase tracking-wider">Consommation estimée</p>
                      <p className="mt-0.5 text-xs">{PREVIEW[previewState].hint}</p>
                    </div>
                    <p className="shrink-0 text-xl font-black tabular-nums">
                      {delta === null || delta < 0 ? '—' : `${formatNumber(delta)} ${unite}`}
                    </p>
                  </div>
                  <p className="flex items-start gap-2 text-xs leading-5 text-slate-500">
                    <Info size={14} className="mt-0.5 shrink-0 text-blue-600" />
                    Le nouvel index doit être supérieur ou égal au dernier index enregistré.
                  </p>
                </>
              )}

              {isInitialMode && (
                <div>
                  <label htmlFor="releve-observation-initiale" className={LABEL}>Observation (facultative)</label>
                  <textarea
                    id="releve-observation-initiale"
                    name="observation"
                    value={form.observation || ''}
                    onChange={handleChange}
                    rows={2}
                    maxLength={2000}
                    disabled={saving}
                    placeholder="Précisez, si nécessaire, les conditions de la première lecture ou une remarque sur l’installation."
                    className={`${FIELD_EDIT} min-h-[76px] resize-y`}
                  />
                </div>
              )}
            </section>

            {/* Retour d'état, à côté du bouton qui l'a déclenché */}
            {error && (
              <div
                role="alert"
                className="rv-pop flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
              >
                <X size={18} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {saved && (
              <div
                role="status"
                className="rv-pop flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
              >
                <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{saved.updated ? 'Relevé corrigé avec succès.' : 'Relevé enregistré avec succès.'}</p>
                  <p className="mt-0.5">
                    {saved.isInitial
                      ? 'Premier index initialisé. Aucune consommation par différence n’a été calculée.'
                      : saved.consommation != null
                        ? `Consommation calculée : ${formatNumber(saved.consommation)} ${saved.unite || ''}`
                        : 'La consommation est indisponible ; vérifiez les données du relevé.'}
                  </p>
                  {saved.mission && (
                    <div className="mt-2">
                      <p className="font-semibold">Votre intervention a été enregistrée et transmise au Responsable.</p>
                      <p className="mt-0.5">
                        Index réel transmis : {Number(saved.index).toLocaleString('fr-FR')} · la mission apparaît comme terminée dans vos contrôles.
                      </p>
                      <button
                        type="button"
                        onClick={() => navigate('/dashboard/agent/missions')}
                        className="mt-1.5 inline-flex items-center gap-1 text-xs font-bold underline underline-offset-2"
                      >
                        Voir mes contrôles
                        <ArrowRight size={13} />
                      </button>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={scrollToHistory}
                  className="inline-flex shrink-0 items-center gap-1 text-xs font-bold underline xl:hidden"
                >
                  Voir l’historique
                  <ArrowDown size={14} />
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={
                saving ||
                loading ||
                missionLoading ||
                !historyReady ||
                missionDejaTraitee ||
                Boolean(missionQuery && !mission) ||
                Boolean(missionQuery && mission && !isMissionTerrainDate(mission))
              }
              className={`inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${
                justSaved ? 'bg-emerald-600' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {saving ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Enregistrement…
                </>
              ) : justSaved ? (
                <>
                  <Check size={18} />
                  Enregistré
                </>
              ) : (
                <>
                  <Save size={18} />
                  {editReleveId ? 'Enregistrer la correction' : isInitialMode ? 'Enregistrer le premier relevé' : 'Enregistrer le relevé'}
                </>
              )}
            </button>
            {editReleveId && (
              <button
                type="button"
                onClick={annulerCorrection}
                disabled={saving}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Annuler la correction
              </button>
            )}
          </form>
        </section>

        {/* HISTORIQUE */}
        <section ref={historyCardRef} className={CARD} aria-labelledby="releve-history-title">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-slate-100 p-3 text-slate-700">
              <History size={21} />
            </div>
            <div>
              <h2 id="releve-history-title" className="font-bold text-slate-900">
                Historique du compteur
              </h2>
              <p className="text-sm text-slate-500">
                {historyLoading ? 'Chargement…' : `${historique.length} relevé(s)`}
              </p>
            </div>

            <button
              type="button"
              onClick={() => loadHistory(selectedCompteur)}
              disabled={!selectedCompteur || historyLoading}
              aria-label="Actualiser l’historique"
              className="ml-auto inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-200 disabled:opacity-50"
            >
              <RefreshCw size={16} className={historyLoading ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Actualiser</span>
            </button>
          </div>

          <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
            <div ref={historyRef} className="max-h-[620px] overflow-auto">
              {historyLoading ? (
                <p className="px-4 py-12 text-center text-sm text-slate-500">Chargement…</p>
              ) : !selectedCompteur ? (
                <p className="px-4 py-12 text-center text-sm text-slate-500">
                  Sélectionnez un compteur pour voir son historique.
                </p>
              ) : !historyReady ? (
                <p className="px-4 py-12 text-center text-sm text-slate-500">
                  Historique indisponible. Utilisez « Actualiser » pour réessayer.
                </p>
              ) : historique.length === 0 ? (
                <p className="px-4 py-12 text-center text-sm text-slate-500">
                  Aucun relevé pour ce compteur. Il s’agit du premier relevé.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {historique.map((item) => {
                    const isNew = item.id === newReleveId;
                    return (
                      <li key={item.id} className={`rv-row ${isNew ? 'rv-row-new' : ''}`}>
                        <div>
                          <div
                            className={`flex items-start justify-between gap-4 p-4 ${
                              isNew ? 'rv-hl' : ''
                            }`}
                          >
                            <div className="min-w-0">
                              <p className="flex items-center gap-2 text-sm font-bold text-slate-800">
                                {formatDate(item.date_releve)}
                                {isNew && (
                                  <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-bold text-white">
                                    Nouveau
                                  </span>
                                )}
                              </p>
                              <p className="mt-1 flex items-center gap-1.5 text-sm tabular-nums text-slate-600">
                                {item.type_releve === 'INITIAL' ? (
                                  <span className="font-semibold text-blue-700">Index initial : {formatNumber(item.nouvel_index)}</span>
                                ) : (
                                  <>
                                    {formatNumber(item.ancien_index)}
                                    <ArrowRight size={14} className="text-slate-400" />
                                    <span className="font-bold text-slate-900">{formatNumber(item.nouvel_index)}</span>
                                  </>
                                )}
                              </p>
                              {item.type_releve === 'INITIAL' && <p className="mt-1 text-xs text-slate-500">Aucune consommation calculée</p>}
                              <p className="mt-1 text-xs text-slate-500">Relevé #{item.id}</p>
                            </div>

                            <div className="flex shrink-0 flex-col items-end gap-2">
                              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold tabular-nums text-blue-700">
                                {item.type_releve === 'INITIAL' || item.consommation == null ? 'Non calculée' : `${formatNumber(item.consommation)} ${item.unite || ''}`}
                              </span>
                              <div className="flex flex-wrap justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => generateRelevePDF(item)}
                                  className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 text-xs font-semibold text-blue-800 hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
                                  aria-label={`Télécharger le PDF du relevé ${item.id}`}
                                >
                                  <FileText size={13} />PDF / Facture
                                </button>
                                {!missionQuery && Number(item.created_by) === currentUserId && (
                                  <button
                                    type="button"
                                    onClick={() => commencerCorrection(item)}
                                    className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
                                  >
                                    <Pencil size={13} />Corriger
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </section>
      </div>
    </AgentLayout>
  );
}

export default AgentRelevesPage;
