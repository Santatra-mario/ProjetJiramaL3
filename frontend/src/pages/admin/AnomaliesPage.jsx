import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  useNavigate,
} from 'react-router-dom';

import {
  AlertCircle,
  AlertTriangle,
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Droplets,
  Eye,
  Filter,
  Gauge,
  Loader2,
  RefreshCw,
  Search,
  UserRound,
  X,
  Zap,
} from 'lucide-react';

import axiosClient from '../../api/axiosClient.js';

import Sidebar from '../../components/admin/Sidebar.jsx';

import Header from '../../components/admin/Header.jsx';

import AdminShell from '../../components/admin/AdminShell.jsx';


/* =========================================================
   UTILITAIRES
========================================================= */

function getToday() {
  const date =
    new Date();

  return [
    date.getFullYear(),
    String(
      date.getMonth() + 1
    ).padStart(2, '0'),
    String(
      date.getDate()
    ).padStart(2, '0'),
  ].join('-');
}


function getMonthsAgo(
  months
) {
  const date =
    new Date();

  date.setMonth(
    date.getMonth() - months
  );

  return [
    date.getFullYear(),
    String(
      date.getMonth() + 1
    ).padStart(2, '0'),
    String(
      date.getDate()
    ).padStart(2, '0'),
  ].join('-');
}


function toNumber(
  value
) {
  const number =
    Number(value);

  return Number.isFinite(
    number
  )
    ? number
    : 0;
}


function formatNumber(
  value
) {
  return toNumber(
    value
  ).toLocaleString(
    'fr-FR',
    {
      maximumFractionDigits: 2,
    }
  );
}


function formatVariation(
  value
) {
  const number =
    toNumber(value);

  const prefix =
    number > 0
      ? '+'
      : '';

  return (
    `${prefix}${number.toLocaleString(
      'fr-FR',
      {
        maximumFractionDigits: 1,
      }
    )} %`
  );
}


function formatDate(
  value
) {
  if (!value) {
    return '—';
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return String(value);
  }

  return date.toLocaleDateString(
    'fr-FR',
    {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }
  );
}


function getTypeLabel(
  type
) {
  return String(type || '')
    .toUpperCase() ===
    'EAU'
    ? 'Eau'
    : 'Électricité';
}


function getUnite(
  type
) {
  return String(type || '')
    .toUpperCase() ===
    'EAU'
    ? 'm³'
    : 'kWh';
}


function getNiveauLabel(
  niveau
) {
  const labels = {
    ATTENTION: 'Attention',
    SUSPECTE: 'Suspecte',
    CRITIQUE: 'Critique',
  };

  return (
    labels[niveau] ||
    niveau ||
    '—'
  );
}


function getNiveauClasses(
  niveau
) {
  if (
    niveau === 'CRITIQUE'
  ) {
    return (
      'border-[var(--jr-err-bordure)] bg-[var(--jr-err-pale)] text-jr-err'
    );
  }

  if (
    niveau === 'SUSPECTE'
  ) {
    return (
      'border-[var(--jr-elec)] bg-[var(--jr-elec-pale)] text-jr-attention'
    );
  }

  return (
    'border-[var(--jr-elec-anneau)] bg-[var(--jr-elec-pale)] text-jr-attention'
  );
}


function getStatutLabel(
  statut
) {
  const labels = {
    NOUVELLE: 'Nouvelle',
    EN_COURS: 'En cours',
    VERIFIEE: 'Vérifiée',
    RESOLUE: 'Résolue',
  };

  return (
    labels[statut] ||
    statut ||
    '—'
  );
}


function getStatutClasses(
  statut
) {
  if (
    statut === 'NOUVELLE'
  ) {
    return (
      'border-[var(--jr-err-bordure)] bg-[var(--jr-err-pale)] text-jr-err'
    );
  }

  if (
    statut === 'EN_COURS'
  ) {
    return (
      'border-[var(--jr-eau-clair)] bg-[var(--jr-eau-pale)] text-jr-lien'
    );
  }

  if (
    statut === 'VERIFIEE'
  ) {
    return (
      'border-[var(--jr-bordure-forte)] bg-jr-champ text-jr-doux'
    );
  }

  return (
    'border-[var(--jr-ok)] bg-[var(--jr-ok-pale)] text-jr-ok'
  );
}


/* =========================================================
   BADGE
========================================================= */

function Badge({
  children,
  className,
}) {
  return (
    <span className={`
        inline-flex
        rounded-full
        border
        px-2.5
        py-1
        text-xs
        font-semibold
        ${className}
      `}
    >
      {children}
    </span>
  );
}


/* =========================================================
   KPI
========================================================= */

function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconBg,
  iconColor,
}) {
  return (
    <div className="rounded-lg border border-jr-bordure jr-verre p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-jr-faible">
            {title}
          </p>

          <p className="mt-2 text-3xl font-bold text-jr-texte">
            {formatNumber(
              value
            )}
          </p>

          <p className="mt-2 text-xs text-jr-faible">
            {subtitle}
          </p>
        </div>

        <div className={`
            rounded-lg
            p-3
            ${iconBg}
          `}
        >
          <Icon
            size={22}
            className={
              iconColor
            }
          />
        </div>
      </div>
    </div>
  );
}


/* =========================================================
   TOAST (message temporaire)
   - glisse depuis la droite (jr-toast), icône qui « pop »
   - se ferme seul, avec une barre de progression
   - le temps se met en pause au survol ou au focus clavier
========================================================= */

