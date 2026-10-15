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
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Copy,
  Gauge,
  Info,
  LayoutGrid,
  LayoutList,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  TriangleAlert,
  Users,
  X,
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

const CLE_VUE = 'jirama-agent-abonnes-vue';

const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jr-elec';

function formatDate(value) {
  if (!value) {
    return '—';
  }

  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);

  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString('fr-FR');
}

function nomComplet(item) {
  return (
    `${item?.prenom || ''} ${item?.nom || ''}`.trim() || '—'
  );
}

function initiales(item) {
  const valeur = `${String(item?.prenom || '').trim().charAt(0)}${String(
    item?.nom || ''
  )
    .trim()
    .charAt(0)}`.toUpperCase();

  return valeur || '—';
}

/*
  Nombre de compteurs : un nombre (0 compris, c'est une valeur réelle)
  ou null si le champ est absent. Jamais de valeur inventée.
*/
function nombreCompteurs(item) {
  const brut = item?.nombre_compteurs;

  if (brut === null || brut === undefined || brut === '') {
    return null;
  }

  const nombre = Number(brut);

  return Number.isFinite(nombre) ? nombre : null;
}

function statutDe(item) {
  return String(item?.statut || '').trim().toUpperCase();
}

function lienTelephone(telephone) {
  return `tel:${String(telephone).replace(/[^\d+]/g, '')}`;
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

async function copierTexte(texte) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(texte);
      return true;
    }
  } catch {
    /* on essaie la méthode de secours */
  }

  try {
    const zone = document.createElement('textarea');

    zone.value = texte;
    zone.setAttribute('readonly', '');
    zone.style.position = 'fixed';
    zone.style.opacity = '0';
    document.body.appendChild(zone);
    zone.select();

    const ok = document.execCommand('copy');

    document.body.removeChild(zone);

    return ok;
  } catch {
    return false;
  }
}

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

function Avatar({ item }) {
  return (
    <span
      aria-hidden="true"
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-jr-eau-pale text-sm font-bold text-jr-lien"
    >
      {initiales(item)}
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
  }[code];

  // autre statut du backend : affiché tel quel ; champ absent : « Non renseigné »
  const courant = config || {
    Icone: Info,
    libelle: code ? code.replace(/_/g, ' ').toLowerCase() : 'Non renseigné',
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
      <Icone size={30} aria-hidden="true" className="text-jr-faible" />
      <p className="mt-3 text-base font-semibold text-jr-texte">{titre}</p>
      <p className="mt-1 max-w-md text-sm text-jr-doux">{message}</p>
      {children}
    </div>
  );
}

/* Téléphone : lien d'appel + bouton de copie (rien si non renseigné) */
function Telephone({ item, onCopier, taille = 'compact' }) {
  if (!item.telephone) {
    return <span className="text-sm text-jr-faible">Non renseigné</span>;
  }

  const haut = taille === 'large' ? 'min-h-[44px]' : 'min-h-[36px]';

  return (
    <span className="inline-flex items-center gap-1">
      <a
        href={lienTelephone(item.telephone)}
        aria-label={`Appeler ${nomComplet(item)} au ${item.telephone}`}
        className={`inline-flex ${haut} items-center gap-1.5 rounded-md px-1.5 text-sm font-semibold text-jr-lien transition-colors hover:bg-jr-eau-pale motion-reduce:transition-none ${FOCUS}`}
      >
        <Phone size={15} aria-hidden="true" />
        {item.telephone}
      </a>

      <button
        type="button"
        onClick={() => onCopier(item)}
        aria-label={`Copier le numéro de ${nomComplet(item)}`}
        title="Copier le numéro"
        className={`flex ${haut} ${
          taille === 'large' ? 'w-11' : 'w-9'
        } items-center justify-center rounded-md text-jr-faible transition-colors hover:bg-jr-eau-pale hover:text-jr-lien motion-reduce:transition-none ${FOCUS}`}
      >
        <Copy size={15} aria-hidden="true" />
      </button>
    </span>
  );
}

