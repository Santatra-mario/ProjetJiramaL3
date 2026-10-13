import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  ClipboardList,
  Droplets,
  Gauge,
  RefreshCw,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { useNavigate } from 'react-router-dom';

import axiosClient from '../../api/axiosClient';
import ResponsableLayout from '../../components/admin/responsable/ResponsableLayout.jsx';
import { traiterErreurSession } from '../../components/admin/responsable/sessionResponsable.js';
import { useToast } from '../../components/ui/ToastProvider.jsx';
import { COULEURS } from '../../theme/couleurs.js';

/* =========================================================
   CONSTANTES
========================================================= */

const INTERVALLE_AUTO = 60000; // actualisation automatique : 60 s
const ECHECS_MAX = 3; // échecs consécutifs avant suspension

const STYLE_INFOBULLE = {
  contentStyle: {
    background: COULEURS.surface,
    border: `1px solid ${COULEURS.bordure}`,
    borderRadius: 8,
    color: COULEURS.texte,
  },
  labelStyle: { color: COULEURS.titre, fontWeight: 600 },
  itemStyle: { color: COULEURS.texte },
};

const STYLE_AXE = { fontSize: 11, fill: COULEURS.texteFaible };

/* =========================================================
   FONCTIONS UTILITAIRES (défensives)
========================================================= */

