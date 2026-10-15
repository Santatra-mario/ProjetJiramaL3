import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useNavigate } from 'react-router-dom';

import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Bell,
  Clock,
  ClipboardList,
  Droplets,
  Gauge,
  RefreshCw,
  TriangleAlert,
  Users,
  WifiOff,
  Zap,
} from 'lucide-react';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import axiosClient from '../../api/axiosClient';
import AgentLayout from '../../components/admin/agent/AgentLayout';
import { useToast } from '../../components/ui/ToastProvider.jsx';
import {
  estAnnulation,
  traiterErreurSession,
} from '../../components/admin/sessionUtilisateur.js';
import { COULEURS } from '../../theme/couleurs.js';

/* =========================================================
   OUTILS
========================================================= */

function formatDate(value) {
  if (!value) {
    return '—';
  }

  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleDateString('fr-FR');
}

function formatDateCourte(value) {
  if (!value) {
    return '';
  }

  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
  });
}

function formatNumber(value, digits = 2) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return '0';
  }

  return number.toLocaleString('fr-FR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function estEau(type) {
  return String(type || '').toUpperCase() === 'EAU';
}

function uniteDe(type) {
  return estEau(type) ? 'm³' : 'kWh';
}

function lireUtilisateur() {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null');
  } catch {
    return null;
  }
}

/*
  Chiffre qui s'incrémente brièvement (0,7 s).
  Aucun mouvement si l'utilisateur a demandé moins d'animations.
*/
function useNombreAnime(cible, duree = 700) {
  const [valeur, setValeur] = useState(0);
  const depart = useRef(0);

  useEffect(() => {
    const nombre = Number(cible);

    if (!Number.isFinite(nombre)) {
      setValeur(0);
      return undefined;
    }

    const reduit =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduit) {
      depart.current = nombre;
      setValeur(nombre);
      return undefined;
    }

    const debut = performance.now();
    const origine = depart.current;
    let image = 0;

    function pas(maintenant) {
      const progres = Math.min(1, (maintenant - debut) / duree);
      const adouci = 1 - Math.pow(1 - progres, 3);
      const courant = Math.round(origine + (nombre - origine) * adouci);

      depart.current = courant;
      setValeur(courant);

      if (progres < 1) {
        image = requestAnimationFrame(pas);
      }
    }

    image = requestAnimationFrame(pas);

    return () => cancelAnimationFrame(image);
  }, [cible, duree]);

  return valeur;
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

function BadgeType({ type }) {
  return estEau(type) ? (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-jr-eau-pale px-2 py-1 text-xs font-semibold text-jr-lien">
      <Droplets size={14} aria-hidden="true" />
      Eau
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-jr-elec-pale px-2 py-1 text-xs font-semibold text-jr-attention">
      <Zap size={14} aria-hidden="true" />
      Électricité
    </span>
  );
}