function Toast({
  genre,
  titre,
  message,
  duree = 6000,
  onClose,
}) {
  const erreur = genre === 'erreur';
  const Icone = erreur ? AlertCircle : CheckCircle2;
  const couleur = erreur ? 'var(--jr-err)' : 'var(--jr-ok)';

  const [pause, setPause] = useState(false);
  const reste = useRef(duree);
  const debut = useRef(0);
  const fermer = useRef(onClose);

  fermer.current = onClose;

  useEffect(() => {
    if (pause) {
      return undefined;
    }

    debut.current = Date.now();

    const minuteur = setTimeout(() => {
      fermer.current?.();
    }, reste.current);

    return () => {
      clearTimeout(minuteur);

      reste.current = Math.max(
        0,
        reste.current - (Date.now() - debut.current)
      );
    };
  }, [pause]);

  return (
    <div
      role={erreur ? 'alert' : 'status'}
      aria-live={erreur ? 'assertive' : 'polite'}
      onMouseEnter={() => setPause(true)}
      onMouseLeave={() => setPause(false)}
      onFocus={() => setPause(true)}
      onBlur={() => setPause(false)}
      className="jr-toast jr-verre-fort pointer-events-auto relative overflow-hidden rounded-md border border-jr-bordure py-3 pl-3 pr-2 shadow-lg"
      style={{ borderLeft: `4px solid ${couleur}` }}
    >
      <div className="flex items-start gap-3">
        <span
          className={`jr-pop mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
            erreur
              ? 'bg-[var(--jr-err-pale)] text-jr-err'
              : 'bg-[var(--jr-ok-pale)] text-jr-ok'
          }`}
        >
          <Icone
            size={18}
            aria-hidden="true"
          />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-jr-titre">
            {titre}
          </p>

          <p className="mt-0.5 break-words text-sm text-jr-doux">
            {message}
          </p>
        </div>

        <button
          type="button"
          onClick={() => onClose?.()}
          aria-label="Fermer le message"
          className="rounded p-1 text-jr-faible transition-colors hover:bg-[var(--jr-eau-pale)] hover:text-jr-texte motion-reduce:transition-none"
        >
          <X
            size={16}
            aria-hidden="true"
          />
        </button>
      </div>

      <span
        aria-hidden="true"
        className="jr-progression absolute bottom-0 left-0 h-0.5"
        style={{
          backgroundColor: couleur,
          animationDuration: `${duree}ms`,
          animationPlayState: pause ? 'paused' : 'running',
        }}
      />
    </div>
  );
}


/* =========================================================
   PAGE
========================================================= */

