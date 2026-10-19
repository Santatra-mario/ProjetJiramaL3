import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useNavigate } from 'react-router-dom';

import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  CalendarDays,
  Droplets,
  GitCompare,
  Loader2,
  Minus,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  Zap,
} from 'lucide-react';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import axiosClient from '../../api/axiosClient.js';
import AdminShell from '../../components/admin/AdminShell.jsx';
import Sidebar from '../../components/admin/Sidebar.jsx';
import Header from '../../components/admin/Header.jsx';

/* =========================================================
   CONSTANTES
========================================================= */

const MS_PAR_JOUR = 86400000;
const ESPACE = '\u00A0'; // espace insécable entre un nombre et son unité

const CHAMPS_DATES = ['dateDebut1', 'dateFin1', 'dateDebut2', 'dateFin2'];

// Eau = bleu, électricité = orange (convention du projet)
const TYPES = [
  {
    valeur: 'ELECTRICITE',
    libelle: 'Électricité',
    unite: 'kWh',
    Icone: Zap,
    couleur: 'var(--jr-elec)',
    actif:
      'border-[var(--jr-elec)] bg-jr-elec-pale text-jr-attention',
  },
  {
    valeur: 'EAU',
    libelle: 'Eau',
    unite: 'm³',
    Icone: Droplets,
    couleur: 'var(--jr-eau-clair)',
    actif:
      'border-[var(--jr-eau-clair)] bg-jr-eau-pale text-jr-lien',
  },
];

// La période 1 est la référence (teinte neutre),
// la période 2 prend la couleur du type de consommation.
const COULEUR_PERIODE_1 = 'var(--jr-texte-faible)';

/* =========================================================
   DATES (calculs en heure locale, format AAAA-MM-JJ)
========================================================= */

function depuisTexte(texte) {
  if (!texte || !/^\d{4}-\d{2}-\d{2}$/.test(texte)) {
    return null;
  }

  const [annee, mois, jour] = texte.split('-').map(Number);
  const date = new Date(annee, mois - 1, jour);

  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== annee ||
    date.getMonth() !== mois - 1 ||
    date.getDate() !== jour
  ) {
    return null;
  }

  return date;
}

// Nombre de jours, bornes incluses
function nombreJours(debut, fin) {
  const dateDebut = depuisTexte(debut);
  const dateFin = depuisTexte(fin);

  if (!dateDebut || !dateFin) {
    return 0;
  }

  const jours =
    Math.round((dateFin.getTime() - dateDebut.getTime()) / MS_PAR_JOUR) + 1;

  return jours > 0 ? jours : 0;
}

function formatDate(valeur) {
  if (!valeur) {
    return '—';
  }

  // les dates AAAA-MM-JJ sont lues en heure locale (pas de décalage de fuseau)
  const date = depuisTexte(String(valeur).slice(0, 10)) || new Date(valeur);

  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString('fr-FR');
}

function formatDateCourte(valeur) {
  const date = depuisTexte(String(valeur || '').slice(0, 10));

  return date
    ? date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
    : '—';
}

function pluriel(nombre, mot) {
  return `${nombre} ${mot}${nombre > 1 ? 's' : ''}`;
}

/* =========================================================
   PÉRIODES CALÉES SUR LES DATES RÉELLES DE LA BASE
========================================================= */

function datesTrieesDisponibles(dates) {
  return [...new Set(
    (Array.isArray(dates) ? dates : [])
      .map((date) => String(date || '').slice(0, 10))
      .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date) && depuisTexte(date))
  )].sort();
}

function construirePeriodesDepuisDates(dates) {
  const disponibles = datesTrieesDisponibles(dates);

  // Deux périodes indépendantes nécessitent au minimum quatre dates distinctes :
  // un début et une fin réels pour la période de référence et pour la période comparée.
  if (disponibles.length < 4) {
    return {
      dateDebut1: '',
      dateFin1: '',
      dateDebut2: '',
      dateFin2: '',
    };
  }

  const separation = Math.max(
    2,
    Math.min(disponibles.length - 2, Math.ceil(disponibles.length / 2))
  );

  return {
    dateDebut1: disponibles[0],
    dateFin1: disponibles[separation - 1],
    dateDebut2: disponibles[separation],
    dateFin2: disponibles[disponibles.length - 1],
  };
}

function construireRaccourcis(dates) {
  const disponibles = datesTrieesDisponibles(dates);

  if (disponibles.length < 4) {
    return [];
  }

  const toutHistorique = construirePeriodesDepuisDates(disponibles);
  const quatreDernieres = disponibles.slice(-4);

  return [
    {
      id: 'historique-base',
      libelle: 'Historique disponible',
      dates: toutHistorique,
    },
    {
      id: 'quatre-dernieres-dates',
      libelle: 'Quatre dernières dates',
      dates: {
        dateDebut1: quatreDernieres[0],
        dateFin1: quatreDernieres[1],
        dateDebut2: quatreDernieres[2],
        dateFin2: quatreDernieres[3],
      },
    },
  ];
}

/* =========================================================
   FORMATAGE ET VALIDATION
========================================================= */

function nombreOuNull(valeur) {
  if (valeur === null || valeur === undefined || valeur === '') {
    return null;
  }

  const n = Number(valeur);

  return Number.isFinite(n) ? n : null;
}

function formatNombre(valeur, { signe = false, decimales = 2 } = {}) {
  const n = nombreOuNull(valeur);

  if (n === null) {
    return '—';
  }

  const texte = n.toLocaleString('fr-FR', {
    maximumFractionDigits: decimales,
  });

  return signe && n > 0 ? `+${texte}` : texte;
}

function valeurAvecUnite(valeur, unite, options) {
  const texte = formatNombre(valeur, options);

  return texte === '—' ? texte : `${texte}${ESPACE}${unite}`;
}

function validerFiltres(filtres) {
  const erreurs = {};

  CHAMPS_DATES.forEach((champ) => {
    if (!filtres[champ]) {
      erreurs[champ] = 'Date requise.';
    } else if (!depuisTexte(filtres[champ])) {
      erreurs[champ] = 'Date invalide. Choisissez une date du calendrier.';
    }
  });

  if (
    !erreurs.dateDebut1 &&
    !erreurs.dateFin1 &&
    filtres.dateDebut1 > filtres.dateFin1
  ) {
    erreurs.periode1 =
      'La période 1 est invalide : le début doit précéder la fin.';
  }

  if (
    !erreurs.dateDebut2 &&
    !erreurs.dateFin2 &&
    filtres.dateDebut2 > filtres.dateFin2
  ) {
    erreurs.periode2 =
      'La période 2 est invalide : le début doit précéder la fin.';
  }

  if (
    !erreurs.dateDebut1 &&
    !erreurs.dateFin1 &&
    !erreurs.dateDebut2 &&
    !erreurs.dateFin2 &&
    filtres.dateFin1 >= filtres.dateDebut2
  ) {
    erreurs.chevauchement =
      'Les périodes se chevauchent. La période 1 doit se terminer avant le début de la période 2.';
  }

  return erreurs;
}

// Période partagée par les deux intervalles (null si aucune)
function chevauchement(filtres) {
  const valides =
    CHAMPS_DATES.every((champ) => depuisTexte(filtres[champ])) &&
    filtres.dateDebut1 <= filtres.dateFin1 &&
    filtres.dateDebut2 <= filtres.dateFin2;

  if (!valides) {
    return null;
  }

  const debut =
    filtres.dateDebut1 > filtres.dateDebut2
      ? filtres.dateDebut1
      : filtres.dateDebut2;

  const fin =
    filtres.dateFin1 < filtres.dateFin2
      ? filtres.dateFin1
      : filtres.dateFin2;

  return debut <= fin ? { debut, fin } : null;
}