function BadgeNiveau({ niveau }) {
  const styles = {
    CRITIQUE:
      'border-jr-err-bordure bg-jr-err-pale text-jr-err',
    SUSPECTE:
      'border-jr-elec bg-jr-elec-pale text-jr-attention',
    ATTENTION:
      'border-jr-elec bg-jr-elec-pale text-jr-attention',
  };

  return (
    <span
      className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
        styles[niveau] ||
        'border-jr-bordure bg-jr-champ text-jr-doux'
      }`}
    >
      {niveau || '—'}
    </span>
  );
}

/* Niveau de gravité : libellé + 3 segments (jamais la couleur seule) */
function JaugeNiveau({ niveau }) {
  const rang = { ATTENTION: 1, SUSPECTE: 2, CRITIQUE: 3 }[niveau] || 0;
  const rouge = niveau === 'CRITIQUE';

  return (
    <span
      aria-hidden="true"
      className="inline-flex items-center gap-0.5"
    >
      {[1, 2, 3].map((segment) => (
        <span
          key={segment}
          className={`h-2 w-3 rounded-sm ${
            segment <= rang
              ? rouge
                ? 'bg-jr-err'
                : 'bg-jr-elec'
              : 'bg-jr-bordure'
          }`}
        />
      ))}
    </span>
  );
}

function BoutonLien({ onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-[44px] items-center gap-1 rounded-md px-2 text-sm font-semibold text-jr-lien transition-colors hover:bg-jr-eau-pale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jr-elec motion-reduce:transition-none"
    >
      {children}
      <ArrowRight size={16} aria-hidden="true" />
    </button>
  );
}

function EtatVide({ icone: Icone, titre, message, action }) {
  return (
    <div className="flex flex-col items-center px-5 py-10 text-center">
      <Icone
        size={28}
        aria-hidden="true"
        className="text-jr-faible"
      />
      <p className="mt-3 text-sm font-semibold text-jr-texte">
        {titre}
      </p>
      {message && (
        <p className="mt-1 max-w-sm text-sm text-jr-doux">
          {message}
        </p>
      )}
      {action}
    </div>
  );
}

/* Consommation récente d'un type de compteur (eau ou électricité) */

function CarteConsommation({ type, releves, loading, onSaisir }) {
  const eau = type === 'EAU';
  const unite = eau ? 'm³' : 'kWh';
  const Icone = eau ? Droplets : Zap;
  const nomType = eau ? 'd’eau' : 'd’électricité';

  const lignes = useMemo(
    () =>
      releves
        .filter((r) => estEau(r.type_compteur) === eau)
        .sort(
          (a, b) =>
            new Date(a.date_releve) - new Date(b.date_releve)
        ),
    [releves, eau]
  );

  const total = lignes.reduce(
    (somme, r) => somme + (Number(r.consommation) || 0),
    0
  );

  const dernier = lignes[lignes.length - 1];

  const donnees = lignes.map((r) => ({
    date: formatDateCourte(r.date_releve),
    compteur: r.numero_compteur,
    consommation: Number(r.consommation) || 0,
  }));

  const couleur = eau ? COULEURS.eauClair : COULEURS.elec;

  const axes = (
    <>
      <CartesianGrid vertical={false} stroke={COULEURS.bordure} />
      <XAxis
        dataKey="date"
        tickLine={false}
        axisLine={false}
        tick={{ fill: COULEURS.texteFaible, fontSize: 11 }}
      />
      <YAxis
        tickLine={false}
        axisLine={false}
        width={44}
        tick={{ fill: COULEURS.texteFaible, fontSize: 11 }}
      />
      <Tooltip
        cursor={{ fill: COULEURS.eauPale, stroke: COULEURS.bordure }}
        contentStyle={{
          backgroundColor: COULEURS.surface,
          border: `1px solid ${COULEURS.bordure}`,
          borderRadius: 8,
          color: COULEURS.texte,
          fontSize: 12,
        }}
        labelStyle={{ color: COULEURS.titre, fontWeight: 600 }}
        labelFormatter={(_, charge) =>
          charge?.[0]?.payload?.compteur
            ? `Compteur ${charge[0].payload.compteur}`
            : ''
        }
        formatter={(valeur) => [
          `${formatNumber(valeur)} ${unite}`,
          'Consommation',
        ]}
      />
    </>
  );

  return (
    <div
      className={`${
        eau
          ? 'jr-carte-eau border-t-4 border-t-jr-eau-clair'
          : 'jr-carte-elec border-t-4 border-t-jr-elec'
      } rounded-lg p-5 shadow-sm`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${
            eau
              ? 'bg-jr-eau-pale text-jr-lien'
              : 'bg-jr-elec-pale text-jr-attention'
          }`}
        >
          <Icone size={20} aria-hidden="true" />
        </span>

        <div className="min-w-0">
          <h3 className="text-sm font-bold text-jr-titre">
            {eau ? 'Eau' : 'Électricité'}
          </h3>
          <p className="text-xs text-jr-doux">
            Consommation par relevé, en {unite}
          </p>
        </div>
      </div>

      {loading ? (
        <>
          <Squelette className="mt-4 h-8 w-32" />
          <Squelette className="mt-4 h-28 w-full" />
        </>
      ) : lignes.length === 0 ? (
        <div className="mt-4">
          <p className="text-sm text-jr-doux">
            Aucun relevé {nomType} parmi les derniers relevés.
          </p>
          <button
            type="button"
            onClick={onSaisir}
            className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-md border border-jr-bordure bg-jr-surface px-4 text-sm font-semibold text-jr-lien transition-colors hover:bg-jr-eau-pale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jr-elec motion-reduce:transition-none"
          >
            <ClipboardList size={16} aria-hidden="true" />
            Saisir un relevé
          </button>
        </div>
      ) : (
        <>
          <p className="mt-3 text-3xl font-extrabold tracking-tight text-jr-texte">
            {formatNumber(total)}{' '}
            <span className="text-base font-semibold text-jr-doux">
              {unite}
            </span>
          </p>

          <p className="mt-1 text-xs text-jr-doux">
            cumulés sur {lignes.length} dernier
            {lignes.length > 1 ? 's' : ''} relevé
            {lignes.length > 1 ? 's' : ''}
            {dernier
              ? ` · dernier : ${formatNumber(dernier.consommation || 0)} ${unite}, compteur ${
                  dernier.numero_compteur || '—'
                }, ${formatDate(dernier.date_releve)}`
              : ''}
          </p>

          {donnees.length >= 2 ? (
            <div
              role="img"
              aria-label={`Consommation des derniers relevés ${nomType}, en ${unite}`}
              className="mt-4 h-28"
            >
              <ResponsiveContainer width="100%" height="100%">
                {eau ? (
                  <BarChart
                    data={donnees}
                    margin={{ top: 4, right: 4, left: -12, bottom: 0 }}
                  >
                    {axes}
                    <Bar
                      dataKey="consommation"
                      fill={couleur}
                      radius={[3, 3, 0, 0]}
                      isAnimationActive={false}
                    />
                  </BarChart>
                ) : (
                  <LineChart
                    data={donnees}
                    margin={{ top: 4, right: 8, left: -12, bottom: 0 }}
                  >
                    {axes}
                    <Line
                      type="monotone"
                      dataKey="consommation"
                      stroke={couleur}
                      strokeWidth={2}
                      dot={{ r: 3, fill: couleur, stroke: couleur }}
                      activeDot={{ r: 5 }}
                      isAnimationActive={false}
                    />
                  </LineChart>
                )}
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="mt-4 text-xs text-jr-faible">
              Un seul relevé {nomType} : il en faut au moins deux pour
              tracer l’évolution.
            </p>
          )}
        </>
      )}
    </div>
  );
}

