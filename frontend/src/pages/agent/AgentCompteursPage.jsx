import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useNavigate } from 'react-router-dom';

import {
  Ban,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Droplets,
  Info,
  LayoutGrid,
  LayoutList,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  TriangleAlert,
  UserRound,
  X,
  Zap,
} from 'lucide-react';

import axiosClient from '../../api/axiosClient';
import AgentLayout from '../../components/admin/agent/AgentLayout';
import { useToast } from '../../components/ui/ToastProvider.jsx';
import {
  estAnnulation,
  traiterErreurSession,
} from '../../components/admin/sessionUtilisateur.js';

/* =========================================================
   OUTILS
========================================================= */

const CLE_VUE = 'jirama-agent-compteurs-vue';

function formatDate(value) {
  if (!value) {
    return '—';
  }

  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);

  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString('fr-FR');
}

/*
  null / undefined / '' = valeur inconnue (affichée « — »),
  jamais 0 : un compteur sans relevé n'a pas d'index à 0.
*/
function formatNumber(value) {
  if (value === null || value === undefined || value === '') {
    return '—';
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number.toLocaleString('fr-FR', { maximumFractionDigits: 2 })
    : '—';
}

function estEau(item) {
  return String(item?.type || '').toUpperCase() === 'EAU';
}

function uniteDe(item) {
  return estEau(item) ? 'm³' : 'kWh';
}

function nomAbonne(item) {
  return (
    `${item?.abonne_prenom || ''} ${item?.abonne_nom || ''}`.trim() ||
    '—'
  );
}

function statutDe(item) {
  return String(item?.statut || '').trim().toUpperCase();
}

/* minuscules, sans accents, espaces superflus ignorés */
function normaliser(valeur) {
  return String(valeur ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function lireVue() {
  try {
    return localStorage.getItem(CLE_VUE) === 'cartes'
      ? 'cartes'
      : 'tableau';
  } catch {
    return 'tableau';
  }
}

function enregistrerVue(vue) {
  try {
    localStorage.setItem(CLE_VUE, vue);
  } catch {
    /* stockage indisponible : le choix vaut pour cette session */
  }
}

const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jr-elec';

/* =========================================================
   PETITS COMPOSANTS
========================================================= */

function Squelette({ className = '' }) {
  return (
    <div
      aria-hidden="true"
      className={`jr-shimmer rounded-md ${className}`}
    />
  );
}

function IconeType({ item, taille = 18 }) {
  return estEau(item) ? (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-jr-eau-pale text-jr-lien">
      <Droplets size={taille} aria-hidden="true" />
    </span>
  ) : (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-jr-elec-pale text-jr-attention">
      <Zap size={taille} aria-hidden="true" />
    </span>
  );
}

function BadgeStatut({ value }) {
  const code = String(value || '').trim().toUpperCase();

  const config = {
    ACTIF: {
      Icone: CheckCircle2,
      libelle: 'Actif',
      classe: 'border-jr-ok bg-jr-ok-pale text-jr-ok',
    },
    INACTIF: {
      Icone: Ban,
      libelle: 'Inactif',
      classe: 'border-jr-bordure-forte bg-jr-champ text-jr-doux',
    },
    A_VERIFIER: {
      Icone: TriangleAlert,
      libelle: 'À vérifier',
      classe: 'border-jr-elec bg-jr-elec-pale text-jr-attention',
    },
  }[code];

  // autre statut renvoyé par le backend : affiché tel quel, lisiblement
  const courant = config || {
    Icone: Info,
    libelle: code ? code.replace(/_/g, ' ').toLowerCase() : '—',
    classe: 'border-jr-bordure bg-jr-champ text-jr-doux',
  };

  const Icone = courant.Icone;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-semibold first-letter:uppercase ${courant.classe}`}
    >
      <Icone size={13} aria-hidden="true" />
      {courant.libelle}
    </span>
  );
}

function BoutonReleve({ onClick, item, pleineLargeur = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Relever le compteur ${item.numero_compteur || ''}`}
      className={`jr-btn-elec inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md px-4 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jr-focus ${
        pleineLargeur ? 'w-full' : ''
      }`}
    >
      <ClipboardList size={16} aria-hidden="true" />
      Relever
    </button>
  );
}

function SegmentFiltre({ actif, onClick, compte, children }) {
  return (
    <button
      type="button"
      aria-pressed={actif}
      onClick={onClick}
      className={`inline-flex min-h-[44px] items-center gap-2 rounded-md border px-3 text-sm font-semibold transition-colors motion-reduce:transition-none ${FOCUS} ${
        actif
          ? 'border-jr-eau bg-jr-eau text-white'
          : 'border-jr-bordure bg-jr-surface text-jr-doux hover:bg-jr-eau-pale hover:text-jr-lien'
      }`}
    >
      {children}
      <span
        className={`rounded px-1.5 text-xs font-bold ${
          actif ? 'bg-jr-eau-fonce text-white' : 'bg-jr-champ text-jr-faible'
        }`}
      >
        {compte}
      </span>
    </button>
  );
}

function EtatVide({ icone: Icone, titre, message, children }) {
  return (
    <div className="flex flex-col items-center px-5 py-12 text-center">
      <Icone
        size={30}
        aria-hidden="true"
        className="text-jr-faible"
      />
      <p className="mt-3 text-base font-semibold text-jr-texte">
        {titre}
      </p>
      <p className="mt-1 max-w-md text-sm text-jr-doux">{message}</p>
      {children}
    </div>
  );
}

/* Dernier relevé : date, puis index et consommation séparés */
function DernierReleve({ item }) {
  if (!item.dernier_releve) {
    return (
      <p className="text-sm text-jr-faible">Aucun relevé enregistré</p>
    );
  }

  return (
    <>
      <p className="text-sm font-semibold text-jr-texte">
        {formatDate(item.dernier_releve)}
      </p>
      <dl className="mt-1 space-y-0.5 text-xs">
        <div className="flex gap-1.5">
          <dt className="text-jr-faible">Index</dt>
          <dd className="font-bold text-jr-texte">
            {formatNumber(item.dernier_index)}
          </dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="text-jr-faible">Consommation</dt>
          <dd className="font-bold text-jr-texte">
            {formatNumber(item.derniere_consommation)}{' '}
            {item.derniere_consommation !== null &&
            item.derniere_consommation !== undefined
              ? uniteDe(item)
              : ''}
          </dd>
        </div>
      </dl>
    </>
  );
}

/* =========================================================
   PANNEAU DE DÉTAIL (données déjà chargées uniquement)
========================================================= */

function PanneauDetail({ item, onClose, onReleve }) {
  const panneau = useRef(null);
  const boutonFermer = useRef(null);
  const fermer = useRef(onClose);

  fermer.current = onClose;

  useEffect(() => {
    const precedent = document.activeElement;
    const defilement = document.body.style.overflow;

    boutonFermer.current?.focus();
    document.body.style.overflow = 'hidden';

    function surTouche(event) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        fermer.current?.();
        return;
      }

      if (event.key === 'Tab') {
        const focalisables = panneau.current?.querySelectorAll(
          'button, [href], input, select, [tabindex]:not([tabindex="-1"])'
        );

        if (!focalisables?.length) {
          return;
        }

        const premier = focalisables[0];
        const dernier = focalisables[focalisables.length - 1];

        if (event.shiftKey && document.activeElement === premier) {
          event.preventDefault();
          dernier.focus();
        } else if (
          !event.shiftKey &&
          document.activeElement === dernier
        ) {
          event.preventDefault();
          premier.focus();
        }
      }
    }

    document.addEventListener('keydown', surTouche);

    return () => {
      document.removeEventListener('keydown', surTouche);
      document.body.style.overflow = defilement;
      precedent?.focus?.();
    };
  }, []);

  const lignes = [
    ['Type', estEau(item) ? 'Eau (m³)' : 'Électricité (kWh)'],
    ['Abonné', nomAbonne(item)],
    ['N° d’abonné', item.numero_abonne || '—'],
    ['Installation', formatDate(item.date_installation)],
  ];

  return (
    <>
      <button
        type="button"
        tabIndex={-1}
        aria-label="Fermer le détail du compteur"
        onClick={onClose}
        className="fixed inset-0 z-[90]"
        style={{
          backgroundColor:
            'color-mix(in srgb, var(--jr-eau-fonce) 55%, transparent)',
        }}
      />

      <aside
        ref={panneau}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titre-detail-compteur"
        className="jr-toast jr-verre-fort fixed inset-y-0 right-0 z-[100] flex w-full flex-col border-l border-jr-bordure shadow-xl sm:max-w-md"
      >
        <div className="flex items-start gap-3 border-b border-jr-bordure p-5">
          <IconeType item={item} />

          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-jr-lien">
              Compteur
            </p>
            <h2
              id="titre-detail-compteur"
              className="truncate text-xl font-bold text-jr-titre"
            >
              {item.numero_compteur || '—'}
            </h2>
            <div className="mt-2">
              <BadgeStatut value={item.statut} />
            </div>
          </div>

          <button
            ref={boutonFermer}
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-jr-doux transition-colors hover:bg-jr-eau-pale hover:text-jr-lien motion-reduce:transition-none ${FOCUS}`}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-5">
          <dl className="space-y-3 text-sm">
            {lignes.map(([libelle, valeur]) => (
              <div
                key={libelle}
                className="flex justify-between gap-4 border-b border-jr-bordure pb-3"
              >
                <dt className="text-jr-faible">{libelle}</dt>
                <dd className="text-right font-semibold text-jr-texte">
                  {valeur}
                </dd>
              </div>
            ))}

            <div className="border-b border-jr-bordure pb-3">
              <dt className="flex items-center gap-1.5 text-jr-faible">
                <MapPin size={14} aria-hidden="true" />
                Adresse
              </dt>
              <dd className="mt-1 font-semibold text-jr-texte">
                {item.abonne_adresse || 'Adresse non renseignée'}
              </dd>
            </div>

            {item.abonne_telephone && (
              <div className="border-b border-jr-bordure pb-3">
                <dt className="flex items-center gap-1.5 text-jr-faible">
                  <Phone size={14} aria-hidden="true" />
                  Téléphone
                </dt>
                <dd className="mt-1 font-semibold text-jr-texte">
                  {item.abonne_telephone}
                </dd>
              </div>
            )}
          </dl>

          <section aria-labelledby="titre-dernier-releve">
            <h3
              id="titre-dernier-releve"
              className="text-sm font-bold text-jr-titre"
            >
              Dernier relevé connu
            </h3>

            {item.dernier_releve ? (
              <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-jr-faible">Date</dt>
                  <dd className="mt-1 font-bold text-jr-texte">
                    {formatDate(item.dernier_releve)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-jr-faible">Index</dt>
                  <dd className="mt-1 font-bold text-jr-texte">
                    {formatNumber(item.dernier_index)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-jr-faible">
                    Consommation
                  </dt>
                  <dd className="mt-1 font-bold text-jr-texte">
                    {formatNumber(item.derniere_consommation)}{' '}
                    {item.derniere_consommation !== null &&
                    item.derniere_consommation !== undefined
                      ? uniteDe(item)
                      : ''}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="mt-2 text-sm text-jr-doux">
                Aucun relevé n’a encore été enregistré pour ce compteur.
              </p>
            )}
          </section>
        </div>

        <div className="border-t border-jr-bordure p-5">
          <button
            type="button"
            onClick={onReleve}
            className="jr-btn-elec flex min-h-[44px] w-full items-center justify-center gap-2 rounded-md px-4 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jr-focus"
          >
            <ClipboardList size={18} aria-hidden="true" />
            Saisir un relevé
          </button>
        </div>
      </aside>
    </>
  );
}

/* =========================================================
   CONTENU DE LA PAGE
   (rendu dans <AgentLayout> : useToast fonctionne ici)
========================================================= */

function Contenu() {
  const navigate = useNavigate();
  const { notify } = useToast();

  const [compteurs, setCompteurs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [echec, setEchec] = useState(false);
  const [derniereMaj, setDerniereMaj] = useState(null);

  const [recherche, setRecherche] = useState('');
  const [filtreType, setFiltreType] = useState('');
  const [filtreStatut, setFiltreStatut] = useState('');
  const [vue, setVue] = useState(lireVue);
  const [selectionId, setSelectionId] = useState(null);

  const controleur = useRef(null);
  const champRecherche = useRef(null);

  /* ---------- Chargement (GET /agent/compteurs) ---------- */

  const charger = useCallback(
    async (manuel = false) => {
      // une seule requête à la fois : la nouvelle annule l'ancienne
      controleur.current?.abort();

      const controle = new AbortController();

      controleur.current = controle;

      try {
        if (manuel) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const response = await axiosClient.get('/agent/compteurs', {
          signal: controle.signal,
        });

        if (response.data?.status !== 'success') {
          throw new Error(
            response.data?.message ||
              'Impossible de charger les compteurs.'
          );
        }

        const liste = response.data?.data || [];

        setCompteurs(liste);
        setEchec(false);
        setDerniereMaj(new Date());

        if (manuel) {
          notify({
            cle: 'compteurs-actualises',
            genre: 'succes',
            titre: 'Liste des compteurs actualisée',
            message: `${liste.length} compteur${
              liste.length > 1 ? 's' : ''
            } chargé${liste.length > 1 ? 's' : ''}.`,
          });
        }
      } catch (requestError) {
        if (estAnnulation(requestError)) {
          return;
        }

        console.error('Erreur compteurs Agent :', requestError);

        if (traiterErreurSession(requestError, notify, navigate)) {
          return;
        }

        setEchec(true);

        notify({
          cle: 'compteurs-erreur',
          genre: 'erreur',
          titre: 'Compteurs non chargés',
          message:
            requestError.response?.data?.message ||
            'La liste des compteurs n’a pas pu être récupérée. Vérifiez la connexion, puis réessayez.',
          action: {
            label: 'Réessayer',
            onClick: () => charger(true),
          },
        });
      } finally {
        if (controleur.current === controle) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [navigate, notify]
  );

  useEffect(() => {
    charger();

    return () => controleur.current?.abort();
  }, [charger]);

  /* ---------- Raccourci « / » : placer le curseur dans la recherche ---------- */

  useEffect(() => {
    function surTouche(event) {
      if (
        event.key !== '/' ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      ) {
        return;
      }

      const cible = event.target;
      const balise = String(cible?.tagName || '').toLowerCase();

      if (
        ['input', 'textarea', 'select'].includes(balise) ||
        cible?.isContentEditable ||
        document.querySelector('[role="dialog"]')
      ) {
        return;
      }

      event.preventDefault();
      champRecherche.current?.focus();
    }

    document.addEventListener('keydown', surTouche);

    return () => document.removeEventListener('keydown', surTouche);
  }, []);

  /* ---------- Données dérivées (filtrage local, sans requête) ---------- */

  const indexRecherche = useMemo(
    () =>
      compteurs.map((item) => ({
        item,
        texte: normaliser(
          [
            item.numero_compteur,
            item.type,
            estEau(item) ? 'eau' : 'electricite',
            item.numero_abonne,
            item.abonne_nom,
            item.abonne_prenom,
            item.abonne_adresse,
          ]
            .filter(Boolean)
            .join(' ')
        ),
      })),
    [compteurs]
  );

  const compte = useMemo(() => {
    const resultat = {
      total: compteurs.length,
      eau: 0,
      elec: 0,
      actifs: 0,
      inactifs: 0,
      aVerifier: 0,
    };

    compteurs.forEach((item) => {
      if (estEau(item)) {
        resultat.eau += 1;
      } else {
        resultat.elec += 1;
      }

      const statut = statutDe(item);

      if (statut === 'ACTIF') {
        resultat.actifs += 1;
      } else if (statut === 'INACTIF') {
        resultat.inactifs += 1;
      } else if (statut === 'A_VERIFIER') {
        resultat.aVerifier += 1;
      }
    });

    return resultat;
  }, [compteurs]);

  const lignes = useMemo(() => {
    const mots = normaliser(recherche).split(' ').filter(Boolean);

    return indexRecherche
      .filter(({ item, texte }) => {
        if (filtreType === 'EAU' && !estEau(item)) {
          return false;
        }

        if (filtreType === 'ELECTRICITE' && estEau(item)) {
          return false;
        }

        if (filtreStatut && statutDe(item) !== filtreStatut) {
          return false;
        }

        return mots.every((mot) => texte.includes(mot));
      })
      .map(({ item }) => item);
  }, [indexRecherche, recherche, filtreType, filtreStatut]);

  const filtresActifs =
    Boolean(recherche.trim()) || Boolean(filtreType) || Boolean(filtreStatut);

  function reinitialiser() {
    setRecherche('');
    setFiltreType('');
    setFiltreStatut('');
  }

  function basculerType(valeur) {
    setFiltreType((actuel) => (actuel === valeur ? '' : valeur));
  }

  function basculerStatut(valeur) {
    setFiltreStatut((actuel) => (actuel === valeur ? '' : valeur));
  }

  function changerVue(valeur) {
    setVue(valeur);
    enregistrerVue(valeur);
  }

  function allerReleve(item) {
    navigate(`/dashboard/agent/releves?compteur=${item.id}`);
  }

  const selection = useMemo(
    () => compteurs.find((item) => item.id === selectionId) || null,
    [compteurs, selectionId]
  );

  const fermerDetail = useCallback(() => setSelectionId(null), []);

  const texteMaj = derniereMaj
    ? `mis à jour à ${derniereMaj.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
      })}`
    : '';

  const aucunFiltreActif = !filtreType && !filtreStatut;

  /* ---------- Rendu ---------- */

  return (
    <div className="space-y-5">
      {/* ---------- 1. En-tête compact + recherche ---------- */}
      <section className="jr-entree jr-verre-fort rounded-lg border border-jr-bordure p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-jr-titre">
              Liste des compteurs
            </h2>
            <p className="mt-1 text-sm text-jr-doux">
              Retrouvez un compteur et lancez directement son relevé.
            </p>
            <p
              role="status"
              aria-live="polite"
              className={`mt-1 text-xs ${
                echec ? 'text-jr-err' : 'text-jr-faible'
              }`}
            >
              {loading
                ? 'Chargement des compteurs…'
                : echec
                  ? 'Connexion impossible : la liste peut ne pas être à jour'
                  : `${compte.total} compteur${
                      compte.total > 1 ? 's' : ''
                    } chargé${compte.total > 1 ? 's' : ''}${
                      texteMaj ? ` · ${texteMaj}` : ''
                    }`}
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 sm:flex-row lg:max-w-2xl">
            <div className="relative flex-1">
              <label htmlFor="recherche-compteur" className="sr-only">
                Rechercher un compteur ou un abonné
              </label>

              <Search
                size={18}
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-jr-faible"
              />

              <input
                id="recherche-compteur"
                ref={champRecherche}
                type="search"
                value={recherche}
                onChange={(event) => setRecherche(event.target.value)}
                placeholder="N° de compteur, abonné, adresse…"
                autoComplete="off"
                className="min-h-[44px] w-full rounded-md border border-jr-bordure-forte bg-jr-champ py-2 pl-10 pr-20 text-sm text-jr-texte placeholder:text-jr-faible focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jr-elec [&::-webkit-search-cancel-button]:hidden"
              />

              {recherche ? (
                <button
                  type="button"
                  onClick={() => {
                    setRecherche('');
                    champRecherche.current?.focus();
                  }}
                  aria-label="Effacer la recherche"
                  className={`absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-md text-jr-faible transition-colors hover:bg-jr-eau-pale hover:text-jr-lien motion-reduce:transition-none ${FOCUS}`}
                >
                  <X size={18} aria-hidden="true" />
                </button>
              ) : (
                <kbd
                  aria-hidden="true"
                  className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-jr-bordure bg-jr-surface px-1.5 text-xs font-semibold text-jr-faible lg:block"
                >
                  /
                </kbd>
              )}
            </div>

            <button
              type="button"
              onClick={() => charger(true)}
              disabled={loading || refreshing}
              aria-busy={refreshing}
              className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md border border-jr-bordure bg-jr-surface px-4 text-sm font-semibold text-jr-lien transition-colors hover:bg-jr-eau-pale disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none ${FOCUS}`}
            >
              <RefreshCw
                size={18}
                aria-hidden="true"
                className={
                  refreshing
                    ? 'animate-spin motion-reduce:animate-none'
                    : ''
                }
              />
              {refreshing ? 'Actualisation…' : 'Actualiser'}
            </button>
          </div>
        </div>
      </section>

      {/* ---------- 2. Situation = filtres rapides ---------- */}
      <section
        aria-label="Situation et filtres rapides"
        className="jr-entree flex flex-wrap items-center gap-2"
        style={{ animationDelay: '60ms' }}
      >
        <SegmentFiltre
          actif={aucunFiltreActif}
          onClick={() => {
            setFiltreType('');
            setFiltreStatut('');
          }}
          compte={loading ? '…' : compte.total}
        >
          Tous
        </SegmentFiltre>

        <span
          aria-hidden="true"
          className="mx-1 hidden h-6 w-px bg-jr-bordure sm:block"
        />

        <SegmentFiltre
          actif={filtreType === 'EAU'}
          onClick={() => basculerType('EAU')}
          compte={loading ? '…' : compte.eau}
        >
          <Droplets size={16} aria-hidden="true" />
          Eau
        </SegmentFiltre>

        <SegmentFiltre
          actif={filtreType === 'ELECTRICITE'}
          onClick={() => basculerType('ELECTRICITE')}
          compte={loading ? '…' : compte.elec}
        >
          <Zap size={16} aria-hidden="true" />
          Électricité
        </SegmentFiltre>

        <span
          aria-hidden="true"
          className="mx-1 hidden h-6 w-px bg-jr-bordure sm:block"
        />

        <SegmentFiltre
          actif={filtreStatut === 'ACTIF'}
          onClick={() => basculerStatut('ACTIF')}
          compte={loading ? '…' : compte.actifs}
        >
          Actifs
        </SegmentFiltre>

        <SegmentFiltre
          actif={filtreStatut === 'INACTIF'}
          onClick={() => basculerStatut('INACTIF')}
          compte={loading ? '…' : compte.inactifs}
        >
          Inactifs
        </SegmentFiltre>

        {compte.aVerifier > 0 && (
          <SegmentFiltre
            actif={filtreStatut === 'A_VERIFIER'}
            onClick={() => basculerStatut('A_VERIFIER')}
            compte={compte.aVerifier}
          >
            À vérifier
          </SegmentFiltre>
        )}

        {/* Choix de la vue : visible quand le tableau est possible */}
        <div
          role="group"
          aria-label="Mode d’affichage"
          className="ml-auto hidden overflow-hidden rounded-md border border-jr-bordure xl:flex"
        >
          {[
            ['tableau', 'Tableau', LayoutList],
            ['cartes', 'Cartes', LayoutGrid],
          ].map(([valeur, libelle, Icone]) => (
            <button
              key={valeur}
              type="button"
              aria-pressed={vue === valeur}
              onClick={() => changerVue(valeur)}
              className={`inline-flex min-h-[44px] items-center gap-2 px-3 text-sm font-semibold transition-colors motion-reduce:transition-none ${FOCUS} ${
                vue === valeur
                  ? 'bg-jr-eau text-white'
                  : 'bg-jr-surface text-jr-doux hover:bg-jr-eau-pale'
              }`}
            >
              <Icone size={16} aria-hidden="true" />
              {libelle}
            </button>
          ))}
        </div>
      </section>

      {/* ---------- 3. Résultats ---------- */}
      <section
        className="jr-entree jr-verre-fort overflow-hidden rounded-lg border border-jr-bordure shadow-sm"
        style={{ animationDelay: '120ms' }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-jr-bordure px-4 py-3 sm:px-5">
          <p
            aria-live="polite"
            className="text-sm font-semibold text-jr-texte"
          >
            {loading
              ? 'Chargement…'
              : filtresActifs
                ? `${lignes.length} résultat${
                    lignes.length > 1 ? 's' : ''
                  } sur ${compte.total} compteur${
                    compte.total > 1 ? 's' : ''
                  }`
                : `${compte.total} compteur${compte.total > 1 ? 's' : ''}`}
          </p>

          {filtresActifs && !loading && (
            <button
              type="button"
              onClick={reinitialiser}
              className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-md px-2 text-sm font-semibold text-jr-lien transition-colors hover:bg-jr-eau-pale motion-reduce:transition-none ${FOCUS}`}
            >
              <X size={15} aria-hidden="true" />
              Réinitialiser les filtres
            </button>
          )}
        </div>

        {loading ? (
          <div aria-busy="true" className="space-y-3 p-4 sm:p-5">
            {[0, 1, 2, 3, 4, 5].map((n) => (
              <div key={n} className="flex items-center gap-4">
                <Squelette className="h-10 w-10 shrink-0" />
                <div className="flex-1 space-y-2">
                  <Squelette className="h-4 w-1/3" />
                  <Squelette className="h-3 w-2/3" />
                </div>
                <Squelette className="hidden h-9 w-24 sm:block" />
              </div>
            ))}
          </div>
        ) : echec && compteurs.length === 0 ? (
          <EtatVide
            icone={TriangleAlert}
            titre="Liste des compteurs indisponible"
            message="Le serveur n’a pas répondu. Vos données n’ont pas été modifiées."
          >
            <button
              type="button"
              onClick={() => charger(true)}
              className={`mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-md border border-jr-bordure px-4 text-sm font-semibold text-jr-lien transition-colors hover:bg-jr-eau-pale motion-reduce:transition-none ${FOCUS}`}
            >
              <RefreshCw size={16} aria-hidden="true" />
              Réessayer
            </button>
          </EtatVide>
        ) : compteurs.length === 0 ? (
          <EtatVide
            icone={ClipboardList}
            titre="Aucun compteur dans la liste pour le moment"
            message="Les compteurs rattachés à des abonnés apparaîtront ici. Actualisez la liste si des compteurs viennent d’être ajoutés."
          />
        ) : lignes.length === 0 ? (
          <EtatVide
            icone={Search}
            titre="Aucun compteur ne correspond à ces critères"
            message="Vérifiez l’orthographe ou élargissez la recherche : numéro de compteur, nom de l’abonné ou adresse."
          >
            <button
              type="button"
              onClick={reinitialiser}
              className={`mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-md border border-jr-bordure px-4 text-sm font-semibold text-jr-lien transition-colors hover:bg-jr-eau-pale motion-reduce:transition-none ${FOCUS}`}
            >
              <X size={16} aria-hidden="true" />
              Effacer la recherche et les filtres
            </button>
          </EtatVide>
        ) : (
          <>
            {/* Tableau : grands écrans */}
            {vue === 'tableau' && (
              <div className="hidden overflow-x-auto xl:block">
                <table className="w-full text-left">
                  <caption className="sr-only">
                    Liste des compteurs avec abonné, installation,
                    dernier relevé et statut
                  </caption>

                  <thead className="jr-thead">
                    <tr>
                      <th scope="col" className="px-5 py-3">
                        Compteur
                      </th>
                      <th scope="col" className="px-5 py-3">
                        Abonné
                      </th>
                      <th scope="col" className="px-5 py-3">
                        Installation
                      </th>
                      <th scope="col" className="px-5 py-3">
                        Dernier relevé
                      </th>
                      <th scope="col" className="px-5 py-3">
                        Statut
                      </th>
                      <th
                        scope="col"
                        className="px-5 py-3 text-right"
                      >
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {lignes.map((item) => (
                      <tr
                        key={item.id}
                        className="border-t border-jr-bordure transition-colors hover:bg-jr-eau-pale focus-within:bg-jr-eau-pale motion-reduce:transition-none"
                      >
                        <td
                          className={`border-l-4 px-5 py-3 ${
                            estEau(item)
                              ? 'border-l-jr-eau-clair'
                              : 'border-l-jr-elec'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => setSelectionId(item.id)}
                            aria-label={`Détail du compteur ${
                              item.numero_compteur || ''
                            }`}
                            className={`flex items-center gap-3 rounded-md text-left ${FOCUS}`}
                          >
                            <IconeType item={item} />
                            <span>
                              <span className="block text-base font-bold text-jr-texte">
                                {item.numero_compteur || '—'}
                              </span>
                              <span className="block text-xs text-jr-doux">
                                {estEau(item)
                                  ? 'Eau · m³'
                                  : 'Électricité · kWh'}
                              </span>
                            </span>
                          </button>
                        </td>

                        <td className="max-w-[16rem] px-5 py-3">
                          <p className="truncate text-sm font-semibold text-jr-texte">
                            {nomAbonne(item)}
                          </p>
                          <p className="text-xs text-jr-doux">
                            {item.numero_abonne || '—'}
                          </p>
                          <p
                            title={item.abonne_adresse || undefined}
                            className="truncate text-xs text-jr-faible"
                          >
                            {item.abonne_adresse ||
                              'Adresse non renseignée'}
                          </p>
                        </td>

                        <td className="px-5 py-3 text-sm text-jr-doux">
                          {formatDate(item.date_installation)}
                        </td>

                        <td className="px-5 py-3">
                          <DernierReleve item={item} />
                        </td>

                        <td className="px-5 py-3">
                          <BadgeStatut value={item.statut} />
                        </td>

                        <td className="px-5 py-3 text-right">
                          <BoutonReleve
                            item={item}
                            onClick={() => allerReleve(item)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Cartes : mobile, tablette, et choix « Cartes » */}
            <ul
              className={`grid gap-3 p-4 sm:grid-cols-2 sm:p-5 ${
                vue === 'tableau' ? 'xl:hidden' : 'xl:grid-cols-3'
              }`}
            >
              {lignes.map((item) => (
                <li
                  key={item.id}
                  className={`flex flex-col rounded-lg border border-l-4 border-jr-bordure bg-jr-surface p-4 ${
                    estEau(item)
                      ? 'border-l-jr-eau-clair'
                      : 'border-l-jr-elec'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectionId(item.id)}
                      aria-label={`Détail du compteur ${
                        item.numero_compteur || ''
                      }`}
                      className={`flex min-w-0 items-center gap-3 rounded-md text-left ${FOCUS}`}
                    >
                      <IconeType item={item} />
                      <span className="min-w-0">
                        <span className="block truncate text-base font-bold text-jr-texte">
                          {item.numero_compteur || '—'}
                        </span>
                        <span className="block text-xs text-jr-doux">
                          {estEau(item)
                            ? 'Eau · m³'
                            : 'Électricité · kWh'}
                        </span>
                      </span>
                    </button>

                    <BadgeStatut value={item.statut} />
                  </div>

                  <div className="mt-3 flex items-start gap-2">
                    <UserRound
                      size={16}
                      aria-hidden="true"
                      className="mt-0.5 shrink-0 text-jr-faible"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-jr-texte">
                        {nomAbonne(item)}
                      </p>
                      <p className="text-xs text-jr-doux">
                        {item.numero_abonne || '—'}
                      </p>
                      <p
                        title={item.abonne_adresse || undefined}
                        className="truncate text-xs text-jr-faible"
                      >
                        {item.abonne_adresse || 'Adresse non renseignée'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 border-t border-jr-bordure pt-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-jr-faible">
                      Dernier relevé
                    </p>
                    <div className="mt-1">
                      <DernierReleve item={item} />
                    </div>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <div className="flex-1">
                      <BoutonReleve
                        item={item}
                        pleineLargeur
                        onClick={() => allerReleve(item)}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectionId(item.id)}
                      aria-label={`Voir le détail du compteur ${
                        item.numero_compteur || ''
                      }`}
                      className={`flex min-h-[44px] w-11 items-center justify-center rounded-md border border-jr-bordure text-jr-lien transition-colors hover:bg-jr-eau-pale motion-reduce:transition-none ${FOCUS}`}
                    >
                      <ChevronRight size={18} aria-hidden="true" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* ---------- 4. Détail du compteur ---------- */}
      {selection && (
        <PanneauDetail
          item={selection}
          onClose={fermerDetail}
          onReleve={() => allerReleve(selection)}
        />
      )}
    </div>
  );
}

/* =========================================================
   PAGE : AgentLayout englobe le contenu pour que useToast
   fonctionne (fond « calme » : page de liste et de recherche).
========================================================= */

function AgentCompteursPage() {
  return (
    <AgentLayout title="Compteurs" intensite="calme">
      <Contenu />
    </AgentLayout>
  );
}

export default AgentCompteursPage;