function Compteurs({ item }) {
  const nombre = nombreCompteurs(item);

  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <Gauge size={16} aria-hidden="true" className="text-jr-faible" />
      {nombre === null ? (
        <span className="text-jr-faible">Non communiqué</span>
      ) : (
        <span className="font-bold text-jr-texte">
          {nombre}{' '}
          <span className="font-medium text-jr-doux">
            compteur{nombre > 1 ? 's' : ''}
          </span>
        </span>
      )}
    </span>
  );
}

function DernierReleve({ item }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <CalendarDays
        size={16}
        aria-hidden="true"
        className="text-jr-faible"
      />
      {item.dernier_releve ? (
        <span className="font-semibold text-jr-texte">
          {formatDate(item.dernier_releve)}
        </span>
      ) : (
        <span className="text-jr-faible">Aucun relevé</span>
      )}
    </span>
  );
}

/* =========================================================
   PANNEAU DE DÉTAIL (données déjà chargées uniquement)
========================================================= */

function PanneauDetail({ item, onClose, onCopier }) {
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

  const nombre = nombreCompteurs(item);

  return (
    <>
      <button
        type="button"
        tabIndex={-1}
        aria-label="Fermer le détail de l’abonné"
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
        aria-labelledby="titre-detail-abonne"
        className="jr-toast jr-verre-fort fixed inset-y-0 right-0 z-[100] flex w-full flex-col border-l border-jr-bordure shadow-xl sm:max-w-md"
      >
        {/* Identité */}
        <div className="flex items-start gap-3 border-b border-jr-bordure p-5">
          <Avatar item={item} />

          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-jr-lien">
              Abonné {item.numero_abonne || ''}
            </p>
            <h2
              id="titre-detail-abonne"
              className="break-words text-xl font-bold text-jr-titre"
            >
              {nomComplet(item)}
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
          {/* Contact */}
          <section aria-labelledby="titre-contact-abonne">
            <h3
              id="titre-contact-abonne"
              className="text-sm font-bold text-jr-titre"
            >
              Contact
            </h3>

            <dl className="mt-3 space-y-4 text-sm">
              <div>
                <dt className="flex items-center gap-1.5 text-jr-faible">
                  <Phone size={14} aria-hidden="true" />
                  Téléphone
                </dt>
                <dd className="mt-1">
                  <Telephone
                    item={item}
                    onCopier={onCopier}
                    taille="large"
                  />
                </dd>
              </div>

              <div>
                <dt className="flex items-center gap-1.5 text-jr-faible">
                  <MapPin size={14} aria-hidden="true" />
                  Adresse
                </dt>
                <dd className="mt-1 break-words font-semibold text-jr-texte">
                  {item.adresse || 'Adresse non renseignée'}
                </dd>
              </div>
            </dl>
          </section>

          {/* Suivi */}
          <section
            aria-labelledby="titre-suivi-abonne"
            className="border-t border-jr-bordure pt-5"
          >
            <h3
              id="titre-suivi-abonne"
              className="text-sm font-bold text-jr-titre"
            >
              Suivi
            </h3>

            <dl className="mt-3 grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-jr-faible">Compteurs associés</dt>
                <dd className="mt-1 text-2xl font-extrabold text-jr-texte">
                  {nombre === null ? '—' : nombre}
                </dd>
              </div>

              <div>
                <dt className="text-jr-faible">Dernier relevé</dt>
                <dd className="mt-1 font-bold text-jr-texte">
                  {item.dernier_releve
                    ? formatDate(item.dernier_releve)
                    : 'Aucun relevé'}
                </dd>
              </div>
            </dl>
          </section>
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

  const [abonnes, setAbonnes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [echec, setEchec] = useState(false);
  const [derniereMaj, setDerniereMaj] = useState(null);

  const [recherche, setRecherche] = useState('');
  const [filtreStatut, setFiltreStatut] = useState('');
  const [filtreCompteurs, setFiltreCompteurs] = useState('');
  const [vue, setVue] = useState(lireVue);
  const [selectionId, setSelectionId] = useState(null);

  const controleur = useRef(null);
  const champRecherche = useRef(null);

  /* ---------- Chargement (GET /agent/abonnes) ---------- */

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

        const response = await axiosClient.get('/agent/abonnes', {
          signal: controle.signal,
        });

        if (response.data?.status !== 'success') {
          throw new Error(
            response.data?.message ||
              'Impossible de charger les abonnés.'
          );
        }

        const liste = response.data?.data || [];

        setAbonnes(liste);
        setEchec(false);
        setDerniereMaj(new Date());

        if (manuel) {
          notify({
            cle: 'abonnes-actualises',
            genre: 'succes',
            titre: 'Liste des abonnés actualisée',
            message: `${liste.length} abonné${
              liste.length > 1 ? 's' : ''
            } chargé${liste.length > 1 ? 's' : ''}.`,
          });
        }
      } catch (requestError) {
        if (estAnnulation(requestError)) {
          return;
        }

        console.error('Erreur abonnés Agent :', requestError);

        if (traiterErreurSession(requestError, notify, navigate)) {
          return;
        }

        setEchec(true);

        notify({
          cle: 'abonnes-erreur',
          genre: 'erreur',
          titre: 'Abonnés non chargés',
          message:
            requestError.response?.data?.message ||
            'La liste des abonnés n’a pas pu être récupérée. Vérifiez la connexion, puis réessayez.',
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
      abonnes.map((item) => ({
        item,
        texte: normaliser(
          [
            item.numero_abonne,
            item.nom,
            item.prenom,
            item.telephone,
            item.adresse,
          ]
            .filter(Boolean)
            .join(' ')
        ),
      })),
    [abonnes]
  );

  const compte = useMemo(() => {
    const resultat = {
      total: abonnes.length,
      actifs: 0,
      inactifs: 0,
      avec: 0,
      sans: 0,
    };

    abonnes.forEach((item) => {
      const statut = statutDe(item);

      if (statut === 'ACTIF') {
        resultat.actifs += 1;
      } else if (statut === 'INACTIF') {
        resultat.inactifs += 1;
      }

      const nombre = nombreCompteurs(item);

      if (nombre !== null) {
        if (nombre > 0) {
          resultat.avec += 1;
        } else {
          resultat.sans += 1;
        }
      }
    });

    return resultat;
  }, [abonnes]);

  const lignes = useMemo(() => {
    const mots = normaliser(recherche).split(' ').filter(Boolean);

    return indexRecherche
      .filter(({ item, texte }) => {
        if (filtreStatut && statutDe(item) !== filtreStatut) {
          return false;
        }

        if (filtreCompteurs) {
          const nombre = nombreCompteurs(item);

          if (nombre === null) {
            return false;
          }

          if (filtreCompteurs === 'AVEC' && nombre <= 0) {
            return false;
          }

          if (filtreCompteurs === 'SANS' && nombre !== 0) {
            return false;
          }
        }

        return mots.every((mot) => texte.includes(mot));
      })
      .map(({ item }) => item);
  }, [indexRecherche, recherche, filtreStatut, filtreCompteurs]);

  const filtresActifs =
    Boolean(recherche.trim()) ||
    Boolean(filtreStatut) ||
    Boolean(filtreCompteurs);

  const aucunFiltreDeGroupe = !filtreStatut && !filtreCompteurs;

  function reinitialiser() {
    setRecherche('');
    setFiltreStatut('');
    setFiltreCompteurs('');
  }

  function basculerStatut(valeur) {
    setFiltreStatut((actuel) => (actuel === valeur ? '' : valeur));
  }

  function basculerCompteurs(valeur) {
    setFiltreCompteurs((actuel) => (actuel === valeur ? '' : valeur));
  }

  function changerVue(valeur) {
    setVue(valeur);
    enregistrerVue(valeur);
  }

  const copier = useCallback(
    async (item) => {
      const reussi = await copierTexte(String(item.telephone || ''));

      if (reussi) {
        notify({
          cle: 'telephone-copie',
          genre: 'succes',
          titre: 'Numéro copié',
          message: `${item.telephone} · ${nomComplet(item)}`,
        });
      } else {
        notify({
          cle: 'telephone-copie',
          genre: 'erreur',
          titre: 'Copie impossible',
          message: `Le navigateur a refusé la copie. Numéro : ${item.telephone}`,
        });
      }
    },
    [notify]
  );

  const selection = useMemo(
    () => abonnes.find((item) => item.id === selectionId) || null,
    [abonnes, selectionId]
  );

  const fermerDetail = useCallback(() => setSelectionId(null), []);

  const texteMaj = derniereMaj
    ? `mis à jour à ${derniereMaj.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
      })}`
    : '';

  /* ---------- Rendu ---------- */

  return (
    <div className="space-y-5">
      {/* ---------- 1. En-tête compact + recherche ---------- */}
      <section className="jr-entree jr-verre-fort rounded-lg border border-jr-bordure p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-lg font-bold text-jr-titre">
              <Users size={20} aria-hidden="true" className="text-jr-lien" />
              Abonnés
            </h2>
            <p className="mt-1 text-sm text-jr-doux">
              Consultation des abonnés et de leurs informations de suivi
            </p>
            <p
              role="status"
              aria-live="polite"
              className={`mt-1 text-xs ${
                echec ? 'text-jr-err' : 'text-jr-faible'
              }`}
            >
              {loading
                ? 'Chargement des abonnés…'
                : echec
                  ? 'Connexion impossible : la liste peut ne pas être à jour'
                  : `${compte.total} abonné${
                      compte.total > 1 ? 's' : ''
                    } chargé${compte.total > 1 ? 's' : ''}${
                      texteMaj ? ` · ${texteMaj}` : ''
                    }`}
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 sm:flex-row lg:max-w-2xl">
            <div className="relative flex-1">
              <label htmlFor="recherche-abonne" className="sr-only">
                Rechercher un abonné
              </label>

              <Search
                size={18}
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-jr-faible"
              />

              <input
                id="recherche-abonne"
                ref={champRecherche}
                type="search"
                value={recherche}
                onChange={(event) => setRecherche(event.target.value)}
                placeholder="Nom, n° d’abonné, téléphone, adresse…"
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
          actif={aucunFiltreDeGroupe}
          onClick={() => {
            setFiltreStatut('');
            setFiltreCompteurs('');
          }}
          compte={loading ? '…' : compte.total}
        >
          Tous les abonnés
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

        <span
          aria-hidden="true"
          className="mx-1 hidden h-6 w-px bg-jr-bordure sm:block"
        />

        <SegmentFiltre
          actif={filtreCompteurs === 'AVEC'}
          onClick={() => basculerCompteurs('AVEC')}
          compte={loading ? '…' : compte.avec}
        >
          <Gauge size={16} aria-hidden="true" />
          Avec compteur
        </SegmentFiltre>

        <SegmentFiltre
          actif={filtreCompteurs === 'SANS'}
          onClick={() => basculerCompteurs('SANS')}
          compte={loading ? '…' : compte.sans}
        >
          Sans compteur
        </SegmentFiltre>

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
                  } sur ${compte.total} abonné${
                    compte.total > 1 ? 's' : ''
                  }`
                : `${compte.total} abonné${compte.total > 1 ? 's' : ''}`}
          </p>

          {filtresActifs && !loading && (
            <button
              type="button"
              onClick={reinitialiser}
              className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-md px-2 text-sm font-semibold text-jr-lien transition-colors hover:bg-jr-eau-pale motion-reduce:transition-none ${FOCUS}`}
            >
              <X size={15} aria-hidden="true" />
              Réinitialiser
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
        ) : echec && abonnes.length === 0 ? (
          <EtatVide
            icone={TriangleAlert}
            titre="Liste des abonnés indisponible"
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
        ) : abonnes.length === 0 ? (
          <EtatVide
            icone={Users}
            titre="Aucun abonné dans la liste actuelle"
            message="Les abonnés enregistrés apparaîtront ici. Actualisez la liste si des abonnés viennent d’être ajoutés."
          />
        ) : lignes.length === 0 ? (
          <EtatVide
            icone={Search}
            titre="Aucun abonné ne correspond à ces critères"
            message="Vérifiez l’orthographe ou élargissez la recherche : nom, numéro d’abonné, téléphone ou adresse."
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
                    Liste des abonnés avec contact, adresse, compteurs,
                    dernier relevé et statut
                  </caption>

                  <thead className="jr-thead">
                    <tr>
                      <th scope="col" className="px-5 py-3">
                        Abonné
                      </th>
                      <th scope="col" className="px-5 py-3">
                        Contact
                      </th>
                      <th scope="col" className="px-5 py-3">
                        Adresse
                      </th>
                      <th scope="col" className="px-5 py-3">
                        Compteurs
                      </th>
                      <th scope="col" className="px-5 py-3">
                        Dernier relevé
                      </th>
                      <th scope="col" className="px-5 py-3">
                        Statut
                      </th>
                      <th scope="col" className="px-3 py-3">
                        <span className="sr-only">Détail</span>
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {lignes.map((item) => (
                      <tr
                        key={item.id}
                        className="border-t border-jr-bordure transition-colors hover:bg-jr-eau-pale focus-within:bg-jr-eau-pale motion-reduce:transition-none"
                      >
                        <td className="max-w-[16rem] px-5 py-3">
                          <button
                            type="button"
                            onClick={() => setSelectionId(item.id)}
                            aria-label={`Détail de l’abonné ${nomComplet(item)}`}
                            className={`flex w-full min-w-0 items-center gap-3 rounded-md text-left ${FOCUS}`}
                          >
                            <Avatar item={item} />
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-bold text-jr-texte">
                                {nomComplet(item)}
                              </span>
                              <span className="block truncate text-xs text-jr-doux">
                                {item.numero_abonne || '—'}
                              </span>
                            </span>
                          </button>
                        </td>

                        <td className="px-5 py-3">
                          <Telephone item={item} onCopier={copier} />
                        </td>

                        <td className="max-w-[16rem] px-5 py-3">
                          <p
                            title={item.adresse || undefined}
                            className="truncate text-sm text-jr-doux"
                          >
                            {item.adresse || 'Adresse non renseignée'}
                          </p>
                        </td>

                        <td className="px-5 py-3">
                          <Compteurs item={item} />
                        </td>

                        <td className="px-5 py-3">
                          <DernierReleve item={item} />
                        </td>

                        <td className="px-5 py-3">
                          <BadgeStatut value={item.statut} />
                        </td>

                        <td className="px-3 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectionId(item.id)}
                            aria-label={`Voir le détail de ${nomComplet(item)}`}
                            className={`flex h-11 w-11 items-center justify-center rounded-md text-jr-lien transition-colors hover:bg-jr-surface motion-reduce:transition-none ${FOCUS}`}
                          >
                            <ChevronRight size={18} aria-hidden="true" />
                          </button>
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
                  className="flex flex-col rounded-lg border border-jr-bordure bg-jr-surface p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectionId(item.id)}
                      aria-label={`Détail de l’abonné ${nomComplet(item)}`}
                      className={`flex min-w-0 items-center gap-3 rounded-md text-left ${FOCUS}`}
                    >
                      <Avatar item={item} />
                      <span className="min-w-0">
                        <span className="block truncate text-base font-bold text-jr-texte">
                          {nomComplet(item)}
                        </span>
                        <span className="block truncate text-xs text-jr-doux">
                          {item.numero_abonne || '—'}
                        </span>
                      </span>
                    </button>

                    <BadgeStatut value={item.statut} />
                  </div>

                  <div className="mt-3 space-y-1.5">
                    <Telephone
                      item={item}
                      onCopier={copier}
                      taille="large"
                    />

                    <p className="flex items-start gap-2 text-sm text-jr-doux">
                      <MapPin
                        size={15}
                        aria-hidden="true"
                        className="mt-0.5 shrink-0 text-jr-faible"
                      />
                      <span className="min-w-0 break-words">
                        {item.adresse || 'Adresse non renseignée'}
                      </span>
                    </p>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-jr-bordure pt-3">
                    <Compteurs item={item} />
                    <DernierReleve item={item} />
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectionId(item.id)}
                    className={`mt-3 inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-md border border-jr-bordure px-3 text-sm font-semibold text-jr-lien transition-colors hover:bg-jr-eau-pale motion-reduce:transition-none ${FOCUS}`}
                  >
                    Voir le détail
                    <ChevronRight size={16} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* ---------- 4. Détail de l'abonné ---------- */}
      {selection && (
        <PanneauDetail
          item={selection}
          onClose={fermerDetail}
          onCopier={copier}
        />
      )}
    </div>
  );
}


function AgentAbonnesPage() {
  return (
    <AgentLayout title="Abonnés" intensite="calme">
      <Contenu />
    </AgentLayout>
  );
}

export default AgentAbonnesPage;