function number(value, digits = 0) {
  if (value === null || value === undefined || value === '') {
    return '—';
  }

  const n = Number(value);

  if (!Number.isFinite(n)) {
    return '—';
  }

  return n.toLocaleString('fr-FR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatDate(value) {
  if (!value) {
    return '—';
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString('fr-FR');
}

function heureCourte(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function tableau(valeur) {
  return Array.isArray(valeur) ? valeur : [];
}

function normaliserDonnees(donnees) {
  return {
    stats:
      donnees?.stats && typeof donnees.stats === 'object'
        ? donnees.stats
        : {},
    evolution: tableau(donnees?.evolution),
    anomaliesParNiveau: tableau(donnees?.anomaliesParNiveau),
    anomaliesRecentes: tableau(donnees?.anomaliesRecentes),
    notificationsRecentes: tableau(donnees?.notificationsRecentes),
    user:
      donnees?.user && typeof donnees.user === 'object'
        ? donnees.user
        : {},
  };
}

function compterCritiques(donnees) {
  const ligne = donnees.anomaliesParNiveau.find(
    (item) => item?.niveau === 'CRITIQUE'
  );

  const total = Number(ligne?.total || 0);

  return Number.isFinite(total) ? total : 0;
}

const DONNEES_VIDES = normaliserDonnees({});

/* =========================================================
   STYLES PAR NIVEAU / TON (variables du thème uniquement)
========================================================= */

const NIVEAUX = {
  CRITIQUE:
    'border-jr-err-bordure bg-jr-err-pale text-jr-err',
  SUSPECTE:
    'border-[var(--jr-elec)] bg-jr-elec-pale text-jr-attention',
  ATTENTION:
    'border-[var(--jr-elec-anneau)] bg-jr-elec-pale text-jr-attention',
};

function niveauClass(niveau) {
  return (
    NIVEAUX[niveau] || 'border-jr-bordure bg-jr-champ text-jr-doux'
  );
}

// bleu = eau, orange = électricité, rouge = alerte, vert = succès
const TONS = {
  bleu: {
    surface: 'jr-verre border border-jr-bordure',
    icone: 'bg-jr-eau-pale text-jr-lien',
    accent: 'bg-jr-eau',
  },
  eau: {
    surface: 'jr-carte-eau',
    icone: 'bg-jr-eau-pale text-jr-lien',
    accent: 'bg-jr-eau-clair',
  },
  elec: {
    surface: 'jr-carte-elec',
    icone: 'bg-jr-elec-pale text-jr-attention',
    accent: 'bg-jr-elec',
  },
  err: {
    surface: 'jr-verre border border-jr-bordure',
    icone: 'bg-jr-err-pale text-jr-err',
    accent: 'bg-jr-err',
  },
  ok: {
    surface: 'jr-verre border border-jr-bordure',
    icone: 'bg-jr-ok-pale text-jr-ok',
    accent: 'bg-jr-ok',
  },
  neutre: {
    surface: 'jr-verre border border-jr-bordure',
    icone: 'bg-jr-champ text-jr-doux',
    accent: 'bg-jr-bordure-forte',
  },
};

/* =========================================================
   PETITS COMPOSANTS
========================================================= */

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  tone = 'bleu',
  onClick,
  index = 0,
}) {
  const ton = TONS[tone] || TONS.bleu;
  const Component = onClick ? 'button' : 'div';

  return (
    <Component
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      style={{ animationDelay: `${index * 70}ms` }}
      className={`jr-entree group relative w-full overflow-hidden rounded-lg p-5 text-left shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jr-elec motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${ton.surface}`}
    >
      <div
        aria-hidden="true"
        className={`absolute inset-x-0 bottom-0 h-1 opacity-80 ${ton.accent}`}
      />

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-jr-faible">
            {title}
          </p>
          <p className="mt-3 truncate text-2xl font-semibold tracking-tight text-jr-titre sm:text-[27px]">
            {value}
          </p>
          <p className="mt-1.5 text-xs text-jr-faible">{subtitle}</p>
        </div>

        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${ton.icone}`}
        >
          <Icon size={21} strokeWidth={2.4} aria-hidden="true" />
        </div>
      </div>
    </Component>
  );
}

function DashboardSkeleton() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="space-y-6"
    >
      <span className="sr-only">Chargement du tableau de bord…</span>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={index}
            className="jr-shimmer h-36 rounded-lg"
          />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        <div className="jr-shimmer h-96 rounded-lg" />
        <div className="jr-shimmer h-96 rounded-lg" />
      </div>
    </div>
  );
}

function MessageVide({ children }) {
  return (
    <div className="flex h-full min-h-[200px] items-center justify-center rounded-lg border border-dashed border-jr-bordure p-6 text-center text-sm text-jr-faible">
      {children}
    </div>
  );
}

/* =========================================================
   GRAPHIQUE « ANOMALIES PAR NIVEAU »
   Barres horizontales, de la plus grave à la moins grave.
   Couleurs : variables du thème uniquement (via COULEURS).

   Teintes retenues, contraste sur la carte (clair / sombre) :
     CRITIQUE  = --jr-attention  (4,9 / 8,5)
     SUSPECTE  = --jr-elec-fonce (3,0 / 5,0)
     ATTENTION = --jr-eau-clair  (3,6 / 4,2)
   --jr-elec est écartée : 2,4:1 sur fond clair et trop proche de
   --jr-elec-fonce (écart de teinte 10 contre 19 avec --jr-attention).
========================================================= */

const NIVEAUX_GRAPHIQUE = [
  { niveau: 'CRITIQUE', couleur: COULEURS.attention },
  { niveau: 'SUSPECTE', couleur: COULEURS.elecFonce },
  { niveau: 'ATTENTION', couleur: COULEURS.eauClair },
];

const DUREE_BARRES = 600; // ms, premier affichage seulement
const PLACE_VALEUR = '6rem'; // largeur réservée au « 3 · 38 % »

// Seuls les nombres finis positifs comptent ; absent, null, chaîne : 0.
function compterAnomalies(valeur) {
  return typeof valeur === 'number' && Number.isFinite(valeur) && valeur > 0
    ? Math.round(valeur)
    : 0;
}

// Pourcentages entiers dont la somme fait exactement 100
// (méthode du plus fort reste). Total nul : tout à 0, sans division.
function repartirPourcentages(valeurs) {
  const total = valeurs.reduce((somme, v) => somme + v, 0);

  if (total === 0) {
    return valeurs.map(() => 0);
  }

  const exacts = valeurs.map((v) => (v * 100) / total);
  const pct = exacts.map((p) => Math.floor(p));
  let reste = 100 - pct.reduce((somme, p) => somme + p, 0);

  const ordre = exacts
    .map((p, i) => ({ i, fraction: p - Math.floor(p) }))
    .sort((a, b) => b.fraction - a.fraction || a.i - b.i);

  for (const { i } of ordre) {
    if (reste <= 0) {
      break;
    }

    pct[i] += 1;
    reste -= 1;
  }

  return pct;
}

// Les trois niveaux sont toujours présents, même absents des données.
function calculerNiveaux(lignesBrutes) {
  const source = Array.isArray(lignesBrutes) ? lignesBrutes : [];

  const valeurs = NIVEAUX_GRAPHIQUE.map(({ niveau }) =>
    compterAnomalies(source.find((ligne) => ligne?.niveau === niveau)?.total)
  );

  const total = valeurs.reduce((somme, v) => somme + v, 0);
  const maximum = Math.max(...valeurs);
  const pct = repartirPourcentages(valeurs);

  return {
    total,
    lignes: NIVEAUX_GRAPHIQUE.map((niveau, i) => ({
      ...niveau,
      valeur: valeurs[i],
      pct: pct[i],
      // longueur de barre : le plus haut niveau remplit la piste
      echelle: maximum > 0 ? valeurs[i] / maximum : 0,
    })),
  };
}

// Phrase calculée : « 3 critiques sur 8 anomalies actives ».
function phraseNiveaux({ lignes, total }) {
  if (total === 0) {
    return 'Rien à signaler pour le moment';
  }

  const critiques = lignes[0].valeur; // CRITIQUE est toujours en tête
  const sujet =
    critiques === 0
      ? 'Aucune critique'
      : `${number(critiques)} critique${critiques >= 2 ? 's' : ''}`;
  const accord = total >= 2 ? 's' : '';

  return `${sujet} sur ${number(total)} anomalie${accord} active${accord}`;
}

function reduireMouvement() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function NiveauxAnomalies({ lignes, total }) {
  // depart : barres à 0 · anime : elles s'allongent · fini : plus de transition
  const [phase, setPhase] = useState(() =>
    reduireMouvement() ? 'fini' : 'depart'
  );

  // Deux images d'attente : le navigateur dessine d'abord les barres à 0,
  // sinon la transition ne démarre pas sur un appareil lent. Si aucune
  // image n'est dessinée en 1 s (onglet masqué), on affiche l'état final.
  useEffect(() => {
    if (phase !== 'depart') {
      return undefined;
    }

    let seconde = 0;
    const premiere = window.requestAnimationFrame(() => {
      seconde = window.requestAnimationFrame(() => setPhase('anime'));
    });
    const secours = window.setTimeout(() => setPhase('fini'), 1000);

    return () => {
      window.cancelAnimationFrame(premiere);
      window.cancelAnimationFrame(seconde);
      window.clearTimeout(secours);
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== 'anime') {
      return undefined;
    }

    const minuteur = window.setTimeout(
      () => setPhase('fini'),
      DUREE_BARRES + 100
    );

    return () => window.clearTimeout(minuteur);
  }, [phase]);

  const resume = `Anomalies actives par niveau : ${lignes
    .map(({ niveau, valeur, pct }) => `${niveau} ${number(valeur)} (${pct}\u00A0%)`)
    .join(', ')}, sur ${number(total)} au total.`;

  return (
    <div className="relative flex h-full flex-col justify-center">
      <div role="img" aria-label={resume} className="space-y-5">
        {lignes.map(({ niveau, couleur, valeur, pct, echelle }) => (
          <div
            key={niveau}
            className="grid gap-1 sm:grid-cols-[5.5rem_minmax(0,1fr)] sm:items-center sm:gap-3"
          >
            <span className="text-xs font-semibold text-jr-texte">
              {niveau}
            </span>

            <div className="flex h-8 min-w-0 items-center border-l border-jr-bordure">
              <span
                className={`h-6 rounded-r ${
                  phase === 'anime'
                    ? 'transition-[width] duration-[600ms] ease-out motion-reduce:transition-none'
                    : ''
                }`}
                style={{
                  backgroundColor: couleur,
                  minWidth: valeur > 0 && phase !== 'depart' ? 3 : 0,
                  width:
                    phase === 'depart'
                      ? '0px'
                      : `calc((100% - ${PLACE_VALEUR}) * ${echelle})`,
                }}
              />

              <span className="ml-2 shrink-0 whitespace-nowrap text-sm tabular-nums">
                <span className="text-base font-semibold text-jr-texte">
                  {number(valeur)}
                </span>
                <span className="text-jr-faible">
                  {` · ${pct}\u00A0%`}
                </span>
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Équivalent texte, hors du role="img" pour rester lisible */}
      <div className="sr-only">
        <table>
          <caption>Anomalies actives par niveau</caption>
          <thead>
            <tr>
              <th scope="col">Niveau</th>
              <th scope="col">Anomalies</th>
              <th scope="col">Part du total</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map(({ niveau, valeur, pct }) => (
              <tr key={niveau}>
                <th scope="row">{niveau}</th>
                <td>{number(valeur)}</td>
                <td>{pct}&nbsp;%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Variation({ valeur }) {
  const n = Number(valeur);

  if (valeur === null || valeur === undefined || !Number.isFinite(n)) {
    return <span className="text-jr-faible">—</span>;
  }

  return (
    <span className="inline-flex items-center gap-1 font-semibold text-jr-texte">
      {n >= 0 ? (
        <TrendingUp size={15} className="text-jr-err" aria-hidden="true" />
      ) : (
        <TrendingDown size={15} className="text-jr-ok" aria-hidden="true" />
      )}
      {number(Math.abs(n), 2)} %
    </span>
  );
}

/* =========================================================
   CONTENU DU DASHBOARD
   (à l'intérieur du layout, donc du ToastProvider)
========================================================= */

function DashboardContenu() {
  const navigate = useNavigate();
  const { notify, dismiss } = useToast();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erreurInitiale, setErreurInitiale] = useState('');
  const [data, setData] = useState(DONNEES_VIDES);
  const [derniereMaj, setDerniereMaj] = useState(null);
  const [autoActive, setAutoActive] = useState(true);

  const enCours = useRef(false);
  const idRequete = useRef(0);
  const controleur = useRef(null);
  const aDesDonnees = useRef(false);
  const echecs = useRef(0);
  const suspendu = useRef(false);
  const connexionPerdue = useRef(false);
  const critiquesPrecedentes = useRef(null);
  const chargerRef = useRef(null);

  /* ---------- Reprise manuelle (bouton « Réessayer ») ---------- */

  const reprendre = useCallback(() => {
    echecs.current = 0;
    suspendu.current = false;

    setAutoActive(true);
    dismiss('connexion');
    dismiss('erreur-dashboard');

    chargerRef.current?.({ manuel: true });
  }, [dismiss]);

  /* ---------- Chargement ---------- */

  const charger = useCallback(
    async ({ manuel = false, auto = false } = {}) => {
      // aucune requête concurrente
      if (enCours.current) {
        return;
      }

      enCours.current = true;
      idRequete.current += 1;

      const id = idRequete.current;
      const controle = new AbortController();

      controleur.current = controle;

      // premier chargement : squelette ; ensuite : actualisation discrète
      if (!aDesDonnees.current) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      try {
        const response = await axiosClient.get('/responsable/dashboard', {
          signal: controle.signal,
        });

        if (response.data?.status !== 'success') {
          throw new Error(
            response.data?.message ||
              'Impossible de charger le dashboard Responsable.'
          );
        }

        const suivant = normaliserDonnees(response.data);

        const critiques = compterCritiques(suivant);
        const precedent = critiquesPrecedentes.current;

        critiquesPrecedentes.current = critiques;
        aDesDonnees.current = true;

        const maintenant = new Date();

        setData(suivant);
        setDerniereMaj(maintenant);
        setErreurInitiale('');
        setAutoActive(true);

        // reprise après une perte de connexion
        if (connexionPerdue.current) {
          connexionPerdue.current = false;

          dismiss('connexion');

          notify({
            cle: 'connexion-retablie',
            genre: 'succes',
            titre: 'Connexion rétablie',
            message: 'L’actualisation automatique a repris.',
          });
        }

        echecs.current = 0;
        suspendu.current = false;

        dismiss('erreur-dashboard');

        if (manuel) {
          notify({
            cle: 'dashboard-actualise',
            genre: 'succes',
            titre: 'Tableau de bord actualisé',
            message: `à ${heureCourte(maintenant)}`,
          });
        }

        if (precedent !== null && critiques > precedent) {
          const nouvelles = critiques - precedent;

          notify({
            cle: 'anomalies-critiques',
            genre: 'attention',
            titre:
              nouvelles > 1
                ? `${nouvelles} nouvelles anomalies critiques`
                : 'Nouvelle anomalie critique',
            message: 'Une vérification est recommandée.',
            action: {
              label: 'Voir',
              onClick: () =>
                navigate('/dashboard/responsable/anomalies'),
            },
          });
        }
      } catch (error) {
        if (
          error?.code === 'ERR_CANCELED' ||
          error?.name === 'CanceledError'
        ) {
          return;
        }

        console.error(
          'Erreur dashboard Responsable :',
          error?.message || error
        );

        // 401 / 403 : toast puis retour à l'accueil
        if (traiterErreurSession(error, notify, navigate)) {
          return;
        }

        const reseau = !error?.response;

        const message =
          error?.response?.data?.message ||
          (reseau
            ? 'Le serveur ne répond pas. Vérifiez votre connexion.'
            : error?.message) ||
          'Erreur lors du chargement du dashboard.';

        echecs.current += 1;

        if (!aDesDonnees.current) {
          setErreurInitiale(message);
        }

        if (echecs.current >= ECHECS_MAX) {
          // trop d'échecs : on suspend l'actualisation automatique
          suspendu.current = true;
          connexionPerdue.current = true;
          setAutoActive(false);

          notify({
            cle: 'connexion',
            genre: 'erreur',
            titre: reseau
              ? 'Connexion au serveur perdue'
              : 'Le serveur rencontre un problème',
            message: 'Actualisation automatique suspendue.',
            duree: 0,
            action: {
              label: 'Réessayer',
              onClick: () => reprendre(),
            },
          });
        } else if (!auto) {
          notify({
            cle: 'erreur-dashboard',
            genre: 'erreur',
            titre: aDesDonnees.current
              ? 'Actualisation impossible'
              : 'Chargement impossible',
            message,
            action: {
              label: 'Réessayer',
              onClick: () => reprendre(),
            },
          });
        }
      } finally {
        if (idRequete.current === id) {
          enCours.current = false;
        }

        // pas de setState si la requête a été annulée (démontage)
        if (!controle.signal.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [dismiss, navigate, notify, reprendre]
  );

  chargerRef.current = charger;

  /* ---------- Premier chargement + actualisation automatique ---------- */

  useEffect(() => {
    charger();

    const minuteur = window.setInterval(() => {
      if (document.hidden || suspendu.current) {
        return;
      }

      charger({ auto: true });
    }, INTERVALLE_AUTO);

    // retour sur l'onglet : mise à jour immédiate
    function auRetour() {
      if (
        !document.hidden &&
        !suspendu.current &&
        aDesDonnees.current
      ) {
        charger({ auto: true });
      }
    }

    document.addEventListener('visibilitychange', auRetour);

    return () => {
      window.clearInterval(minuteur);
      document.removeEventListener('visibilitychange', auRetour);

      controleur.current?.abort();
      enCours.current = false;
    };
  }, [charger]);

  /* ---------- Données calculées ---------- */

  const totalAnomalies = useMemo(
    () =>
      data.anomaliesParNiveau.reduce(
        (sum, item) => sum + (Number(item?.total) || 0),
        0
      ),
    [data.anomaliesParNiveau]
  );

  const niveaux = useMemo(
    () => calculerNiveaux(data.anomaliesParNiveau),
    [data.anomaliesParNiveau]
  );

  const stats = data.stats;
  const firstName = data.user?.prenom || 'Responsable';
  const erreurBloquante = Boolean(erreurInitiale) && !derniereMaj;

  return (
    <div className="space-y-6 pb-6">
      {/* ---------- Bandeau d'accueil ---------- */}
      <section className="jr-carte-eau jr-entree relative overflow-hidden rounded-lg p-6 shadow-sm sm:p-8">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-jr-bordure bg-jr-surface px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-jr-lien">
              <span className="relative flex h-2 w-2">
                <span
                  aria-hidden="true"
                  className="absolute inline-flex h-full w-full animate-ping rounded-full bg-jr-elec opacity-70 motion-reduce:animate-none"
                />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-jr-elec" />
              </span>
              Supervision JIRAMA
            </div>

            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-jr-titre sm:text-4xl">
              Bonjour {firstName}
            </h2>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-jr-doux sm:text-base">
              Voici un aperçu de l’activité, des consommations, des
              relevés et des alertes pour faciliter votre supervision.
            </p>

            {derniereMaj && (
              <p
                aria-live="polite"
                className="mt-3 text-xs text-jr-faible"
              >
                Dernière mise à jour : {heureCourte(derniereMaj)}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => charger({ manuel: true })}
            disabled={refreshing || loading}
            className="jr-btn jr-btn-elec inline-flex shrink-0 items-center justify-center gap-2 rounded-md px-5 py-3 text-sm font-semibold shadow-sm disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
          >
            <RefreshCw
              size={17}
              aria-hidden="true"
              className={
                refreshing ? 'animate-spin motion-reduce:animate-none' : ''
              }
            />
            {refreshing ? 'Actualisation...' : 'Actualiser'}
          </button>
        </div>
      </section>

      {/* ---------- Contenu ---------- */}
      {loading ? (
        <DashboardSkeleton />
      ) : erreurBloquante ? (
        <div
          role="alert"
          className="jr-verre flex flex-col items-start gap-4 rounded-lg border border-jr-err-bordure p-5 shadow-sm sm:flex-row sm:items-center"
        >
          <AlertTriangle
            className="shrink-0 text-jr-err"
            size={22}
            aria-hidden="true"
          />

          <div className="min-w-0 flex-1">
            <p className="font-semibold text-jr-titre">
              Impossible de charger le tableau de bord
            </p>
            <p className="mt-1 text-sm text-jr-doux">{erreurInitiale}</p>
          </div>

          <button
            type="button"
            onClick={reprendre}
            className="jr-btn jr-btn-bleu rounded-md px-4 py-2 text-sm font-semibold"
          >
            Réessayer
          </button>
        </div>
      ) : (
        <>
          {/* ---------- Indicateurs clés ---------- */}
          <section>
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-jr-lien">
                  Indicateurs clés
                </p>
                <h2 className="mt-1 text-xl font-semibold text-jr-titre">
                  Activité du mois
                </h2>
              </div>

              <span className="hidden rounded-full border border-jr-bordure bg-jr-surface px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-jr-faible sm:inline-flex">
                {autoActive
                  ? 'Actualisation automatique · 60 s'
                  : 'Actualisation suspendue'}
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                index={0}
                title="Relevés du mois"
                value={number(stats.relevesMois)}
                subtitle="Saisies enregistrées"
                icon={ClipboardList}
                tone="bleu"
                onClick={() => navigate('/dashboard/admin/releves')}
              />
              <StatCard
                index={1}
                title="Consommation eau"
                value={`${number(stats.consommationEauMois, 2)} m³`}
                subtitle="Mois en cours"
                icon={Droplets}
                tone="eau"
              />
              <StatCard
                index={2}
                title="Consommation électricité"
                value={`${number(stats.consommationElectriciteMois, 2)} kWh`}
                subtitle="Mois en cours"
                icon={Zap}
                tone="elec"
              />
              <StatCard
                index={3}
                title="Anomalies actives"
                value={number(stats.anomaliesActives)}
                subtitle={`${number(totalAnomalies)} suivies actuellement`}
                icon={ShieldAlert}
                tone="err"
                onClick={() => navigate('/dashboard/responsable/anomalies')}
              />
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              index={4}
              title="Abonnés"
              value={number(stats.abonnes)}
              subtitle="Base totale"
              icon={Users}
              tone="neutre"
            />
            <StatCard
              index={5}
              title="Compteurs actifs"
              value={`${number(stats.compteursActifs)} / ${number(stats.compteurs)}`}
              subtitle="Compteurs en service"
              icon={Gauge}
              tone="ok"
            />
            <StatCard
              index={6}
              title="Agents actifs"
              value={number(stats.agentsActifs)}
              subtitle="Équipe opérationnelle"
              icon={Users}
              tone="bleu"
            />
            <StatCard
              index={7}
              title="Notifications non lues"
              value={number(stats.notificationsNonLues)}
              subtitle="Pour votre compte"
              icon={Bell}
              tone="err"
              onClick={() =>
                navigate('/dashboard/responsable/notifications')
              }
            />
          </section>

          {/* ---------- Graphiques ---------- */}
          <section className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
            <div className="jr-verre rounded-lg border border-jr-bordure p-5 shadow-sm sm:p-6">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-jr-lien">
                    Analyse
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-jr-titre">
                    Évolution de la consommation
                  </h2>
                  <p className="mt-1 text-sm text-jr-faible">
                    Les douze derniers mois.
                  </p>
                </div>

                <div className="flex items-center gap-2 text-[10px] font-semibold">
                  <span className="rounded-full bg-jr-eau-pale px-3 py-1.5 text-jr-lien">
                    Eau
                  </span>
                  <span className="rounded-full bg-jr-elec-pale px-3 py-1.5 text-jr-attention">
                    Électricité
                  </span>
                </div>
              </div>

              <div className="mt-5 h-[320px]">
                {data.evolution.length === 0 ? (
                  <MessageVide>
                    Aucune donnée de consommation disponible pour le moment.
                  </MessageVide>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={data.evolution}
                      margin={{ top: 10, right: 8, left: -20, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient
                          id="eauFillJirama"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            style={{
                              stopColor: COULEURS.eauClair,
                              stopOpacity: 0.28,
                            }}
                          />
                          <stop
                            offset="95%"
                            style={{
                              stopColor: COULEURS.eauClair,
                              stopOpacity: 0,
                            }}
                          />
                        </linearGradient>

                        <linearGradient
                          id="elecFillJirama"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            style={{
                              stopColor: COULEURS.elec,
                              stopOpacity: 0.28,
                            }}
                          />
                          <stop
                            offset="95%"
                            style={{
                              stopColor: COULEURS.elec,
                              stopOpacity: 0,
                            }}
                          />
                        </linearGradient>
                      </defs>

                      <CartesianGrid
                        stroke={COULEURS.bordure}
                        strokeDasharray="4 4"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="mois"
                        tickLine={false}
                        axisLine={false}
                        tick={STYLE_AXE}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tick={STYLE_AXE}
                      />
                      <Tooltip {...STYLE_INFOBULLE} />
                      <Legend
                        wrapperStyle={{ fontSize: 11 }}
                        formatter={(value) => (
                          <span style={{ color: COULEURS.texteDoux }}>
                            {value}
                          </span>
                        )}
                      />
                      <Area
                        type="monotone"
                        dataKey="eau"
                        name="Eau (m³)"
                        stroke={COULEURS.eauClair}
                        strokeWidth={3}
                        fill="url(#eauFillJirama)"
                        activeDot={{ r: 5 }}
                      />
                      <Area
                        type="monotone"
                        dataKey="electricite"
                        name="Électricité (kWh)"
                        stroke={COULEURS.elec}
                        strokeWidth={3}
                        fill="url(#elecFillJirama)"
                        activeDot={{ r: 5 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-jr-bordure bg-jr-surface p-5 shadow-sm sm:p-6">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-jr-lien">
                  Surveillance
                </p>
                <h2 className="mt-1 text-lg font-semibold text-jr-titre">
                  Anomalies par niveau
                </h2>
                <p className="mt-1 text-sm text-jr-faible">
                  {phraseNiveaux(niveaux)}
                </p>
              </div>

              <div className="mt-5 h-[320px]">
                {niveaux.total === 0 ? (
                  <MessageVide>
                    <span>
                      <CheckCircle2
                        className="mx-auto mb-2 text-jr-ok"
                        size={28}
                        aria-hidden="true"
                      />
                      Aucune anomalie active à représenter.
                    </span>
                  </MessageVide>
                ) : (
                  <NiveauxAnomalies
                    lignes={niveaux.lignes}
                    total={niveaux.total}
                  />
                )}
              </div>
            </div>
          </section>

          {/* ---------- Anomalies récentes + notifications ---------- */}
          <section className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
            <div className="jr-verre overflow-hidden rounded-lg border border-jr-bordure shadow-sm">
              <div className="flex items-center justify-between gap-4 border-b border-jr-bordure p-5 sm:p-6">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-jr-err">
                    À surveiller
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-jr-titre">
                    Dernières anomalies
                  </h2>
                  <p className="mt-1 text-sm text-jr-faible">
                    Les cas qui nécessitent une supervision.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    navigate('/dashboard/responsable/anomalies')
                  }
                  className="jr-btn jr-btn-bleu rounded-md px-3.5 py-2 text-xs font-semibold"
                >
                  Tout voir
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="jr-thead text-[10px] uppercase tracking-wider">
                    <tr>
                      <th scope="col" className="px-5 py-3.5 font-semibold">Compteur</th>
                      <th scope="col" className="px-5 py-3.5 font-semibold">Anomalie</th>
                      <th scope="col" className="px-5 py-3.5 font-semibold">Variation</th>
                      <th scope="col" className="px-5 py-3.5 font-semibold">Niveau</th>
                      <th scope="col" className="px-5 py-3.5 font-semibold">Date</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-jr-bordure">
                    {data.anomaliesRecentes.map((item, index) => (
                      <tr
                        key={item.id ?? `anomalie-${index}`}
                        className="transition hover:bg-jr-eau-pale motion-reduce:transition-none"
                      >
                        <td className="px-5 py-4 font-semibold text-jr-texte">
                          {item.numero_compteur || '—'}
                          <div className="mt-1 text-xs font-normal text-jr-faible">
                            {item.numero_abonne || item.abonne_nom || 'Abonné —'}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-jr-doux">
                          {item.type_anomalie || '—'}
                        </td>
                        <td className="px-5 py-4">
                          <Variation valeur={item.variation} />
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold ${niveauClass(item.niveau)}`}
                          >
                            {item.niveau || '—'}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-jr-faible">
                          {formatDate(item.date_detection)}
                        </td>
                      </tr>
                    ))}

                    {data.anomaliesRecentes.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-5 py-12 text-center text-sm text-jr-faible"
                        >
                          <CheckCircle2
                            className="mx-auto mb-2 text-jr-ok"
                            size={28}
                            aria-hidden="true"
                          />
                          Aucune anomalie active.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="jr-verre overflow-hidden rounded-lg border border-jr-bordure shadow-sm">
              <div className="border-b border-jr-bordure p-5 sm:p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-jr-lien">
                      Communication
                    </p>
                    <h2 className="mt-1 text-lg font-semibold text-jr-titre">
                      Notifications récentes
                    </h2>
                  </div>

                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-jr-eau-pale text-jr-lien">
                    <Bell size={19} aria-hidden="true" />
                  </div>
                </div>
              </div>

              <div className="divide-y divide-jr-bordure">
                {data.notificationsRecentes.map((notification, index) => (
                  <button
                    key={notification.id ?? `notification-${index}`}
                    type="button"
                    onClick={() =>
                      navigate('/dashboard/responsable/notifications')
                    }
                    className="group w-full p-5 text-left transition hover:bg-jr-eau-pale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-jr-elec motion-reduce:transition-none"
                  >
                    <div className="flex gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-jr-err-pale text-jr-err">
                        <AlertTriangle size={17} aria-hidden="true" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-jr-texte">
                          {notification.sujet || 'Alerte'}
                        </p>
                        <p className="mt-1 line-clamp-3 text-xs leading-5 text-jr-faible">
                          {notification.message ||
                            'Notification de supervision.'}
                        </p>
                        <span
                          className={`mt-2 inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold ${
                            notification.statut === 'EN_ATTENTE'
                              ? 'border-[var(--jr-elec-anneau)] bg-jr-elec-pale text-jr-attention'
                              : 'border-jr-ok bg-jr-ok-pale text-jr-ok'
                          }`}
                        >
                          {notification.statut === 'EN_ATTENTE'
                            ? 'Non lue'
                            : 'Lue'}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}

                {data.notificationsRecentes.length === 0 && (
                  <div className="p-10 text-center text-sm text-jr-faible">
                    Aucune notification récente.
                  </div>
                )}
              </div>

              <div className="border-t border-jr-bordure p-4">
                <button
                  type="button"
                  onClick={() =>
                    navigate('/dashboard/responsable/notifications')
                  }
                  className="jr-btn jr-btn-elec w-full rounded-md px-4 py-3 text-sm font-semibold shadow-sm"
                >
                  Ouvrir toutes les notifications
                </button>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export default function ResponsableDashboard() {
  return (
    <ResponsableLayout title="Tableau de bord">
      <DashboardContenu />
    </ResponsableLayout>
  );
}