// Durées « très différentes » : plus de 10 % d'écart
function durreesDifferentes(jours1, jours2) {
  if (!jours1 || !jours2) {
    return false;
  }

  return Math.abs(jours1 - jours2) / Math.max(jours1, jours2) > 0.1;
}

/* =========================================================
   ANALYSE DU RÉSULTAT (à partir des seules données de l'API)
========================================================= */

function analyserResultat(resultat) {
  const unite = resultat?.unite || 'kWh';

  const total1 = nombreOuNull(resultat?.periode1?.total);
  const total2 = nombreOuNull(resultat?.periode2?.total);
  const difference = nombreOuNull(resultat?.comparaison?.difference);
  const evolution = nombreOuNull(resultat?.comparaison?.evolution);

  const tendanceApi = resultat?.comparaison?.tendance;

  let libelle = 'Non calculable';
  let Icone = Minus;
  let ton = 'neutre';

  if (difference !== null) {
    const tendance = ['HAUSSE', 'BAISSE', 'STABLE'].includes(tendanceApi)
      ? tendanceApi
      : difference > 0
        ? 'HAUSSE'
        : difference < 0
          ? 'BAISSE'
          : 'STABLE';

    if (tendance === 'HAUSSE') {
      libelle = 'Hausse';
      Icone = TrendingUp;
      ton = 'hausse';
    } else if (tendance === 'BAISSE') {
      libelle = 'Baisse';
      Icone = TrendingDown;
      ton = 'baisse';
    } else {
      libelle = 'Stable';
    }
  }

  let phrase = 'Les totaux ne permettent pas de conclure.';

  if (difference !== null) {
    if (difference === 0) {
      phrase = 'Les totaux des deux périodes sont identiques.';
    } else {
      const sens = difference > 0 ? 'supérieure' : 'inférieure';
      const pourcentage =
        evolution !== null
          ? ` (${formatNombre(evolution, { signe: true })}${ESPACE}%)`
          : '';

      phrase =
        `La consommation de la période 2 est ${sens} à celle de la période 1 ` +
        `de ${valeurAvecUnite(Math.abs(difference), unite)}${pourcentage}.`;
    }
  }

  let precision = '';

  if (evolution === null) {
    if (total1 === null || total2 === null) {
      precision =
        'La comparaison complète n’est pas calculable : au moins une période ne dispose pas de deux index datés permettant de mesurer l’écart. Consultez le détail des index retenus ci-dessous.';
    } else if (total1 === 0) {
      precision =
        total2 === 0
          ? 'Les deux périodes ont un total calculé égal à zéro.'
          : 'Le pourcentage n’est pas calculable, car la consommation de référence de la période 1 est nulle.';
    }
  }

  const releves1 = nombreOuNull(resultat?.periode1?.nombre_releves);
  const releves2 = nombreOuNull(resultat?.periode2?.nombre_releves);

  const notes = [];

  const nonCalculables1 = Number(
    resultat?.periode1?.nombre_compteurs_non_calculables || 0
  );
  const nonCalculables2 = Number(
    resultat?.periode2?.nombre_compteurs_non_calculables || 0
  );

  if (nonCalculables1 > 0) {
    notes.push(
      `Données insuffisantes pour ${pluriel(nonCalculables1, 'compteur')} en période 1 : deux index datés et cohérents sont nécessaires. Ces compteurs ne contribuent pas au total calculé.`
    );
  }

  if (nonCalculables2 > 0) {
    notes.push(
      `Données insuffisantes pour ${pluriel(nonCalculables2, 'compteur')} en période 2 : deux index datés et cohérents sont nécessaires. Ces compteurs ne contribuent pas au total calculé.`
    );
  }

  const exclus1 = Number(resultat?.periode1?.nombre_compteurs_exclus || 0);
  const exclus2 = Number(resultat?.periode2?.nombre_compteurs_exclus || 0);

  if (exclus1 > 0 || exclus2 > 0) {
    const nombreExclus = Math.max(exclus1, exclus2);
    const verbe = nombreExclus > 1 ? 'ne peuvent pas' : 'ne peut pas';
    notes.push(
      `${pluriel(nombreExclus, 'compteur')} ${verbe} être inclus dans la comparaison, car les index ne sont pas exploitables pour les deux périodes. Les deux totaux utilisent le même ensemble de compteurs.`
    );
  }

  if (releves1 === 0 && releves2 === 0) {
    notes.push(
      'Aucun relevé n’existe sur les deux périodes pour cette sélection.'
    );
  } else if (releves1 === 0 || releves2 === 0) {
    notes.push(
      `Aucun relevé sur la période ${releves1 === 0 ? 1 : 2} : son total est ` +
        'nul faute de données, ce qui ne signifie pas forcément une absence de consommation.'
    );
  }

  const jours1 = nombreJours(
    resultat?.periode1?.dateDebut,
    resultat?.periode1?.dateFin
  );

  const jours2 = nombreJours(
    resultat?.periode2?.dateDebut,
    resultat?.periode2?.dateFin
  );

  if (durreesDifferentes(jours1, jours2)) {
    notes.push(
      `Les durées diffèrent (${pluriel(jours1, 'jour')} contre ${pluriel(jours2, 'jour')}) : ` +
        'comparez les totaux avec prudence.'
    );
  }

  return {
    unite,
    total1,
    total2,
    difference,
    evolution,
    libelle,
    Icone,
    ton,
    phrase,
    precision,
    notes,
    jours1,
    jours2,
  };
}

const STYLES_TON = {
  hausse: {
    texte: 'text-jr-attention',
    pastille: 'bg-jr-elec-pale text-jr-attention',
  },
  baisse: {
    texte: 'text-jr-ok',
    pastille: 'bg-jr-ok-pale text-jr-ok',
  },
  neutre: {
    texte: 'text-jr-doux',
    pastille: 'bg-jr-champ text-jr-doux',
  },
};

/* =========================================================
   PETITS COMPOSANTS
========================================================= */

function useReducedMotion() {
  const [reduit, setReduit] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return undefined;
    }

    const media = window.matchMedia('(prefers-reduced-motion: reduce)');

    function surChangement(event) {
      setReduit(event.matches);
    }

    media.addEventListener?.('change', surChangement);

    return () => media.removeEventListener?.('change', surChangement);
  }, []);

  return reduit;
}

function Repere({ couleur }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
      style={{ backgroundColor: couleur }}
    />
  );
}

function MessageChamp({ id, children }) {
  if (!children) {
    return null;
  }

  return (
    <p
      id={id}
      className="mt-1.5 flex items-start gap-1.5 text-xs font-medium text-jr-err"
    >
      <AlertCircle
        size={14}
        className="mt-px shrink-0"
        aria-hidden="true"
      />
      <span>{children}</span>
    </p>
  );
}

function InfoBulle({ active, payload, unite }) {
  if (!active || !payload?.length) {
    return null;
  }

  const ligne = payload[0].payload;

  return (
    <div className="rounded-md border border-jr-bordure bg-jr-surface px-3 py-2 text-xs shadow-md">
      <p className="font-semibold text-jr-titre">{ligne.nom}</p>
      <p className="mt-0.5 text-jr-faible">{ligne.dates}</p>
      <p className="mt-1.5 font-semibold text-jr-texte">
        {valeurAvecUnite(ligne.total, unite)}
      </p>
    </div>
  );
}

