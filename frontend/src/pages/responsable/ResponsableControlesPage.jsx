import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarDays, Check, CheckCircle2, ClipboardCheck, ExternalLink, Filter,
  MapPin, Plus, RefreshCw, Save, Search, ShieldAlert, Users, X,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import ResponsableLayout from '../../components/admin/responsable/ResponsableLayout.jsx';
import CarteLeaflet from '../../components/map/CarteLeaflet.jsx';
import { AbonneControleDialog, FicheAbonneControle } from '../../components/responsable/FicheAbonneControle.jsx';
import LocaliserAbonneControle from '../../components/responsable/LocaliserAbonneControle.jsx';
import { ecouterChangementAbonnes } from '../../hooks/abonnesSync.js';

const STATUS = {
  EN_ATTENTE: { label: 'En attente', color: '#64748b' },
  PLANIFIEE: { label: 'Planifiée', color: '#2563eb' },
  EN_COURS: { label: 'En cours', color: '#d97706' },
  TERMINEE: { label: 'Terminée', color: '#15803d' },
  A_REPROGRAMMER: { label: 'À reprogrammer', color: '#ea580c' },
  ANNULEE: { label: 'Annulée', color: '#dc2626' },
};

const dateDuJour = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: import.meta.env.VITE_APP_TIME_ZONE || 'Indian/Antananarivo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};

const currentMonth = () => dateDuJour().slice(0, 7);

function dateInput(value) {
  if (!value) return '';
  if (value instanceof Date) return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  return String(value).slice(0, 10);
}

function ajouterJours(date, nombre) {
  const value = new Date(`${dateInput(date)}T00:00:00Z`);
  if (Number.isNaN(value.getTime())) return '';
  value.setUTCDate(value.getUTCDate() + nombre);
  return value.toISOString().slice(0, 10);
}

function ecartJours(debut, fin) {
  return Math.round(
    (Date.parse(`${dateInput(fin)}T00:00:00Z`) - Date.parse(`${dateInput(debut)}T00:00:00Z`)) / 86400000
  );
}

function construireCycles(debutValue, finValue) {
  const debut = dateInput(debutValue);
  const fin = dateInput(finValue);
  if (!debut || !fin || fin < debut) return [];
  const cycles = [];
  for (let offset = 0; ; offset += 3) {
    const preparation = ajouterJours(debut, offset);
    const descente = ajouterJours(preparation, 1);
    const finalisation = ajouterJours(preparation, 2);
    if (!finalisation || finalisation > fin) break;
    cycles.push({ numero: cycles.length + 1, preparation, descente, finalisation });
  }
  return cycles;
}

function estDateTerrain(dateValue, debutValue, finValue) {
  const date = dateInput(dateValue);
  const debut = dateInput(debutValue);
  const fin = dateInput(finValue);
  if (!date || !debut || !fin || date < debut || date > fin) return false;
  const offset = ecartJours(debut, date);
  if (offset < 0 || offset % 3 === 0) return false;
  const preparationCycle = ajouterJours(debut, offset - (offset % 3));
  return ajouterJours(preparationCycle, 2) <= fin;
}

function finDernierCycleDuMois(debutValue) {
  const debut = dateInput(debutValue);
  if (!debut) return '';
  const year = Number(debut.slice(0, 4));
  const month = Number(debut.slice(5, 7));
  const dernierJour = new Date(year, month, 0).getDate();
  const finMois = `${debut.slice(0, 7)}-${String(dernierJour).padStart(2, '0')}`;
  const joursDisponibles = ecartJours(debut, finMois) + 1;
  const joursComplets = Math.floor(joursDisponibles / 3) * 3;
  return joursComplets >= 3 ? ajouterJours(debut, joursComplets - 1) : '';
}

function prochainJourTerrain(cycles, dateMinimum) {
  for (const cycle of cycles) {
    if (cycle.descente >= dateMinimum) return cycle.descente;
    if (cycle.finalisation >= dateMinimum) return cycle.finalisation;
  }
  return '';
}

/* Les quartiers ne sont jamais déduits, découpés ni complétés par une valeur
   par défaut : on reprend le libellé réellement enregistré sur les abonnés, en
   neutralisant seulement les espaces et la casse qui créeraient des doublons. */
function normaliserNomQuartier(valeur) {
  return String(valeur ?? '').replace(/\s+/g, ' ').trim();
}

function cleQuartier(valeur) {
  return normaliserNomQuartier(valeur).toLocaleLowerCase('fr');
}

/* Quartiers réellement disponibles pour la préparation : abonnés actifs et
   compteurs actifs renvoyés par l'API, sans aucun ajout artificiel. */
function construireQuartiersDisponibles(targets) {
  const canoniques = new Map();
  for (const target of targets) {
    const nom = normaliserNomQuartier(target.quartier);
    if (!nom) continue;
    const cle = cleQuartier(nom);
    if (!canoniques.has(cle)) canoniques.set(cle, nom);
  }
  const quartiers = [...canoniques.values()].sort((a, b) => a.localeCompare(b, 'fr'));
  const liste = targets.some((target) => !normaliserNomQuartier(target.quartier))
    ? [...quartiers, '__none__']
    : quartiers;
  return { quartiers, canoniques, liste };
}

/* Une sélection gardée d'un enregistrement précédent peut désigner un quartier
   renommé ou supprimé : elle est ramenée aux seuls quartiers réellement
   disponibles, avec leur libellé exact. Aucun quartier fantôme n'est conservé,
   donc aucune affectation ne peut plus être réclamée pour lui. */
function quartiersReelsDepuis(targets, selection) {
  const { canoniques, liste } = construireQuartiersDisponibles(targets);
  const source = selection && selection.length ? selection : liste;
  const resultat = [];
  for (const item of source) {
    if (item === '__none__') {
      if (liste.includes('__none__') && !resultat.includes('__none__')) resultat.push('__none__');
      continue;
    }
    const canonique = canoniques.get(cleQuartier(item));
    if (canonique && !resultat.includes(canonique)) resultat.push(canonique);
  }
  return resultat;
}

const idCarte = (mission) => String(mission?.map_id ?? mission?.mission_id ?? mission?.id ?? '');

function coordonneesValides(mission) {
  if (mission.latitude === null || mission.latitude === undefined || mission.longitude === null || mission.longitude === undefined || mission.latitude === '' || mission.longitude === '') return false;
  const latitude = Number(mission.latitude);
  const longitude = Number(mission.longitude);
  return Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
}

function missionEnRetard(mission) {
  const deadline = dateInput(mission.date_limite) || dateInput(mission.date_prevue);
  return ['PLANIFIEE', 'EN_COURS', 'A_REPROGRAMMER'].includes(mission.statut)
    && Boolean(deadline) && deadline < dateDuJour();
}

function etatTransmissionMission(mission) {
  if (mission.statut === 'TERMINEE') {
    if (mission.releve_exploitable) return 'Mission terminée · consommation vérifiée';
    if (mission.type_releve === 'INITIAL') return 'Mission terminée · index initial enregistré';
    return 'Mission terminée · relevé à vérifier';
  }
  if (mission.statut === 'A_REPROGRAMMER') {
    return 'Visite effectuée · résultat transmis · consommation non vérifiée';
  }
  if (mission.date_visite_reelle) return 'Visite enregistrée · résultat à examiner';
  if (dateInput(mission.date_prevue) < dateDuJour()) return 'Non réalisée à la date prévue';
  if (mission.statut === 'EN_COURS') return 'Intervention en cours';
  return 'En attente';
}