function AnomaliesPage() {
  const navigate =
    useNavigate();

  const [
    sidebarOpen,
    setSidebarOpen,
  ] = useState(false);

  const [
    user,
    setUser,
  ] = useState(null);

  /* FILTRES */

  const [
    dateDebut,
    setDateDebut,
  ] = useState(
    getMonthsAgo(12)
  );

  const [
    dateFin,
    setDateFin,
  ] = useState(
    getToday()
  );

  const [
    type,
    setType,
  ] = useState('');

  const [
    niveau,
    setNiveau,
  ] = useState('');

  const [
    statut,
    setStatut,
  ] = useState('');

  const [
    recherche,
    setRecherche,
  ] = useState('');

  /* DONNÉES */

  const [
    anomalies,
    setAnomalies,
  ] = useState([]);

  const [
    stats,
    setStats,
  ] = useState({
    total: 0,

    parNiveau: {
      ATTENTION: 0,
      SUSPECTE: 0,
      CRITIQUE: 0,
    },

    parStatut: {
      NOUVELLE: 0,
      EN_COURS: 0,
      VERIFIEE: 0,
      RESOLUE: 0,
    },

    parType: {
      EAU: 0,
      ELECTRICITE: 0,
    },
  });

  /* ÉTATS */

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    analysing,
    setAnalysing,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState('');

  const [
    success,
    setSuccess,
  ] = useState('');

  /* MODAL */

  const [
    selected,
    setSelected,
  ] = useState(null);

  const [
    selectedStatut,
    setSelectedStatut,
  ] = useState(
    'NOUVELLE'
  );

  const [
    commentaire,
    setCommentaire,
  ] = useState('');

  const [
    saving,
    setSaving,
  ] = useState(false);


  /* =======================================================
     UTILISATEUR
  ======================================================= */

  useEffect(() => {
    const token =
      localStorage.getItem(
        'token'
      );

    const storedUser =
      localStorage.getItem(
        'user'
      );

    if (
      !token ||
      !storedUser
    ) {
      navigate(
        '/',
        {
          replace: true,
        }
      );

      return;
    }

    try {
      const parsed =
        JSON.parse(
          storedUser
        );

      if (
        ![
          'ADMINISTRATEUR',
          'AGENT',
          'RESPONSABLE',
        ].includes(
          parsed.role
        )
      ) {
        navigate(
          '/',
          {
            replace: true,
          }
        );

        return;
      }

      setUser(
        parsed
      );
    } catch (storageError) {
      console.error(
        'Erreur utilisateur :',
        storageError
      );

      localStorage.removeItem(
        'token'
      );

      localStorage.removeItem(
        'user'
      );

      navigate(
        '/',
        {
          replace: true,
        }
      );
    }
  }, [
    navigate,
  ]);


  /* =======================================================
     DÉCONNEXION
  ======================================================= */

  const handleLogout =
    () => {
      localStorage.removeItem(
        'token'
      );

      localStorage.removeItem(
        'user'
      );

      navigate(
        '/',
        {
          replace: true,
        }
      );
    };


  /* =======================================================
     CHARGER ANOMALIES
  ======================================================= */

  const loadAnomalies =
    useCallback(
      async () => {
        setLoading(true);

        setError('');

        try {
          const response =
            await axiosClient.get(
              '/anomalies',
              {
                params: {
                  date_debut:
                    dateDebut ||
                    undefined,

                  date_fin:
                    dateFin ||
                    undefined,

                  type:
                    type ||
                    undefined,

                  niveau:
                    niveau ||
                    undefined,

                  statut:
                    statut ||
                    undefined,

                  recherche:
                    recherche.trim() ||
                    undefined,

                  limite: 500,
                },
              }
            );

          if (
            response.data?.status !==
            'success'
          ) {
            throw new Error(
              response.data?.message ||
                'Impossible de charger les anomalies.'
            );
          }

          setAnomalies(
            response.data?.anomalies ||
              []
          );
        } catch (requestError) {
          console.error(
            'Erreur chargement anomalies :',
            requestError
          );

          setAnomalies(
            []
          );

          setError(
            requestError.response?.data?.message ||
              requestError.message ||
              'Impossible de charger les anomalies.'
          );
        } finally {
          setLoading(false);
        }
      },
      [
        dateDebut,
        dateFin,
        type,
        niveau,
        statut,
        recherche,
      ]
    );


  /* =======================================================
     CHARGER STATISTIQUES
  ======================================================= */

  const loadStats =
    useCallback(
      async () => {
        try {
          const response =
            await axiosClient.get(
              '/anomalies/stats'
            );

          if (
            response.data?.status !==
            'success'
          ) {
            throw new Error(
              response.data?.message ||
                'Impossible de récupérer les statistiques.'
            );
          }

          setStats({
            total:
              toNumber(
                response.data.total
              ),

            parNiveau: {
              ATTENTION:
                toNumber(
                  response.data
                    ?.parNiveau
                    ?.ATTENTION
                ),

              SUSPECTE:
                toNumber(
                  response.data
                    ?.parNiveau
                    ?.SUSPECTE
                ),

              CRITIQUE:
                toNumber(
                  response.data
                    ?.parNiveau
                    ?.CRITIQUE
                ),
            },

            parStatut: {
              NOUVELLE:
                toNumber(
                  response.data
                    ?.parStatut
                    ?.NOUVELLE
                ),

              EN_COURS:
                toNumber(
                  response.data
                    ?.parStatut
                    ?.EN_COURS
                ),

              VERIFIEE:
                toNumber(
                  response.data
                    ?.parStatut
                    ?.VERIFIEE
                ),

              RESOLUE:
                toNumber(
                  response.data
                    ?.parStatut
                    ?.RESOLUE
                ),
            },

            parType: {
              EAU:
                toNumber(
                  response.data
                    ?.parType
                    ?.EAU
                ),

              ELECTRICITE:
                toNumber(
                  response.data
                    ?.parType
                    ?.ELECTRICITE
                ),
            },
          });
        } catch (requestError) {
          console.error(
            'Erreur statistiques anomalies :',
            requestError
          );

          throw requestError;
        }
      },
      []
    );


  /* =======================================================
     CHARGEMENT INITIAL
  ======================================================= */

  useEffect(() => {
    if (!user) {
      return;
    }

    const run =
      async () => {
        try {
          await Promise.all([
            loadAnomalies(),
            loadStats(),
          ]);
        } catch (requestError) {
          setError(
            requestError.response?.data
              ?.message ||
              requestError.message ||
              'Erreur lors du chargement du module.'
          );
        }
      };

    run();
  }, [
    user,
    loadAnomalies,
    loadStats,
  ]);


  /* =======================================================
     ANALYSE
  ======================================================= */

  const handleAnalyse =
    async () => {
      setAnalysing(
        true
      );

      setError('');

      setSuccess('');

      try {
        const response =
          await axiosClient.post(
            '/anomalies/analyser'
          );

        if (
          response.data?.status !==
          'success'
        ) {
          throw new Error(
            response.data?.message ||
              'L’analyse a échoué.'
          );
        }

        setSuccess(
          `${toNumber(
            response.data.totalDetectees
          )} anomalie(s) détectée(s).`
        );

        await Promise.all([
          loadAnomalies(),
          loadStats(),
        ]);
      } catch (requestError) {
        console.error(
          'Erreur analyse :',
          requestError
        );

        setError(
          requestError.response?.data
            ?.message ||
            requestError.message ||
            'Impossible d’analyser les consommations.'
        );
      } finally {
        setAnalysing(
          false
        );
      }
    };


  /* =======================================================
     DÉTAIL
  ======================================================= */

  const openDetail =
    (anomalie) => {
      setSelected(
        anomalie
      );

      setSelectedStatut(
        anomalie.statut ||
          'NOUVELLE'
      );

      setCommentaire(
        anomalie.commentaire ||
          ''
      );
    };


  const closeDetail =
    () => {
      if (saving) {
        return;
      }

      setSelected(
        null
      );

      setSelectedStatut(
        'NOUVELLE'
      );

      setCommentaire('');
    };


  /* =======================================================
     ENREGISTRER TRAITEMENT
  ======================================================= */

  const handleSave =
    async () => {
      if (!selected) {
        return;
      }

      setSaving(
        true
      );

      setError('');

      setSuccess('');

      try {
        const response =
          await axiosClient.patch(
            `/anomalies/${selected.id}/statut`,
            {
              statut:
                selectedStatut,

              commentaire:
                commentaire.trim() ||
                null,
            }
          );

        if (
          response.data?.status !==
          'success'
        ) {
          throw new Error(
            response.data?.message ||
              'Impossible de mettre à jour le statut.'
          );
        }

        setSuccess(
          'Le traitement de l’anomalie a été enregistré.'
        );

        closeDetail();

        await Promise.all([
          loadAnomalies(),
          loadStats(),
        ]);
      } catch (requestError) {
        console.error(
          'Erreur mise à jour anomalie :',
          requestError
        );

        setError(
          requestError.response?.data
            ?.message ||
            requestError.message ||
            'Impossible de mettre à jour le statut.'
        );
      } finally {
        setSaving(
          false
        );
      }
    };


  /* =======================================================
     SYNTHÈSE
  ======================================================= */

  const summary =
    useMemo(
      () => {
        const total =
          anomalies.length;

        const critiques =
          anomalies.filter(
            (item) =>
              item.niveau ===
              'CRITIQUE'
          ).length;

        const hausses =
          anomalies.filter(
            (item) =>
              toNumber(
                item.variation
              ) >= 0
          ).length;

        const baisses =
          anomalies.filter(
            (item) =>
              toNumber(
                item.variation
              ) < 0
          ).length;

        return {
          total,
          critiques,
          hausses,
          baisses,
        };
      },
      [anomalies]
    );


  /* =======================================================
     CHARGEMENT
  ======================================================= */

  if (!user) {
    return (
      <AdminShell intensite="calme"><div className="flex min-h-screen items-center justify-center p-4">
        <div className="jr-verre flex items-center gap-3 rounded-lg border border-jr-bordure px-6 py-5 text-sm text-jr-doux shadow-sm">
          <Loader2
            size={18}
            className="animate-spin text-jr-lien"
          />

          Chargement du module des anomalies...
        </div>
      </div></AdminShell>
    );
  }


  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <AdminShell intensite="calme" className="selection:bg-[var(--jr-elec)] selection:text-[var(--jr-sur-elec)]">
      <Sidebar
        isOpen={
          sidebarOpen
        }

        onClose={() =>
          setSidebarOpen(
            false
          )
        }

        activePath="/dashboard/admin/anomalies"

        onNavigate={
          navigate
        }

        onLogout={
          handleLogout
        }

        user={
          user
        }
      />

      <div className="lg:pl-72">
        <Header
          onOpenSidebar={() =>
            setSidebarOpen(
              true
            )
          }

          onProfile={() =>
            navigate(
              '/dashboard/admin'
            )
          }

          user={
            user
          }
        />

        <main className="p-4 sm:p-6 lg:p-8">

          {/* =================================================
              EN-TÊTE
          ================================================= */}

          <div className="jr-entree mb-7 flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
            <div>
              <div className="flex items-center gap-2 text-sm text-jr-faible">
                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      '/dashboard/admin'
                    )
                  }
                  className="inline-flex items-center gap-1 font-medium text-jr-lien hover:text-jr-lien">
                  <ArrowLeft
                    size={15}
                  />

                  Dashboard
                </button>

                <span>
                  /
                </span>

                <span>
                  Anomalies
                </span>
              </div>

              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-jr-titre sm:text-4xl">
                Détection et suivi des anomalies
              </h1>

              <p className="mt-1.5 max-w-xl text-sm text-jr-doux">
                Analyse automatique des consommations
                d’eau et d’électricité à partir des relevés
                réels.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  Promise.all([
                    loadAnomalies(),
                    loadStats(),
                  ])
                }
                disabled={
                  loading ||
                  analysing
                }
                className="inline-flex items-center gap-2 rounded-md border border-jr-bordure jr-verre px-4 py-2.5 text-sm font-semibold text-jr-doux shadow-sm hover:bg-[var(--jr-eau-pale)] disabled:cursor-not-allowed disabled:opacity-60">
                <RefreshCw
                  size={17}
                  className={
                    loading
                      ? 'animate-spin'
                      : ''
                  }
                />

                Actualiser
              </button>

              <button
                type="button"
                onClick={
                  handleAnalyse
                }
                disabled={
                  analysing
                }
                className="inline-flex items-center gap-2 rounded-md jr-btn jr-btn-elec px-4 py-2.5 text-sm font-semibold shadow-sm disabled:cursor-not-allowed disabled:opacity-60">
                {analysing ? (
                  <Loader2
                    size={17}
                    className="animate-spin"
                  />
                ) : (
                  <AlertTriangle
                    size={17}
                  />
                )}

                {analysing
                  ? 'Analyse...'
                  : 'Analyser les relevés'}
              </button>
            </div>
          </div>


          {/* Les messages d’erreur et de succès s’affichent en toasts (voir la fin de la page) */}