function BlocPeriode({
  numero,
  titre,
  description,
  couleur,
  nomDebut,
  nomFin,
  debut,
  fin,
  onChange,
  erreurDebut,
  erreurFin,
  erreurPeriode,
  datesDisponibles = [],
  chargementDates = false,
}) {
  const jours = nombreJours(debut, fin);
  const idDebut = `champ-${nomDebut}`;
  const idFin = `champ-${nomFin}`;
  const idErreurPeriode = `erreur-periode-${numero}`;

  function champ(id, nom, libelle, valeur, erreur) {
    const invalide = Boolean(erreur || erreurPeriode);
    const decrit = [
      erreur ? `${id}-erreur` : null,
      erreurPeriode ? idErreurPeriode : null,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div>
        <label
          htmlFor={id}
          className="mb-1.5 block text-xs font-semibold text-jr-doux"
        >
          {libelle}
        </label>

        <select
          id={id}
          name={nom}
          value={valeur || ''}
          onChange={onChange}
          disabled={chargementDates || datesDisponibles.length === 0}
          aria-invalid={invalide || undefined}
          aria-describedby={decrit || undefined}
          className="jr-field w-full rounded-md border px-3 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
          style={invalide ? { borderColor: 'var(--jr-err)' } : undefined}
        >
          <option value="">
            {chargementDates
              ? 'Chargement des dates de la base…'
              : datesDisponibles.length > 0
                ? 'Choisir une date de relevé'
                : 'Aucune date de relevé disponible'}
          </option>
          {datesDisponibles.map((date) => (
            <option key={`${nom}-${date}`} value={date}>
              {formatDate(date)}
            </option>
          ))}
        </select>

        <MessageChamp id={`${id}-erreur`}>{erreur}</MessageChamp>
      </div>
    );
  }

  return (
    <fieldset className="min-w-0 p-5 sm:p-6">
      <legend className="sr-only">{titre}</legend>

      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Repere couleur={couleur} />
          <div>
            <h3 className="text-sm font-semibold text-jr-titre">{titre}</h3>
            <p className="text-xs text-jr-faible">{description}</p>
          </div>
        </div>

        {jours > 0 && (
          <span className="shrink-0 rounded-full border border-jr-bordure px-2.5 py-1 text-xs font-medium text-jr-doux">
            {pluriel(jours, 'jour')}
          </span>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {champ(
          idDebut,
          nomDebut,
          'Date de début',
          debut,
          erreurDebut
        )}
        {champ(
          idFin,
          nomFin,
          'Date de fin',
          fin,
          erreurFin
        )}
      </div>

      <MessageChamp id={idErreurPeriode}>{erreurPeriode}</MessageChamp>

      <div className="mt-5 rounded-md border border-jr-bordure bg-jr-champ p-3.5 sm:p-4">
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-jr-doux">
          <CalendarDays size={14} aria-hidden="true" />
          Dates exactes prises en compte
        </p>
        <p className="mt-2 text-sm font-semibold text-jr-titre">
          Du {formatDate(debut)} au {formatDate(fin)}
        </p>
        <p className="mt-1 text-xs leading-5 text-jr-faible">
          {jours > 0 ? `${pluriel(jours, 'jour')} inclus.` : 'Sélectionnez une date de début et une date de fin valides.'}
          {' '}Après le calcul, les index réellement utilisés et leurs dates de lecture seront affichés dans les résultats.
        </p>
      </div>
    </fieldset>
  );
}

function SqueletteResultat() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="space-y-6"
    >
      <span className="sr-only">Analyse en cours…</span>

      <div className="jr-shimmer h-28 rounded-lg" />

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="jr-shimmer h-80 rounded-lg" />
        <div className="jr-shimmer h-80 rounded-lg" />
      </div>
    </div>
  );
}

/* =========================================================
   PAGE
========================================================= */

const FILTRES_PAR_DEFAUT = () => ({
  type: 'ELECTRICITE',
  compteurId: '',
  // Les dates sont remplies après lecture des dates réellement présentes en base.
  dateDebut1: '',
  dateFin1: '',
  dateDebut2: '',
  dateFin2: '',
});