/* =========================================================
   CONTENU DU TABLEAU DE BORD
   (rendu à l'intérieur d'<AgentLayout> : useToast fonctionne ici)
========================================================= */

function Contenu() {
  const navigate = useNavigate();
  const { notify } = useToast();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [echec, setEchec] = useState(false);
  const [derniereMaj, setDerniereMaj] = useState(null);
  const [user] = useState(lireUtilisateur);

  const [data, setData] = useState({
    stats: {},
    relevesRecents: [],
    anomaliesRecentes: [],
  });

  const controleur = useRef(null);

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

        const response = await axiosClient.get('/agent/dashboard', {
          signal: controle.signal,
        });

        if (response.data?.status !== 'success') {
          throw new Error(
            response.data?.message ||
              'Impossible de charger le tableau de bord.'
          );
        }

        const suivant = {
          stats: response.data.stats || {},
          relevesRecents: response.data.relevesRecents || [],
          anomaliesRecentes: response.data.anomaliesRecentes || [],
        };

        setData(suivant);
        setEchec(false);
        setDerniereMaj(new Date());

        if (manuel) {
          const aVerifier = Number(suivant.stats.anomalies || 0);

          notify({
            cle: 'dashboard-actualise',
            genre: 'succes',
            titre: 'Tableau de bord actualisé',
            message:
              aVerifier > 0
                ? `${aVerifier} anomalie${
                    aVerifier > 1 ? 's' : ''
                  } à vérifier.`
                : 'Aucune anomalie à vérifier.',
          });
        }
      } catch (requestError) {
        if (estAnnulation(requestError)) {
          return;
        }

        console.error('Erreur dashboard Agent :', requestError);

        if (traiterErreurSession(requestError, notify, navigate)) {
          return;
        }

        setEchec(true);

        notify({
          cle: 'dashboard-erreur',
          genre: 'erreur',
          titre: 'Tableau de bord indisponible',
          message:
            requestError.response?.data?.message ||
            'Les relevés et anomalies n’ont pas pu être chargés. Vérifiez la connexion, puis réessayez.',
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

  const stats = data.stats || {};

  const nombreActifs = useNombreAnime(
    loading ? 0 : Number(stats.compteursActifs || 0)
  );
  const nombreAbonnes = useNombreAnime(
    loading ? 0 : Number(stats.abonnes || 0)
  );
  const nombreRelevesMois = useNombreAnime(
    loading ? 0 : Number(stats.relevesMois || 0)
  );
  const nombreAnomalies = useNombreAnime(
    loading ? 0 : Number(stats.anomalies || 0)
  );
  const nombreNotifications = useNombreAnime(
    loading ? 0 : Number(stats.notifications || 0)
  );

  const totalCompteurs = Number(stats.compteurs || 0);
  const totalActifs = Number(stats.compteursActifs || 0);
  const pourcentageActifs =
    totalCompteurs > 0
      ? Math.round((totalActifs / totalCompteurs) * 100)
      : 0;

  const anomaliesAVerifier = Number(stats.anomalies || 0);
  const notificationsAttente = Number(stats.notifications || 0);

  const prenom = String(user?.prenom || '').trim();

  const dateDuJour = useMemo(() => {
    const texte = new Date().toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    return texte.charAt(0).toUpperCase() + texte.slice(1);
  }, []);

  const relevesRecents = data.relevesRecents || [];
  const anomaliesRecentes = data.anomaliesRecentes || [];

  let statut = null;

  if (loading) {
    statut = { Icone: Clock, texte: 'Chargement des données…' };
  } else if (refreshing) {
    statut = { Icone: RefreshCw, texte: 'Actualisation en cours…', tourne: true };
  } else if (echec) {
    statut = {
      Icone: WifiOff,
      texte: derniereMaj
        ? 'Connexion impossible : les données affichées ne sont plus à jour'
        : 'Connexion impossible : données indisponibles',
      erreur: true,
    };
  } else if (derniereMaj) {
    statut = {
      Icone: Clock,
      texte: `Données mises à jour à ${derniereMaj.toLocaleTimeString(
        'fr-FR',
        { hour: '2-digit', minute: '2-digit' }
      )}`,
    };
  }

  const actionSaisir = (
    <button
      type="button"
      onClick={() => navigate('/dashboard/agent/releves')}
      className="jr-btn-elec mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-md px-4 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jr-focus"
    >
      <ClipboardList size={18} aria-hidden="true" />
      Saisir un relevé
    </button>
  );

  return (
    <div className="space-y-6">
      {/* Barre d'actualisation : toujours présente (pas de saut de page) */}
      <div
        aria-hidden="true"
        className={`-mb-4 h-0.5 rounded-full ${
          refreshing ? 'jr-shimmer' : ''
        }`}
      />

      {/* ---------- 1. En-tête ---------- */}
      <header
        className="jr-entree flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        style={{ animationDelay: '0ms' }}
      >
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-jr-logo p-1.5 shadow-sm ring-1 ring-jr-bordure">
            <img
              src="/images/Jirama.png"
              alt="Logo JIRAMA"
              className="h-full w-full object-contain"
            />
          </div>

          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-jr-lien">
              Suivi des consommations
            </p>
            <h2 className="truncate text-xl font-bold text-jr-titre sm:text-2xl">
              {prenom ? `Bonjour, ${prenom}` : 'Bonjour'}
            </h2>
            <p className="text-sm text-jr-doux">{dateDuJour}</p>

            {statut && (
              <p
                role="status"
                aria-live="polite"
                className={`mt-1 flex items-center gap-1.5 text-xs ${
                  statut.erreur ? 'text-jr-err' : 'text-jr-faible'
                }`}
              >
                <statut.Icone
                  size={13}
                  aria-hidden="true"
                  className={
                    statut.tourne
                      ? 'animate-spin motion-reduce:animate-none'
                      : ''
                  }
                />
                {statut.texte}
              </p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => charger(true)}
          disabled={refreshing || loading}
          aria-busy={refreshing}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md border border-jr-bordure bg-jr-surface px-4 text-sm font-semibold text-jr-lien transition-colors hover:bg-jr-eau-pale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jr-elec disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
        >
          <RefreshCw
            size={18}
            aria-hidden="true"
            className={
              refreshing ? 'animate-spin motion-reduce:animate-none' : ''
            }
          />
          {refreshing ? 'Actualisation…' : 'Actualiser'}
        </button>
      </header>

      {/* ---------- 2. Compteurs actifs + points de vigilance ---------- */}
      <section
        aria-label="Chiffres clés"
        className="jr-entree grid gap-4 lg:grid-cols-3"
        style={{ animationDelay: '70ms' }}
      >
        {/* Bloc principal */}
        <div className="jr-verre-fort rounded-lg border border-jr-bordure p-5 shadow-sm sm:p-6 lg:col-span-2">
          <div className="flex items-center gap-2 text-jr-lien">
            <Gauge size={20} aria-hidden="true" />
            <h3 className="text-sm font-bold text-jr-titre">
              Compteurs actifs
            </h3>
          </div>

          {loading ? (
            <>
              <Squelette className="mt-4 h-12 w-40" />
              <Squelette className="mt-4 h-2 w-full" />
            </>
          ) : (
            <>
              <p className="mt-3 text-5xl font-extrabold tracking-tight text-jr-texte">
                {formatNumber(nombreActifs, 0)}
                <span className="ml-2 text-lg font-semibold text-jr-doux">
                  sur {formatNumber(totalCompteurs, 0)} compteurs
                </span>
              </p>

              <div
                role="progressbar"
                aria-label="Part des compteurs actifs"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={pourcentageActifs}
                className="mt-4 h-2 overflow-hidden rounded-full bg-jr-eau-pale"
              >
                <div
                  className="h-full rounded-full bg-jr-eau"
                  style={{ width: `${pourcentageActifs}%` }}
                />
              </div>

              <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-jr-bordure pt-4">
                <div>
                  <dt className="flex items-center gap-1.5 text-xs font-medium text-jr-faible">
                    <Users size={14} aria-hidden="true" />
                    Abonnés
                  </dt>
                  <dd className="mt-1 text-xl font-bold text-jr-texte">
                    {formatNumber(nombreAbonnes, 0)}
                  </dd>
                </div>

                <div>
                  <dt className="flex items-center gap-1.5 text-xs font-medium text-jr-faible">
                    <ClipboardList size={14} aria-hidden="true" />
                    Relevés du mois
                  </dt>
                  <dd className="mt-1 text-xl font-bold text-jr-texte">
                    {formatNumber(nombreRelevesMois, 0)}
                  </dd>
                </div>
              </dl>
            </>
          )}

          <div className="flex flex-wrap gap-3">
            {actionSaisir}

            <button
              type="button"
              onClick={() => navigate('/dashboard/agent/compteurs')}
              className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-md border border-jr-bordure px-4 text-sm font-semibold text-jr-lien transition-colors hover:bg-jr-eau-pale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jr-elec motion-reduce:transition-none"
            >
              Voir les compteurs
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Points de vigilance */}
        <div className="grid gap-4">
          <button
            type="button"
            onClick={() => navigate('/dashboard/agent/anomalies')}
            className={`jr-verre-fort flex min-h-[44px] flex-col rounded-lg border border-jr-bordure p-5 text-left shadow-sm transition-colors hover:bg-jr-eau-pale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jr-elec motion-reduce:transition-none ${
              !loading && anomaliesAVerifier > 0
                ? 'border-l-4 border-l-jr-err'
                : ''
            }`}
          >
            <span className="flex items-center gap-2 text-sm font-bold text-jr-titre">
              <TriangleAlert
                size={18}
                aria-hidden="true"
                className={
                  anomaliesAVerifier > 0 ? 'text-jr-err' : 'text-jr-faible'
                }
              />
              Anomalies à vérifier
              {!loading && anomaliesAVerifier > 0 && (
                <span className="ml-auto rounded-md border border-jr-err-bordure bg-jr-err-pale px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-jr-err">
                  À contrôler
                </span>
              )}
            </span>

            {loading ? (
              <Squelette className="mt-3 h-9 w-16" />
            ) : (
              <>
                <span
                  className={`mt-2 text-4xl font-extrabold tracking-tight ${
                    anomaliesAVerifier > 0 ? 'text-jr-err' : 'text-jr-ok'
                  }`}
                >
                  {formatNumber(nombreAnomalies, 0)}
                </span>
                <span className="mt-1 text-xs text-jr-doux">
                  {anomaliesAVerifier > 0
                    ? 'Contrôlez les index concernés sur le terrain'
                    : 'Aucun écart à contrôler'}
                </span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => navigate('/dashboard/agent/notifications')}
            className="jr-verre-fort flex min-h-[44px] flex-col rounded-lg border border-jr-bordure p-5 text-left shadow-sm transition-colors hover:bg-jr-eau-pale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jr-elec motion-reduce:transition-none"
          >
            <span className="flex items-center gap-2 text-sm font-bold text-jr-titre">
              <Bell
                size={18}
                aria-hidden="true"
                className="text-jr-attention"
              />
              Notifications en attente
              {!loading && notificationsAttente > 0 && (
                <span
                  aria-hidden="true"
                  className="jr-respire ml-auto min-w-6 rounded-full bg-jr-elec px-2 py-0.5 text-center text-[10px] font-bold text-jr-sur-elec"
                >
                  {notificationsAttente > 99
                    ? '99+'
                    : notificationsAttente}
                </span>
              )}
            </span>

            {loading ? (
              <Squelette className="mt-3 h-9 w-16" />
            ) : (
              <>
                <span className="mt-2 text-4xl font-extrabold tracking-tight text-jr-texte">
                  {formatNumber(nombreNotifications, 0)}
                </span>
                <span className="mt-1 text-xs text-jr-doux">
                  {notificationsAttente > 0
                    ? 'Consignes et alertes à lire'
                    : 'Tout est lu'}
                </span>
              </>
            )}
          </button>
        </div>
      </section>

      {/* ---------- 3. Consommation récente : eau et électricité ---------- */}
      <section
        aria-label="Consommation des derniers relevés"
        className="jr-entree grid gap-4 md:grid-cols-2"
        style={{ animationDelay: '140ms' }}
      >
        <CarteConsommation
          type="EAU"
          releves={relevesRecents}
          loading={loading}
          onSaisir={() => navigate('/dashboard/agent/releves')}
        />
        <CarteConsommation
          type="ELECTRICITE"
          releves={relevesRecents}
          loading={loading}
          onSaisir={() => navigate('/dashboard/agent/releves')}
        />
      </section>

      {/* ---------- 4. Derniers relevés ---------- */}
      <section
        className="jr-entree jr-verre-fort overflow-hidden rounded-lg border border-jr-bordure shadow-sm"
        style={{ animationDelay: '210ms' }}
      >
        <div className="flex items-center justify-between gap-3 border-b border-jr-bordure px-5 py-3">
          <h3 className="text-base font-bold text-jr-titre">
            Derniers relevés
          </h3>

          <BoutonLien
            onClick={() => navigate('/dashboard/agent/releves')}
          >
            Tout voir
          </BoutonLien>
        </div>

        {loading ? (
          <div className="space-y-3 p-5">
            <Squelette className="h-10 w-full" />
            <Squelette className="h-10 w-full" />
            <Squelette className="h-10 w-full" />
          </div>
        ) : echec && relevesRecents.length === 0 ? (
          <EtatVide
            icone={TriangleAlert}
            titre="Relevés non chargés"
            message="La liste n’a pas pu être récupérée."
            action={
              <button
                type="button"
                onClick={() => charger(true)}
                className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-md border border-jr-bordure px-4 text-sm font-semibold text-jr-lien transition-colors hover:bg-jr-eau-pale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jr-elec motion-reduce:transition-none"
              >
                <RefreshCw size={16} aria-hidden="true" />
                Réessayer
              </button>
            }
          />
        ) : relevesRecents.length === 0 ? (
          <EtatVide
            icone={ClipboardList}
            titre="Aucun relevé enregistré"
            message="Les relevés que vous saisirez apparaîtront ici avec l’abonné, le compteur et la consommation."
            action={actionSaisir}
          />
        ) : (
          <>
            {/* Tableau : écrans larges */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead className="jr-thead">
                  <tr>
                    <th scope="col" className="px-5 py-3 text-left">
                      Abonné
                    </th>
                    <th scope="col" className="px-5 py-3 text-left">
                      Compteur
                    </th>
                    <th scope="col" className="px-5 py-3 text-left">
                      Type
                    </th>
                    <th scope="col" className="px-5 py-3 text-left">
                      Date
                    </th>
                    <th scope="col" className="px-5 py-3 text-right">
                      Consommation
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {relevesRecents.map((releve) => (
                    <tr
                      key={releve.id}
                      className="border-t border-jr-bordure transition-colors hover:bg-jr-eau-pale motion-reduce:transition-none"
                    >
                      <td
                        className={`border-l-4 px-5 py-3 font-medium text-jr-texte ${
                          estEau(releve.type_compteur)
                            ? 'border-l-jr-eau-clair'
                            : 'border-l-jr-elec'
                        }`}
                      >
                        {`${releve.abonne_prenom || ''} ${
                          releve.abonne_nom || ''
                        }`.trim() || '—'}
                      </td>
                      <td className="px-5 py-3 text-jr-doux">
                        {releve.numero_compteur || '—'}
                      </td>
                      <td className="px-5 py-3">
                        <BadgeType type={releve.type_compteur} />
                      </td>
                      <td className="px-5 py-3 text-jr-doux">
                        {formatDate(releve.date_releve)}
                      </td>
                      <td className="px-5 py-3 text-right font-bold text-jr-texte">
                        {formatNumber(releve.consommation || 0)}{' '}
                        <span className="text-xs font-medium text-jr-faible">
                          {uniteDe(releve.type_compteur)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Cartes empilées : mobile */}
            <ul className="divide-y divide-jr-bordure md:hidden">
              {relevesRecents.map((releve) => (
                <li
                  key={releve.id}
                  className={`flex items-center gap-3 border-l-4 px-4 py-3 ${
                    estEau(releve.type_compteur)
                      ? 'border-l-jr-eau-clair'
                      : 'border-l-jr-elec'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-jr-texte">
                      {`${releve.abonne_prenom || ''} ${
                        releve.abonne_nom || ''
                      }`.trim() || '—'}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-jr-doux">
                      Compteur {releve.numero_compteur || '—'} ·{' '}
                      {formatDate(releve.date_releve)}
                    </p>
                    <div className="mt-1.5">
                      <BadgeType type={releve.type_compteur} />
                    </div>
                  </div>

                  <p className="text-right text-base font-bold text-jr-texte">
                    {formatNumber(releve.consommation || 0)}
                    <span className="block text-[11px] font-medium text-jr-faible">
                      {uniteDe(releve.type_compteur)}
                    </span>
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* ---------- 5. Anomalies récentes ---------- */}
      <section
        className="jr-entree jr-verre-fort overflow-hidden rounded-lg border border-jr-bordure shadow-sm"
        style={{ animationDelay: '280ms' }}
      >
        <div className="flex items-center justify-between gap-3 border-b border-jr-bordure px-5 py-3">
          <h3 className="text-base font-bold text-jr-titre">
            Anomalies récentes
          </h3>

          <BoutonLien
            onClick={() => navigate('/dashboard/agent/anomalies')}
          >
            Tout voir
          </BoutonLien>
        </div>

        {loading ? (
          <div className="space-y-3 p-5">
            <Squelette className="h-10 w-full" />
            <Squelette className="h-10 w-full" />
          </div>
        ) : echec && anomaliesRecentes.length === 0 ? (
          <EtatVide
            icone={TriangleAlert}
            titre="Anomalies non chargées"
            message="Actualisez pour vérifier les écarts détectés."
          />
        ) : anomaliesRecentes.length === 0 ? (
          <EtatVide
            icone={Gauge}
            titre="Aucune anomalie détectée"
            message="Aucun index ne s’écarte de la consommation habituelle des abonnés."
          />
        ) : (
          <ul className="divide-y divide-jr-bordure">
            {anomaliesRecentes.map((anomalie) => {
              const variation = Number(anomalie.variation || 0);
              const hausse = variation >= 0;
              const valeur = Math.abs(variation).toFixed(1);
              const critique = anomalie.niveau === 'CRITIQUE';

              return (
                <li
                  key={anomalie.id}
                  className={`flex items-start gap-3 border-l-4 px-5 py-3 ${
                    critique ? 'border-l-jr-err' : 'border-l-jr-elec'
                  }`}
                >
                  <TriangleAlert
                    size={18}
                    aria-hidden="true"
                    className={`mt-0.5 shrink-0 ${
                      critique ? 'text-jr-err' : 'text-jr-attention'
                    }`}
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-jr-texte">
                        Compteur {anomalie.numero_compteur || '—'}
                      </p>
                      <BadgeNiveau niveau={anomalie.niveau} />
                      <JaugeNiveau niveau={anomalie.niveau} />
                    </div>

                    <p className="mt-1 text-xs text-jr-doux">
                      {anomalie.type_anomalie || 'Anomalie'} ·{' '}
                      {formatDate(anomalie.date_detection)}
                    </p>
                  </div>

                  <p
                    aria-label={`Variation de ${valeur} % ${
                      hausse ? 'à la hausse' : 'à la baisse'
                    }`}
                    className={`flex items-center gap-1 text-sm font-bold ${
                      critique ? 'text-jr-err' : 'text-jr-attention'
                    }`}
                  >
                    {hausse ? (
                      <ArrowUp size={14} aria-hidden="true" />
                    ) : (
                      <ArrowDown size={14} aria-hidden="true" />
                    )}
                    {valeur} %
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

/* =========================================================
   PAGE : AgentLayout englobe le contenu pour que useToast
   fonctionne (fond « vivant » sur le tableau de bord).
========================================================= */

function AgentDashboard() {
  return (
    <AgentLayout title="Tableau de bord" intensite="vivant">
      <Contenu />
    </AgentLayout>
  );
}

export default AgentDashboard;