{/* =================================================
              KPI
          ================================================= */}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              title="Total anomalies"
              value={
                stats.total
              }
              subtitle="
                Toutes anomalies détectées
              "
              icon={
                AlertTriangle
              }
              iconBg="
                bg-[var(--jr-err-pale)]
              "
              iconColor="
                text-jr-err
              "
            />

            <KpiCard
              title="Critiques"
              value={
                stats.parNiveau
                  .CRITIQUE
              }
              subtitle="
                Écart supérieur ou égal à 100 %
              "
              icon={
                AlertCircle
              }
              iconBg="
                bg-[var(--jr-err-pale)]
              "
              iconColor="
                text-jr-err
              "
            />

            <KpiCard
              title="En cours"
              value={
                stats.parStatut
                  .EN_COURS
              }
              subtitle="
                Anomalies en traitement
              "
              icon={
                Clock3
              }
              iconBg="
                bg-[var(--jr-eau-pale)]
              "
              iconColor="
                text-jr-lien
              "
            />

            <KpiCard
              title="Résolues"
              value={
                stats.parStatut
                  .RESOLUE
              }
              subtitle="
                Anomalies traitées
              "
              icon={
                CheckCircle2
              }
              iconBg="
                bg-[var(--jr-ok-pale)]
              "
              iconColor="
                text-jr-ok
              "
            />
          </div>


          {/* =================================================
              RÉPARTITION RAPIDE
          ================================================= */}

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="jr-carte-eau rounded-lg p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-[var(--jr-eau-pale)] p-2.5">
                  <Droplets
                    size={19}
                    className="text-jr-lien"
                  />
                </div>

                <div>
                  <p className="font-semibold text-jr-texte">
                    Eau
                  </p>

                  <p className="text-xs text-jr-faible">
                    Anomalies
                  </p>
                </div>

                <strong className="ml-auto text-2xl text-jr-texte">
                  {formatNumber(
                    stats.parType
                      .EAU
                  )}
                </strong>
              </div>
            </div>

            <div className="jr-carte-elec rounded-lg p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-[var(--jr-elec-pale)] p-2.5">
                  <Zap
                    size={19}
                    className="text-jr-elec"
                  />
                </div>

                <div>
                  <p className="font-semibold text-jr-texte">
                    Électricité
                  </p>

                  <p className="text-xs text-jr-faible">
                    Anomalies
                  </p>
                </div>

                <strong className="ml-auto text-2xl text-jr-texte">
                  {formatNumber(
                    stats.parType
                      .ELECTRICITE
                  )}
                </strong>
              </div>
            </div>

            <div className="rounded-lg border border-jr-bordure jr-verre p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-jr-bordure p-2.5">
                  <Filter
                    size={19}
                    className="text-jr-doux"
                  />
                </div>

                <div>
                  <p className="font-semibold text-jr-texte">
                    Résultats
                  </p>

                  <p className="text-xs text-jr-faible">
                    Après filtrage
                  </p>
                </div>

                <strong className="ml-auto text-2xl text-jr-texte">
                  {formatNumber(
                    summary.total
                  )}
                </strong>
              </div>
            </div>
          </div>


          {/* =================================================
              FILTRES
          ================================================= */}

          <section className="mt-6 rounded-lg border border-jr-bordure jr-verre p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Filter
                size={18}
                className="text-jr-lien"
              />

              <h2 className="font-bold text-jr-titre">
                Filtres d’analyse
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <label>
                <span className="mb-2 block text-xs font-semibold text-jr-doux">
                  Date début
                </span>

                <div className="relative">
                  <CalendarDays
                    size={16}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-jr-faible"
                  />

                  <input
                    type="date"
                    value={
                      dateDebut
                    }
                    onChange={(
                      event
                    ) =>
                      setDateDebut(
                        event.target.value
                      )
                    }
                    className="w-full rounded-md border px-3 py-2.5 pl-10 text-sm outline-none jr-field"
                  />
                </div>
              </label>


              <label>
                <span className="mb-2 block text-xs font-semibold text-jr-doux">
                  Date fin
                </span>

                <div className="relative">
                  <CalendarDays
                    size={16}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-jr-faible"
                  />

                  <input
                    type="date"
                    value={
                      dateFin
                    }
                    onChange={(
                      event
                    ) =>
                      setDateFin(
                        event.target.value
                      )
                    }
                    className="w-full rounded-md border px-3 py-2.5 pl-10 text-sm outline-none jr-field"
                  />
                </div>
              </label>


              <label>
                <span className="mb-2 block text-xs font-semibold text-jr-doux">
                  Type
                </span>

                <select
                  value={
                    type
                  }
                  onChange={(
                    event
                  ) =>
                    setType(
                      event.target.value
                    )
                  }
                  className="w-full rounded-md border px-3 py-2.5 text-sm outline-none jr-field">
                  <option value="">
                    Tous les types
                  </option>

                  <option value="EAU">
                    Eau
                  </option>

                  <option value="ELECTRICITE">
                    Électricité
                  </option>
                </select>
              </label>


              <label>
                <span className="mb-2 block text-xs font-semibold text-jr-doux">
                  Niveau
                </span>

                <select
                  value={
                    niveau
                  }
                  onChange={(
                    event
                  ) =>
                    setNiveau(
                      event.target.value
                    )
                  }
                  className="w-full rounded-md border px-3 py-2.5 text-sm outline-none jr-field">
                  <option value="">
                    Tous les niveaux
                  </option>

                  <option value="ATTENTION">
                    Attention
                  </option>

                  <option value="SUSPECTE">
                    Suspecte
                  </option>

                  <option value="CRITIQUE">
                    Critique
                  </option>
                </select>
              </label>


              <label>
                <span className="mb-2 block text-xs font-semibold text-jr-doux">
                  Statut
                </span>

                <select
                  value={
                    statut
                  }
                  onChange={(
                    event
                  ) =>
                    setStatut(
                      event.target.value
                    )
                  }
                  className="w-full rounded-md border px-3 py-2.5 text-sm outline-none jr-field">
                  <option value="">
                    Tous les statuts
                  </option>

                  <option value="NOUVELLE">
                    Nouvelle
                  </option>

                  <option value="EN_COURS">
                    En cours
                  </option>

                  <option value="VERIFIEE">
                    Vérifiée
                  </option>

                  <option value="RESOLUE">
                    Résolue
                  </option>
                </select>
              </label>


              <label>
                <span className="mb-2 block text-xs font-semibold text-jr-doux">
                  Recherche
                </span>

                <div className="relative">
                  <Search
                    size={16}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-jr-faible"
                  />

                  <input
                    type="text"
                    value={
                      recherche
                    }
                    onChange={(
                      event
                    ) =>
                      setRecherche(
                        event.target.value
                      )
                    }
                    onKeyDown={(
                      event
                    ) => {
                      if (
                        event.key ===
                        'Enter'
                      ) {
                        loadAnomalies();
                      }
                    }}
                    placeholder="
                      Compteur ou abonné...
                    "
                    className="w-full rounded-md border px-3 py-2.5 pl-10 text-sm outline-none jr-field"
                  />
                </div>
              </label>
            </div>
          </section>


          {/* =================================================
              RÉSUMÉ FILTRAGE
          ================================================= */}

          <div className="mt-4 flex flex-col gap-2 text-xs text-jr-faible sm:flex-row sm:items-center sm:justify-between">
            <p>
              {summary.total} anomalie(s)
              affichée(s) ·{' '}
              {summary.critiques} critique(s)
              ·{' '}
              {summary.hausses} hausse(s)
              ·{' '}
              {summary.baisses} baisse(s)
            </p>

            <p>
              Référence :
              moyenne des 3 relevés précédents
            </p>
          </div>


          {/* =================================================
              TABLEAU
          ================================================= */}

          <section className="mt-3 overflow-hidden rounded-lg border border-jr-bordure jr-verre shadow-sm">
            {loading ? (
<div role="status" aria-live="polite" className="space-y-3 p-5">
{Array.from({ length: 6 }).map((_, index) => (
<div key={index} className="jr-shimmer h-12 rounded-md" />
))}
<span className="sr-only">Chargement des anomalies...</span>
</div>
) : anomalies.length ===
              0 ? (
              <div className="flex min-h-[320px] flex-col items-center justify-center px-6 text-center">
                <div className="rounded-lg bg-[var(--jr-ok-pale)] p-4">
                  <CheckCircle2
                    size={34}
                    className="text-jr-ok"
                  />
                </div>

                <h3 className="mt-4 text-lg font-bold text-jr-titre">
                  Aucune anomalie détectée
                </h3>

                <p className="mt-1 max-w-md text-sm text-jr-faible">
                  Aucun relevé ne présente
                  actuellement un écart supérieur
                  au seuil défini.
                </p>

                <button
                  type="button"
                  onClick={
                    handleAnalyse
                  }
                  disabled={
                    analysing
                  }
                  className="mt-5 inline-flex items-center gap-2 rounded-md jr-btn jr-btn-elec px-4 py-2.5 text-sm font-semibold disabled:opacity-60">
                  <RefreshCw
                    size={16}
                    className={
                      analysing
                        ? 'animate-spin'
                        : ''
                    }
                  />

                  Relancer l’analyse
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-[1200px] w-full text-left">
                  <thead className="jr-thead border-b border-jr-bordure">
                    <tr className="text-xs uppercase tracking-wider text-jr-faible">
                      <th className="px-5 py-4 font-semibold">
                        Date
                      </th>

                      <th className="px-5 py-4 font-semibold">
                        Compteur
                      </th>

                      <th className="px-5 py-4 font-semibold">
                        Abonné
                      </th>

                      <th className="px-5 py-4 font-semibold">
                        Consommation
                      </th>

                      <th className="px-5 py-4 font-semibold">
                        Référence
                      </th>

                      <th className="px-5 py-4 font-semibold">
                        Variation
                      </th>

                      <th className="px-5 py-4 font-semibold">
                        Niveau
                      </th>

                      <th className="px-5 py-4 font-semibold">
                        Statut
                      </th>

                      <th className="px-5 py-4 text-right font-semibold">
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-jr-bordure">
                    {anomalies.map(
                      (anomalie) => {
                        const isEau =
                          String(
                            anomalie
                              .type_compteur ||
                              ''
                          ).toUpperCase() ===
                          'EAU';

                        const isHausse =
                          toNumber(
                            anomalie
                              .variation
                          ) >= 0;

                        return (
                          <tr
                            key={
                              anomalie.id
                            }
                            className="transition hover:bg-[var(--jr-eau-pale)] motion-reduce:transition-none">
                            {/* DATE */}

                            <td className="px-5 py-4">
                              <p className="font-semibold text-jr-texte">
                                {formatDate(
                                  anomalie
                                    .date_releve
                                )}
                              </p>

                              <p className="mt-1 text-xs text-jr-faible">
                                {anomalie
                                  .type_anomalie ===
                                'SURCONSOMMATION'
                                  ? 'Surconsommation'
                                  : 'Sous-consommation'}
                              </p>
                            </td>


                            {/* COMPTEUR */}

                            <td className="px-5 py-4">
                              <div className="flex items-center gap-2">
                                <div className={`
                                    rounded-lg
                                    p-2
                                    ${
                                      isEau
                                        ? 'bg-[var(--jr-eau-pale)]'
                                        : 'bg-[var(--jr-elec-pale)]'
                                    }
                                  `}
                                >
                                  {isEau ? (
                                    <Droplets
                                      size={16}
                                      className="text-jr-lien"
                                    />
                                  ) : (
                                    <Zap
                                      size={16}
                                      className="text-jr-elec"
                                    />
                                  )}
                                </div>

                                <div>
                                  <p className="font-semibold text-jr-texte">
                                    {anomalie
                                      .numero_compteur ||
                                      '—'}
                                  </p>

                                  <p className="text-xs text-jr-faible">
                                    {getTypeLabel(
                                      anomalie
                                        .type_compteur
                                    )}
                                  </p>
                                </div>
                              </div>
                            </td>


                            {/* ABONNÉ */}

                            <td className="px-5 py-4">
                              <div className="flex items-center gap-2">
                                <UserRound
                                  size={16}
                                  className="text-jr-faible"
                                />

                                <div>
                                  <p className="font-medium text-jr-texte">
                                    {anomalie
                                      .abonne_nom_complet ||
                                      '—'}
                                  </p>

                                  <p className="text-xs text-jr-faible">
                                    {anomalie
                                      .numero_abonne ||
                                      '—'}
                                  </p>
                                </div>
                              </div>
                            </td>


                            {/* CONSOMMATION */}

                            <td className="px-5 py-4">
                              <p className="font-bold text-jr-texte">
                                {formatNumber(
                                  anomalie.valeur
                                )}{' '}
                                {getUnite(
                                  anomalie
                                    .type_compteur
                                )}
                              </p>
                            </td>


                            {/* RÉFÉRENCE */}

                            <td className="px-5 py-4">
                              <p className="font-medium text-jr-doux">
                                {formatNumber(
                                  anomalie
                                    .valeur_reference
                                )}{' '}
                                {getUnite(
                                  anomalie
                                    .type_compteur
                                )}
                              </p>

                              <p className="mt-1 text-xs text-jr-faible">
                                3 relevés précédents
                              </p>
                            </td>


                            {/* VARIATION */}

                            <td className="px-5 py-4">
                              <div className={`
                                  inline-flex
                                  items-center
                                  gap-1.5
                                  font-bold
                                  ${
                                    isHausse
                                      ? 'text-jr-err'
                                      : 'text-jr-lien'
                                  }
                                `}
                              >
                                {isHausse ? (
                                  <ArrowUpRight
                                    size={17}
                                  />
                                ) : (
                                  <ArrowDownRight
                                    size={17}
                                  />
                                )}

                                {formatVariation(
                                  anomalie
                                    .variation
                                )}
                              </div>
                            </td>


                            {/* NIVEAU */}

                            <td className="px-5 py-4">
                              <Badge className={
                                  getNiveauClasses(
                                    anomalie
                                      .niveau
                                  )
                                }
                              >
                                {getNiveauLabel(
                                  anomalie
                                    .niveau
                                )}
                              </Badge>
                            </td>


                            {/* STATUT */}

                            <td className="px-5 py-4">
                              <Badge className={
                                  getStatutClasses(
                                    anomalie
                                      .statut
                                  )
                                }
                              >
                                {getStatutLabel(
                                  anomalie
                                    .statut
                                )}
                              </Badge>
                            </td>


                            {/* ACTION */}

                            <td className="px-5 py-4 text-right">
                              <button
                                type="button"
                                onClick={() =>
                                  openDetail(
                                    anomalie
                                  )
                                }
                                className="inline-flex items-center gap-2 rounded-md border border-jr-bordure jr-verre px-3 py-2 text-xs font-semibold text-jr-doux hover:border-[var(--jr-eau-clair)] hover:bg-[var(--jr-eau-pale)] hover:text-jr-lien">
                                <Eye
                                  size={15}
                                />

                                Détails
                              </button>
                            </td>
                          </tr>
                        );
                      }
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>


          {/* =================================================
              MODAL DÉTAIL
          ================================================= */}

          {selected && (
            <div role="dialog" aria-modal="true" className="fixed inset-0 z-[100] flex items-center justify-center jr-entree p-4 backdrop-blur-sm" style={{ backgroundColor: 'color-mix(in srgb, var(--jr-eau-fonce) 55%, transparent)' }}>
              <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-lg jr-verre-fort shadow-2xl">

                {/* HEADER MODAL */}

                <div className="sticky top-0 z-10 flex items-start justify-between border-b border-jr-bordure jr-verre-fort p-5 sm:p-6">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-jr-lien">
                      Anomalie #{selected.id}
                    </p>

                    <h2 className="mt-1 text-xl font-bold text-jr-titre">
                      {selected
                        .numero_compteur ||
                        'Compteur'}
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={
                      closeDetail
                    }
                    disabled={
                      saving
                    }
                    className="rounded-md p-2 text-jr-faible hover:bg-[var(--jr-eau-pale)] hover:text-jr-texte">
                    <X
                      size={20}
                    />
                  </button>
                </div>


                {/* CONTENU */}

                <div className="space-y-5 p-5 sm:p-6">

                  {/* Informations principales */}

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="rounded-lg border border-jr-bordure bg-jr-champ p-4">
                      <p className="text-xs font-semibold text-jr-faible">
                        Date du relevé
                      </p>

                      <p className="mt-2 font-bold text-jr-texte">
                        {formatDate(
                          selected.date_releve
                        )}
                      </p>
                    </div>


                    <div className="rounded-lg border border-jr-bordure bg-jr-champ p-4">
                      <p className="text-xs font-semibold text-jr-faible">
                        Consommation
                      </p>

                      <p className="mt-2 font-bold text-jr-texte">
                        {formatNumber(
                          selected.valeur
                        )}{' '}
                        {getUnite(
                          selected.type_compteur
                        )}
                      </p>
                    </div>


                    <div className="rounded-lg border border-jr-bordure bg-jr-champ p-4">
                      <p className="text-xs font-semibold text-jr-faible">
                        Référence
                      </p>

                      <p className="mt-2 font-bold text-jr-texte">
                        {formatNumber(
                          selected.valeur_reference
                        )}{' '}
                        {getUnite(
                          selected.type_compteur
                        )}
                      </p>
                    </div>
                  </div>


                  {/* Variation / niveau */}

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="rounded-lg border border-jr-bordure p-5">
                      <p className="text-xs font-semibold uppercase tracking-wider text-jr-faible">
                        Variation
                      </p>

                      <p className={`
                          mt-2
                          text-3xl
                          font-bold
                          ${
                            toNumber(
                              selected.variation
                            ) >= 0
                              ? 'text-jr-err'
                              : 'text-jr-lien'
                          }
                        `}
                      >
                        {formatVariation(
                          selected.variation
                        )}
                      </p>
                    </div>


                    <div className="rounded-lg border border-jr-bordure p-5">
                      <p className="text-xs font-semibold uppercase tracking-wider text-jr-faible">
                        Niveau
                      </p>

                      <div className="mt-3">
                        <Badge className={
                            getNiveauClasses(
                              selected.niveau
                            )
                          }
                        >
                          {getNiveauLabel(
                            selected.niveau
                          )}
                        </Badge>
                      </div>
                    </div>
                  </div>


                  {/* Compteur / abonné */}

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="rounded-lg border border-jr-bordure p-5">
                      <div className="flex items-center gap-3">
                        <div className="rounded-md bg-[var(--jr-eau-pale)] p-2.5">
                          <Gauge
                            size={19}
                            className="text-jr-lien"
                          />
                        </div>

                        <div>
                          <p className="text-xs font-semibold text-jr-faible">
                            Compteur
                          </p>

                          <p className="mt-1 font-bold text-jr-texte">
                            {selected
                              .numero_compteur ||
                              '—'}
                          </p>

                          <p className="mt-1 text-xs text-jr-faible">
                            {getTypeLabel(
                              selected.type_compteur
                            )}
                          </p>
                        </div>
                      </div>
                    </div>


                    <div className="rounded-lg border border-jr-bordure p-5">
                      <div className="flex items-center gap-3">
                        <div className="rounded-md bg-jr-bordure p-2.5">
                          <UserRound
                            size={19}
                            className="text-jr-doux"
                          />
                        </div>

                        <div>
                          <p className="text-xs font-semibold text-jr-faible">
                            Abonné
                          </p>

                          <p className="mt-1 font-bold text-jr-texte">
                            {selected
                              .abonne_nom_complet ||
                              '—'}
                          </p>

                          <p className="mt-1 text-xs text-jr-faible">
                            {selected
                              .numero_abonne ||
                              '—'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>


                  {/* Analyse automatique */}

                  <div className="rounded-lg border border-[var(--jr-eau-clair)] bg-[var(--jr-eau-pale)] p-5">
                    <p className="text-xs font-bold uppercase tracking-wider text-jr-lien">
                      Analyse automatique
                    </p>

                    <p className="mt-2 text-sm leading-6 text-jr-titre">
                      {selected.description ||
                        'Variation inhabituelle détectée.'}
                    </p>
                  </div>


                  {/* Traitement */}

                  <div className="rounded-lg border border-jr-bordure p-5">
                    <h3 className="font-bold text-jr-titre">
                      Traitement de l’anomalie
                    </h3>


                    <label className="mt-4 block">
                      <span className="mb-2 block text-xs font-semibold text-jr-doux">
                        Statut
                      </span>

                      <select
                        value={
                          selectedStatut
                        }
                        onChange={(
                          event
                        ) =>
                          setSelectedStatut(
                            event.target.value
                          )
                        }
                        className="w-full rounded-md border px-3 py-2.5 text-sm outline-none jr-field">
                        <option value="NOUVELLE">
                          Nouvelle
                        </option>

                        <option value="EN_COURS">
                          En cours
                        </option>

                        <option value="VERIFIEE">
                          Vérifiée
                        </option>

                        <option value="RESOLUE">
                          Résolue
                        </option>
                      </select>
                    </label>


                    <label className="mt-4 block">
                      <span className="mb-2 block text-xs font-semibold text-jr-doux">
                        Commentaire de traitement
                      </span>

                      <textarea
                        rows={4}
                        value={
                          commentaire
                        }
                        onChange={(
                          event
                        ) =>
                          setCommentaire(
                            event.target.value
                          )
                        }
                        placeholder="
                          Décrivez la vérification,
                          l’intervention ou la décision...
                        "
                        className="w-full resize-none rounded-md border px-3 py-3 text-sm outline-none jr-field"
                      />
                    </label>
                  </div>


                  {/* Actions */}

                  <div className="flex flex-col-reverse gap-3 border-t border-jr-bordure pt-5 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={
                        closeDetail
                      }
                      disabled={
                        saving
                      }
                      className="rounded-md border border-jr-bordure jr-verre-fort px-5 py-2.5 text-sm font-semibold text-jr-doux hover:bg-[var(--jr-eau-pale)] disabled:opacity-60">
                      Fermer
                    </button>

                    <button
                      type="button"
                      onClick={
                        handleSave
                      }
                      disabled={
                        saving
                      }
                      className="inline-flex items-center justify-center gap-2 rounded-md jr-btn jr-btn-elec px-5 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60">
                      {saving && (
                        <Loader2
                          size={16}
                          className="animate-spin"
                        />
                      )}

                      Enregistrer
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* =================================================
          TOASTS (en bas à droite)
      ================================================= */}

      <div className="pointer-events-none fixed bottom-4 right-4 z-[120] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2">
        {error && (
          <Toast
            key={`erreur-${error}`}
            genre="erreur"
            titre="Une erreur est survenue"
            message={error}
            duree={8000}
            onClose={() => setError('')}
          />
        )}

        {success && (
          <Toast
            key={`succes-${success}`}
            genre="succes"
            titre="Opération réussie"
            message={success}
            duree={6000}
            onClose={() => setSuccess('')}
          />
        )}
      </div>
    </AdminShell>
  );
}

export default AnomaliesPage;