function ComparaisonPage() {
  const navigate = useNavigate();
  const reduireMouvements = useReducedMotion();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState(null);

  const [compteurs, setCompteurs] = useState([]);
  const [loadingCompteurs, setLoadingCompteurs] = useState(true);
  const [erreurCompteurs, setErreurCompteurs] = useState('');
  const [versionCompteurs, setVersionCompteurs] = useState(0);

  const [datesDisponibles, setDatesDisponibles] = useState([]);
  const [loadingDatesDisponibles, setLoadingDatesDisponibles] = useState(false);
  const [erreurDatesDisponibles, setErreurDatesDisponibles] = useState('');
  const requeteDatesRef = useRef(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resultat, setResultat] = useState(null);

  const [filters, setFilters] = useState(FILTRES_PAR_DEFAUT);
  const [raccourciActif, setRaccourciActif] = useState(null);
  const [tentative, setTentative] = useState(false);

  const idRequete = useRef(0);
  const controleur = useRef(null);
  const zoneResultat = useRef(null);
  const titreResultat = useRef(null);

  /* ---------- Déconnexion ---------- */

  const deconnecter = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');

    navigate('/', { replace: true });
  }, [navigate]);

  /* ---------- Utilisateur connecté ---------- */

  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (!token || !storedUser) {
      navigate('/', { replace: true });
      return;
    }

    try {
      const currentUser = JSON.parse(storedUser);

      setUser(currentUser);

      const role = String(currentUser?.role || '')
        .trim()
        .toUpperCase();

      if (!['ADMINISTRATEUR', 'RESPONSABLE'].includes(role)) {
        navigate('/', { replace: true });
      }
    } catch (err) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');

      navigate('/', { replace: true });
    }
  }, [navigate]);

  /* ---------- Dates réelles disponibles dans PostgreSQL ---------- */

  useEffect(() => {
    const controle = new AbortController();
    const numeroRequete = ++requeteDatesRef.current;

    async function chargerDatesDisponibles() {
      setLoadingDatesDisponibles(true);
      setErreurDatesDisponibles('');
      setDatesDisponibles([]);

      try {
        const response = await axiosClient.get('/comparaison/dates-disponibles', {
          params: {
            type: filters.type,
            compteurId: filters.compteurId || undefined,
          },
          signal: controle.signal,
        });

        if (numeroRequete !== requeteDatesRef.current) return;

        const dates = datesTrieesDisponibles(response.data?.data?.dates || []);
        setDatesDisponibles(dates);
        setFilters((previous) => ({
          ...previous,
          ...construirePeriodesDepuisDates(dates),
        }));
        setResultat(null);
        setError('');
        setRaccourciActif(null);

        if (dates.length < 4) {
          setErreurDatesDisponibles(
            dates.length === 0
              ? 'Aucune date de lecture exploitable n’a été trouvée dans la base pour cette sélection.'
              : `Seulement ${pluriel(dates.length, 'date de lecture')} disponible${dates.length > 1 ? 's' : ''}. Il faut au moins quatre dates distinctes pour construire deux périodes non chevauchantes à comparer.`
          );
        }
      } catch (err) {
        if (err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError') return;
        if (numeroRequete !== requeteDatesRef.current) return;

        if (err.response?.status === 401 || err.response?.status === 403) {
          deconnecter();
          return;
        }

        setDatesDisponibles([]);
        setFilters((previous) => ({
          ...previous,
          dateDebut1: '',
          dateFin1: '',
          dateDebut2: '',
          dateFin2: '',
        }));
        setErreurDatesDisponibles(
          err.response?.data?.message ||
            'Impossible de récupérer les dates de relevés depuis la base de données.'
        );
      } finally {
        if (!controle.signal.aborted && numeroRequete === requeteDatesRef.current) {
          setLoadingDatesDisponibles(false);
        }
      }
    }

    chargerDatesDisponibles();
    return () => controle.abort();
  }, [filters.type, filters.compteurId, deconnecter]);

  /* ---------- Chargement des compteurs ---------- */

  useEffect(() => {
    const controle = new AbortController();

    async function chargerCompteurs() {
      setLoadingCompteurs(true);
      setErreurCompteurs('');

      try {
        const response = await axiosClient.get('/compteurs', {
          signal: controle.signal,
        });

        const data =
          response.data?.data ||
          response.data?.compteurs ||
          response.data ||
          [];

        setCompteurs(Array.isArray(data) ? data : []);
      } catch (err) {
        if (
          err?.code === 'ERR_CANCELED' ||
          err?.name === 'CanceledError'
        ) {
          return;
        }

        if (err.response?.status === 401 || err.response?.status === 403) {
          deconnecter();
          return;
        }

        setErreurCompteurs(
          err.response?.data?.message ||
            'Impossible de charger la liste des compteurs.'
        );
      } finally {
        if (!controle.signal.aborted) {
          setLoadingCompteurs(false);
        }
      }
    }

    chargerCompteurs();

    return () => controle.abort();
  }, [deconnecter, versionCompteurs]);

  /* ---------- Compteurs du type choisi ---------- */

  const compteursFiltres = useMemo(
    () =>
      compteurs.filter((compteur) => {
        const valeurBrute = String(compteur.type || '')
          .trim()
          .toUpperCase();
        const type = valeurBrute === 'ÉLECTRICITÉ'
          ? 'ELECTRICITE'
          : valeurBrute;

        return type === filters.type;
      }),
    [compteurs, filters.type]
  );

  // Le compteur choisi n'appartient plus au type : on le retire
  useEffect(() => {
    if (
      filters.compteurId &&
      !compteursFiltres.some(
        (compteur) => String(compteur.id) === String(filters.compteurId)
      )
    ) {
      setFilters((previous) => ({ ...previous, compteurId: '' }));
    }
  }, [compteursFiltres, filters.compteurId]);

  /* ---------- Annulation d'une requête en cours ---------- */

  const annulerRequete = useCallback(() => {
    idRequete.current += 1;

    controleur.current?.abort();
    controleur.current = null;

    setLoading(false);
  }, []);

  useEffect(() => () => controleur.current?.abort(), []);

  /* ---------- Saisie ---------- */

  const handleChange = (event) => {
    const { name, value } = event.target;

    // un changement de filtre invalide le calcul en cours et le résultat affiché
    annulerRequete();

    setFilters((previous) =>
      name === 'type'
        ? { ...previous, type: value, compteurId: '' }
        : { ...previous, [name]: value }
    );
    setError('');
    setResultat(null);

    if (CHAMPS_DATES.includes(name)) {
      setRaccourciActif(null);
    }
  };

  const appliquerRaccourci = (raccourci) => {
    annulerRequete();

    setFilters((previous) => ({ ...previous, ...raccourci.dates }));
    setRaccourciActif(raccourci.id);
    setError('');
    setResultat(null);
  };

  /* ---------- Validation et aides visuelles ---------- */

  const erreursChamps = useMemo(
    () => (tentative ? validerFiltres(filters) : {}),
    [tentative, filters]
  );

  const nombreErreurs = Object.keys(erreursChamps).length;

  const jours1 = nombreJours(filters.dateDebut1, filters.dateFin1);
  const jours2 = nombreJours(filters.dateDebut2, filters.dateFin2);

  const zoneChevauchement = useMemo(() => chevauchement(filters), [filters]);

  const avertissementsFormulaire = [];

  if (zoneChevauchement) {
    avertissementsFormulaire.push(
      zoneChevauchement.debut === zoneChevauchement.fin
        ? `Les périodes se chevauchent le ${formatDate(zoneChevauchement.debut)}. Choisissez une date de fin de période 1 antérieure au début de période 2.`
        : `Les périodes se chevauchent du ${formatDate(zoneChevauchement.debut)} au ${formatDate(zoneChevauchement.fin)}. Elles doivent être distinctes pour éviter de compter les mêmes jours deux fois.`
    );
  }

  if (durreesDifferentes(jours1, jours2)) {
    avertissementsFormulaire.push(
      `Les durées diffèrent (${pluriel(jours1, 'jour')} contre ${pluriel(jours2, 'jour')}) : interprétez la comparaison avec prudence.`
    );
  }

  const raccourcis = useMemo(
    () => construireRaccourcis(datesDisponibles),
    [datesDisponibles]
  );

  const typeActif =
    TYPES.find((type) => type.valeur === filters.type) || TYPES[0];

  const compteurSelectionne = compteurs.find(
    (compteur) => String(compteur.id) === String(filters.compteurId)
  );

  /* ---------- Lancer la comparaison ---------- */

  const lancerComparaison = async (event) => {
    event?.preventDefault();

    if (loading) {
      return;
    }

    setTentative(true);

    const erreurs = validerFiltres(filters);

    if (Object.keys(erreurs).length > 0) {
      const premier =
        CHAMPS_DATES.find((champ) => erreurs[champ]) ||
        (erreurs.periode1 ? 'dateDebut1' : 'dateDebut2');

      document.getElementById(`champ-${premier}`)?.focus();

      return;
    }

    controleur.current?.abort();

    const controle = new AbortController();

    controleur.current = controle;
    idRequete.current += 1;

    const id = idRequete.current;

    setLoading(true);
    setError('');
    setResultat(null);

    try {
      const response = await axiosClient.get('/comparaison', {
        params: {
          type: filters.type,
          compteurId: filters.compteurId || undefined,
          dateDebut1: filters.dateDebut1,
          dateFin1: filters.dateFin1,
          dateDebut2: filters.dateDebut2,
          dateFin2: filters.dateFin2,
        },
        signal: controle.signal,
      });

      // réponse devenue obsolète (filtre modifié, nouvelle demande...)
      if (id !== idRequete.current) {
        return;
      }

      const donnees = response.data?.data || null;

      setResultat(donnees);

      if (!donnees) {
        setError('Le serveur a renvoyé une réponse inattendue.');
      }
    } catch (err) {
      if (
        err?.code === 'ERR_CANCELED' ||
        err?.name === 'CanceledError'
      ) {
        return;
      }

      if (id !== idRequete.current) {
        return;
      }

      if (err.response?.status === 401 || err.response?.status === 403) {
        deconnecter();
        return;
      }

      setError(
        err.response?.data?.message ||
          'Impossible de calculer la comparaison.'
      );
    } finally {
      if (id === idRequete.current) {
        setLoading(false);
      }
    }
  };

  /* ---------- Réinitialiser ---------- */

  const reset = () => {
    annulerRequete();

    setFilters({
      ...FILTRES_PAR_DEFAUT(),
      ...construirePeriodesDepuisDates(datesDisponibles),
    });
    setRaccourciActif(null);
    setTentative(false);
    setResultat(null);
    setError('');
  };

  /* ---------- Résultat affiché : amené à l'écran ---------- */

  useEffect(() => {
    if (!resultat) {
      return;
    }

    zoneResultat.current?.scrollIntoView?.({
      behavior: reduireMouvements ? 'auto' : 'smooth',
      block: 'start',
    });

    titreResultat.current?.focus({ preventScroll: true });
  }, [resultat, reduireMouvements]);

  /* ---------- Données dérivées du résultat ---------- */

  const analyse = useMemo(
    () => (resultat ? analyserResultat(resultat) : null),
    [resultat]
  );

  const typeResultat = resultat
    ? TYPES.find((type) => type.valeur === resultat.type) || typeActif
    : typeActif;

  const donneesGraphique = useMemo(() => {
    if (!resultat || !analyse) {
      return [];
    }

    return [
      {
        nom: 'Période 1',
        libelle: 'Période 1',
        dates: `${formatDate(resultat.periode1?.dateDebut)} → ${formatDate(resultat.periode1?.dateFin)}`,
        total: analyse.total1,
        couleur: COULEUR_PERIODE_1,
      },
      {
        nom: 'Période 2',
        libelle: 'Période 2',
        dates: `${formatDate(resultat.periode2?.dateDebut)} → ${formatDate(resultat.periode2?.dateFin)}`,
        total: analyse.total2,
        couleur: typeResultat.couleur,
      },
    ];
  }, [resultat, analyse, typeResultat]);

  const libelleCompteurResultat = resultat?.compteur?.numero_compteur
    ? `Référence client ${resultat.compteur.numero_compteur}`
    : 'Tous les compteurs';

  const styleTon = STYLES_TON[analyse?.ton || 'neutre'];

  const lignesIndex = useMemo(() => {
    if (!resultat) return [];

    const periode1 = (resultat.periode1?.details_indices || []).map((ligne) => ({
      ...ligne,
      clePeriode: 'periode1',
      nomPeriode: 'Période 1 · Référence',
      couleurPeriode: COULEUR_PERIODE_1,
    }));
    const periode2 = (resultat.periode2?.details_indices || []).map((ligne) => ({
      ...ligne,
      clePeriode: 'periode2',
      nomPeriode: 'Période 2 · Comparée',
      couleurPeriode: typeResultat?.couleur || TYPES[0].couleur,
    }));

    return [...periode1, ...periode2];
  }, [resultat, typeResultat]);

  const libelleSelection = [
    typeActif.libelle,
    compteurSelectionne
      ? `Référence client ${compteurSelectionne.numero_compteur}`
      : 'tous les compteurs',
  ].join(' · ');

  /* ---------- Rendu ---------- */

  return (
    <AdminShell intensite="calme">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activePath="/dashboard/admin/comparaison"
        onNavigate={(path) => navigate(path)}
        onLogout={deconnecter}
        user={user}
      />

      <div className="lg:pl-72">
        <Header
          onOpenSidebar={() => setSidebarOpen(true)}
          onProfile={() => navigate('/dashboard/admin')}
          user={user}
        />

        <main className="px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl space-y-6">
            {/* ---------- En-tête ---------- */}
            <div className="jr-entree flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={() => navigate('/dashboard/admin')}
                  className="mb-3 inline-flex items-center gap-2 rounded-md text-sm font-medium text-jr-lien transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jr-elec motion-reduce:transition-none"
                >
                  <ArrowLeft size={16} aria-hidden="true" />
                  Retour au tableau de bord
                </button>

                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-jr-lien">
                  <GitCompare size={14} aria-hidden="true" />
                  Analyse
                </p>

                <h1 className="mt-1 text-3xl font-semibold tracking-tight text-jr-titre sm:text-4xl">
                  Comparaison des consommations
                </h1>

                <p className="mt-1.5 max-w-xl text-sm text-jr-doux">
                  Mesurez l’écart de consommation entre deux périodes, pour
                  l’eau ou l’électricité.
                </p>
              </div>

              <button
                type="button"
                onClick={reset}
                className="jr-verre inline-flex items-center justify-center gap-2 rounded-md border border-jr-bordure px-4 py-2.5 text-sm font-semibold text-jr-doux shadow-sm transition hover:bg-jr-eau-pale hover:text-jr-lien focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jr-elec motion-reduce:transition-none"
              >
                <RefreshCw size={16} aria-hidden="true" />
                Réinitialiser
              </button>
            </div>

            {/* ---------- Erreur de chargement des compteurs ---------- */}
            {erreurCompteurs && (
              <div
                role="alert"
                className="jr-verre flex flex-col gap-3 rounded-lg border border-jr-err-bordure p-4 text-sm sm:flex-row sm:items-center"
              >
                <AlertCircle
                  size={18}
                  className="shrink-0 text-jr-err"
                  aria-hidden="true"
                />
                <p className="flex-1 font-medium text-jr-texte">
                  {erreurCompteurs}
                </p>
                <button
                  type="button"
                  onClick={() => setVersionCompteurs((v) => v + 1)}
                  className="jr-btn jr-btn-bleu rounded-md px-3.5 py-2 text-xs font-semibold"
                >
                  Recharger la liste
                </button>
              </div>
            )}

            {/* ---------- Formulaire ---------- */}
            <section
              aria-labelledby="titre-parametres"
              className="jr-verre jr-entree overflow-hidden rounded-lg border border-jr-bordure shadow-sm"
            >
              <form onSubmit={lancerComparaison} noValidate>
                <h2 id="titre-parametres" className="sr-only">
                  Paramètres de comparaison
                </h2>

                {/* Étape 1 : quoi comparer */}
                <fieldset className="p-5 sm:p-6">
                  <legend className="mb-4 flex items-center gap-2.5 text-sm font-semibold text-jr-titre">
                    <span
                      aria-hidden="true"
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-jr-eau text-xs font-bold text-white"
                    >
                      1
                    </span>
                    Que voulez-vous comparer ?
                  </legend>

                  <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
                    <div>
                      <p
                        id="libelle-type"
                        className="mb-1.5 text-xs font-semibold text-jr-doux"
                      >
                        Type de consommation
                      </p>

                      <div
                        role="radiogroup"
                        aria-labelledby="libelle-type"
                        className="grid grid-cols-2 gap-2"
                      >
                        {TYPES.map((type) => {
                          const actif = filters.type === type.valeur;
                          const Icone = type.Icone;

                          return (
                            <label
                              key={type.valeur}
                              className={`flex cursor-pointer items-center gap-3 rounded-md border px-4 py-3 text-sm transition focus-within:ring-2 focus-within:ring-jr-elec motion-reduce:transition-none ${
                                actif
                                  ? type.actif
                                  : 'border-jr-bordure text-jr-doux hover:bg-jr-champ'
                              }`}
                            >
                              <input
                                type="radio"
                                name="type"
                                value={type.valeur}
                                checked={actif}
                                onChange={handleChange}
                                className="sr-only"
                              />
                              <Icone size={20} aria-hidden="true" />
                              <span className="min-w-0">
                                <span className="block font-semibold">
                                  {type.libelle}
                                </span>
                                <span className="block text-xs opacity-80">
                                  en {type.unite}
                                </span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="champ-compteur"
                        className="mb-1.5 block text-xs font-semibold text-jr-doux"
                      >
                        Référence client
                      </label>

                      <select
                        id="champ-compteur"
                        name="compteurId"
                        value={filters.compteurId}
                        onChange={handleChange}
                        disabled={loadingCompteurs}
                        aria-busy={loadingCompteurs || undefined}
                        className="jr-field w-full rounded-md border px-3 py-3 text-sm disabled:opacity-70"
                      >
                        <option value="">
                          {loadingCompteurs
                            ? 'Chargement des compteurs…'
                            : 'Tous les compteurs de ce type'}
                        </option>

                        {compteursFiltres.map((compteur) => {
                          const abonne = [
                            compteur.abonne_prenom,
                            compteur.abonne_nom,
                          ]
                            .filter(Boolean)
                            .join(' ');

                          return (
                            <option key={compteur.id} value={compteur.id}>
                              {compteur.numero_compteur}
                              {abonne ? ` — ${abonne}` : ''}
                            </option>
                          );
                        })}
                      </select>

                      <p className="mt-1.5 text-xs text-jr-faible">
                        {loadingCompteurs
                          ? 'Récupération de la liste…'
                          : `${pluriel(compteursFiltres.length, 'compteur')} ${filters.type === 'EAU' ? 'd’eau' : 'd’électricité'} disponible${compteursFiltres.length > 1 ? 's' : ''}.`}
                      </p>
                    </div>
                  </div>
                </fieldset>

                <div className="border-t border-jr-bordure" />

                <div
                  role={erreurDatesDisponibles ? 'alert' : 'status'}
                  aria-live="polite"
                  className={`mx-5 mt-4 rounded-md border px-4 py-3 text-sm sm:mx-6 ${
                    erreurDatesDisponibles
                      ? 'border-jr-attention bg-jr-elec-pale text-jr-texte'
                      : 'border-jr-bordure bg-jr-champ text-jr-doux'
                  }`}
                >
                  {loadingDatesDisponibles ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 size={15} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
                      Recherche des dates de lecture dans PostgreSQL…
                    </span>
                  ) : erreurDatesDisponibles ? (
                    erreurDatesDisponibles
                  ) : (
                    <>
                      <span className="font-semibold text-jr-titre">Dates réellement présentes dans la base :</span>{' '}
                      {pluriel(datesDisponibles.length, 'date distincte')}, du {formatDate(datesDisponibles[0])} au {formatDate(datesDisponibles[datesDisponibles.length - 1])}.
                      {' '}Les quatre champs de période proposent uniquement ces dates réelles.
                    </>
                  )}
                </div>

                {/* Raccourcis établis uniquement à partir des dates disponibles */}
                <div className="flex flex-col gap-3 px-5 pt-5 sm:px-6 lg:flex-row lg:items-center">
                  <p className="flex shrink-0 items-center gap-2 text-xs font-semibold text-jr-doux">
                    <CalendarDays size={15} aria-hidden="true" />
                    Raccourcis de période
                  </p>

                  <div
                    role="group"
                    aria-label="Raccourcis de période"
                    className="flex flex-wrap gap-2"
                  >
                    {raccourcis.map((raccourci) => {
                      const actif = raccourciActif === raccourci.id;

                      return (
                        <button
                          key={raccourci.id}
                          type="button"
                          aria-pressed={actif}
                          onClick={() => appliquerRaccourci(raccourci)}
                          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jr-elec motion-reduce:transition-none ${
                            actif
                              ? 'border-[var(--jr-eau-clair)] bg-jr-eau-pale text-jr-lien'
                              : 'border-jr-bordure text-jr-doux hover:bg-jr-champ'
                          }`}
                        >
                          {raccourci.libelle}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Étapes 2 et 3 : les deux périodes */}
                <div className="grid lg:grid-cols-2 lg:divide-x lg:divide-jr-bordure">
                  <BlocPeriode
                    numero={1}
                    titre="Période 1"
                    description="Référence"
                    couleur={COULEUR_PERIODE_1}
                    nomDebut="dateDebut1"
                    nomFin="dateFin1"
                    debut={filters.dateDebut1}
                    fin={filters.dateFin1}
                    onChange={handleChange}
                    erreurDebut={erreursChamps.dateDebut1}
                    erreurFin={erreursChamps.dateFin1}
                    erreurPeriode={erreursChamps.periode1}
                    datesDisponibles={datesDisponibles}
                    chargementDates={loadingDatesDisponibles}
                  />

                  <BlocPeriode
                    numero={2}
                    titre="Période 2"
                    description="Période comparée"
                    couleur={typeActif.couleur}
                    nomDebut="dateDebut2"
                    nomFin="dateFin2"
                    debut={filters.dateDebut2}
                    fin={filters.dateFin2}
                    onChange={handleChange}
                    erreurDebut={erreursChamps.dateDebut2}
                    erreurFin={erreursChamps.dateFin2}
                    erreurPeriode={erreursChamps.periode2}
                    datesDisponibles={datesDisponibles}
                    chargementDates={loadingDatesDisponibles}
                  />
                </div>

                {/* Pied de formulaire */}
                <div className="border-t border-jr-bordure bg-jr-champ px-5 py-4 sm:px-6">
                  {avertissementsFormulaire.length > 0 && (
                    <ul
                      aria-live="polite"
                      className="mb-4 space-y-1.5"
                    >
                      {avertissementsFormulaire.map((texte) => (
                        <li
                          key={texte}
                          className="flex items-start gap-2 text-xs text-jr-doux"
                        >
                          <TriangleAlert
                            size={14}
                            className="mt-px shrink-0 text-jr-attention"
                            aria-hidden="true"
                          />
                          <span>{texte}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {nombreErreurs > 0 && (
                    <p
                      role="alert"
                      className="mb-4 flex items-center gap-2 text-sm font-medium text-jr-err"
                    >
                      <AlertCircle size={16} aria-hidden="true" />
                      Corrigez les dates signalées pour lancer la comparaison.
                    </p>
                  )}

                  {error && (
                    <div
                      role="alert"
                      className="mb-4 flex flex-col gap-3 rounded-md border border-jr-err-bordure bg-jr-err-pale p-3 text-sm sm:flex-row sm:items-center"
                    >
                      <AlertCircle
                        size={18}
                        className="shrink-0 text-jr-err"
                        aria-hidden="true"
                      />
                      <p className="flex-1 font-medium text-jr-texte">
                        {error}
                      </p>
                      <button
                        type="button"
                        onClick={lancerComparaison}
                        disabled={loading}
                        className="rounded-md border border-jr-err-bordure px-3 py-1.5 text-xs font-semibold text-jr-err transition hover:bg-jr-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jr-elec disabled:opacity-60 motion-reduce:transition-none"
                      >
                        Réessayer
                      </button>
                    </div>
                  )}

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-jr-faible">
                      <span className="font-semibold text-jr-doux">
                        {libelleSelection}
                      </span>
                      {' · '}
                      période 1 : {jours1 > 0 ? pluriel(jours1, 'jour') : '—'}
                      {' · '}
                      période 2 : {jours2 > 0 ? pluriel(jours2, 'jour') : '—'}
                    </p>

                    <button
                      type="submit"
                      disabled={loading || loadingDatesDisponibles || datesDisponibles.length < 4}
                      aria-busy={loading || undefined}
                      className="jr-btn jr-btn-elec inline-flex w-full items-center justify-center gap-2 rounded-md px-5 py-3 text-sm font-semibold shadow-sm disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto motion-reduce:transition-none"
                    >
                      {loading ? (
                        <>
                          <Loader2
                            size={17}
                            className="animate-spin motion-reduce:animate-none"
                            aria-hidden="true"
                          />
                          Analyse en cours…
                        </>
                      ) : (
                        <>
                          <BarChart3 size={17} aria-hidden="true" />
                          Comparer les consommations
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </section>

            {/* ---------- Résultats ---------- */}
            {loading && <SqueletteResultat />}

            {!loading && !resultat && !error && (
              <div className="flex items-center gap-4 rounded-lg border border-dashed border-jr-bordure-forte p-5 text-sm text-jr-doux">
                <BarChart3
                  size={22}
                  className="shrink-0 text-jr-faible"
                  aria-hidden="true"
                />
                <p>
                  <span className="font-semibold text-jr-texte">
                    Aucune comparaison lancée.
                  </span>{' '}
                  Les dates sont chargées depuis les relevés réellement présents dans PostgreSQL. Choisissez deux périodes distinctes, puis lancez le calcul.
                </p>
              </div>
            )}

            {!loading && resultat && analyse && (
              <section
                ref={zoneResultat}
                aria-labelledby="titre-resultat"
                className="jr-entree space-y-6 scroll-mt-24"
              >
                <div>
                  <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-jr-lien">
                    <typeResultat.Icone size={14} aria-hidden="true" />
                    Résultat · {typeResultat.libelle}
                  </p>

                  <h2
                    id="titre-resultat"
                    ref={titreResultat}
                    tabIndex={-1}
                    className="mt-1 text-2xl font-semibold tracking-tight text-jr-titre outline-none"
                  >
                    {libelleCompteurResultat}
                  </h2>

                  <p className="mt-1 text-sm text-jr-doux">
                    Du {formatDate(resultat.periode1?.dateDebut)} au{' '}
                    {formatDate(resultat.periode1?.dateFin)} (
                    {pluriel(analyse.jours1, 'jour')}), comparé au{' '}
                    {formatDate(resultat.periode2?.dateDebut)} au{' '}
                    {formatDate(resultat.periode2?.dateFin)} (
                    {pluriel(analyse.jours2, 'jour')}).
                  </p>
                </div>

                {/* Bandeau de lecture */}
                <dl className="grid gap-px overflow-hidden rounded-lg border border-jr-bordure bg-[var(--jr-bordure)] shadow-sm sm:grid-cols-2 lg:grid-cols-4">
                  <div className="bg-jr-surface p-5">
                    <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-jr-faible">
                      <Repere couleur={COULEUR_PERIODE_1} />
                      Total période 1
                    </dt>
                    <dd className="mt-2 text-2xl font-semibold tracking-tight text-jr-titre">
                      {valeurAvecUnite(analyse.total1, analyse.unite)}
                    </dd>
                    <dd className="mt-1 text-xs text-jr-faible">
                      {formatDateCourte(resultat.periode1?.dateDebut)} →{' '}
                      {formatDateCourte(resultat.periode1?.dateFin)}
                    </dd>
                  </div>

                  <div className="bg-jr-surface p-5">
                    <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-jr-faible">
                      <Repere couleur={typeResultat.couleur} />
                      Total période 2
                    </dt>
                    <dd className="mt-2 text-2xl font-semibold tracking-tight text-jr-titre">
                      {valeurAvecUnite(analyse.total2, analyse.unite)}
                    </dd>
                    <dd className="mt-1 text-xs text-jr-faible">
                      {formatDateCourte(resultat.periode2?.dateDebut)} →{' '}
                      {formatDateCourte(resultat.periode2?.dateFin)}
                    </dd>
                  </div>

                  <div className="bg-jr-surface p-5">
                    <dt className="text-xs font-semibold uppercase tracking-wider text-jr-faible">
                      Écart (période 2 − période 1)
                    </dt>
                    <dd
                      className={`mt-2 text-2xl font-semibold tracking-tight ${styleTon.texte}`}
                    >
                      {valeurAvecUnite(analyse.difference, analyse.unite, {
                        signe: true,
                      })}
                    </dd>
                    <dd className="mt-1 text-xs text-jr-faible">
                      Calcul fondé sur les index des mêmes compteurs
                    </dd>
                  </div>

                  <div className="bg-jr-surface p-5">
                    <dt className="text-xs font-semibold uppercase tracking-wider text-jr-faible">
                      Évolution
                    </dt>
                    <dd
                      className={`mt-2 flex items-center gap-2 text-2xl font-semibold tracking-tight ${styleTon.texte}`}
                    >
                      <analyse.Icone size={22} aria-hidden="true" />
                      {analyse.evolution === null
                        ? 'Non calculable'
                        : `${formatNombre(analyse.evolution, { signe: true })}${ESPACE}%`}
                    </dd>
                    <dd className="mt-1 text-xs text-jr-faible">
                      Tendance : {analyse.libelle}
                    </dd>
                  </div>
                </dl>

                <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
                  {/* Graphique */}
                  <div className="jr-verre rounded-lg border border-jr-bordure p-5 shadow-sm sm:p-6">
                    <h3 className="text-base font-semibold text-jr-titre">
                      Totaux par période
                    </h3>
                    <p className="mt-1 text-sm text-jr-faible">
                      Consommation calculée par compteur : index de fin retenu moins index de départ retenu, en {analyse.unite}.
                    </p>

                    <div
                      role="img"
                      aria-label={`Graphique en barres : période 1, ${valeurAvecUnite(analyse.total1, analyse.unite)} ; période 2, ${valeurAvecUnite(analyse.total2, analyse.unite)}.`}
                      className="mt-4 h-[300px]"
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={donneesGraphique}
                          margin={{ top: 28, right: 12, left: 0, bottom: 4 }}
                          barCategoryGap="30%"
                        >
                          <CartesianGrid
                            stroke="var(--jr-bordure)"
                            strokeDasharray="3 4"
                            vertical={false}
                          />
                          <XAxis
                            dataKey="libelle"
                            tickLine={false}
                            axisLine={{ stroke: 'var(--jr-bordure)' }}
                            tick={{
                              fill: 'var(--jr-texte-doux)',
                              fontSize: 12,
                            }}
                          />
                          <YAxis
                            tickLine={false}
                            axisLine={false}
                            width={56}
                            tick={{
                              fill: 'var(--jr-texte-faible)',
                              fontSize: 11,
                            }}
                            tickFormatter={(valeur) =>
                              formatNombre(valeur, { decimales: 0 })
                            }
                          />
                          <Tooltip
                            cursor={{ fill: 'var(--jr-eau-pale)' }}
                            content={<InfoBulle unite={analyse.unite} />}
                          />
                          <Bar
                            dataKey="total"
                            radius={[4, 4, 0, 0]}
                            maxBarSize={96}
                            isAnimationActive={!reduireMouvements}
                            animationDuration={500}
                          >
                            {donneesGraphique.map((ligne) => (
                              <Cell key={ligne.nom} fill={ligne.couleur} />
                            ))}
                            <LabelList
                              dataKey="total"
                              position="top"
                              formatter={(valeur) =>
                                valeurAvecUnite(valeur, analyse.unite)
                              }
                              style={{
                                fill: 'var(--jr-texte)',
                                fontSize: 12,
                                fontWeight: 600,
                              }}
                            />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Lecture du résultat */}
                  <div className="jr-verre rounded-lg border border-jr-bordure p-5 shadow-sm sm:p-6">
                    <p className="text-xs font-semibold uppercase tracking-widest text-jr-faible">
                      Lecture du résultat
                    </p>

                    <div className="mt-3 flex items-center gap-3">
                      <span
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${styleTon.pastille}`}
                      >
                        <analyse.Icone size={20} aria-hidden="true" />
                      </span>

                      <p
                        className={`text-xl font-semibold ${styleTon.texte}`}
                      >
                        {analyse.libelle}
                      </p>
                    </div>

                    <p className="mt-4 text-sm leading-6 text-jr-texte">
                      {analyse.phrase}
                    </p>

                    {analyse.precision && (
                      <p className="mt-2 text-sm leading-6 text-jr-doux">
                        {analyse.precision}
                      </p>
                    )}

                    {analyse.notes.length > 0 && (
                      <ul className="mt-4 space-y-2 border-t border-jr-bordure pt-4">
                        {analyse.notes.map((note) => (
                          <li
                            key={note}
                            className="flex items-start gap-2 text-xs leading-5 text-jr-doux"
                          >
                            <TriangleAlert
                              size={14}
                              className="mt-0.5 shrink-0 text-jr-attention"
                              aria-hidden="true"
                            />
                            <span>{note}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    <p className="mt-4 border-t border-jr-bordure pt-4 text-xs leading-5 text-jr-faible">
                      Une variation entre deux périodes n’indique pas, à elle
                      seule, une anomalie ni une fuite : la détection
                      d’anomalies est un module distinct. Cette comparaison ne
                      modifie aucune donnée.
                    </p>
                  </div>
                </div>

                {/* Index réellement utilisés dans les calculs */}
                <div className="jr-verre overflow-hidden rounded-lg border border-jr-bordure shadow-sm">
                  <div className="border-b border-jr-bordure p-5 sm:p-6">
                    <div className="flex items-start gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-jr-eau-pale text-jr-lien">
                        <GitCompare size={18} aria-hidden="true" />
                      </span>
                      <div>
                        <h3 className="text-base font-semibold text-jr-titre">
                          Index utilisés pour calculer les périodes 1 et 2
                        </h3>
                        <p className="mt-1 max-w-3xl text-sm leading-6 text-jr-faible">
                          Le calcul est effectué séparément pour chaque compteur : consommation de la période = index de fin retenu − index de départ retenu. Les dates affichées sous les index sont celles des lectures réelles utilisées ; elles peuvent différer des bornes sélectionnées lorsqu’aucune lecture n’a été faite exactement à ces dates.
                        </p>
                      </div>
                    </div>
                    <p className="mt-3 text-xs font-medium text-jr-doux">
                      Compteurs inclus dans les deux calculs : {formatNombre(resultat.periode1?.nombre_compteurs_comparables ?? 0, { decimales: 0 })}.
                    </p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-md border border-jr-bordure bg-jr-champ p-3.5">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-jr-faible">Période 1 · Référence</p>
                        <p className="mt-1.5 text-sm font-semibold text-jr-titre">
                          {formatDate(resultat.periode1?.dateDebut)} → {formatDate(resultat.periode1?.dateFin)}
                        </p>
                        <p className="mt-1 text-sm text-jr-doux">
                          Total calculé : <strong className="text-jr-texte">{valeurAvecUnite(analyse.total1, analyse.unite)}</strong>
                        </p>
                        <p className="mt-1 text-xs text-jr-faible">
                          {formatNombre(resultat.periode1?.nombre_releves, { decimales: 0 })} relevé(s) dans la période.
                        </p>
                      </div>
                      <div className="rounded-md border border-jr-bordure bg-jr-champ p-3.5">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-jr-faible">Période 2 · Comparée</p>
                        <p className="mt-1.5 text-sm font-semibold text-jr-titre">
                          {formatDate(resultat.periode2?.dateDebut)} → {formatDate(resultat.periode2?.dateFin)}
                        </p>
                        <p className="mt-1 text-sm text-jr-doux">
                          Total calculé : <strong className="text-jr-texte">{valeurAvecUnite(analyse.total2, analyse.unite)}</strong>
                        </p>
                        <p className="mt-1 text-xs text-jr-faible">
                          {formatNombre(resultat.periode2?.nombre_releves, { decimales: 0 })} relevé(s) dans la période.
                        </p>
                      </div>
                    </div>
                  </div>

                  {lignesIndex.length === 0 ? (
                    <div className="flex items-start gap-3 p-5 sm:p-6" role="status">
                      <AlertCircle size={18} className="mt-0.5 shrink-0 text-jr-attention" aria-hidden="true" />
                      <div>
                        <p className="text-sm font-semibold text-jr-titre">Aucun index exploitable dans ces périodes</p>
                        <p className="mt-1 text-sm leading-6 text-jr-doux">
                          Aucun relevé ne correspond aux périodes sélectionnées, ou les données ne permettent pas de déterminer les index de début et de fin. Vérifiez les dates ou choisissez une autre période.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="max-h-[34rem] overflow-auto">
                      <table className="min-w-[980px] w-full text-left text-sm">
                        <caption className="sr-only">Index et calculs par compteur pour les deux périodes comparées</caption>
                        <thead className="jr-thead sticky top-0 z-10 text-[11px] uppercase tracking-wider">
                          <tr>
                            <th scope="col" className="px-4 py-3 font-semibold">Période</th>
                            <th scope="col" className="px-4 py-3 font-semibold">Référence client</th>
                            <th scope="col" className="px-4 py-3 font-semibold">Abonné</th>
                            <th scope="col" className="px-4 py-3 font-semibold">Index de départ retenu</th>
                            <th scope="col" className="px-4 py-3 font-semibold">Index de fin retenu</th>
                            <th scope="col" className="px-4 py-3 text-right font-semibold">Consommation calculée</th>
                            <th scope="col" className="px-4 py-3 font-semibold">État</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-jr-bordure">
                          {lignesIndex.map((ligne) => {
                            const calculeIndividuellement = ligne.statut_calcul === 'CALCULABLE';
                            const calculable = calculeIndividuellement && ligne.contribue_comparaison !== false;
                            const excluAutrePeriode = calculeIndividuellement && ligne.contribue_comparaison === false;
                            const incoherent = ligne.statut_calcul === 'INDEX_INCOHERENT';
                            const libelleEtat = calculable
                              ? 'Inclus dans les totaux'
                              : excluAutrePeriode
                                ? 'Hors comparaison'
                                : incoherent
                                  ? 'À vérifier'
                                  : ligne.statut_calcul === 'LECTURE_INSUFFISANTE'
                                    ? 'Index insuffisants'
                                    : 'Index indisponibles';

                            return (
                              <tr key={`${ligne.clePeriode}-${ligne.compteur_id}`} className="transition-colors hover:bg-jr-eau-pale motion-reduce:transition-none">
                                <td className="whitespace-nowrap px-4 py-3.5 font-semibold text-jr-texte">
                                  <span className="inline-flex items-center gap-2">
                                    <Repere couleur={ligne.couleurPeriode} />
                                    {ligne.nomPeriode}
                                  </span>
                                </td>
                                <td className="whitespace-nowrap px-4 py-3.5 font-medium text-jr-texte">
                                  {ligne.numero_compteur || `Compteur #${ligne.compteur_id}`}
                                </td>
                                <td className="px-4 py-3.5 text-jr-doux">
                                  {ligne.abonne || ligne.numero_abonne || 'Abonné non renseigné'}
                                </td>
                                <td className="px-4 py-3.5">
                                  <p className="font-semibold tabular-nums text-jr-texte">
                                    {ligne.index_debut === null ? '—' : formatNombre(ligne.index_debut)}
                                  </p>
                                  <p className="mt-1 text-xs text-jr-faible">
                                    {ligne.date_index_debut ? `Lecture du ${formatDate(ligne.date_index_debut)}` : 'Date de lecture indisponible'}
                                  </p>
                                </td>
                                <td className="px-4 py-3.5">
                                  <p className="font-semibold tabular-nums text-jr-texte">
                                    {ligne.index_fin === null ? '—' : formatNombre(ligne.index_fin)}
                                  </p>
                                  <p className="mt-1 text-xs text-jr-faible">
                                    {ligne.date_index_fin ? `Lecture du ${formatDate(ligne.date_index_fin)}` : 'Date de lecture indisponible'}
                                  </p>
                                </td>
                                <td className="whitespace-nowrap px-4 py-3.5 text-right font-semibold tabular-nums text-jr-texte">
                                  {ligne.consommation_calculee === null
                                    ? 'Non calculable'
                                    : valeurAvecUnite(ligne.consommation_calculee, analyse.unite)}
                                </td>
                                <td className="px-4 py-3.5">
                                  <span className={`inline-flex rounded-sm border px-2 py-1 text-xs font-semibold ${calculable ? 'border-jr-ok bg-jr-ok-pale text-jr-ok' : incoherent ? 'border-jr-err bg-jr-err-pale text-jr-err' : 'border-jr-bordure bg-jr-champ text-jr-doux'}`}>
                                    {libelleEtat}
                                  </span>
                                  {!calculable && (
                                    <p className="mt-1.5 max-w-xs text-xs leading-5 text-jr-faible">
                                      {ligne.message_calcul}
                                    </p>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <div className="border-t border-jr-bordure bg-jr-champ px-5 py-3.5 text-xs leading-5 text-jr-faible sm:px-6">
                    Seuls les compteurs disposant de deux index datés et cohérents contribuent au total. Une donnée manquante n’est jamais interprétée comme une consommation égale à zéro.
                  </div>
                </div>
              </section>
            )}
          </div>
        </main>
      </div>
    </AdminShell>
  );
}

export default ComparaisonPage;