function dateLabel(value, options = {}) {
  const valueDate = dateInput(value);
  if (!valueDate) return '—';
  const parsed = new Date(`${valueDate}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleDateString('fr-FR', options);
}

function dateHeureLabel(value) {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? '—'
    : parsed.toLocaleString('fr-FR', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: import.meta.env.VITE_APP_TIME_ZONE || 'Indian/Antananarivo',
    });
}

function monthLabel(value) {
  const selectedMonth = dateInput(value).slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(selectedMonth)) return 'mois sélectionné';
  const date = new Date(`${selectedMonth}-01T00:00:00Z`);
  return new Intl.DateTimeFormat('fr-FR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

const CAMPAIGN_STATUS_LABEL = {
  BROUILLON: 'Brouillon',
  PUBLIEE: 'Publiée',
  CLOTUREE: 'Clôturée',
  ANNULEE: 'Annulée',
};

/* Résultat réellement constaté pendant la visite.
   « Index relevé » provient de la création du relevé ; les autres
   valeurs décrivent une visite sans consommation vérifiable. */
const RESULTATS_VISITE = {
  RELEVE_ENREGISTRE: 'Index relevé',
  ABONNE_ABSENT: 'Abonné absent',
  COMPTEUR_INACCESSIBLE: 'Compteur inaccessible',
  INDEX_ILLISIBLE: 'Index illisible',
  COMPTEUR_A_INTERVENIR: 'Compteur à intervenir',
  AUTRE: 'Autre situation signalée',
};

function startRangeForMonth(month) {
  const currentDate = `${month}-01`;
  return [currentDate, finDernierCycleDuMois(currentDate) || ajouterJours(currentDate, 2)];
}

function campagneTroisJours(startValue, endValue) {
  const start = dateInput(startValue) || dateDuJour();
  const end = endValue ? dateInput(endValue) : ajouterJours(start, 2);
  const normalized = end && end >= start ? end : ajouterJours(start, 2);
  return {
    date_debut: start,
    date_fin: normalized,
  };
}

function ControlesResponsable() {
  const [searchParams] = useSearchParams();
  const missionCible = searchParams.get('mission');
  const moisCible = searchParams.get('mois');
  const [month, setMonth] = useState(() => (
    /^\d{4}-\d{2}$/.test(String(moisCible || '')) ? moisCible : currentMonth()
  ));
  const [dateDebut, setDateDebut] = useState(() => startRangeForMonth(currentMonth())[0]);
  const [dateFin, setDateFin] = useState(() => startRangeForMonth(currentMonth())[1]);
  const [agents, setAgents] = useState([]);
  const [targets, setTargets] = useState([]);
  const [ciblesSansCompteur, setCiblesSansCompteur] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [campaignId, setCampaignId] = useState('');
  const [cycleStart, setCycleStart] = useState('');
  const [selectedPlanningDay, setSelectedPlanningDay] = useState(null);
  const [agentIdsSelectionnes, setAgentIdsSelectionnes] = useState([]);
  const [selection, setSelection] = useState({});
  const [search, setSearch] = useState('');
  const [agentSearch, setAgentSearch] = useState('');
  const [quartiersSelectionnes, setQuartiersSelectionnes] = useState([]);
  const [filters, setFilters] = useState({ quartier: '', agent: '', date: '', statut: '' });
  const [missionDrafts, setMissionDrafts] = useState({});
  const [selectedMissionId, setSelectedMissionId] = useState(() => (missionCible ? String(missionCible) : null));
  const [abonneDetail, setAbonneDetail] = useState(null);
  const [abonneALocaliser, setAbonneALocaliser] = useState(null);
  const missionRowsRef = useRef(new Map());
  const [selectedTargetId, setSelectedTargetId] = useState('');
  const [loading, setLoading] = useState(true);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const [agentsError, setAgentsError] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [duplicateCampaign, setDuplicateCampaign] = useState(null);
  const [clotureConfirmation, setClotureConfirmation] = useState('');
  const [preparationModalOpen, setPreparationModalOpen] = useState(false);
  const [agentsPreparationDraft, setAgentsPreparationDraft] = useState([]);
  const [quartiersPreparationDraft, setQuartiersPreparationDraft] = useState([]);
  const [preparationModalError, setPreparationModalError] = useState('');
  const [preparationStep, setPreparationStep] = useState('selection');
  /* Répartition explicite Agent → Quartiers : un quartier n'est jamais
     attribué automatiquement à deux Agents. */
  const [repartitionPreparation, setRepartitionPreparation] = useState({});
  const [affectationsSaving, setAffectationsSaving] = useState(false);
  const [agentsReplies, setAgentsReplies] = useState([]);

  const activeCampaign = campaigns.find((campaign) => String(campaign.id) === String(campaignId)) || null;
  const monthEnd = dateInput(`${month}-${String(new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate()).padStart(2, '0')}`);
  const draftDatesValid = Boolean(
    dateDebut &&
      dateFin &&
      dateDebut.startsWith(`${month}-`) &&
      dateFin.startsWith(`${month}-`) &&
      dateFin >= ajouterJours(dateDebut, 2) &&
      (ecartJours(dateDebut, dateFin) + 1) % 3 === 0 &&
      dateFin <= monthEnd
  );
  const campaignDatesDirty = Boolean(
    activeCampaign?.statut === 'BROUILLON' &&
      (dateDebut !== dateInput(activeCampaign.date_debut) ||
        dateFin !== dateInput(activeCampaign.date_fin))
  );
  const campaignStart = dateInput(activeCampaign?.date_debut || dateDebut);
  const campaignEnd = dateInput(activeCampaign?.date_fin || dateFin);
  const campaignCycles = useMemo(
    () => construireCycles(campaignStart, campaignEnd),
    [campaignStart, campaignEnd]
  );
  const campaignHasControlDates = campaignCycles.length > 0;
  const lastControlDate = campaignCycles[campaignCycles.length - 1]?.finalisation || '';
  const isPublishedCampaign = activeCampaign?.statut === 'PUBLIEE';
  const missionDateMin = prochainJourTerrain(campaignCycles, dateDuJour());
  const missionDateMax = lastControlDate;
  const missionDateRangeValid = Boolean(
    campaignHasControlDates &&
      activeCampaign &&
    !campaignDatesDirty &&
    ['BROUILLON', 'PUBLIEE'].includes(activeCampaign.statut) &&
      Boolean(missionDateMin) &&
      missionDateMin <= missionDateMax
  );
  const campaignDatesValid = Boolean(
    activeCampaign && !campaignDatesDirty
      ? campaignCycles.length > 0
      : draftDatesValid
  );
  const campaignEditable = Boolean(
    activeCampaign && ['BROUILLON', 'PUBLIEE'].includes(activeCampaign.statut)
  );
  const selectedTargets = Object.values(selection).filter((item) => item.selected);
  const selectedDatesValid = selectedTargets.every((item) => (
    Boolean(item.date_prevue) &&
    item.date_prevue >= missionDateMin &&
    item.date_prevue <= missionDateMax &&
    estDateTerrain(item.date_prevue, campaignStart, campaignEnd)
  ));
  const selectedAssignmentsValid = selectedTargets.every((item) => (
    Boolean(item.agent_id) && agentIdsSelectionnes.includes(String(item.agent_id))
  ));

  const load = useCallback(async () => {
    setLoading(true);
    setAgentsLoading(true);
    setAgentsError('');
    setError('');
    const agentsTask = axiosClient.get('/responsable/controles/agents')
      .then((response) => {
        if (response.data?.status !== 'success' || !Array.isArray(response.data?.data)) {
          throw new Error(response.data?.message || 'Réponse invalide lors du chargement des agents.');
        }
        setAgents(response.data.data);
      })
      .catch((requestError) => {
        console.error('Erreur chargement des agents du planning :', requestError);
        setAgents([]);
        setAgentsError(
          requestError.response?.data?.message ||
            requestError.message ||
            'Impossible de charger les agents. Veuillez réessayer.'
        );
      })
      .finally(() => setAgentsLoading(false));

    const planningTask = Promise.all([
      axiosClient.get('/responsable/controles/cibles', { params: { mois: month } }),
      axiosClient.get('/responsable/controles/campagnes', { params: { mois: month } }),
    ])
      .then(([targetResponse, campaignResponse]) => {
        const nextCampaigns = Array.isArray(campaignResponse.data?.data) ? campaignResponse.data.data : [];
        const nextTargets = targetResponse.data?.data || [];
        setTargets(nextTargets);
        setCiblesSansCompteur(Array.isArray(targetResponse.data?.abonnes_sans_compteur) ? targetResponse.data.abonnes_sans_compteur : []);
        setCampaigns(nextCampaigns);
        setCampaignId((previous) => {
          const selected = nextCampaigns.find((campaign) => String(campaign.id) === String(previous));
          if (selected && selected.statut !== 'ANNULEE') return previous;
          const open = nextCampaigns.find((campaign) => ['BROUILLON', 'PUBLIEE'].includes(campaign.statut));
          const consultable = nextCampaigns.find((campaign) => campaign.statut !== 'ANNULEE');
          return String(open?.id || consultable?.id || '');
        });
        setSelectedMissionId((previous) => nextCampaigns.some((campaign) => campaign.missions?.some((mission) => String(mission.mission_id) === String(previous))) ? previous : null);
        setSelectedTargetId((previous) => nextTargets.some((target) => String(target.compteur_id) === String(previous)) ? previous : '');
        setMissionDrafts({});
        return nextCampaigns;
      })
      .catch((requestError) => {
        setError(requestError.response?.data?.message || 'Impossible de charger les données du planning. Vérifiez que la migration des contrôles a été appliquée.');
        return null;
      });

    const [, loadedCampaigns] = await Promise.all([agentsTask, planningTask]);
    setLoading(false);
    return loadedCampaigns;
  }, [month]);

  const refreshCampaigns = useCallback(async () => {
    try {
      const response = await axiosClient.get('/responsable/controles/campagnes', {
        params: { mois: month },
      });
      if (response.data?.status !== 'success' || !Array.isArray(response.data?.data)) {
        throw new Error(response.data?.message || 'Réponse invalide lors de l’actualisation des missions.');
      }
      setCampaigns(response.data.data);
    } catch (requestError) {
      console.error('Erreur actualisation des missions de campagne :', requestError);
      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          'Impossible d’actualiser les missions de la campagne.'
      );
    }
  }, [month]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') refreshCampaigns();
    };
    const interval = window.setInterval(refreshIfVisible, 20000);
    window.addEventListener('focus', refreshIfVisible);
    document.addEventListener('visibilitychange', refreshIfVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshIfVisible);
      document.removeEventListener('visibilitychange', refreshIfVisible);
    };
  }, [refreshCampaigns]);

  useEffect(() => ecouterChangementAbonnes(() => {
    setSelectedMissionId(null);
    setSelectedTargetId('');
    setSelection({});
    load();
  }), [load]);

  useEffect(() => {
    if (!activeCampaign) return;
    setDateDebut(dateInput(activeCampaign.date_debut));
    setDateFin(dateInput(activeCampaign.date_fin));
    setCycleStart(dateInput(activeCampaign.date_debut));
    setSelectedPlanningDay(null);
    setSelection({});
  }, [activeCampaign?.id, activeCampaign?.date_debut, activeCampaign?.date_fin]);

  useEffect(() => {
    if (!dateDebut && !dateFin) return;
    const nextPlan = campagneTroisJours(dateDebut || dateDuJour(), dateFin || ajouterJours(dateDebut || dateDuJour(), 2));
    if (dateDebut !== nextPlan.date_debut || (dateFin && dateFin !== nextPlan.date_fin)) {
      setDateDebut(nextPlan.date_debut);
      setDateFin(nextPlan.date_fin);
    }
  }, [dateDebut, dateFin]);

  const quartiersPreparation = useMemo(() => construireQuartiersDisponibles(targets), [targets]);
  const quarters = quartiersPreparation.quartiers;
  const quartiersCanoniques = quartiersPreparation.canoniques;
  const quartiersDisponiblesModal = quartiersPreparation.liste;
  const quartiersReels = useCallback(
    (selection) => quartiersReelsDepuis(targets, selection),
    [targets]
  );
  const agentsFiltres = useMemo(() => {
    const needle = agentSearch.trim().toLowerCase();
    return agents.filter((agent) => !needle || [agent.nom, agent.prenom, agent.identifiant, agent.email]
      .some((value) => String(value || '').toLowerCase().includes(needle)));
  }, [agents, agentSearch]);
  const agentsPourAffectation = agents.filter((agent) => agentIdsSelectionnes.includes(String(agent.id)));
  const campaignsMissions = activeCampaign?.missions || [];
  /* Préparation Agent → Quartier réellement enregistrée (table
     affectations_controle). Elle existe même sans aucune mission
     individuelle : c'est elle que le détail du Jour 1 doit afficher. */
  const affectationsPreparees = useMemo(() => {
    const lignes = Array.isArray(activeCampaign?.affectations) ? activeCampaign.affectations : [];
    const parAgent = new Map();
    for (const ligne of lignes) {
      const cle = String(ligne.agent_id);
      if (!parAgent.has(cle)) {
        parAgent.set(cle, {
          cle,
          nom: [ligne.agent_prenom, ligne.agent_nom].filter(Boolean).join(' ') || `Agent #${ligne.agent_id}`,
          identifiant: ligne.agent_identifiant || '',
          statut: ligne.agent_statut || '',
          email: ligne.agent_email || '',
          quartiers: [],
        });
      }
      parAgent.get(cle).quartiers.push(ligne.quartier || '');
    }
    return [...parAgent.values()]
      .map((agent) => ({ ...agent, quartiers: [...new Set(agent.quartiers)].sort((a, b) => a.localeCompare(b, 'fr')) }))
      .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  }, [activeCampaign]);
  const quartiersPreparees = useMemo(
    () => [...new Set(affectationsPreparees.flatMap((agent) => agent.quartiers))],
    [affectationsPreparees]
  );
  /* Agents attribués à chaque quartier préparé : sert à préaffecter les
     compteurs du quartier et à signaler un quartier partagé entre Agents. */
  const agentsParQuartier = useMemo(() => {
    const map = new Map();
    for (const agent of affectationsPreparees) {
      for (const quartier of agent.quartiers) {
        const cle = quartier || '__none__';
        if (!map.has(cle)) map.set(cle, []);
        map.get(cle).push(agent);
      }
    }
    return map;
  }, [affectationsPreparees]);
  const quartiersPartages = useMemo(
    () => [...agentsParQuartier.entries()]
      .filter(([, agents]) => agents.length > 1)
      .map(([quartier]) => quartier),
    [agentsParQuartier]
  );
  useEffect(() => {
    const affectes = [...new Set(campaignsMissions.map((mission) => String(mission.agent_id || '')).filter(Boolean))];
    setAgentIdsSelectionnes((previous) => previous.filter((id) => agents.some((agent) => String(agent.id) === id))
      .concat(affectes.filter((id) => !previous.includes(id) && agents.some((agent) => String(agent.id) === id))));
  }, [campaignsMissions, agents]);

  /* Rechargement de la page : la préparation enregistrée en base rétablit les
     Agents et les quartiers sélectionnés au lieu de repartir de zéro. */
  const restaurationPreparee = useRef('');
  useEffect(() => {
    if (!affectationsPreparees.length) return;
    /* La préparation enregistrée n'est réappliquée qu'une fois par contenu
       réel : un rechargement des cibles ne doit pas écraser une correction
       faite par le Responsable dans le formulaire. */
    const signature = `${activeCampaign?.id || ''}|${affectationsPreparees
      .map((agent) => `${agent.cle}:${agent.quartiers.join(',')}`)
      .join(';')}`;
    if (restaurationPreparee.current === signature) return;
    restaurationPreparee.current = signature;
    setAgentIdsSelectionnes(
      affectationsPreparees
        .map((agent) => agent.cle)
        .filter((id) => agents.some((agent) => String(agent.id) === String(id)))
    );
    /* Seuls les quartiers encore portés par des abonnés actifs sont retenus. */
    setQuartiersSelectionnes(quartiersReelsDepuis(
      targets,
      [...new Set(affectationsPreparees.flatMap((agent) => agent.quartiers))]
        .map((quartier) => (quartier ? quartier : '__none__'))
    ));
  }, [affectationsPreparees, activeCampaign?.id, agents, targets]);

  /* Au premier affichage d’un planning déjà préparé, les compteurs des
     quartiers attribués sont proposés sélectionnés (une seule fois, pour ne
     jamais écraser un choix du Responsable). */
  const selectionAmorcee = useRef(false);
  useEffect(() => {
    if (selectionAmorcee.current) return;
    if (!affectationsPreparees.length || !targets.length || !missionDateRangeValid) return;
    selectionAmorcee.current = true;
    if (Object.keys(selection).length) return;
    preparerSelectionDepuisPreparation(activeCampaign?.affectations || []);
  }, [affectationsPreparees, targets, missionDateRangeValid, selection, activeCampaign]);

  const targetRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return targets.filter((target) => {
      const matchesSearch = !needle || [target.abonne_nom, target.abonne_prenom, target.numero_abonne, target.numero_compteur, target.adresse, target.quartier]
        .some((value) => String(value || '').toLowerCase().includes(needle));
      const matchesQuarter = !quartiersSelectionnes.length || quartiersSelectionnes.some((quarter) => (
        quarter === '__none__' ? !target.quartier : target.quartier === quarter
      ));
      return matchesSearch && matchesQuarter;
    });
  }, [targets, search, quartiersSelectionnes]);

  /* Périmètre réel des quartiers retenus : tous les abonnés actifs et tous
     leurs compteurs actifs, sans passer par la recherche libre. */
  const perimetreQuartiers = useMemo(() => {
    const correspondQuartier = (quartier) => quartiersSelectionnes.length === 0
      || quartiersSelectionnes.some((choisi) => (choisi === '__none__' ? !quartier : quartier === choisi));
    const cibles = targets.filter((target) => correspondQuartier(target.quartier));
    const sansCompteur = ciblesSansCompteur.filter((abonne) => correspondQuartier(abonne.quartier));
    return {
      abonnes: new Set(cibles.map((target) => target.abonne_id)).size,
      compteurs: new Set(cibles.map((target) => target.compteur_id)).size,
      sansCompteur: sansCompteur.length,
      sansCompteurListe: sansCompteur,
    };
  }, [targets, ciblesSansCompteur, quartiersSelectionnes]);

  /* Missions réellement enregistrées dans les quartiers retenus : elles
     existent immédiatement après l'enregistrement de la préparation. */
  const missionsQuartiersRetenus = useMemo(() => {
    const correspondQuartier = (quartier) => quartiersSelectionnes.length === 0
      || quartiersSelectionnes.some((choisi) => (choisi === '__none__' ? !quartier : quartier === choisi));
    const lignes = campaignsMissions.filter(
      (mission) => mission.statut !== 'ANNULEE' && correspondQuartier(mission.quartier)
    );
    return {
      total: lignes.length,
      jour2: lignes.filter((mission) => jourCycleDe(dateInput(mission.date_prevue)) === 2).length,
      jour3: lignes.filter((mission) => jourCycleDe(dateInput(mission.date_prevue)) === 3).length,
      abonnes: new Set(lignes.map((mission) => mission.abonne_id)).size,
      compteurs: new Set(lignes.map((mission) => mission.compteur_id)).size,
    };
  }, [campaignsMissions, quartiersSelectionnes, campaignStart]);

  function jourCycleDe(date) {
    if (!date || !campaignStart) return null;
    const offset = ecartJours(campaignStart, date);
    if (!Number.isFinite(offset) || offset < 0) return null;
    const reste = offset % 3;
    return reste === 1 ? 2 : reste === 2 ? 3 : 1;
  }

  /* Répartition de la sélection courante entre les deux journées de terrain. */
  const repartitionSelection = useMemo(() => {
    const choisis = targets.filter((target) => selection[target.compteur_id]?.selected);
    const abonnes = new Set();
    const compteurs = new Set();
    let jour2 = 0;
    let jour3 = 0;
    let sansDate = 0;
    for (const target of choisis) {
      abonnes.add(target.abonne_id);
      compteurs.add(target.compteur_id);
      const jour = jourCycleDe(selection[target.compteur_id]?.date_prevue);
      if (jour === 2) jour2 += 1;
      else if (jour === 3) jour3 += 1;
      else sansDate += 1;
    }
    return { missions: choisis.length, abonnes: abonnes.size, compteurs: compteurs.size, jour2, jour3, sansDate };
  }, [targets, selection, campaignStart]);

  const filterValues = useMemo(() => ({
    quartiers: [...new Set(campaignsMissions.map((mission) => mission.quartier).filter(Boolean))].sort(),
    agents: (() => {
      const options = new Map();
      campaignsMissions.filter((mission) => mission.agent_id).forEach((mission) => {
        const name = `${mission.agent_prenom || ''} ${mission.agent_nom || ''}`.trim();
        const label = [name, mission.agent_identifiant].filter(Boolean).join(' — ') || `Agent #${mission.agent_id}`;
        options.set(String(mission.agent_id), { id: mission.agent_id, label });
      });
      agents.forEach((agent) => {
        const name = `${agent.prenom || ''} ${agent.nom || ''}`.trim();
        const label = [name, agent.identifiant].filter(Boolean).join(' — ') || `Agent #${agent.id}`;
        options.set(String(agent.id), { id: agent.id, label });
      });
      return [...options.values()].sort((a, b) => a.label.localeCompare(b.label, 'fr'));
    })(),
  }), [campaignsMissions, agents]);

  /* Ouverture directe depuis une notification du Responsable :
     la mission signalée est recentrée et surlignée sans modifier les données. */
  useEffect(() => {
    if (!missionCible || loading) return undefined;
    const cible = campaignsMissions.find((mission) => String(mission.mission_id) === String(missionCible));
    if (!cible) return undefined;
    setSelectedMissionId(String(cible.mission_id));
    setFilters({ quartier: '', agent: '', date: '', statut: '', search: cible.numero_compteur || '' });
    const minuteur = setTimeout(() => {
      const ligne = missionRowsRef.current.get(String(cible.mission_id));
      if (!ligne) return;
      /* Le layout Responsable utilise overflow: clip ; un scrollIntoView
         classique n’y déplace pas le document, on cible donc la fenêtre. */
      const position = ligne.getBoundingClientRect().top + window.scrollY - 140;
      window.scrollTo({ top: Math.max(0, position), behavior: 'instant' });
    }, 350);
    return () => clearTimeout(minuteur);
  }, [missionCible, loading, campaignsMissions]);

  const visibleMissions = useMemo(() => campaignsMissions.filter((mission) => (
    (!String(filters.search || '').trim() || [mission.abonne_nom, mission.abonne_prenom, mission.numero_abonne, mission.numero_compteur, mission.adresse, mission.quartier]
      .some((value) => String(value || '').toLowerCase().includes(String(filters.search).trim().toLowerCase()))) &&
    (!filters.quartier || (filters.quartier === '__none__' ? !mission.quartier : mission.quartier === filters.quartier)) &&
    (!filters.agent || String(mission.agent_id || '') === filters.agent) &&
    (!filters.date || dateInput(mission.date_prevue) === filters.date) &&
    (!filters.statut || mission.statut === filters.statut)
  )), [campaignsMissions, filters]);

  const missionsCarte = useMemo(() => visibleMissions.filter((mission) =>
    ['PLANIFIEE', 'EN_COURS', 'A_REPROGRAMMER'].includes(mission.statut)
  ), [visibleMissions]);

  const selectedTargetPreview = useMemo(() => {
    const target = targets.find((item) => String(item.compteur_id) === String(selectedTargetId));
    if (!target) return null;
    const draft = selection[target.compteur_id] || {};
    const agent = agents.find((item) => String(item.id) === String(draft.agent_id));
    return {
      ...target,
      map_id: `cible:${target.compteur_id}`,
      isTarget: true,
      statut: 'EN_ATTENTE',
      agent_prenom: agent?.prenom || '',
      agent_nom: agent?.nom || '',
      date_prevue: draft.date_prevue || missionDateMin,
      date_limite: null,
    };
  }, [targets, selectedTargetId, selection, agents, missionDateMin]);

  const missionsCarteEtCible = selectedTargetPreview
    ? [...missionsCarte, selectedTargetPreview]
    : missionsCarte;
  const mapSelectedId = selectedTargetPreview
    ? selectedTargetPreview.map_id
    : selectedMissionId;

  /* Un marqueur uniquement pour les abonnés réellement géolocalisés :
     les autres restent listés « GPS non renseigné », sans position inventée. */
  const marqueursCarte = useMemo(() => missionsCarteEtCible
    .filter(coordonneesValides)
    .map((mission) => ({
      id: idCarte(mission),
      latitude: Number(mission.latitude),
      longitude: Number(mission.longitude),
      color: mission.isTarget ? '#7c3aed' : (STATUS[mission.statut] || STATUS.EN_ATTENTE).color,
      label: `${mission.abonne_prenom || ''} ${mission.abonne_nom || ''}`.trim()
        + ` · ${mission.numero_compteur || 'compteur'}`
        + ` · ${mission.isTarget ? 'à planifier' : (STATUS[mission.statut]?.label || mission.statut)}`,
    })), [missionsCarteEtCible]);

  const missionsSansGps = useMemo(
    () => missionsCarteEtCible.filter((mission) => !coordonneesValides(mission)),
    [missionsCarteEtCible]
  );

  const missionSelectionnee = useMemo(
    () => missionsCarteEtCible.find((mission) => idCarte(mission) === String(mapSelectedId)) || null,
    [missionsCarteEtCible, mapSelectedId]
  );

  const selectionnerCarte = useCallback((id) => {
    if (String(id).startsWith('cible:')) {
      setSelectedTargetId(String(id).slice('cible:'.length));
      setSelectedMissionId(null);
    } else {
      setSelectedTargetId('');
      setSelectedMissionId(id);
    }
  }, []);

  const counts = useMemo(() => Object.fromEntries(Object.keys(STATUS).map((status) => [
    status, campaignsMissions.filter((mission) => mission.statut === status).length,
  ])), [campaignsMissions]);

  const quartierCounts = useMemo(() => Object.entries(campaignsMissions.reduce((result, mission) => {
    const key = mission.quartier || 'Quartier non renseigné';
    result[key] = (result[key] || 0) + 1;
    return result;
  }, {})).sort((a, b) => b[1] - a[1]), [campaignsMissions]);

  const agentCounts = useMemo(() => {
    const result = new Map();
    for (const mission of campaignsMissions) {
      const key = mission.agent_id ? String(mission.agent_id) : 'non-affecte';
      const name = `${mission.agent_prenom || ''} ${mission.agent_nom || ''}`.trim() || mission.agent_identifiant || 'Non affecté';
      const entry = result.get(key) || { name, identifiant: mission.agent_identifiant || '', count: 0 };
      entry.count += 1;
      result.set(key, entry);
    }
    return [...result.entries()].sort((a, b) => b[1].count - a[1].count);
  }, [campaignsMissions]);

  const missionsEnRetard = campaignsMissions.filter(missionEnRetard).length;

  async function createCampaign(event) {
    event.preventDefault();
    if (!draftDatesValid) {
      setError('Choisissez une période dans le mois sélectionné, avec le jour de préparation et les deux jours de terrain.');
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const response = await axiosClient.post('/responsable/controles/campagnes', {
        mois: month, date_debut: dateDebut, date_fin: dateFin,
      });
      setCampaignId(String(response.data?.data?.id || ''));
      setNotice('Brouillon du planning enregistré. Ajoutez les compteurs et leurs affectations.');
      await load();
      if (response.data?.data?.id) setCampaignId(String(response.data.data.id));
    } catch (requestError) {
      const responseData = requestError.response?.data;
      let existing = responseData?.existingCampaign || null;
      if (requestError.response?.status === 409 && !existing?.id) {
        try {
          const campaignResponse = await axiosClient.get('/responsable/controles/campagnes', { params: { mois: month } });
          const availableCampaigns = Array.isArray(campaignResponse.data?.data) ? campaignResponse.data.data : [];
          existing = availableCampaigns.find((campaign) => ['BROUILLON', 'PUBLIEE', 'CLOTUREE'].includes(campaign.statut)) || null;
        } catch {
          existing = null;
        }
      }

      if (requestError.response?.status === 409 && existing?.id) {
        setDuplicateCampaign(existing);
        setError('');
      } else if (requestError.response?.status === 409) {
        setDuplicateCampaign(null);
        setError(`Un planning existe déjà pour ${monthLabel(month)}, mais ses détails n’ont pas pu être chargés. Actualisez la page ou réessayez.`);
      } else {
        setDuplicateCampaign(null);
        setError(responseData?.message || 'Impossible d’enregistrer le brouillon.');
      }
    } finally {
      setSaving(false);
    }
  }

  async function saveCampaignDates() {
    if (!activeCampaign || activeCampaign.statut !== 'BROUILLON') return;
    if (!draftDatesValid) {
      setError('Les dates du brouillon doivent rester dans son mois et inclure les deux jours de terrain après la préparation.');
      return;
    }

    setSaving(true);
    setError('');
    setNotice('');
    try {
      await axiosClient.patch(
        `/responsable/controles/campagnes/${activeCampaign.id}/dates`,
        { date_debut: dateDebut, date_fin: dateFin }
      );
      setNotice('Dates du brouillon mises à jour. Vérifiez les dates de visite des missions avant publication.');
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Impossible de modifier les dates du brouillon.');
    } finally {
      setSaving(false);
    }
  }

  async function openExistingCampaign() {
    const campaignIdToOpen = String(duplicateCampaign?.id || '');
    if (!campaignIdToOpen) {
      setError('L’identifiant du planning existant est indisponible. Actualisez les plannings avant de continuer.');
      return;
    }

    setSaving(true);
    setError('');
    setNotice('');
    try {
      const loadedCampaigns = await load();
      const campaign = loadedCampaigns?.find((item) => String(item.id) === campaignIdToOpen);
      if (!campaign) {
        setError(`Le planning #${campaignIdToOpen} a été identifié, mais ses données n’ont pas pu être chargées. Actualisez les plannings avant de continuer.`);
        return;
      }

      setCampaignId(campaignIdToOpen);
      setDuplicateCampaign(null);
      const campaignNotice = campaign.statut === 'CLOTUREE'
        ? `Planning #${campaignIdToOpen} ouvert en consultation : il est clôturé.`
        : `Planning #${campaignIdToOpen} ouvert. Vous pouvez le compléter selon son statut.`;
      const hiddenCount = Number(campaign.nombre_missions_masquees || 0);
      const hiddenNotice = hiddenCount > 0
        ? ` ${hiddenCount} mission${hiddenCount > 1 ? 's' : ''} associée${hiddenCount > 1 ? 's' : ''} ${hiddenCount > 1 ? 'à des abonnés supprimés' : 'à un abonné supprimé'} ${hiddenCount > 1 ? 'restent enregistrées mais masquées' : 'reste enregistrée mais masquée'}.`
        : '';
      setNotice(`${campaignNotice}${hiddenNotice}`);
    } finally {
      setSaving(false);
    }
  }

  async function addMissions() {
    if (!activeCampaign) return;
    const missions = Object.entries(selection).filter(([, value]) => value.selected).map(([compteurId, value]) => ({
      compteur_id: Number(compteurId),
      agent_id: value.agent_id || null,
      date_prevue: value.date_prevue || null,
      priorite: value.priorite || null,
      nouvelle_visite: Boolean(value.nouvelle_visite),
      suivi_periodique: Boolean(value.suivi_periodique),
      observations: value.observations || '',
    }));
    if (!missions.length) {
      setError('Sélectionnez au moins un compteur à planifier.');
      return;
    }
    if (!selectedAssignmentsValid) {
      setError('Sélectionnez au moins un Agent actif, puis affectez un Agent choisi à chaque compteur sélectionné.');
      return;
    }
    if (!missionDateRangeValid || !selectedDatesValid) {
      setError(
        isPublishedCampaign
          ? `Aucune date sélectionnée n’est compatible. Pour un planning publié, choisissez une date de contrôle du ${dateLabel(missionDateMin)} au ${dateLabel(missionDateMax)}.`
          : `Les dates de contrôle doivent être comprises entre le ${dateLabel(missionDateMin)} et le ${dateLabel(missionDateMax)}. Le premier jour du planning est réservé à la préparation.`
      );
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await axiosClient.post(`/responsable/controles/campagnes/${activeCampaign.id}/missions`, { missions });
      setSelection({});
      setSelectedTargetId('');
      setNotice(`${missions.length} mission${missions.length > 1 ? 's' : ''} ajoutée${missions.length > 1 ? 's' : ''} au planning.`);
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Impossible d’ajouter ces missions.');
    } finally {
      setSaving(false);
    }
  }

  async function publishCampaign() {
    if (!activeCampaign) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const response = await axiosClient.patch(`/responsable/controles/campagnes/${activeCampaign.id}/publier`);
      setNotice(response.data?.message || 'Planning publié. Les Agents affectés ont reçu une notification.');
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Impossible de publier ce planning.');
    } finally {
      setSaving(false);
    }
  }

  async function cloturerCampagne(confirmerSuivis = false) {
    if (!activeCampaign) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const response = await axiosClient.patch(
        `/responsable/controles/campagnes/${activeCampaign.id}/cloturer`,
        { confirmer_suivis: confirmerSuivis }
      );
      setClotureConfirmation('');
      setNotice(response.data?.message || 'Campagne clôturée.');
      await load();
    } catch (requestError) {
      const responseData = requestError.response?.data;
      if (responseData?.code === 'SUIVIS_A_COMPLETER') {
        setClotureConfirmation(String(responseData.message || ''));
        setError('');
      } else {
        setClotureConfirmation('');
        setError(responseData?.message || 'Impossible de clôturer cette campagne.');
      }
    } finally {
      setSaving(false);
    }
  }

  function preparerMoisSuivant() {
    const base = String(activeCampaign?.mois || `${month}-01`).slice(0, 7);
    const reference = new Date(`${base}-01T00:00:00Z`);
    if (Number.isNaN(reference.getTime())) return;
    reference.setUTCMonth(reference.getUTCMonth() + 1);
    const suivant = reference.toISOString().slice(0, 7);
    const [debutSuivant, finSuivante] = startRangeForMonth(suivant);
    setMonth(suivant);
    setDateDebut(debutSuivant);
    setDateFin(finSuivante);
    setCampaignId('');
    setDuplicateCampaign(null);
    setClotureConfirmation('');
    setError('');
    setNotice(
      `Préparation du planning de ${monthLabel(suivant)}. Un brouillon existant pour ce mois est rouvert s’il existe, sinon vérifiez les dates et enregistrez le brouillon. Aucune publication n’est effectuée automatiquement et les campagnes précédentes restent conservées.`
    );
  }

  function draftFor(mission) {
    return missionDrafts[mission.mission_id] || {
      agent_id: mission.agent_id ? String(mission.agent_id) : '',
      date_prevue: dateInput(mission.date_prevue),
      statut: mission.statut,
      suivi_periodique: Boolean(mission.suivi_periodique),
      observations: mission.observations || '',
    };
  }

  function patchDraft(missionId, key, value) {
    setMissionDrafts((previous) => ({ ...previous, [missionId]: { ...previous[missionId], [key]: value } }));
  }

  async function saveMission(mission) {
    const draft = draftFor(mission);
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await axiosClient.patch(`/responsable/controles/missions/${mission.mission_id}`, {
        agent_id: draft.agent_id || null,
        date_prevue: draft.date_prevue || null,
        statut: draft.statut,
        suivi_periodique: Boolean(draft.suivi_periodique),
        observations: draft.observations || '',
      });
      setNotice(`Mission #${mission.mission_id} mise à jour.`);
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Impossible de modifier cette mission.');
    } finally {
      setSaving(false);
    }
  }

  /*
  =========================================================
  CALENDRIER RÉEL DE LA CAMPAGNE
  ---------------------------------------------------------
  Les trois journées sont calculées à partir de la date de
  début du planning. Chaque journée distingue les missions
  prévues, les interventions réellement enregistrées et les
  consommations réellement vérifiées (relevé exploitable
  rattaché à la mission). Une mission démarrée n'est pas encore
  comptée comme une intervention réalisée.
  =========================================================
  */

  const selectedCycle = campaignCycles.find((cycle) => cycle.preparation === cycleStart) || campaignCycles[0] || null;
  const missionsDuCycle = selectedCycle
    ? campaignsMissions.filter((mission) => {
      const prevue = dateInput(mission.date_prevue);
      /* Une mission encore sans date (brouillon en préparation) est
         rattachée au premier cycle afin de rester visible au Jour 1. */
      if (!prevue) return selectedCycle === campaignCycles[0];
      return [selectedCycle.descente, selectedCycle.finalisation].includes(prevue);
    })
    : [];

  const calendrier = useMemo(() => {
    if (!selectedCycle) return [];
    const definitions = [
      {
        numero: 1,
        date: selectedCycle.preparation,
        phase: 'PREPARATION',
        roleCourt: 'Préparation',
        role: 'Préparation et affectation des missions',
        prevues: missionsDuCycle.filter((mission) => mission.statut !== 'ANNULEE').length,
        realisees: 0,
        verifiees: 0,
        restantes: 0,
      },
      {
        numero: 2,
        date: selectedCycle.descente,
        phase: 'DESCENTE',
        roleCourt: 'Descente terrain',
        role: 'Première journée de contrôle',
      },
      {
        numero: 3,
        date: selectedCycle.finalisation,
        phase: 'FINALISATION',
        roleCourt: 'Finalisation',
        role: 'Deuxième journée terrain et transmission des résultats',
      },
    ];

    return definitions.map((day) => {
      if (day.numero === 1) return { ...day, cycle: selectedCycle };
      const planifiees = missionsDuCycle.filter((mission) => (
        mission.statut !== 'ANNULEE' && dateInput(mission.date_prevue) === day.date
      ));
      /* Une visite effectuée reste comptée sur sa journée prévue, même si la
         date réelle est postérieure : le retard est signalé à part et n’ajoute
         aucune journée au cycle. */
      const realisees = planifiees.filter((mission) => (
        ['TERMINEE', 'A_REPROGRAMMER'].includes(mission.statut)
      ));
      const enRetard = realisees.filter((mission) => (
        dateInput(mission.date_visite_reelle) > day.date
      ));
      return {
        ...day,
        cycle: selectedCycle,
        prevues: planifiees.length,
        realisees: realisees.length,
        verifiees: realisees.filter((mission) => mission.releve_exploitable === true).length,
        enRetard: enRetard.length,
        restantes: planifiees.filter((mission) => ['EN_ATTENTE', 'PLANIFIEE', 'EN_COURS'].includes(mission.statut)).length,
      };
    });
  }, [selectedCycle, missionsDuCycle]);

  const bilan = useMemo(() => {
    const actives = campaignsMissions.filter((mission) => mission.statut !== 'ANNULEE');
    return {
      missions: actives.length,
      abonnes: new Set(actives.map((mission) => mission.abonne_id)).size,
      compteurs: new Set(actives.map((mission) => mission.compteur_id)).size,
      visites: actives.filter((mission) => (
        ['TERMINEE', 'A_REPROGRAMMER'].includes(mission.statut) &&
        Boolean(mission.date_visite_reelle)
      )).length,
      verifiees: actives.filter((mission) => (
        mission.statut === 'TERMINEE' && mission.releve_exploitable === true
      )).length,
      enAttente: actives.filter((mission) => ['EN_ATTENTE', 'PLANIFIEE', 'EN_COURS'].includes(mission.statut)).length,
      suivis: actives.filter((mission) => mission.statut === 'A_REPROGRAMMER').length,
      annulees: campaignsMissions.length - actives.length,
    };
  }, [campaignsMissions]);

  const calendrierEnAttente = bilan.enAttente;
  const calendrierPretPourCloture = activeCampaign?.statut === 'PUBLIEE'
    && bilan.missions > 0
    && calendrierEnAttente === 0;

  /* TERMINEE figure dans la liste pour que le statut réel d’une mission
     terminée s’affiche correctement ; ce choix reste désactivé sur ces
     lignes, le statut n’est posé que par l’enregistrement du relevé. */
  const statusSelectValues = activeCampaign?.statut === 'PUBLIEE'
    ? ['PLANIFIEE', 'EN_COURS', 'TERMINEE', 'A_REPROGRAMMER', 'ANNULEE']
    : ['EN_ATTENTE', 'PLANIFIEE', 'EN_COURS', 'TERMINEE', 'A_REPROGRAMMER', 'ANNULEE'];
  const duplicateMissionCount = Number.isFinite(Number(duplicateCampaign?.nombre_missions))
    ? Number(duplicateCampaign.nombre_missions)
    : Array.isArray(duplicateCampaign?.missions)
      ? duplicateCampaign.missions.length
      : null;
  const duplicateHiddenCount = Number(duplicateCampaign?.nombre_missions_masquees || 0);
  const activeHiddenCount = Number(activeCampaign?.nombre_missions_masquees || 0);
  const missionsDetailJour = selectedPlanningDay
    ? selectedPlanningDay.phase === 'DESCENTE'
      ? missionsDuCycle.filter((mission) => dateInput(mission.date_prevue) === selectedPlanningDay.date)
      : missionsDuCycle
    : [];
  /* Jour 1 : regroupement des affectations réellement enregistrées,
     d'abord par Agent puis par quartier. Les données proviennent
     uniquement des missions enregistrées en base. */
  const preparationParAgent = useMemo(() => {
    if (!selectedPlanningDay || selectedPlanningDay.phase !== 'PREPARATION') return [];
    const parAgent = new Map();
    /* Étape 1 : Agents et quartiers préparés, même sans mission individuelle. */
    for (const agent of affectationsPreparees) {
      parAgent.set(agent.cle, {
        cle: agent.cle,
        nom: agent.nom,
        identifiant: agent.identifiant,
        statut: agent.statut,
        email: agent.email,
        missions: 0,
        prepare: true,
        quartiers: new Map(agent.quartiers.map((quartier) => [
          quartier || '__none__',
          { nom: quartier || 'Quartier non renseigné', missions: [] },
        ])),
      });
    }
    for (const mission of missionsDuCycle) {
      if (mission.statut === 'ANNULEE') continue;
      const cleAgent = mission.agent_id ? String(mission.agent_id) : 'non-affecte';
      if (!parAgent.has(cleAgent)) {
        parAgent.set(cleAgent, {
          cle: cleAgent,
          nom: [mission.agent_prenom, mission.agent_nom].filter(Boolean).join(' ') || 'Agent non affecté',
          identifiant: mission.agent_identifiant || '',
          statut: mission.agent_statut || '',
          email: mission.agent_email || '',
          missions: 0,
          prepare: false,
          quartiers: new Map(),
        });
      }
      const agent = parAgent.get(cleAgent);
      agent.missions += 1;
      const cleQuartier = mission.quartier || '__none__';
      if (!agent.quartiers.has(cleQuartier)) {
        agent.quartiers.set(cleQuartier, { nom: mission.quartier || 'Quartier non renseigné', missions: [] });
      }
      agent.quartiers.get(cleQuartier).missions.push(mission);
    }
    return [...parAgent.values()]
      .map((agent) => ({
        ...agent,
        quartiers: [...agent.quartiers.values()]
          .map((quartier) => ({
            ...quartier,
            missions: [...quartier.missions].sort((a, b) => String(a.abonne_nom || '').localeCompare(String(b.abonne_nom || ''), 'fr')),
          }))
          .sort((a, b) => a.nom.localeCompare(b.nom, 'fr')),
      }))
      .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  }, [selectedPlanningDay, missionsDuCycle, affectationsPreparees]);

  const preparationModalCycle = selectedCycle || (() => {
    const debut = dateInput(activeCampaign?.date_debut || dateDebut);
    return {
      preparation: debut,
      descente: debut ? ajouterJours(debut, 1) : '',
      finalisation: debut ? ajouterJours(debut, 2) : '',
    };
  })();

  /* Répartition par défaut : un quartier par Agent à tour de rôle. Elle est
     modifiable, et jamais dupliquée entre deux Agents. */
  function repartitionParDefaut(agentIds, quartiers) {
    const ids = [...new Set(agentIds.map(String))];
    const liste = quartiers.length ? [...new Set(quartiers)] : [...quartiersDisponiblesModal];
    const map = {};
    for (const id of ids) map[id] = [];
    if (!ids.length) return map;
    liste.forEach((quartier, index) => {
      map[ids[index % ids.length]].push(quartier);
    });
    return map;
  }

  function ouvrirPreparationModal() {
    const agentsInitiaux = [...new Set(agentIdsSelectionnes)]
      .filter((id) => agents.some((agent) => String(agent.id) === String(id)));
    /* Un quartier renommé ou disparu des abonnés actifs n'est jamais reproposé
       comme une obligation à affecter. */
    const quartiersInitiaux = quartiersReels(quartiersSelectionnes);
    setAgentsPreparationDraft(agentsInitiaux);
    setQuartiersPreparationDraft(quartiersInitiaux);
    const existantes = {};
    for (const agent of affectationsPreparees) {
      if (agentsInitiaux.includes(agent.cle)) {
        existantes[agent.cle] = agent.quartiers.map((quartier) => (quartier ? quartier : '__none__'));
      }
    }
    const quartiersCouvers = quartiersInitiaux.length ? quartiersInitiaux : [...quartiersDisponiblesModal];
    const complet = agentsInitiaux.length > 0
      && agentsInitiaux.every((id) => (existantes[id] || []).length > 0)
      && quartiersCouvers.every((quartier) => Object.values(existantes).some((liste) => liste.includes(quartier)));
    setRepartitionPreparation(complet ? existantes : repartitionParDefaut(agentsInitiaux, quartiersInitiaux));
    setPreparationModalError('');
    setPreparationStep('selection');
    setPreparationModalOpen(true);
  }

  function basculerQuartierPourAgent(agentId, quartier, coche) {
    setRepartitionPreparation((previous) => {
      const suivant = { ...previous };
      const liste = new Set(suivant[agentId] || []);
      if (coche) liste.add(quartier);
      else liste.delete(quartier);
      suivant[agentId] = [...liste];
      return suivant;
    });
  }

  /* La répartition suit toujours les Agents et quartiers sélectionnés : un
     Agent retiré perd ses quartiers, un nouveau quartier rejoint le premier
     Agent pour qu'aucun abonné ne reste sans responsable. */
  useEffect(() => {
    if (!preparationModalOpen) return;
    setRepartitionPreparation((previous) => {
      const suivants = {};
      for (const agentId of agentsPreparationDraft) {
        suivants[agentId] = [...(previous[agentId] || [])].filter(
          (quartier) => !quartiersPreparationDraft.length || quartiersPreparationDraft.includes(quartier)
        );
      }
      const cible = agentsPreparationDraft[0];
      if (!cible) return suivants;
      const couverts = new Set(Object.values(suivants).flat());
      for (const quartier of quartiersPreparationDraft) {
        if (!couverts.has(quartier)) {
          suivants[cible].push(quartier);
          couverts.add(quartier);
        }
      }
      return suivants;
    });
  }, [preparationModalOpen, agentsPreparationDraft, quartiersPreparationDraft]);

  function basculerQuartierPreparation(quartier, coche) {
    if (quartier !== '__none__' && !quartiersCanoniques.has(cleQuartier(quartier))) return;
    setQuartiersPreparationDraft((previous) => {
      // Une sélection vide signifie « tous les quartiers », comme dans les filtres existants.
      const base = previous.length ? previous : [...quartiersDisponiblesModal];
      const prochaine = coche
        ? [...new Set([...base, quartier])]
        : base.filter((item) => item !== quartier);
      return quartiersDisponiblesModal.length > 0 && prochaine.length === quartiersDisponiblesModal.length
        ? []
        : prochaine;
    });
  }

  async function appliquerPreparationModal() {
    if (!activeCampaign) {
      setPreparationModalOpen(false);
      setError('Créez d’abord le brouillon du planning, puis ouvrez « Préparer et affecter les missions » pour sélectionner les Agents et les quartiers.');
      document.getElementById('configuration-planning')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (!campaignEditable) {
      setPreparationModalError(
        activeCampaign.statut === 'CLOTUREE'
          ? 'Ce planning est clôturé. Ses missions et ses affectations ne peuvent plus être modifiées.'
          : activeCampaign.statut === 'ANNULEE'
            ? 'Ce planning a été annulé. Aucune nouvelle intervention ne peut y être enregistrée.'
            : 'Ce planning n’est plus modifiable. Ouvrez un planning en cours pour préparer des missions.'
      );
      return;
    }
    if (agentsPreparationDraft.length === 0) {
      setPreparationModalError('Veuillez sélectionner au moins un Agent actif avant de poursuivre.');
      return;
    }
    /* Dans cette interface, une liste vide signifie « tous les quartiers ».
       On enregistre donc explicitement les quartiers disponibles. */
    const quartiersAEnregistrer = quartiersReels(quartiersPreparationDraft);
    if (quartiersAEnregistrer.length === 0) {
      setPreparationModalError('Veuillez sélectionner au moins un quartier à contrôler avant de poursuivre.');
      return;
    }

    /* Chaque quartier retenu doit être attribué explicitement à un seul Agent. */
    const affectationsChoisies = [];
    for (const agentId of agentsPreparationDraft) {
      for (const quartier of repartitionPreparation[agentId] || []) {
        if (!quartiersAEnregistrer.includes(quartier)) continue;
        affectationsChoisies.push({ agent_id: Number(agentId), quartier });
      }
    }
    const quartiersSansAgent = quartiersAEnregistrer.filter(
      (quartier) => !affectationsChoisies.some((paire) => paire.quartier === quartier)
    );
    if (quartiersSansAgent.length) {
      setPreparationModalError(
        `Attribuez chaque quartier à un Agent avant de poursuivre : ${quartiersSansAgent.map((quartier) => (quartier === '__none__' ? 'quartier non renseigné' : quartier)).join(', ')}.`
      );
      return;
    }
    const agentsSansQuartier = agentsPreparationDraft.filter(
      (agentId) => !affectationsChoisies.some((paire) => String(paire.agent_id) === String(agentId))
    );
    if (agentsSansQuartier.length) {
      setPreparationModalError('Chaque Agent sélectionné doit recevoir au moins un quartier, ou être retiré de la sélection.');
      return;
    }

    setAffectationsSaving(true);
    setPreparationModalError('');
    try {
      const response = await axiosClient.put(
        `/responsable/controles/campagnes/${activeCampaign.id}/affectations`,
        {
          agents: agentsPreparationDraft,
          quartiers: quartiersAEnregistrer,
          affectations: affectationsChoisies,
        }
      );
      const lignes = Array.isArray(response.data?.data) ? response.data.data : [];
      setCampaigns((previous) => previous.map((campagne) => (
        String(campagne.id) === String(activeCampaign.id)
          ? { ...campagne, affectations: lignes }
          : campagne
      )));
      setAgentIdsSelectionnes([...new Set(lignes.map((ligne) => String(ligne.agent_id)))]);
      setQuartiersSelectionnes(quartiersReelsDepuis(
        targets,
        [...new Set(lignes.map((ligne) => (ligne.quartier ? ligne.quartier : '__none__')))]
      ));
      /* Les missions du quartier sont créées côté serveur : on recharge le
         planning pour afficher les missions réellement enregistrées, sans
         jamais réutiliser une liste de sélection devenue obsolète. */
      const missionsCreees = Number(response.data?.missions_creees || 0);
      setSelection({});
      selectionAmorcee.current = false;
      await load();
      setPreparationStep('recap');
      const ciblesRetenues = targets.filter((target) => (
        lignes.some((ligne) => (
          ligne.quartier ? target.quartier === ligne.quartier : !target.quartier
        ))
      )).length;
      const nombreAgents = new Set(lignes.map((ligne) => ligne.agent_id)).size;
      const nombreQuartiers = new Set(lignes.map((ligne) => ligne.quartier)).size;
      const suiviMissions = missionsCreees > 0
        ? `${missionsCreees} mission${missionsCreees > 1 ? 's' : ''} enregistrée${missionsCreees > 1 ? 's' : ''} et Agent${nombreAgents > 1 ? 's' : ''} notifié${nombreAgents > 1 ? 's' : ''}`
        : 'aucune nouvelle mission à créer : les compteurs de ces quartiers sont déjà planifiés';
      setNotice(`Préparation enregistrée : ${nombreAgents} Agent${nombreAgents > 1 ? 's' : ''} et ${nombreQuartiers} quartier${nombreQuartiers > 1 ? 's' : ''} · ${ciblesRetenues} compteur${ciblesRetenues > 1 ? 's' : ''} couvert${ciblesRetenues > 1 ? 's' : ''} · ${suiviMissions}.`);
      if (response.data?.avertissement) setPreparationModalError(response.data.avertissement);
    } catch (requestError) {
      setPreparationModalError(
        requestError.response?.data?.message ||
          requestError.message ||
          'Impossible d’enregistrer la préparation des missions.'
      );
    } finally {
      setAffectationsSaving(false);
    }
  }

  function poursuivreVersCompteurs() {
    setPreparationModalOpen(false);
    setPreparationStep('selection');
    document.getElementById('liste-cibles-controle')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* Un quartier attribué à un Agent couvre tous ses abonnés et tous leurs
     compteurs actifs : la sélection est donc préparée automatiquement pour
     chaque compteur du quartier, sans retirer ce que le Responsable a déjà
     saisi. L’Agent n’est préaffecté que si le quartier n’a qu’un seul Agent. */
  function preparerSelectionDepuisPreparation(affectations) {
    if (!campaignEditable || !missionDateRangeValid) return;
    const agentsDuQuartier = new Map();
    for (const ligne of affectations || []) {
      const cle = ligne.quartier ? ligne.quartier : '__none__';
      if (!agentsDuQuartier.has(cle)) agentsDuQuartier.set(cle, []);
      agentsDuQuartier.get(cle).push(String(ligne.agent_id));
    }
    setSelection((previous) => {
      const suivant = { ...previous };
      for (const target of targets) {
        const cle = target.quartier ? target.quartier : '__none__';
        if (!agentsDuQuartier.has(cle)) continue;
        const existante = campaignsMissions.find(
          (mission) => Number(mission.compteur_id) === Number(target.compteur_id)
        );
        const dejaPlanifiee = existante
          && !['TERMINEE', 'A_REPROGRAMMER'].includes(existante.statut);
        if (dejaPlanifiee) continue;
        const agentsCles = [...new Set(agentsDuQuartier.get(cle))];
        suivant[target.compteur_id] = {
          ...(previous[target.compteur_id] || {}),
          selected: true,
          agent_id: agentsCles.length === 1
            ? agentsCles[0]
            : (previous[target.compteur_id]?.agent_id || ''),
          date_prevue: previous[target.compteur_id]?.date_prevue
            || selectionDateParDefaut(target),
          nouvelle_visite: Boolean(existante),
        };
      }
      return suivant;
    });
  }

  function selectionDateParDefaut(target) {
    const existante = campaignsMissions.find(
      (mission) => Number(mission.compteur_id) === Number(target.compteur_id)
    );
    const dateExistante = dateInput(existante?.date_prevue);
    return dateExistante >= missionDateMin && dateExistante <= missionDateMax
      ? dateExistante
      : missionDateMin;
  }

  function affecterJourSelection(jourCible) {
    const dateCible = jourCible === 2 ? selectedCycle?.descente : selectedCycle?.finalisation;
    if (!dateCible) return;
    setSelection((previous) => {
      const suivant = { ...previous };
      for (const target of targets) {
        const draft = previous[target.compteur_id];
        if (!draft?.selected) continue;
        suivant[target.compteur_id] = { ...draft, date_prevue: dateCible };
      }
      return suivant;
    });
  }

  function repartirSelectionSurDeuxJours() {
    if (!selectedCycle?.descente || !selectedCycle?.finalisation) return;
    setSelection((previous) => {
      const suivant = { ...previous };
      let index = 0;
      for (const target of targets) {
        const draft = previous[target.compteur_id];
        if (!draft?.selected) continue;
        suivant[target.compteur_id] = {
          ...draft,
          date_prevue: index % 2 === 0 ? selectedCycle.descente : selectedCycle.finalisation,
        };
        index += 1;
      }
      return suivant;
    });
  }

  return (
    <ResponsableLayout title="Planning des contrôles">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <section className="flex flex-wrap items-end justify-between gap-4 rounded-xl border border-jr-bordure bg-jr-surface p-5 shadow-sm">
          <div className="max-w-3xl">
            <h2 className="text-xl font-bold text-jr-titre">Contrôles des abonnés</h2>
            <p className="mt-1.5 text-sm leading-6 text-jr-faible">Préparez les cycles de trois jours du mois, affectez les Agents aux compteurs et suivez séparément la date prévue, l’intervention réelle et le relevé vérifié.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={ouvrirPreparationModal} disabled={loading || agentsLoading} className="jr-btn jr-btn-elec inline-flex items-center gap-2 rounded-md px-3.5 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60">
              <Plus size={16} />Préparer et affecter les missions
            </button>
            <button type="button" onClick={load} disabled={loading || saving} className="inline-flex items-center gap-2 rounded-md border border-jr-bordure px-3.5 py-2.5 text-sm font-semibold text-jr-doux hover:bg-jr-eau-pale disabled:opacity-60">
              <RefreshCw size={15} className={loading ? 'animate-spin motion-reduce:animate-none' : ''} />Actualiser
            </button>
          </div>
        </section>

        {error && <div role="alert" className="flex items-start gap-2 rounded-lg border border-jr-err-bordure bg-jr-err-pale px-4 py-3 text-sm font-medium text-jr-err"><ShieldAlert size={17} className="mt-0.5 shrink-0" />{error}</div>}
        {duplicateCampaign && (
          <section role="alert" className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-jr-elec-bordure bg-jr-elec-pale px-4 py-4 text-sm text-jr-texte">
            <div className="min-w-0 flex-1">
              <h3 className="font-bold">Un planning existe déjà pour {monthLabel(duplicateCampaign.mois || month)}.</h3>
              <p className="mt-1">
                Planning #{duplicateCampaign.id} · statut : {CAMPAIGN_STATUS_LABEL[duplicateCampaign.statut] || duplicateCampaign.statut || 'non renseigné'}.
              </p>
              {duplicateCampaign.date_debut && duplicateCampaign.date_fin ? (
                <p className="mt-1">
                  Période : du {dateLabel(duplicateCampaign.date_debut, { day: '2-digit', month: '2-digit', year: 'numeric' })} au {dateLabel(duplicateCampaign.date_fin, { day: '2-digit', month: '2-digit', year: 'numeric' })}.
                </p>
              ) : (
                <p className="mt-1">Les dates de début et de fin ne sont pas disponibles pour ce planning.</p>
              )}
              {duplicateMissionCount !== null && (
                <p className="mt-1">{duplicateMissionCount} mission{duplicateMissionCount > 1 ? 's' : ''} enregistrée{duplicateMissionCount > 1 ? 's' : ''}.</p>
              )}
              {duplicateHiddenCount > 0 && (
                <p className="mt-1">{duplicateHiddenCount} mission{duplicateHiddenCount > 1 ? 's associées à des abonnés supprimés sont conservées mais masquées' : ' associée à un abonné supprimé est conservée mais masquée'}.</p>
              )}
              <p className="mt-2">Ouvrez ce planning pour consulter ses contrôles et le compléter si son statut l’autorise.</p>
            </div>
            <button type="button" onClick={openExistingCampaign} disabled={loading || saving} className="jr-btn jr-btn-bleu inline-flex shrink-0 items-center gap-2 rounded-md px-3.5 py-2.5 text-sm font-semibold disabled:opacity-60">
              <ExternalLink size={16} />{saving ? 'Chargement…' : 'Ouvrir le planning existant'}
            </button>
          </section>
        )}
        {notice && <div role="status" className="flex items-start gap-2 rounded-lg border border-jr-ok bg-jr-ok-pale px-4 py-3 text-sm font-medium text-jr-ok"><CheckCircle2 size={17} className="mt-0.5 shrink-0" />{notice}</div>}
        {agentsLoading && <p role="status" className="text-sm text-jr-faible">Chargement des agents…</p>}
        {agentsError && (
          <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-jr-err-bordure bg-jr-err-pale px-4 py-3 text-sm text-jr-err">
            <ShieldAlert size={17} className="shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Impossible de charger les agents. Veuillez réessayer.</p>
              {agentsError !== 'Impossible de charger les agents. Veuillez réessayer.' && <p className="mt-1">{agentsError}</p>}
            </div>
            <button type="button" onClick={load} disabled={loading || saving} className="rounded-md border border-jr-err-bordure px-3 py-1.5 font-semibold disabled:opacity-60">Réessayer</button>
          </div>
        )}
        {!agentsLoading && !agentsError && agents.length === 0 && (
          <p role="status" className="rounded-lg border border-jr-bordure bg-jr-surface px-4 py-3 text-sm text-jr-faible">Aucun agent actif et éligible n’a été trouvé.</p>
        )}

        <section id="configuration-planning" className="scroll-mt-6 rounded-xl border border-jr-bordure bg-jr-surface p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
            <label className="text-sm font-medium text-jr-doux">
              <span className="mb-1.5 block">Mois de campagne</span>
              <input type="month" value={month} onChange={(event) => {
                const next = event.target.value;
                if (!next) return;
                setMonth(next);
                const [start, end] = startRangeForMonth(next);
                setDateDebut(start);
                setDateFin(end);
                setCampaignId('');
                setDuplicateCampaign(null);
                setError('');
              }} className="jr-field w-full rounded-md border px-3 py-2.5" />
            </label>
            <label className="text-sm font-medium text-jr-doux">
              <span className="mb-1.5 block">Début du planning</span>
              <input type="date" value={dateDebut} min={`${month}-01`} max={monthEnd} disabled={Boolean(activeCampaign && activeCampaign.statut !== 'BROUILLON')} onChange={(event) => { const nextStart = event.target.value; setDateDebut(nextStart); setDateFin(finDernierCycleDuMois(nextStart)); }} className="jr-field w-full rounded-md border px-3 py-2.5 disabled:opacity-70" />
            </label>
            <label className="text-sm font-medium text-jr-doux">
              <span className="mb-1.5 block">Fin du planning</span>
              <input type="date" value={dateFin} min={dateDebut ? ajouterJours(dateDebut, 2) : `${month}-01`} max={monthEnd} disabled={Boolean(activeCampaign && activeCampaign.statut !== 'BROUILLON')} onChange={(event) => setDateFin(event.target.value)} className="jr-field w-full rounded-md border px-3 py-2.5 disabled:opacity-70" />
            </label>
            {activeCampaign ? (
              <label className="text-sm font-medium text-jr-doux">
                <span className="mb-1.5 block">Planning enregistré</span>
                <select value={campaignId} onChange={(event) => setCampaignId(event.target.value)} className="jr-field w-full min-w-52 rounded-md border px-3 py-2.5">
                  {campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{dateLabel(campaign.date_debut)} – {dateLabel(campaign.date_fin)} · {campaign.statut}</option>)}
                </select>
              </label>
            ) : (
              <button type="button" onClick={createCampaign} disabled={saving || loading || !draftDatesValid} className="jr-btn jr-btn-elec inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold disabled:opacity-60">
                <Plus size={16} />{saving ? 'Enregistrement…' : 'Créer un brouillon'}
              </button>
            )}
          </div>
          <p className="mt-3 text-sm text-jr-doux">
            Mois sélectionné : <strong>{monthLabel(month)}</strong>
            {dateDebut && dateFin && (
              <span> · Période : du {dateLabel(dateDebut, { day: '2-digit', month: '2-digit', year: 'numeric' })} au {dateLabel(dateFin, { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
            )}
          </p>
          {!draftDatesValid && (
            <p role="alert" className="mt-2 text-sm text-jr-err">
              Choisissez une période du mois composée d’un ou plusieurs cycles complets de trois jours.
            </p>
          )}
          {activeCampaign && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-jr-bordure pt-4">
              <div className="text-sm text-jr-doux">
                <span className="font-semibold">{dateLabel(activeCampaign.date_debut)} – {dateLabel(activeCampaign.date_fin)}</span>
                <span className="ml-2 rounded-full border border-jr-bordure bg-jr-eau-pale px-2.5 py-1 text-xs font-semibold">{activeCampaign.statut}</span>
                <span className="ml-2 text-jr-faible">{campaignsMissions.length} mission{campaignsMissions.length > 1 ? 's' : ''} affichée{campaignsMissions.length > 1 ? 's' : ''} / {activeCampaign.nombre_missions ?? campaignsMissions.length} enregistrée{Number(activeCampaign.nombre_missions ?? campaignsMissions.length) > 1 ? 's' : ''}</span>
              </div>
              {activeHiddenCount > 0 && (
                <p className="text-xs text-jr-faible">{activeHiddenCount} mission{activeHiddenCount > 1 ? 's associées à des abonnés supprimés sont conservées mais masquées' : ' associée à un abonné supprimé est conservée mais masquée'}.</p>
              )}
              {activeCampaign.statut === 'BROUILLON' && (
                <div className="flex flex-wrap gap-2">
                  {campaignDatesDirty && (
                    <button type="button" onClick={saveCampaignDates} disabled={saving || !draftDatesValid} className="jr-btn inline-flex items-center gap-2 rounded-md border border-jr-bordure px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50">
                      <Save size={16} />{saving ? 'Enregistrement…' : 'Enregistrer les dates'}
                    </button>
                  )}
                  <button type="button" onClick={publishCampaign} disabled={saving || campaignsMissions.length === 0 || campaignDatesDirty || !campaignDatesValid} className="jr-btn jr-btn-bleu inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50">
                    <Check size={16} />Publier le planning
                  </button>
                </div>
              )}
              <button type="button" onClick={preparerMoisSuivant} disabled={saving} className="inline-flex items-center gap-2 rounded-md border border-jr-bordure px-4 py-2.5 text-sm font-semibold text-jr-doux hover:bg-jr-eau-pale disabled:opacity-60">
                <CalendarDays size={16} />Préparer le planning du mois suivant
              </button>
            </div>
          )}
        </section>

        {activeCampaign && (
          <>
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6" aria-label="Récapitulatif des missions">
              {['PLANIFIEE', 'EN_ATTENTE', 'EN_COURS', 'TERMINEE', 'A_REPROGRAMMER'].map((status) => (
                <div key={status} className="rounded-lg border border-jr-bordure bg-jr-surface px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-jr-faible">{STATUS[status].label}</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums" style={{ color: STATUS[status].color }}>{counts[status] || 0}</p>
                </div>
              ))}
              <div className="rounded-lg border border-jr-bordure bg-jr-surface px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-jr-attention">En retard</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-jr-attention">{missionsEnRetard}</p>
              </div>
            </section>

            <section id="preparer-missions" className="scroll-mt-6 rounded-xl border border-jr-bordure bg-jr-surface p-5 shadow-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div>
                  <h3 className="font-bold text-jr-titre">Calendrier de la campagne</h3>
                  <p className="mt-1 text-sm text-jr-faible">Trois indicateurs distincts par journée : missions prévues, interventions réellement réalisées et consommations vérifiées par un relevé.</p>
                </div>
                <CalendarDays size={19} className="text-jr-lien" />
              </div>
              <label className="mt-4 block max-w-sm text-sm font-medium text-jr-doux">
                <span className="mb-1.5 block">Cycle de trois jours</span>
                <select value={selectedCycle?.preparation || ''} onChange={(event) => { setCycleStart(event.target.value); setSelectedPlanningDay(null); }} className="jr-field w-full rounded-md border px-3 py-2.5" disabled={!campaignCycles.length}>
                  {campaignCycles.map((cycle) => <option key={cycle.preparation} value={cycle.preparation}>Cycle {cycle.numero} · Préparation le {dateLabel(cycle.preparation, { day: '2-digit', month: '2-digit', year: 'numeric' })}</option>)}
                </select>
              </label>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {calendrier.map((day) => (
                  <button key={day.date} type="button" aria-label={`Ouvrir les détails du Jour ${day.numero}, ${day.roleCourt}, ${dateLabel(day.date)}`} onClick={() => { setAgentsReplies([]); setSelectedPlanningDay(day); }} className="rounded-lg border border-jr-bordure p-3 text-left transition-colors hover:bg-jr-eau-pale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jr-elec motion-reduce:transition-none">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-jr-faible">{`Jour ${day.numero}`}</span>
                      <span className="text-xs font-semibold text-jr-doux">{dateLabel(day.date, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                    </span>
                    <span className="mt-1 block font-semibold text-jr-texte">{day.roleCourt}</span>
                    <span className="mt-0.5 block text-xs text-jr-faible">{day.role}</span>
                    <span className="mt-1 block text-xs text-jr-doux">
                      {day.numero === 1 ? 'Date de préparation :' : 'Date prévue :'}{' '}
                      {dateLabel(day.date, { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </span>
                    {day.numero === 1 && (
                      <span className="mt-0.5 block text-xs font-semibold text-jr-doux">
                        {affectationsPreparees.length
                          ? `${affectationsPreparees.length} Agent${affectationsPreparees.length > 1 ? 's' : ''} · ${quartiersPreparees.length} quartier${quartiersPreparees.length > 1 ? 's' : ''} préparé${quartiersPreparees.length > 1 ? 's' : ''}`
                          : 'Aucun Agent ni quartier préparé'}
                      </span>
                    )}
                    {day.numero > 1 && (
                      <span className="mt-0.5 block text-xs text-jr-doux">
                        {day.prevues === 0
                          ? 'Aucune descente prévue ce jour'
                          : day.realisees > 0
                            ? `${day.realisees} intervention${day.realisees > 1 ? 's' : ''} sur ${day.prevues} transmise${day.realisees > 1 ? 's' : ''}`
                            : 'Visite non encore effectuée'}
                      </span>
                    )}
                    {day.numero > 1 && day.enRetard > 0 && (
                      <span className="mt-0.5 block text-xs font-medium text-jr-attention">
                        {day.enRetard} réalisée{day.enRetard > 1 ? 's' : ''} après la date prévue
                      </span>
                    )}
                    <span className="mt-3 grid grid-cols-3 gap-1 text-center">
                      <span>
                        <span className="block text-lg font-bold tabular-nums text-jr-titre">{day.prevues}</span>
                        <span className="block text-[10px] font-semibold uppercase tracking-wide text-jr-faible">Prévues</span>
                      </span>
                      <span>
                        <span className="block text-lg font-bold tabular-nums text-jr-elec">{day.realisees}</span>
                        <span className="block text-[10px] font-semibold uppercase tracking-wide text-jr-faible">Réalisées</span>
                      </span>
                      <span>
                        <span className="block text-lg font-bold tabular-nums text-jr-eau">{day.verifiees}</span>
                        <span className="block text-[10px] font-semibold uppercase tracking-wide text-jr-faible">Vérifiées</span>
                      </span>
                    </span>
                    {day.restantes > 0 && (
                      <span className="mt-2 block text-xs font-medium text-jr-attention">{day.restantes} mission{day.restantes > 1 ? 's' : ''} à effectuer</span>
                    )}
                    {day.realisees > 0 && (
                      <span className="mt-1 block text-xs font-medium text-jr-ok">Interventions enregistrées</span>
                    )}
                  </button>
                ))}
              </div>

              <div className="mt-5 rounded-lg border border-jr-bordure bg-jr-eau-pale/40 p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h4 className="font-semibold text-jr-titre">Bilan de la campagne</h4>
                  <span className="text-xs text-jr-faible">Une mission prévue n’est pas une visite ; une visite n’est pas une consommation vérifiée.</span>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
                  {[
                    ['Missions', bilan.missions, 'text-jr-titre'],
                    ['Abonnés', bilan.abonnes, 'text-jr-titre'],
                    ['Compteurs', bilan.compteurs, 'text-jr-titre'],
                    ['Visites réalisées', bilan.visites, 'text-jr-elec'],
                    ['Consommations vérifiées', bilan.verifiees, 'text-jr-eau'],
                    ['En attente', bilan.enAttente, 'text-jr-attention'],
                    ['Suivis à compléter', bilan.suivis, 'text-jr-attention'],
                    ['Annulées', bilan.annulees, 'text-jr-faible'],
                  ].map(([label, valeur, couleur]) => (
                    <div key={label}>
                      <dt className="text-[11px] font-semibold uppercase tracking-wide text-jr-faible">{label}</dt>
                      <dd className={`mt-0.5 text-xl font-bold tabular-nums ${couleur}`}>{valeur}</dd>
                    </div>
                  ))}
                </dl>
                {activeCampaign.statut === 'PUBLIEE' && (
                  <div className="mt-4 border-t border-jr-bordure pt-3">
                    {calendrierPretPourCloture ? (
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm font-medium text-jr-ok">
                          Toutes les descentes prévues sont terminées : examinez les résultats, puis clôturez la campagne.
                        </p>
                        <button type="button" onClick={() => cloturerCampagne(false)} disabled={saving} className="jr-btn jr-btn-bleu inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold disabled:opacity-60">
                          <CheckCircle2 size={16} />{saving ? 'Clôture…' : 'Clôturer la campagne'}
                        </button>
                      </div>
                    ) : (
                      <p className="text-sm text-jr-faible">
                        La campagne ne peut pas être clôturée tant que {calendrierEnAttente} mission{calendrierEnAttente > 1 ? 's restent' : ' reste'} à effectuer ou à transmettre. La clôture n’est jamais automatique.
                      </p>
                    )}
                    {clotureConfirmation && (
                      <div role="alert" className="mt-3 rounded-lg border border-jr-elec-bordure bg-jr-elec-pale px-3 py-3 text-sm text-jr-texte">
                        <p className="font-semibold">{clotureConfirmation}</p>
                        <p className="mt-1 text-jr-doux">Les relevés déjà enregistrés sont conservés ; les visites sans index restent consultables en suivi.</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button type="button" onClick={() => cloturerCampagne(true)} disabled={saving} className="jr-btn jr-btn-bleu rounded-md px-3.5 py-2 text-sm font-semibold disabled:opacity-60">Clôturer et conserver ces suivis</button>
                          <button type="button" onClick={() => setClotureConfirmation('')} className="rounded-md border border-jr-bordure px-3.5 py-2 text-sm font-semibold text-jr-doux hover:bg-jr-surface">Traiter les suivis d’abord</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-jr-bordure bg-jr-surface p-5 shadow-sm">
                <h3 className="font-bold text-jr-titre">Missions par quartier</h3>
                <div className="mt-3 divide-y divide-jr-bordure">
                  {quartierCounts.length ? quartierCounts.map(([name, count]) => <div key={name} className="flex justify-between gap-3 py-2.5 text-sm"><span className="text-jr-doux">{name}</span><span className="font-semibold tabular-nums text-jr-texte">{count}</span></div>) : <p className="py-4 text-sm text-jr-faible">Aucune mission enregistrée.</p>}
                </div>
              </div>
              <div className="rounded-xl border border-jr-bordure bg-jr-surface p-5 shadow-sm">
                <h3 className="font-bold text-jr-titre">Missions par Agent</h3>
                <div className="mt-3 divide-y divide-jr-bordure">
                  {agentCounts.length ? agentCounts.map(([id, agent]) => <div key={id} className="flex justify-between gap-3 py-2.5 text-sm"><span className="text-jr-doux">{agent.name}{agent.identifiant ? <span className="ml-2 text-xs text-jr-faible">{agent.identifiant}</span> : null}</span><span className="font-semibold tabular-nums text-jr-texte">{agent.count}</span></div>) : <p className="py-4 text-sm text-jr-faible">Aucune mission enregistrée.</p>}
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-jr-bordure bg-jr-surface p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="font-bold text-jr-titre">Planning opérationnel et carte</h3>
                  <p className="mt-1 text-sm text-jr-faible">Les missions terminées ou annulées restent dans le suivi historique, sans marqueur opérationnel. Les adresses sans GPS vérifié n’ont pas de marqueur.</p>
                </div>
                <span className="inline-flex items-center gap-2 text-xs text-jr-faible"><MapPin size={15} />{missionsCarte.length} mission{missionsCarte.length > 1 ? 's' : ''} active{missionsCarte.length > 1 ? 's' : ''}</span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <label className="relative sm:col-span-2 xl:col-span-1">
                  <span className="sr-only">Rechercher une mission</span>
                  <Search size={15} className="absolute left-3 top-3 text-jr-faible" />
                  <input value={filters.search || ''} onChange={(event) => setFilters((previous) => ({ ...previous, search: event.target.value }))} placeholder="Rechercher…" className="jr-field w-full rounded-md border py-2.5 pl-9 pr-3 text-sm" />
                </label>
                <label>
                  <span className="sr-only">Filtrer par quartier</span>
                  <select value={filters.quartier} onChange={(event) => setFilters((previous) => ({ ...previous, quartier: event.target.value }))} className="jr-field w-full rounded-md border px-3 py-2.5 text-sm">
                    <option value="">Tous les quartiers</option><option value="__none__">Quartier non renseigné</option>{filterValues.quartiers.map((quarter) => <option key={quarter} value={quarter}>{quarter}</option>)}
                  </select>
                </label>
                <label>
                  <span className="sr-only">Filtrer par Agent</span>
                  <select value={filters.agent} onChange={(event) => setFilters((previous) => ({ ...previous, agent: event.target.value }))} className="jr-field w-full rounded-md border px-3 py-2.5 text-sm">
                    <option value="">Tous les agents</option>
                    {agentsLoading && <option value="__agents_loading" disabled>Chargement des agents…</option>}
                    {agentsError && <option value="__agents_error" disabled>Agents indisponibles</option>}
                    {!agentsLoading && !agentsError && agents.length === 0 && <option value="__agents_empty" disabled>Aucun agent éligible</option>}
                    {filterValues.agents.map((agent) => <option key={agent.id} value={String(agent.id)}>{agent.label}</option>)}
                  </select>
                </label>
                <label>
                  <span className="sr-only">Filtrer par date</span>
                  <input type="date" value={filters.date} onChange={(event) => setFilters((previous) => ({ ...previous, date: event.target.value }))} className="jr-field w-full rounded-md border px-3 py-2 text-sm" />
                </label>
                <label>
                  <span className="sr-only">Filtrer par statut</span>
                  <select value={filters.statut} onChange={(event) => setFilters((previous) => ({ ...previous, statut: event.target.value }))} className="jr-field w-full rounded-md border px-3 py-2.5 text-sm">
                    <option value="">Tous les statuts</option>{Object.entries(STATUS).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
                  </select>
                </label>
              </div>
              {filters.date && <button type="button" onClick={() => setFilters((previous) => ({ ...previous, date: '' }))} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-jr-lien underline underline-offset-2">Effacer la date <X size={12} /></button>}

              <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="space-y-2">
                  <CarteLeaflet
                    markers={marqueursCarte}
                    selectedId={mapSelectedId}
                    onSelect={selectionnerCarte}
                    height={360}
                    emptyMessage="Aucun abonné géolocalisé pour ces filtres"
                  />
                  <p className="text-[11px] text-jr-faible">
                    <strong className="text-jr-texte">{marqueursCarte.length}</strong> abonné{marqueursCarte.length > 1 ? 's' : ''} géolocalisé{marqueursCarte.length > 1 ? 's' : ''}
                    {' · '}
                    <strong className="text-jr-texte">{missionsSansGps.length}</strong> sans coordonnées GPS
                    {' · '}cliquez sur un marqueur pour ouvrir la fiche de l’abonné.
                  </p>
                </div>
                <div className="max-h-[390px] space-y-2 overflow-y-auto pr-1" aria-label="Missions visibles sur la carte">
                  {missionsCarteEtCible.length ? missionsCarteEtCible.map((mission) => {
                    const status = STATUS[mission.statut] || STATUS.EN_ATTENTE;
                    const mapId = idCarte(mission);
                    const selected = mapId === String(mapSelectedId);
                    return (
                      <button key={mapId} type="button" onClick={() => mission.isTarget ? setSelectedTargetId(String(mission.compteur_id)) : (setSelectedTargetId(''), setSelectedMissionId(mission.mission_id))} className={`w-full rounded-lg border p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jr-elec ${selected ? 'border-jr-eau bg-jr-eau-pale' : 'border-jr-bordure hover:bg-jr-eau-pale'}`}>
                        <span className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold text-jr-texte">{mission.isTarget ? 'À planifier · ' : `Mission #${mission.mission_id} · `}{mission.abonne_prenom} {mission.abonne_nom} · {mission.numero_compteur}</span>
                          <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-white" style={{ backgroundColor: mission.isTarget ? '#7c3aed' : status.color }}>{mission.isTarget ? 'À planifier' : status.label}</span>
                        </span>
                        <span className="mt-1 block text-xs text-jr-doux">{mission.adresse || 'Adresse incomplète'} · {mission.quartier || 'Quartier non renseigné'}{mission.commune ? ` · ${mission.commune}` : ''}</span>
                        <span className="mt-1 block text-xs text-jr-faible">{mission.type_compteur === 'EAU' ? 'Eau' : 'Électricité'} · Date de visite prévue : {dateLabel(mission.date_prevue)} · Date réelle : {mission.date_visite_reelle ? dateLabel(mission.date_visite_reelle) : 'Visite non encore effectuée'} · {mission.numero_abonne} · {mission.agent_prenom || 'Agent non affecté'} {mission.agent_nom || ''}</span>
                        {!coordonneesValides(mission) && <span className="mt-1 block text-xs text-jr-attention">Position GPS non renseignée — ouvrez la fiche pour la définir</span>}
                      </button>
                    );
                  }) : <p className="rounded-lg border border-dashed border-jr-bordure p-6 text-center text-sm text-jr-faible">Aucune mission opérationnelle ne correspond aux filtres.</p>}
                </div>
              </div>

              {missionSelectionnee && (
                <div className="mt-4">
                  <FicheAbonneControle
                    mission={missionSelectionnee}
                    onClose={() => {
                      setSelectedMissionId(null);
                      setSelectedTargetId('');
                    }}
                    onOuvrirFiche={(mission) => setAbonneDetail(mission)}
                    onLocaliser={setAbonneALocaliser}
                  />
                </div>
              )}

              {missionsSansGps.length > 0 && (
                <details className="mt-3 rounded-lg border border-dashed border-jr-bordure bg-jr-eau-pale/30 p-3">
                  <summary className="cursor-pointer text-sm font-semibold text-jr-texte">
                    Abonnés à localiser — {missionsSansGps.length} sans coordonnées GPS
                  </summary>
                  <p className="mt-1 text-xs text-jr-faible">
                    Ces abonnés restent dans le planning et dans le suivi. Sélectionnez-en un ci-dessous : sa fiche permet de rechercher son adresse et de définir sa position exacte sur la carte, sans quitter le planning.
                  </p>
                  <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
                    {missionsSansGps.map((mission) => (
                      <li key={idCarte(mission)}>
                        <button
                          type="button"
                          onClick={() => selectionnerCarte(idCarte(mission))}
                          className="flex w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-jr-bordure bg-jr-surface px-2.5 py-2 text-left text-xs text-jr-doux transition-colors hover:bg-jr-eau-pale"
                        >
                          <span className="font-semibold text-jr-texte">
                            {mission.abonne_prenom} {mission.abonne_nom}
                          </span>
                          <span>· {mission.quartier || 'quartier non renseigné'}</span>
                          <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-jr-attention/40 bg-jr-attention/10 px-2 py-0.5 text-[10px] font-semibold text-jr-attention">
                            <MapPin size={10} aria-hidden="true" /> GPS non renseigné
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </section>

            <section id="liste-cibles-controle" className="scroll-mt-6 rounded-xl border border-jr-bordure bg-jr-surface p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="font-bold text-jr-titre">Étape 2 · Abonnés et compteurs à planifier</h3>
                  <p className="mt-1 text-sm text-jr-faible">Après le récapitulatif des Agents et des quartiers, choisissez ici les compteurs, leur date de visite et l’Agent responsable. Adresse, quartier et dernier relevé viennent de PostgreSQL.</p>
                </div>
                <span className="text-sm text-jr-faible">{targetRows.length} compteur{targetRows.length > 1 ? 's' : ''}</span>
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-1">
                <label className="relative max-w-3xl">
                  <span className="sr-only">Rechercher parmi les abonnés</span><Search size={15} className="absolute left-3 top-3 text-jr-faible" />
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nom, référence, adresse ou compteur" className="jr-field w-full rounded-md border py-2.5 pl-9 pr-3 text-sm" />
                </label>
              </div>
              <div className="mt-3 space-y-3 rounded-md border border-jr-bordure bg-jr-eau-pale/40 p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="text-sm text-jr-doux">
                    <p className="text-xs font-semibold uppercase tracking-wide text-jr-faible">Étape 1 · Agents et quartiers</p>
                    <p className="mt-1"><strong>{agentIdsSelectionnes.length}</strong> Agent{agentIdsSelectionnes.length > 1 ? 's' : ''} sélectionné{agentIdsSelectionnes.length > 1 ? 's' : ''} · <strong>{quartiersSelectionnes.length}</strong> quartier{quartiersSelectionnes.length > 1 ? 's' : ''} retenu{quartiersSelectionnes.length > 1 ? 's' : ''}.</p>
                    <p className="mt-1 text-xs text-jr-faible">
                      Quartiers : {quartiersSelectionnes.length === 0 ? 'tous les quartiers' : quartiersSelectionnes.map((quartier) => quartier === '__none__' ? 'quartier non renseigné' : quartier).join(', ')}.
                    </p>
                    {affectationsPreparees.length > 0 ? (
                      <p className="mt-1 text-xs font-semibold text-jr-texte">Préparation enregistrée dans le planning #{activeCampaign?.id} : elle reste visible dans le détail du Jour 1 après actualisation.</p>
                    ) : (
                      <p className="mt-1 text-xs text-jr-attention">Aucune préparation n’est encore enregistrée. Ouvrez « Modifier la préparation » : les Agents et les quartiers choisis seront conservés en base avant le choix des compteurs.</p>
                    )}
                  </div>
                  <button type="button" onClick={ouvrirPreparationModal} disabled={!campaignEditable || loading || agentsLoading} className="inline-flex items-center gap-2 rounded-md border border-jr-bordure bg-jr-surface px-3 py-2 text-sm font-semibold text-jr-doux hover:bg-jr-eau-pale disabled:cursor-not-allowed disabled:opacity-50">
                    <Users size={15} />Modifier la préparation
                  </button>
                </div>
                {affectationsPreparees.length > 0 && (
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {affectationsPreparees.map((agent) => (
                      <li key={agent.cle} className="rounded-md border border-jr-bordure bg-jr-surface p-2.5">
                        <p className="text-sm font-semibold text-jr-texte">{agent.nom}<span className="ml-1 text-xs font-normal text-jr-faible">· {agent.identifiant || `Agent #${agent.cle}`}</span></p>
                        <p className="mt-1 text-xs text-jr-doux">{agent.quartiers.map((quartier) => quartier || 'Quartier non renseigné').join(' · ') || 'Aucun quartier attribué'}</p>
                        <p className="mt-1 text-[11px] text-jr-faible">Jour 2 · {dateLabel(preparationModalCycle.descente, { day: '2-digit', month: '2-digit', year: 'numeric' })} — Jour 3 · {dateLabel(preparationModalCycle.finalisation, { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="mt-3 rounded-md border border-jr-bordure p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-jr-faible">Périmètre des quartiers retenus</p>
                <dl className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    ['Abonnés actifs', perimetreQuartiers.abonnes],
                    ['Compteurs actifs', perimetreQuartiers.compteurs],
                    ['Abonnés sans compteur actif', perimetreQuartiers.sansCompteur],
                    ['Missions enregistrées', missionsQuartiersRetenus.total],
                    ['Sélection en cours', repartitionSelection.missions],
                  ].map(([label, valeur]) => (
                    <div key={label}>
                      <dt className="text-[11px] font-semibold uppercase tracking-wide text-jr-faible">{label}</dt>
                      <dd className="mt-0.5 text-lg font-bold tabular-nums text-jr-titre">{valeur}</dd>
                    </div>
                  ))}
                </dl>
                {missionsQuartiersRetenus.total > 0 && (
                  <p className="mt-2 text-xs text-jr-doux">
                    Répartition réellement enregistrée : <strong>{missionsQuartiersRetenus.jour2}</strong> mission{missionsQuartiersRetenus.jour2 > 1 ? 's' : ''} au Jour 2 · <strong>{missionsQuartiersRetenus.jour3}</strong> au Jour 3, pour {missionsQuartiersRetenus.abonnes} abonné{missionsQuartiersRetenus.abonnes > 1 ? 's' : ''} et {missionsQuartiersRetenus.compteurs} compteur{missionsQuartiersRetenus.compteurs > 1 ? 's' : ''}.
                  </p>
                )}
                {perimetreQuartiers.sansCompteur > 0 && (
                  <p className="mt-2 text-xs text-jr-attention">
                    {perimetreQuartiers.sansCompteur} abonné{perimetreQuartiers.sansCompteur > 1 ? 's actifs ne possèdent aucun compteur actif' : ' actif ne possède aucun compteur actif'} : {perimetreQuartiers.sansCompteurListe.slice(0, 3).map((abonne) => `${abonne.abonne_prenom || ''} ${abonne.abonne_nom || ''}`.trim() || abonne.numero_abonne).join(', ')}{perimetreQuartiers.sansCompteur > 3 ? '…' : ''}. Aucune mission ne peut leur être créée tant qu’aucun compteur actif n’est enregistré.
                  </p>
                )}
                {quartiersPartages.length > 0 && (
                  <p role="status" className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-900">
                    Quartier{quartiersPartages.length > 1 ? 's' : ''} attribué{quartiersPartages.length > 1 ? 's' : ''} à plusieurs Agents ({quartiersPartages.map((quartier) => quartier === '__none__' ? 'non renseigné' : quartier).join(', ')}) : la répartition des compteurs entre ces Agents reste à préciser, aucun Agent n’est préaffecté automatiquement.
                  </p>
                )}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-jr-bordure pt-3">
                  <p className="text-sm text-jr-doux">
                    Répartition : <strong>{repartitionSelection.jour2}</strong> au Jour 2 · <strong>{repartitionSelection.jour3}</strong> au Jour 3
                    {repartitionSelection.sansDate > 0 ? ` · ${repartitionSelection.sansDate} sans date de terrain` : ''}
                    {repartitionSelection.abonnes !== repartitionSelection.missions
                      ? ` · ${repartitionSelection.abonnes} abonné${repartitionSelection.abonnes > 1 ? 's' : ''} pour ${repartitionSelection.missions} compteur${repartitionSelection.missions > 1 ? 's' : ''}`
                      : ''}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => affecterJourSelection(2)} disabled={!campaignEditable || !missionDateRangeValid || !repartitionSelection.missions} className="rounded-md border border-jr-bordure px-3 py-2 text-xs font-semibold text-jr-doux hover:bg-jr-eau-pale disabled:cursor-not-allowed disabled:opacity-50">Tout au Jour 2</button>
                    <button type="button" onClick={() => affecterJourSelection(3)} disabled={!campaignEditable || !missionDateRangeValid || !repartitionSelection.missions} className="rounded-md border border-jr-bordure px-3 py-2 text-xs font-semibold text-jr-doux hover:bg-jr-eau-pale disabled:cursor-not-allowed disabled:opacity-50">Tout au Jour 3</button>
                    <button type="button" onClick={repartirSelectionSurDeuxJours} disabled={!campaignEditable || !missionDateRangeValid || repartitionSelection.missions < 2} className="rounded-md border border-jr-bordure px-3 py-2 text-xs font-semibold text-jr-doux hover:bg-jr-eau-pale disabled:cursor-not-allowed disabled:opacity-50">Répartir sur les deux journées</button>
                  </div>
                </div>
              </div>
              {!activeCampaign && <p className="mt-4 rounded-md border border-jr-elec-bordure bg-jr-elec-pale px-3 py-2 text-sm text-jr-doux">Créez d’abord le brouillon de campagne pour pouvoir ajouter des missions.</p>}
              <div className="mt-4 overflow-x-auto rounded-lg border border-jr-bordure">
                <table className="min-w-[1240px] w-full text-left text-sm">
                  <thead className="bg-jr-eau-pale text-[11px] uppercase tracking-wide text-jr-faible">
                    <tr><th className="px-3 py-3">Abonné</th><th className="px-3 py-3">Adresse / quartier</th><th className="px-3 py-3">Compteur</th><th className="px-3 py-3">Dernier relevé</th><th className="px-3 py-3">Date de visite</th><th className="px-3 py-3">Agent</th><th className="px-3 py-3">Suivi 3 jours</th><th className="px-3 py-3">Choisir</th></tr>
                  </thead>
                  <tbody className="divide-y divide-jr-bordure">
                    {targetRows.map((target) => {
                      const selected = selection[target.compteur_id] || {};
                      const existingStatus = target.mission_existante_statut;
                      const canRepeat = ['TERMINEE', 'A_REPROGRAMMER'].includes(existingStatus);
                      const alreadyScheduled = Boolean(target.mission_existante_id);
                      const canSelect = !alreadyScheduled || canRepeat;
                      const existingMission = campaignsMissions.find((mission) => Number(mission.compteur_id) === Number(target.compteur_id));
                      const existingDate = dateInput(existingMission?.date_prevue);
                      const existingDateIsAvailable = existingDate >= missionDateMin && existingDate <= missionDateMax && estDateTerrain(existingDate, campaignStart, campaignEnd);
                      const defaultDate = existingDateIsAvailable ? existingDate : (missionDateRangeValid ? missionDateMin : '');
                      const mapTargetId = String(target.compteur_id);
                      return (
                        <tr key={target.compteur_id} className={`align-top ${selectedTargetId === mapTargetId ? 'bg-jr-eau-pale/50' : ''}`}>
                          <td className="px-3 py-3"><button type="button" onClick={() => setSelectedTargetId(mapTargetId)} className="text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jr-elec"><span className="font-semibold text-jr-texte">{target.abonne_prenom} {target.abonne_nom}</span><span className="mt-0.5 block text-xs text-jr-faible">{target.numero_abonne} · #{target.abonne_id}</span></button></td>
                          <td className="max-w-64 px-3 py-3"><p className="text-jr-texte">{target.adresse || 'Adresse incomplète'}</p><p className="mt-0.5 text-xs text-jr-faible">{target.quartier || 'Quartier non renseigné'}{target.commune ? ` · ${target.commune}` : ''}</p>{coordonneesValides(target) ? <button type="button" onClick={() => setAbonneALocaliser(target)} className="mt-1.5 inline-flex items-center gap-1 rounded border border-jr-ok-bordure bg-jr-ok-pale px-2 py-1 text-[11px] font-semibold text-jr-ok transition-colors hover:bg-jr-surface"><MapPin size={11} aria-hidden="true" />Position GPS · modifier</button> : <button type="button" onClick={() => setAbonneALocaliser(target)} className="mt-1.5 inline-flex items-center gap-1 rounded border border-jr-attention/50 bg-jr-attention/10 px-2 py-1 text-[11px] font-semibold text-jr-attention transition-colors hover:bg-jr-attention/20"><MapPin size={11} aria-hidden="true" />Définir la position GPS</button>}</td>
                          <td className="px-3 py-3"><p className="font-semibold text-jr-texte">{target.numero_compteur}</p><p className="text-xs text-jr-faible">{target.type_compteur === 'EAU' ? 'Eau' : 'Électricité'} · #{target.compteur_id}</p></td>
                          <td className="px-3 py-3 text-jr-doux">{dateLabel(target.dernier_releve)}</td>
                          <td className="px-3 py-3"><input aria-label={`Date de visite prévue du contrôle ${target.numero_compteur}`} type="date" value={selected.date_prevue || existingDate || defaultDate} min={missionDateMin} max={missionDateMax} disabled={!selected.selected || !campaignEditable || !missionDateRangeValid} onChange={(event) => { setSelectedTargetId(mapTargetId); setSelection((previous) => ({ ...previous, [target.compteur_id]: { ...previous[target.compteur_id], date_prevue: event.target.value } })); }} className="jr-field rounded-md border px-2 py-2 text-xs disabled:opacity-60" /></td>
                          <td className="px-3 py-3"><select aria-label={`Agent pour ${target.numero_compteur}`} value={selected.agent_id || ''} disabled={!selected.selected || !campaignEditable || !agentsPourAffectation.length} onChange={(event) => { setSelectedTargetId(mapTargetId); setSelection((previous) => ({ ...previous, [target.compteur_id]: { ...previous[target.compteur_id], agent_id: event.target.value } })); }} className="jr-field min-w-40 rounded-md border px-2 py-2 text-xs disabled:opacity-60"><option value="">À affecter</option>{agentsPourAffectation.map((agent) => <option key={agent.id} value={agent.id}>{agent.prenom} {agent.nom} · {agent.identifiant}</option>)}</select></td>
                          <td className="px-3 py-3"><label className="inline-flex items-center gap-2 text-xs font-medium text-jr-doux"><input type="checkbox" checked={Boolean(selected.suivi_periodique)} disabled={!selected.selected || !campaignEditable} onChange={(event) => setSelection((previous) => ({ ...previous, [target.compteur_id]: { ...previous[target.compteur_id], suivi_periodique: event.target.checked } }))} />Répéter</label><textarea aria-label={`Consignes pour ${target.numero_compteur}`} rows={2} maxLength={1000} value={selected.observations || ''} disabled={!selected.selected || !campaignEditable} onChange={(event) => setSelection((previous) => ({ ...previous, [target.compteur_id]: { ...previous[target.compteur_id], observations: event.target.value } }))} placeholder="Consigne facultative" className="jr-field mt-2 min-w-48 rounded-md border px-2 py-2 text-xs disabled:opacity-60" /></td>
                          <td className="px-3 py-3"><label className="inline-flex items-center gap-2 text-xs font-medium text-jr-doux"><input type="checkbox" checked={Boolean(selected.selected)} disabled={!canSelect || !campaignEditable || !missionDateRangeValid} onChange={(event) => { if (event.target.checked) setSelectedTargetId(mapTargetId); setSelection((previous) => ({ ...previous, [target.compteur_id]: { ...previous[target.compteur_id], selected: event.target.checked, agent_id: previous[target.compteur_id]?.agent_id || (canRepeat && existingMission?.agent_id ? String(existingMission.agent_id) : ''), date_prevue: previous[target.compteur_id]?.date_prevue || defaultDate, nouvelle_visite: canRepeat } })); }} />{alreadyScheduled ? (canRepeat ? 'Nouvelle visite' : `Déjà ${STATUS[existingStatus]?.label || 'planifié'}`) : 'Ajouter'}</label></td>
                        </tr>
                      );
                    })}
                    {!targetRows.length && <tr><td colSpan={8} className="px-3 py-10 text-center text-sm text-jr-faible">Aucun abonné actif ne correspond à la recherche.</td></tr>}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-jr-faible">
                Chaque cycle contient un jour de préparation, un jour de descente et un jour de finalisation. Les dates terrain sont les jours 2 et 3 des cycles complets, jusqu’au {dateLabel(lastControlDate)}.
              </p>
              {!missionDateRangeValid && activeCampaign && (
                <p role="alert" className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  {campaignDatesDirty
                    ? 'Enregistrez les nouvelles dates du brouillon avant d’ajouter ou de modifier des missions.'
                    : activeCampaign.statut === 'BROUILLON' && !campaignHasControlDates
                    ? `Aucun cycle complet n’est disponible pour ${monthLabel(activeCampaign.mois)}. Choisissez une période contenant au moins trois jours.`
                      : activeCampaign.statut === 'BROUILLON'
                        ? `Les jours de terrain prévus pour ${monthLabel(activeCampaign.mois)} sont déjà passés ou hors période. Ajustez les dates du brouillon ; la préparation à l’avance reste possible.`
                      : isPublishedCampaign
                        ? `Aucune date terrain future n’est disponible dans les cycles complets du planning. Préparez un nouveau cycle futur.`
                        : 'Ce planning n’accepte plus de nouvelles missions dans son statut actuel.'}
                </p>
              )}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-jr-faible">{selectedTargets.length} compteur{selectedTargets.length > 1 ? 's' : ''} sélectionné{selectedTargets.length > 1 ? 's' : ''}</p>
                  {activeCampaign && selectedTargets.length === 0 && (
                    <p className="mt-1 text-xs text-jr-faible">Sélectionnez au moins un compteur pour l’ajouter au planning.</p>
                  )}
                  {selectedTargets.length > 0 && !selectedDatesValid && (
                    <p role="alert" className="mt-1 text-xs text-jr-err">Corrigez la date de contrôle sélectionnée avant l’ajout.</p>
                  )}
                  {selectedTargets.length > 0 && !selectedAssignmentsValid && (
                    <p role="alert" className="mt-1 text-xs text-jr-err">Sélectionnez un ou plusieurs Agents et affectez-en un à chaque compteur sélectionné.</p>
                  )}
                </div>
                <button type="button" onClick={addMissions} disabled={saving || !campaignEditable || !selectedTargets.length || !missionDateRangeValid || !selectedDatesValid || !selectedAssignmentsValid} className="jr-btn jr-btn-elec inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"><Plus size={16} />Ajouter au planning</button>
              </div>
            </section>

            <section className="rounded-xl border border-jr-bordure bg-jr-surface p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><h3 className="font-bold text-jr-titre">Suivi des missions</h3><p className="mt-1 text-sm text-jr-faible">Les changements enregistrés sont répercutés dans la liste et sur la carte.</p></div>
                <span className="inline-flex items-center gap-2 text-xs text-jr-faible"><Filter size={14} />{visibleMissions.length} affichée{visibleMissions.length > 1 ? 's' : ''} / {campaignsMissions.length}</span>
              </div>
              <div className="mt-4 overflow-x-auto rounded-lg border border-jr-bordure">
                <table className="min-w-[1650px] w-full text-left text-sm">
                  <thead className="bg-jr-eau-pale text-[11px] uppercase tracking-wide text-jr-faible"><tr><th className="px-3 py-3">Abonné / compteur</th><th className="px-3 py-3">Adresse / quartier</th><th className="px-3 py-3">Date de visite prévue</th><th className="px-3 py-3">Date limite</th><th className="px-3 py-3">Agent</th><th className="px-3 py-3">Statut</th><th className="px-3 py-3">Suivi 3 jours</th><th className="px-3 py-3">Date de visite réelle</th><th className="px-3 py-3">Date du relevé</th><th className="px-3 py-3">Résultat de la visite</th><th className="px-3 py-3">Enregistrer</th></tr></thead>
                  <tbody className="divide-y divide-jr-bordure">
                    {visibleMissions.map((mission) => {
                      const draft = draftFor(mission);
                      const terminal = ['TERMINEE', 'ANNULEE'].includes(mission.statut);
                      return (
                        <tr
                          key={mission.mission_id}
                          ref={(node) => {
                            if (node) missionRowsRef.current.set(String(mission.mission_id), node);
                            else missionRowsRef.current.delete(String(mission.mission_id));
                          }}
                          className={`align-top ${String(mission.mission_id) === String(selectedMissionId) ? 'bg-jr-eau-pale/70 outline outline-2 -outline-offset-2 outline-jr-eau' : ''}`}
                        >
                          <td className="px-3 py-3"><p className="font-semibold text-jr-texte">{mission.abonne_prenom} {mission.abonne_nom}</p><p className="mt-0.5 text-xs text-jr-faible">{mission.numero_abonne} · {mission.numero_compteur} · #{mission.compteur_id}</p></td>
                          <td className="max-w-56 px-3 py-3"><p className="text-jr-doux">{mission.adresse || 'Adresse incomplète'}</p><p className="mt-0.5 text-xs text-jr-faible">{mission.quartier || 'Quartier non renseigné'}</p></td>
                          <td className="px-3 py-3"><input type="date" aria-label={`Date prévue mission ${mission.mission_id}`} value={draft.date_prevue} min={missionDateMin} max={missionDateMax} disabled={terminal || activeCampaign.statut === 'CLOTUREE' || !missionDateRangeValid} onChange={(event) => patchDraft(mission.mission_id, 'date_prevue', event.target.value)} className="jr-field rounded-md border px-2 py-2 text-xs disabled:opacity-60" />{missionEnRetard(mission) && <span className="mt-1 block text-xs font-semibold text-jr-attention">En retard</span>}</td>
                          <td className="px-3 py-3 text-xs text-jr-doux">{mission.date_limite ? dateLabel(mission.date_limite) : 'Non renseignée'}</td>
                          <td className="px-3 py-3"><select aria-label={`Agent mission ${mission.mission_id}`} value={draft.agent_id} disabled={terminal || activeCampaign.statut === 'CLOTUREE'} onChange={(event) => patchDraft(mission.mission_id, 'agent_id', event.target.value)} className="jr-field min-w-40 rounded-md border px-2 py-2 text-xs disabled:opacity-60"><option value="">À affecter</option>{agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.prenom} {agent.nom} · {agent.identifiant}</option>)}</select></td>
                          <td className="px-3 py-3"><select aria-label={`Statut mission ${mission.mission_id}`} value={draft.statut} disabled={terminal || activeCampaign.statut === 'CLOTUREE'} onChange={(event) => patchDraft(mission.mission_id, 'statut', event.target.value)} className="jr-field min-w-40 rounded-md border px-2 py-2 text-xs disabled:opacity-60">{statusSelectValues.map((status) => <option key={status} value={status}>{STATUS[status].label}</option>)}{mission.statut === 'EN_COURS' && <option value="EN_COURS">En cours</option>}</select>{mission.motif_reprogrammation && <p className="mt-1 max-w-44 text-xs text-jr-attention" title={mission.motif_reprogrammation}>{mission.motif_reprogrammation}</p>}</td>
                          <td className="px-3 py-3"><label className="inline-flex items-center gap-2 text-xs text-jr-doux"><input type="checkbox" checked={Boolean(draft.suivi_periodique)} disabled={terminal || activeCampaign.statut === 'CLOTUREE'} onChange={(event) => patchDraft(mission.mission_id, 'suivi_periodique', event.target.checked)} />Actif</label><textarea aria-label={`Consignes mission ${mission.mission_id}`} rows={2} maxLength={1000} value={draft.observations || ''} disabled={terminal || activeCampaign.statut === 'CLOTUREE'} onChange={(event) => patchDraft(mission.mission_id, 'observations', event.target.value)} placeholder="Consigne facultative" className="jr-field mt-2 min-w-48 rounded-md border px-2 py-2 text-xs disabled:opacity-60" /></td>
                          <td className="px-3 py-3 text-jr-doux">{mission.date_visite_reelle ? dateLabel(mission.date_visite_reelle, { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Visite non encore effectuée'}</td>
                          <td className="px-3 py-3 text-jr-doux">{dateLabel(mission.date_releve_realisee)}</td>
                          <td className="px-3 py-3 text-xs">
                            {mission.releve_exploitable ? (
                              <span className="font-semibold text-jr-ok">
                                Index {mission.index_releve !== null && mission.index_releve !== undefined ? Number(mission.index_releve).toLocaleString('fr-FR') : 'enregistré'}
                                {mission.consommation_releve !== null && mission.consommation_releve !== undefined
                                  ? ` · ${Number(mission.consommation_releve).toLocaleString('fr-FR')} consommés`
                                  : ''}
                              </span>
                            ) : mission.type_releve === 'INITIAL' ? (
                              <span className="font-semibold text-jr-ok">
                                Index initial {mission.index_releve !== null && mission.index_releve !== undefined ? Number(mission.index_releve).toLocaleString('fr-FR') : 'enregistré'}
                              </span>
                            ) : mission.releve_id ? (
                              <span className="font-medium text-jr-attention">Relevé associé non exploitable</span>
                            ) : mission.resultat_visite ? (
                              <span className="font-medium text-jr-attention">{RESULTATS_VISITE[mission.resultat_visite] || mission.resultat_visite}</span>
                            ) : (
                              <span className="text-jr-faible">—</span>
                            )}
                          </td>
                          <td className="px-3 py-3"><button type="button" onClick={() => saveMission(mission)} disabled={saving || terminal || activeCampaign.statut === 'CLOTUREE'} className="inline-flex items-center gap-1.5 rounded-md border border-jr-bordure px-2.5 py-2 text-xs font-semibold text-jr-doux hover:bg-jr-eau-pale disabled:opacity-50"><Save size={13} />Enregistrer</button></td>
                        </tr>
                      );
                    })}
                    {!visibleMissions.length && <tr><td colSpan={11} className="px-3 py-10 text-center text-sm text-jr-faible">Aucune mission ne correspond aux filtres actuels.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {preparationModalOpen && (
          <div
            className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-[2px] sm:p-6"
            onMouseDown={(event) => { if (event.target === event.currentTarget) setPreparationModalOpen(false); }}
          >
            <section role="dialog" aria-modal="true" aria-labelledby="preparation-controle-titre" className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-xl border border-jr-bordure bg-jr-surface shadow-2xl">
              <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-jr-bordure bg-jr-surface px-5 py-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-jr-faible">Planning des contrôles</p>
                  <h2 id="preparation-controle-titre" className="mt-1 text-lg font-bold text-jr-titre">Préparer et affecter les missions</h2>
                  <p className="mt-1 text-sm text-jr-doux">Sélectionnez les Agents actifs et les quartiers à contrôler. Les affectations finales seront confirmées dans la liste des compteurs.</p>
                </div>
                <button type="button" onClick={() => setPreparationModalOpen(false)} aria-label="Fermer la préparation" className="rounded-md border border-jr-bordure p-2 text-jr-doux hover:bg-jr-eau-pale"><X size={18} /></button>
              </header>

              <div className="space-y-5 p-4 sm:p-5">
                {preparationStep === 'recap' ? (
                  <div className="space-y-4">
                    <div className="rounded-lg border border-jr-bordure bg-jr-eau-pale/40 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-jr-faible">Étape 1 enregistrée</p>
                      <h3 className="mt-1 font-bold text-jr-titre">Récapitulatif des affectations préparées</h3>
                      <p className="mt-1 text-sm text-jr-doux">
                        Ces Agents et ces quartiers sont enregistrés pour le planning #{activeCampaign?.id}. Tous les abonnés actifs de ces quartiers et tous leurs compteurs actifs ont reçu une mission, répartie automatiquement entre le Jour 2 et le Jour 3. L’étape 2 permet d’ajuster les compteurs non encore planifiés.
                      </p>
                      <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {[
                          ["Agents sélectionnés", affectationsPreparees.length],
                          ["Quartiers sélectionnés", quartiersPreparees.length],
                          ["Missions de compteurs enregistrées", missionsDuCycle.length],
                          ["Missions du Jour 2", missionsDuCycle.filter((mission) => dateInput(mission.date_prevue) === preparationModalCycle.descente).length],
                          ["Missions du Jour 3", missionsDuCycle.filter((mission) => dateInput(mission.date_prevue) === preparationModalCycle.finalisation).length],
                          ["Abonnés couverts", new Set(missionsDuCycle.map((mission) => mission.abonne_id)).size],
                        ].map(([label, valeur]) => (
                          <div key={label} className="rounded-md border border-jr-bordure bg-jr-surface p-3">
                            <dt className="text-[11px] font-semibold uppercase tracking-wide text-jr-faible">{label}</dt>
                            <dd className="mt-0.5 text-lg font-bold tabular-nums text-jr-titre">{valeur}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>

                    <div className="overflow-x-auto rounded-md border border-jr-bordure">
                      <table className="min-w-[780px] w-full text-left text-sm">
                        <thead className="bg-jr-eau-pale text-[11px] uppercase tracking-wide text-jr-faible">
                          <tr><th className="px-3 py-2.5">Agent</th><th className="px-3 py-2.5">Identifiant</th><th className="px-3 py-2.5">Statut</th><th className="px-3 py-2.5">Quartiers attribués</th><th className="px-3 py-2.5">Dates de descente</th></tr>
                        </thead>
                        <tbody className="divide-y divide-jr-bordure">
                          {affectationsPreparees.map((agent) => (
                            <tr key={agent.cle} className="align-top">
                              <td className="px-3 py-2.5 font-semibold text-jr-texte">{agent.nom}</td>
                              <td className="px-3 py-2.5 text-xs text-jr-doux">{agent.identifiant || `Agent #${agent.cle}`}</td>
                              <td className="px-3 py-2.5 text-xs text-jr-doux">{agent.statut ? agent.statut.charAt(0).toUpperCase() + agent.statut.slice(1) : 'Non renseigné'}</td>
                              <td className="px-3 py-2.5">
                                <span className="flex flex-wrap gap-1">
                                  {agent.quartiers.map((quartier) => (
                                    <span key={quartier || '__none__'} className="rounded-full border border-jr-bordure bg-jr-surface px-2 py-0.5 text-xs text-jr-doux">{quartier || 'Quartier non renseigné'}</span>
                                  ))}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-xs text-jr-doux">
                                <span className="block">Jour 2 · {dateLabel(preparationModalCycle.descente, { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                                <span className="block">Jour 3 · {dateLabel(preparationModalCycle.finalisation, { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                              </td>
                            </tr>
                          ))}
                          {!affectationsPreparees.length && (
                            <tr><td colSpan={5} className="px-3 py-8 text-center text-sm text-jr-faible">Aucune affectation enregistrée pour le moment.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {!missionsDuCycle.length && (
                      <p className="rounded-md border border-dashed border-jr-bordure px-3 py-3 text-sm text-jr-attention">
                        Aucune mission de compteur n’est encore enregistrée. Si le planning ne contient plus de cycle de trois jours complet, ajustez ses dates ; sinon, l’étape 2 permet de choisir les compteurs à contrôler.
                      </p>
                    )}

                    <footer className="flex flex-wrap justify-end gap-2 border-t border-jr-bordure pt-4">
                      <button type="button" onClick={() => setPreparationStep('selection')} className="rounded-md border border-jr-bordure px-4 py-2.5 text-sm font-semibold text-jr-doux hover:bg-jr-eau-pale">Modifier la sélection</button>
                      <button type="button" onClick={poursuivreVersCompteurs} className="jr-btn jr-btn-elec inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold"><CheckCircle2 size={16} />Poursuivre : choisir les compteurs</button>
                    </footer>
                  </div>
                ) : (
                  <>
                <div className="rounded-lg border border-jr-bordure bg-jr-eau-pale/40 p-4">
                  <div className="flex items-center gap-2 font-semibold text-jr-titre"><CalendarDays size={17} />Cycle de trois jours</div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-md border border-jr-bordure bg-jr-surface p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-jr-faible">Jour 1 · Préparation</p>
                      <p className="mt-1 font-semibold text-jr-texte">{dateLabel(preparationModalCycle.preparation, { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
                    </div>
                    <div className="rounded-md border border-jr-bordure bg-jr-surface p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-jr-faible">Jour 2 · Descente</p>
                      <p className="mt-1 font-semibold text-jr-texte">{dateLabel(preparationModalCycle.descente, { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
                    </div>
                    <div className="rounded-md border border-jr-bordure bg-jr-surface p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-jr-faible">Jour 3 · Finalisation</p>
                      <p className="mt-1 font-semibold text-jr-texte">{dateLabel(preparationModalCycle.finalisation, { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
                    </div>
                  </div>
                  {activeCampaign ? (
                    <p className="mt-3 text-xs text-jr-faible">Campagne : {monthLabel(activeCampaign.mois)} · {CAMPAIGN_STATUS_LABEL[activeCampaign.statut] || activeCampaign.statut} · planning #{activeCampaign.id}.</p>
                  ) : (
                    <p className="mt-3 text-sm text-jr-attention">Aucun brouillon n’est encore enregistré pour ce mois. Vous pourrez créer le planning après avoir fermé cette fenêtre.</p>
                  )}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <fieldset className="rounded-lg border border-jr-bordure p-4">
                    <legend className="px-1 text-sm font-semibold text-jr-titre">1. Agents actifs à affecter</legend>
                    <label className="mt-2 block">
                      <span className="sr-only">Rechercher un Agent</span>
                      <input value={agentSearch} onChange={(event) => setAgentSearch(event.target.value)} placeholder="Rechercher par nom, identifiant ou e-mail" className="jr-field w-full rounded-md border px-3 py-2 text-sm" />
                    </label>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className="text-xs text-jr-faible">{agentsPreparationDraft.length} sélectionné{agentsPreparationDraft.length > 1 ? 's' : ''} sur {agents.length}</span>
                      <div className="flex gap-3">
                        <button type="button" onClick={() => setAgentsPreparationDraft(agents.map((agent) => String(agent.id)))} disabled={!agents.length} className="text-xs font-semibold text-jr-lien underline underline-offset-2 disabled:opacity-50">Tous</button>
                        <button type="button" onClick={() => setAgentsPreparationDraft([])} disabled={!agentsPreparationDraft.length} className="text-xs font-semibold text-jr-lien underline underline-offset-2 disabled:opacity-50">Aucun</button>
                      </div>
                    </div>
                    <div className="mt-2 grid max-h-64 gap-1 overflow-y-auto">
                      {agentsFiltres.map((agent) => (
                        <label key={agent.id} className="flex min-w-0 items-start gap-2 rounded-md p-2 text-sm hover:bg-jr-eau-pale">
                          <input type="checkbox" checked={agentsPreparationDraft.includes(String(agent.id))} onChange={(event) => setAgentsPreparationDraft((previous) => event.target.checked ? [...new Set([...previous, String(agent.id)])] : previous.filter((id) => id !== String(agent.id)))} />
                          <span className="min-w-0"><span className="block truncate font-medium text-jr-texte">{agent.prenom} {agent.nom}</span><span className="block truncate text-xs text-jr-faible">{agent.identifiant || `#${agent.id}`} · {agent.email || 'E-mail absent'} · Actif</span></span>
                        </label>
                      ))}
                      {!agentsFiltres.length && <p className="py-3 text-sm text-jr-faible">Aucun Agent actif ne correspond à la recherche.</p>}
                    </div>
                  </fieldset>

                  <fieldset className="rounded-lg border border-jr-bordure p-4">
                    <legend className="px-1 text-sm font-semibold text-jr-titre">2. Quartiers à contrôler</legend>
                    <div className="mt-2 flex flex-wrap gap-3">
                      <button type="button" onClick={() => setQuartiersPreparationDraft([])} className="text-xs font-semibold text-jr-lien underline underline-offset-2">Tous les quartiers</button>
                      <button type="button" onClick={() => setQuartiersPreparationDraft([...quartiersDisponiblesModal])} disabled={!quartiersDisponiblesModal.length} className="text-xs font-semibold text-jr-lien underline underline-offset-2 disabled:opacity-50">Tout sélectionner</button>
                    </div>
                    <p className="mt-2 text-xs text-jr-faible">Par défaut, tous les quartiers sont inclus. Décochez uniquement ceux que vous souhaitez exclure.</p>
                    <div className="mt-3 grid max-h-64 gap-1 overflow-y-auto sm:grid-cols-2">
                      {quarters.map((quartier) => (
                        <label key={quartier} className="flex min-w-0 items-center gap-2 rounded-md p-2 text-sm hover:bg-jr-eau-pale">
                          <input type="checkbox" checked={quartiersPreparationDraft.length === 0 || quartiersPreparationDraft.includes(quartier)} onChange={(event) => basculerQuartierPreparation(quartier, event.target.checked)} />
                          <span className="truncate text-jr-doux">{quartier}</span>
                        </label>
                      ))}
                      {targets.some((target) => !target.quartier) && (
                        <label className="flex items-center gap-2 rounded-md p-2 text-sm hover:bg-jr-eau-pale">
                          <input type="checkbox" checked={quartiersPreparationDraft.length === 0 || quartiersPreparationDraft.includes('__none__')} onChange={(event) => basculerQuartierPreparation('__none__', event.target.checked)} />
                          <span className="text-jr-doux">Quartier non renseigné</span>
                        </label>
                      )}
                      {!quartiersDisponiblesModal.length && <p className="py-3 text-sm text-jr-faible">Aucun quartier n’est disponible pour ce mois.</p>}
                    </div>
                    <p className="mt-3 text-xs text-jr-faible">La sélection filtre la liste des compteurs. Pour chaque compteur retenu, l’Agent responsable sera confirmé dans le formulaire principal.</p>
                  </fieldset>
                </div>

                <fieldset className="rounded-lg border border-jr-bordure p-4">
                  <legend className="px-1 text-sm font-semibold text-jr-titre">3. Répartition Agent → Quartier</legend>
                  <p className="mt-1 text-xs text-jr-faible">
                    Chaque quartier est attribué à un seul Agent : tous ses abonnés actifs et tous leurs compteurs actifs lui seront affectés. Cochez pour changer de responsable.
                  </p>
                  {agentsPreparationDraft.length ? (
                    <div className="mt-3 space-y-2">
                      {agents.filter((agent) => agentsPreparationDraft.includes(String(agent.id))).map((agent) => {
                        const cle = String(agent.id);
                        const liste = repartitionPreparation[cle] || [];
                        return (
                          <div key={cle} className="rounded-md border border-jr-bordure bg-jr-surface px-3 py-2">
                            <p className="text-sm font-semibold text-jr-texte">{agent.prenom} {agent.nom}
                              <span className="ml-2 text-xs font-normal text-jr-faible">{agent.identifiant || `#${agent.id}`}</span>
                            </p>
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              {quartiersReels(quartiersPreparationDraft).map((quartier) => {
                                const attribue = liste.includes(quartier);
                                return (
                                  <label key={quartier} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${attribue ? 'border-jr-eau bg-jr-eau-pale text-jr-lien' : 'border-jr-bordure text-jr-faible'}`}>
                                    <input type="checkbox" checked={attribue} onChange={(event) => basculerQuartierPourAgent(cle, quartier, event.target.checked)} />
                                    {quartier === '__none__' ? 'Quartier non renseigné' : quartier}
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-jr-faible">Sélectionnez d’abord au moins un Agent.</p>
                  )}
                </fieldset>

                {preparationModalError && <p role="alert" className="rounded-md border border-jr-err-bordure bg-jr-err-pale px-3 py-2 text-sm text-jr-err">{preparationModalError}</p>}
                <footer className="flex flex-wrap justify-end gap-2 border-t border-jr-bordure pt-4">
                  <button type="button" onClick={() => { setPreparationModalOpen(false); setPreparationModalError(''); }} className="rounded-md border border-jr-bordure px-4 py-2.5 text-sm font-semibold text-jr-doux hover:bg-jr-eau-pale">Annuler</button>
                  <button type="button" onClick={appliquerPreparationModal} disabled={affectationsSaving || agentsLoading || agents.length === 0} className="jr-btn jr-btn-elec inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"><CheckCircle2 size={16} />{affectationsSaving ? 'Enregistrement…' : 'Appliquer la sélection et choisir les compteurs'}</button>
                </footer>
                  </>
                )}
              </div>
            </section>
          </div>
        )}

        {selectedPlanningDay && activeCampaign && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-[2px] sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedPlanningDay(null); }}>
            <section role="dialog" aria-modal="true" aria-labelledby="jour-controle-titre" className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-lg border border-jr-bordure bg-jr-surface shadow-2xl">
              <header className="sticky top-0 z-10 flex flex-wrap items-start justify-between gap-4 border-b border-jr-bordure bg-jr-surface px-5 py-4 sm:px-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-jr-faible">Cycle {selectedCycle?.numero} · {CAMPAIGN_STATUS_LABEL[activeCampaign.statut] || activeCampaign.statut}</p>
                  <h2 id="jour-controle-titre" className="mt-1 text-lg font-bold text-jr-titre">Jour {selectedPlanningDay.numero} · {selectedPlanningDay.roleCourt}</h2>
                  <p className="mt-1 text-sm text-jr-doux">{selectedPlanningDay.role} · {dateLabel(selectedPlanningDay.date, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</p>
                </div>
                <button type="button" onClick={() => setSelectedPlanningDay(null)} aria-label="Fermer le détail du jour" className="rounded-md border border-jr-bordure p-2 text-jr-doux hover:bg-jr-eau-pale"><X size={18} /></button>
              </header>

              <div className="space-y-5 p-4 sm:p-6">
                {selectedPlanningDay.phase === 'PREPARATION' ? (
                  <div className="space-y-4">
                    <div className="rounded-md border border-jr-bordure bg-jr-eau-pale/50 p-4">
                      <h3 className="font-semibold text-jr-titre">Jour 1 · Préparation et affectation des missions</h3>
                      <p className="mt-1 text-sm text-jr-doux">
                        Date de préparation : {dateLabel(selectedCycle?.preparation || selectedPlanningDay.date, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}. Aucune descente n’a lieu ce jour : les interventions sont attendues le {dateLabel(selectedCycle?.descente)} (Jour 2) puis le {dateLabel(selectedCycle?.finalisation)} (Jour 3).
                      </p>
                      <p className="mt-1 text-sm text-jr-doux">
                        Responsable : {[activeCampaign.responsable_prenom, activeCampaign.responsable_nom].filter(Boolean).join(' ') || `Utilisateur #${activeCampaign.created_by || '—'}`}
                        {activeCampaign.responsable_identifiant ? ` (${activeCampaign.responsable_identifiant})` : ''} · Planning #{activeCampaign.id} · {CAMPAIGN_STATUS_LABEL[activeCampaign.statut] || activeCampaign.statut} · enregistré le {dateHeureLabel(activeCampaign.created_at)}.
                      </p>
                      <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {[
                          ['Agents affectés', preparationParAgent.length],
                          ['Quartiers', new Set(preparationParAgent.flatMap((agent) => agent.quartiers.map((quartier) => quartier.nom))).size],
                          ['Missions prévues', preparationParAgent.reduce((total, agent) => total + agent.missions, 0)],
                          ['Descentes prévues', `${dateLabel(selectedCycle?.descente)} · ${dateLabel(selectedCycle?.finalisation)}`],
                        ].map(([label, valeur]) => (
                          <div key={label}>
                            <dt className="text-[11px] font-semibold uppercase tracking-wide text-jr-faible">{label}</dt>
                            <dd className="mt-0.5 text-base font-bold tabular-nums text-jr-titre">{valeur}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-jr-titre">A · Affectations des Agents et des quartiers</p>
                        <p className="mt-0.5 text-sm text-jr-faible">Préparation enregistrée pour ce planning, classée par Agent puis par quartier.</p>
                      </div>
                      {preparationParAgent.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setAgentsReplies(agentsReplies.length ? [] : preparationParAgent.map((agent) => agent.cle))}
                          className="rounded-md border border-jr-bordure px-3 py-2 text-sm font-semibold text-jr-doux hover:bg-jr-eau-pale"
                        >
                          {agentsReplies.length ? 'Tout déplier' : 'Tout replier'}
                        </button>
                      )}
                    </div>

                    {preparationParAgent.length ? preparationParAgent.map((agent) => {
                      const replie = agentsReplies.includes(agent.cle);
                      return (
                        <section key={agent.cle} className="rounded-lg border border-jr-bordure">
                          <h4>
                            <button
                              type="button"
                              onClick={() => setAgentsReplies((previous) => (
                                previous.includes(agent.cle)
                                  ? previous.filter((cle) => cle !== agent.cle)
                                  : [...previous, agent.cle]
                              ))}
                              aria-expanded={!replie}
                              className="flex w-full flex-wrap items-center justify-between gap-3 rounded-t-lg bg-jr-eau-pale/60 px-4 py-3 text-left hover:bg-jr-eau-pale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jr-elec"
                            >
                              <span className="min-w-0">
                                <span className="block text-xs font-semibold uppercase tracking-wide text-jr-faible">Agent</span>
                                <span className="mt-0.5 block font-bold text-jr-titre">{agent.nom}</span>
                                <span className="mt-0.5 block text-xs text-jr-doux">
                                  Identifiant : {agent.identifiant || 'non renseigné'} · ID utilisateur : {agent.cle === 'non-affecte' ? 'non affecté' : agent.cle} · Statut : {agent.statut ? agent.statut.charAt(0).toUpperCase() + agent.statut.slice(1) : 'non renseigné'}
                                  {agent.email ? ` · ${agent.email}` : ''}
                                </span>
                              </span>
                              <span className="flex items-center gap-2 text-xs text-jr-doux">
                                <span className="rounded-full border border-jr-bordure bg-jr-surface px-2.5 py-1 font-semibold tabular-nums">{agent.missions} mission{agent.missions > 1 ? 's' : ''}</span>
                                <span className="rounded-full border border-jr-bordure bg-jr-surface px-2.5 py-1 font-semibold tabular-nums">{agent.quartiers.length} quartier{agent.quartiers.length > 1 ? 's' : ''}</span>
                                <span aria-hidden="true" className="text-base font-bold text-jr-faible">{replie ? '▸' : '▾'}</span>
                              </span>
                            </button>
                          </h4>
                          {!replie && (
                            <div className="space-y-4 p-4">
                              {agent.quartiers.map((quartier) => (
                                <div key={`${agent.cle}:${quartier.nom}`}>
                                  <p className="text-sm font-semibold text-jr-titre">
                                    Quartier : {quartier.nom}
                                    <span className="ml-2 text-xs font-normal text-jr-faible">{quartier.missions.length ? `${quartier.missions.length} abonné${quartier.missions.length > 1 ? 's' : ''} à contrôler` : 'préparé · aucune mission individuelle'}</span>
                                  </p>
                                  {!quartier.missions.length && (
                                    <p className="mt-2 rounded-md border border-dashed border-jr-bordure px-3 py-2 text-xs text-jr-faible">Aucune mission individuelle de compteur n’a encore été ajoutée à ce quartier. Le quartier reste bien enregistré dans la préparation du Jour 1.</p>
                                  )}
                                  {quartier.missions.length > 0 && (
                                  <div className="mt-2 overflow-x-auto rounded-md border border-jr-bordure">
                                    <table className="min-w-[980px] w-full text-left text-sm">
                                      <thead className="bg-jr-eau-pale text-[11px] uppercase tracking-wide text-jr-faible">
                                        <tr>
                                          <th className="px-3 py-2.5">Abonné</th>
                                          <th className="px-3 py-2.5">Référence abonné</th>
                                          <th className="px-3 py-2.5">Compteur</th>
                                          <th className="px-3 py-2.5">Type</th>
                                          <th className="px-3 py-2.5">Date prévue</th>
                                          <th className="px-3 py-2.5">Statut</th>
                                          <th className="px-3 py-2.5">Résultat</th>
                                          <th className="px-3 py-2.5">Mission</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-jr-bordure">
                                        {quartier.missions.map((mission) => {
                                          const jourMission = dateInput(mission.date_prevue) === selectedCycle?.descente
                                            ? 'Jour 2'
                                            : dateInput(mission.date_prevue) === selectedCycle?.finalisation
                                              ? 'Jour 3'
                                              : '';
                                          return (
                                            <tr key={mission.mission_id} className="align-top">
                                              <td className="px-3 py-2.5">
                                                <p className="font-semibold text-jr-texte">{[mission.abonne_prenom, mission.abonne_nom].filter(Boolean).join(' ') || 'Abonné'}</p>
                                                <p className="mt-0.5 text-xs text-jr-faible">{mission.adresse || 'Adresse non renseignée'}</p>
                                              </td>
                                              <td className="px-3 py-2.5 text-jr-doux">{mission.numero_abonne || '—'}</td>
                                              <td className="px-3 py-2.5 text-jr-doux">{mission.numero_compteur || '—'}</td>
                                              <td className="px-3 py-2.5 text-jr-doux">{mission.type_compteur === 'EAU' ? 'Eau' : 'Électricité'}</td>
                                              <td className="px-3 py-2.5 text-jr-doux">
                                                {dateLabel(mission.date_prevue, { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                                {jourMission ? <span className="mt-0.5 block text-xs text-jr-faible">{jourMission}</span> : null}
                                              </td>
                                              <td className="px-3 py-2.5">
                                                <span className="inline-flex rounded-full border border-jr-bordure px-2 py-0.5 text-xs font-semibold" style={{ color: (STATUS[mission.statut] || STATUS.EN_ATTENTE).color }}>
                                                  {(STATUS[mission.statut] || STATUS.EN_ATTENTE).label}
                                                </span>
                                                {missionEnRetard(mission) && <span className="mt-1 block text-xs font-semibold text-jr-attention">En retard</span>}
                                              </td>
                                            <td className="px-3 py-2.5 text-xs text-jr-doux">
                                              {mission.releve_exploitable
                                                ? 'Consommation vérifiée'
                                                : mission.type_releve === 'INITIAL'
                                                  ? 'Index initial enregistré'
                                                  : mission.resultat_visite
                                                    ? (RESULTATS_VISITE[mission.resultat_visite] || mission.resultat_visite)
                                                    : mission.releve_id
                                                      ? 'Relevé à vérifier'
                                                      : 'Non transmis'}
                                            </td>
                                              <td className="px-3 py-2.5 text-xs text-jr-faible">#{mission.mission_id}</td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </section>
                      );
                    }) : (
                      <div className="rounded-md border border-dashed border-jr-bordure px-4 py-8 text-center">
                        <p className="font-semibold text-jr-titre">Aucune affectation enregistrée pour ce cycle</p>
                        <p className="mx-auto mt-1 max-w-xl text-sm text-jr-faible">Utilisez « Préparer et affecter les missions » : les Agents et les quartiers sont enregistrés dès la première étape, avant même de choisir les compteurs.</p>
                      </div>
                    )}
                  </div>
                ) : selectedPlanningDay.phase === 'DESCENTE' ? (
                  <p className="rounded-md border border-jr-bordure bg-jr-eau-pale/50 p-4 text-sm text-jr-doux">Missions prévues ce jour : {selectedPlanningDay.prevues}. Les interventions ne sont comptées comme réalisées qu’après la saisie effective d’une date de visite réelle.</p>
                ) : (
                  <p className="rounded-md border border-jr-bordure bg-jr-eau-pale/50 p-4 text-sm text-jr-doux">Finalisation du cycle : les résultats affichés ci-dessous proviennent des missions et relevés enregistrés. Une mission sans index exploitable reste en suivi et n’est pas comptée comme consommation vérifiée.</p>
                )}

                {selectedPlanningDay.phase === 'PREPARATION' && (
                  <div>
                    <p className="text-sm font-semibold text-jr-titre">B · Missions individuelles enregistrées</p>
                    <p className="mt-0.5 text-xs text-jr-faible">Une mission associe un Agent, un quartier, un abonné, un compteur et une date de visite. Ces lignes proviennent uniquement des missions réellement enregistrées en base.</p>
                  </div>
                )}
                <div className="overflow-x-auto rounded-md border border-jr-bordure">
                  <table className="min-w-[1180px] w-full text-left text-sm">
                    <thead className="bg-jr-eau-pale text-[11px] uppercase tracking-wide text-jr-faible">
                      <tr><th className="px-3 py-3">Agent / quartier</th><th className="px-3 py-3">Abonné / compteur</th><th className="px-3 py-3">Date prévue</th><th className="px-3 py-3">Date réelle</th><th className="px-3 py-3">État</th><th className="px-3 py-3">Index ancien → nouveau</th><th className="px-3 py-3">Résultat</th><th className="px-3 py-3">Observation / motif</th><th className="px-3 py-3">Transmission</th></tr>
                    </thead>
                    <tbody className="divide-y divide-jr-bordure">
                      {missionsDetailJour.map((mission) => (
                        <tr key={mission.mission_id} className="align-top">
                          <td className="px-3 py-3"><p className="font-semibold text-jr-texte">{[mission.agent_prenom, mission.agent_nom].filter(Boolean).join(' ') || 'Agent non affecté'}</p><p className="mt-1 text-xs text-jr-faible">{mission.agent_identifiant || `Agent #${mission.agent_id || '—'}`} · {mission.quartier || 'Quartier non renseigné'}</p></td>
                          <td className="px-3 py-3"><p className="font-semibold text-jr-texte">{[mission.abonne_prenom, mission.abonne_nom].filter(Boolean).join(' ') || 'Abonné'}</p><p className="mt-1 text-xs text-jr-faible">{mission.numero_abonne} · {mission.numero_compteur} · {mission.type_compteur === 'EAU' ? 'Eau' : 'Électricité'}</p><p className="mt-1 text-xs text-jr-faible">{mission.adresse || 'Adresse non renseignée'}</p></td>
                          <td className="px-3 py-3 text-jr-doux">{dateLabel(mission.date_prevue, { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
                          <td className="px-3 py-3 text-jr-doux">{mission.date_visite_reelle ? dateLabel(mission.date_visite_reelle, { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Non effectuée'}</td>
                          <td className="px-3 py-3"><span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${mission.statut === 'TERMINEE' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : mission.statut === 'A_REPROGRAMMER' || etatTransmissionMission(mission).startsWith('Non réalisée') ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>{etatTransmissionMission(mission)}</span></td>
                          <td className="px-3 py-3 tabular-nums text-jr-doux">
                            {mission.ancien_index_releve === null || mission.ancien_index_releve === undefined
                              ? mission.index_releve === null || mission.index_releve === undefined
                                ? '—'
                                : `Premier relevé · ${Number(mission.index_releve).toLocaleString('fr-FR')}`
                              : `${Number(mission.ancien_index_releve).toLocaleString('fr-FR')} → ${Number(
                                  mission.index_releve
                                ).toLocaleString('fr-FR')}`}
                          </td>
                          <td className="px-3 py-3 text-xs text-jr-doux">{mission.releve_exploitable ? 'Consommation vérifiée' : mission.type_releve === 'INITIAL' ? 'Index initial enregistré' : mission.resultat_visite ? (RESULTATS_VISITE[mission.resultat_visite] || mission.resultat_visite) : mission.releve_id ? 'Relevé à vérifier' : 'Non transmis'}</td>
                          <td className="max-w-56 whitespace-normal px-3 py-3 text-xs text-jr-doux">{mission.motif_reprogrammation || mission.observations || '—'}</td>
                          <td className="px-3 py-3 text-xs text-jr-doux">{mission.date_transmission_resultat ? dateHeureLabel(mission.date_transmission_resultat) : mission.date_transmission_releve ? dateHeureLabel(mission.date_transmission_releve) : 'En attente'}</td>
                        </tr>
                      ))}
                      {!missionsDetailJour.length && <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-jr-faible">Aucune mission enregistrée pour ce jour ou ce cycle.</td></tr>}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-jr-faible">Une mission en retard reste attachée à sa date prévue ; sa date réelle est affichée séparément et n’ajoute aucun jour au calendrier.</p>
              </div>
            </section>
          </div>
        )}

        {!activeCampaign && !loading && campaigns.length === 0 && (
          <section className="rounded-xl border border-dashed border-jr-bordure bg-jr-surface px-6 py-12 text-center">
            <Users size={27} className="mx-auto text-jr-faible" />
            <h3 className="mt-3 font-semibold text-jr-titre">Aucun planning pour ce mois</h3>
            <p className="mx-auto mt-1 max-w-xl text-sm text-jr-faible">Choisissez une période dans le mois, puis créez un brouillon. Les agents et les abonnés chargés ici proviennent de vos données PostgreSQL.</p>
          </section>
        )}

        {loading && <p role="status" className="text-center text-sm text-jr-faible">Chargement du planning…</p>}
      </div>
      <AbonneControleDialog
        mission={abonneDetail}
        onClose={() => setAbonneDetail(null)}
        onLocaliser={(mission) => {
          setAbonneDetail(null);
          setAbonneALocaliser(mission);
        }}
      />
      {abonneALocaliser && (
        <LocaliserAbonneControle
          mission={abonneALocaliser}
          onClose={() => setAbonneALocaliser(null)}
          onSaved={async (_data, message) => {
            setAbonneALocaliser(null);
            setNotice(message || 'Position GPS enregistrée. La carte du planning est actualisée.');
            await load();
          }}
        />
      )}
    </ResponsableLayout>
  );
}

export default function ResponsableControlesPage() {
  return <ControlesResponsable />;
}
