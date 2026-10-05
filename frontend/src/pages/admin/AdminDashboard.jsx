import {
  useEffect,
  useState,
} from 'react';

import {
  useNavigate,
} from 'react-router-dom';

import {
  UserRound,
  Gauge,
  ClipboardList,
  TriangleAlert,
  CalendarDays,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  RefreshCw,
  Droplets,
  Zap,
  Bell,
} from 'lucide-react';


import Sidebar
  from '../../components/admin/Sidebar.jsx';

import Header
  from '../../components/admin/Header.jsx';

import StatCard
  from '../../components/admin/StatCard.jsx';

import ConsumptionChart
  from '../../components/admin/ConsumptionChart.jsx';

import RecentReadings
  from '../../components/admin/RecentReadings.jsx';

import axiosClient
  from '../../api/axiosClient.js';


/* =========================================================
   FORMATAGE MOIS
========================================================= */

function formatCurrentMonth() {

  const value =
    new Intl.DateTimeFormat(
      'fr-FR',
      {
        month: 'long',
        year: 'numeric',
      }
    ).format(
      new Date()
    );


  return (
    value.charAt(0).toUpperCase() +
    value.slice(1)
  );
}


/* =========================================================
   FORMATAGE LABEL MOIS
========================================================= */

function formatMonthLabel(
  value
) {

  if (
    !value
  ) {

    return '';
  }


  const [
    year,
    month,
  ] =
    String(
      value
    )
      .split(
        '-'
      );


  if (
    !year ||
    !month
  ) {

    return String(
      value
    );
  }


  const date =
    new Date(
      Number(year),
      Number(month) - 1,
      1
    );


  const label =
    new Intl.DateTimeFormat(
      'fr-FR',
      {
        month: 'short',
        year: 'numeric',
      }
    ).format(
      date
    );


  return (
    label.charAt(0).toUpperCase() +
    label.slice(1)
  );
}


/* =========================================================
   FORMATAGE NOMBRE
========================================================= */

function formatNumber(
  value
) {

  return Number(
    value || 0
  ).toLocaleString(
    'fr-FR'
  );
}


/* =========================================================
   DASHBOARD ADMIN
========================================================= */

function AdminDashboard() {

  const navigate =
    useNavigate();


  const [
    sidebarOpen,
    setSidebarOpen,
  ] = useState(
    false
  );


  const [
    user,
    setUser,
  ] = useState(
    null
  );


  const [
    dashboard,
    setDashboard,
  ] = useState(
    null
  );


  const [
    loading,
    setLoading,
  ] = useState(
    true
  );


  const [
    refreshing,
    setRefreshing,
  ] = useState(
    false
  );


  const [
    error,
    setError,
  ] = useState(
    ''
  );


  const [
    notificationCount,
    setNotificationCount,
  ] = useState(
    0
  );


  /* =======================================================
     UTILISATEUR CONNECTÉ
  ======================================================= */

  useEffect(
    () => {

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

        const parsedUser =
          JSON.parse(
            storedUser
          );


        const role =
          String(
            parsedUser?.role ||
            ''
          )
            .trim()
            .toUpperCase();


        if (
          role !==
          'ADMINISTRATEUR'
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
          parsedUser
        );

      } catch (
        parseError
      ) {

        console.error(
          'Erreur lecture utilisateur :',
          parseError
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

    },
    [
      navigate,
    ]
  );


  /* =======================================================
     CHARGEMENT INITIAL
  ======================================================= */

  useEffect(
    () => {

      if (
        !user
      ) {

        return;
      }


      loadDashboard();

      loadNotificationCount();

    },
    [
      user,
    ]
  );


  /* =======================================================
     CHARGER LE DASHBOARD
  ======================================================= */

  const loadDashboard =
    async (
      isRefresh = false
    ) => {

      try {

        setError(
          ''
        );


        if (
          isRefresh
        ) {

          setRefreshing(
            true
          );

        } else {

          setLoading(
            true
          );
        }


        const response =
          await axiosClient.get(
            '/dashboard'
          );


        if (
          response.data?.status !==
          'success'
        ) {

          throw new Error(
            response.data?.message ||
            'Impossible de charger le tableau de bord.'
          );
        }


        setDashboard(
          response.data
        );

      } catch (
        requestError
      ) {

        console.error(
          'Erreur chargement dashboard :',
          requestError
        );


        const status =
          requestError.response?.status;


        if (
          status === 401 ||
          status === 403
        ) {

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


          return;
        }


        setError(

          requestError.response?.data
            ?.message ||

          requestError.message ||

          'Une erreur est survenue lors du chargement du tableau de bord.'

        );

      } finally {

        setLoading(
          false
        );

        setRefreshing(
          false
        );
      }
    };


  /* =======================================================
     CHARGER LES NOTIFICATIONS
  ======================================================= */

  const loadNotificationCount =
    async () => {

      try {

        let response;


        /* -------------------------------------------------
           1. Essayer l'endpoint spécialisé /count
        ------------------------------------------------- */

        try {

          response =
            await axiosClient.get(
              '/notifications/count'
            );


          if (
            response.data?.status ===
            'success'
          ) {

            setNotificationCount(
              Number(
                response.data?.data?.total ||
                0
              )
            );


            return;
          }

        } catch (
          countError
        ) {

          /*
           * Si /count n'existe pas encore,
           * on utilise /notifications.
           */

          if (
            countError.response?.status !==
            404
          ) {

            throw countError;
          }
        }


        /* -------------------------------------------------
           2. Solution de secours
        ------------------------------------------------- */

        response =
          await axiosClient.get(
            '/notifications'
          );


        const notifications =
          Array.isArray(
            response.data?.data
          )
            ? response.data.data
            : [];


        const pendingCount =
          notifications.filter(
            notification =>
              notification.statut ===
              'EN_ATTENTE'
          ).length;


        setNotificationCount(
          pendingCount
        );

      } catch (
        requestError
      ) {

        console.error(
          'Erreur chargement notifications :',
          requestError
        );


        const status =
          requestError.response?.status;


        if (
          status === 401 ||
          status === 403
        ) {

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


          return;
        }


        /*
         * Le dashboard reste utilisable
         * même si les notifications sont
         * momentanément indisponibles.
         */

        setNotificationCount(
          0
        );
      }
    };


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
     CHARGEMENT
  ======================================================= */

  if (
    !user ||
    loading
  ) {

    return (

      <div
        className="
          flex
          min-h-screen
          items-center
          justify-center
          bg-slate-100
          p-6
        "
      >

        <div
          className="
            rounded-2xl
            border
            border-slate-200
            bg-white
            px-6
            py-5
            text-sm
            text-slate-500
            shadow-sm
          "
        >

          Chargement du tableau de bord...

        </div>

      </div>
    );
  }


  /* =======================================================
     VALEURS PAR DÉFAUT
  ======================================================= */

  const stats =
    dashboard?.stats || {

      abonnes:
        0,

      abonnesActifs:
        0,

      compteurs:
        0,

      compteursActifs:
        0,

      releves:
        0,

      relevesMois:
        0,

      anomalies:
        0,

      anomaliesNouvelles:
        0,

      consommationEauMois:
        0,

      consommationElectriciteMois:
        0,
    };


  /* =======================================================
     DONNÉES GRAPHIQUE
  ======================================================= */

  const evolutionData =
    (
      dashboard?.evolution ||
      []
    ).map(
      (
        item
      ) => ({

        ...item,

        mois:
          formatMonthLabel(
            item.mois
          ),

      })
    );


  /* =======================================================
     DERNIERS RELEVÉS
  ======================================================= */

  const derniersReleves =
    dashboard
      ?.derniersReleves ||
    [];


  /* =======================================================
     ANOMALIES
  ======================================================= */

  const anomaliesRecentes =
    dashboard
      ?.anomaliesRecentes ||
    [];


  return (

    <div
      className="
        min-h-screen
        bg-slate-100
      "
    >

      {/* =================================================
          SIDEBAR
      ================================================= */}

      <Sidebar

        isOpen={
          sidebarOpen
        }

        onClose={() =>
          setSidebarOpen(
            false
          )
        }

        activePath=
          "/dashboard/admin"

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


      <div
        className="
          lg:pl-72
        "
      >

        {/* =================================================
            HEADER
        ================================================= */}

        <Header

          onOpenSidebar={() =>
            setSidebarOpen(
              true
            )
          }

          onProfile={() =>
            console.log(
              'Profil administrateur'
            )
          }

          onNotifications={() =>
            navigate(
              '/dashboard/admin/notifications'
            )
          }

          notificationCount={
            notificationCount
          }

          user={
            user
          }

        />


        {/* =================================================
            MAIN
        ================================================= */}

        <main
          className="
            p-4
            sm:p-6
            lg:p-8
          "
        >

          {/* =================================================
              ENTÊTE
          ================================================= */}

          <div
            className="
              mb-7
              flex
              flex-col
              justify-between
              gap-4
              md:flex-row
              md:items-end
            "
          >

            <div>

              <h2
                className="
                  text-2xl
                  font-bold
                  text-slate-900
                "
              >

                Pilotage des consommations

              </h2>


              <p
                className="
                  mt-1
                  text-sm
                  text-slate-500
                "
              >

                Vue réelle du suivi de
                l'eau et de l'électricité.

              </p>

            </div>


            <div
              className="
                flex
                flex-wrap
                items-center
                gap-2
              "
            >

              {/* -------------------------------------------------
                  MOIS
              ------------------------------------------------- */}

              <div
                className="
                  flex
                  items-center
                  gap-2
                  rounded-xl
                  border
                  border-slate-200
                  bg-white
                  px-4
                  py-2.5
                  text-sm
                  text-slate-600
                  shadow-sm
                "
              >

                <CalendarDays
                  size={
                    17
                  }
                />

                <span>
                  {
                    formatCurrentMonth()
                  }
                </span>

              </div>


              {/* -------------------------------------------------
                  ACTUALISER
              ------------------------------------------------- */}

              <button

                type="button"

                onClick={() => {

                  loadDashboard(
                    true
                  );

                  loadNotificationCount();

                }}

                disabled={
                  refreshing
                }

                className="
                  inline-flex
                  items-center
                  gap-2
                  rounded-xl
                  border
                  border-slate-200
                  bg-white
                  px-4
                  py-2.5
                  text-sm
                  font-semibold
                  text-slate-700
                  shadow-sm
                  transition
                  hover:bg-slate-50
                  disabled:cursor-not-allowed
                  disabled:opacity-60
                "
              >

                <RefreshCw

                  size={
                    16
                  }

                  className={
                    refreshing
                      ? 'animate-spin'
                      : ''
                  }

                />

                Actualiser

              </button>


              {/* -------------------------------------------------
                  NOTIFICATIONS
              ------------------------------------------------- */}

              <button

                type="button"

                onClick={() =>
                  navigate(
                    '/dashboard/admin/notifications'
                  )
                }

                className="
                  relative
                  inline-flex
                  items-center
                  gap-2
                  rounded-xl
                  border
                  border-slate-200
                  bg-white
                  px-4
                  py-2.5
                  text-sm
                  font-semibold
                  text-slate-700
                  shadow-sm
                  transition
                  hover:bg-slate-50
                "

                title=
                  "Ouvrir les notifications"

              >

                <Bell
                  size={
                    16
                  }
                  className="
                    text-blue-600
                  "
                />

                Notifications

                {notificationCount >
                  0 && (

                  <span
                    className="
                      flex
                      min-w-[22px]
                      items-center
                      justify-center
                      rounded-full
                      bg-red-600
                      px-1.5
                      py-0.5
                      text-[11px]
                      font-bold
                      text-white
                    "
                  >

                    {
                      notificationCount >
                      99
                        ? '99+'
                        : notificationCount
                    }

                  </span>

                )}

              </button>

            </div>

          </div>


          {/* =================================================
              ERREUR
          ================================================= */}

          {error && (

            <div
              className="
                mb-6
                flex
                flex-col
                gap-3
                rounded-2xl
                border
                border-red-200
                bg-red-50
                px-5
                py-4
                text-sm
                text-red-700
                sm:flex-row
                sm:items-center
                sm:justify-between
              "
            >

              <span>
                {
                  error
                }
              </span>


              <button

                type="button"

                onClick={() =>
                  loadDashboard()
                }

                className="
                  font-semibold
                  underline
                  underline-offset-2
                "
              >

                Réessayer

              </button>

            </div>

          )}


          {/* =================================================
              KPI
          ================================================= */}

          <div
            className="
              grid
              grid-cols-1
              gap-4
              sm:grid-cols-2
              xl:grid-cols-4
            "
          >

            <StatCard

              title="Abonnés"

              value={
                formatNumber(
                  stats.abonnes
                )
              }

              subtitle={
                `${formatNumber(
                  stats.abonnesActifs
                )} actifs`
              }

              icon={
                UserRound
              }

              iconBg=
                "bg-blue-50"

              iconColor=
                "text-blue-600"

              trend=
                "info"

            />


            <StatCard

              title="Compteurs"

              value={
                formatNumber(
                  stats.compteurs
                )
              }

              subtitle={
                `${formatNumber(
                  stats.compteursActifs
                )} actifs`
              }

              icon={
                Gauge
              }

              iconBg=
                "bg-cyan-50"

              iconColor=
                "text-cyan-600"

              trend=
                "info"

            />


            <StatCard

              title="Relevés"

              value={
                formatNumber(
                  stats.releves
                )
              }

              subtitle={
                `+${formatNumber(
                  stats.relevesMois
                )} ce mois`
              }

              icon={
                ClipboardList
              }

              iconBg=
                "bg-emerald-50"

              iconColor=
                "text-emerald-600"

              trend=
                "up"

            />


            <StatCard

              title="Anomalies"

              value={
                formatNumber(
                  stats.anomalies
                )
              }

              subtitle={
                `${formatNumber(
                  stats.anomaliesNouvelles
                )} détectées`
              }

              icon={
                TriangleAlert
              }

              iconBg=
                "bg-red-50"

              iconColor=
                "text-red-600"

              trend=
                "alert"

            />

          </div>


          {/* =================================================
              NOTIFICATIONS EN ATTENTE
          ================================================= */}

          <section
            className="
              mt-6
              overflow-hidden
              rounded-2xl
              border
              border-slate-200
              bg-white
              shadow-sm
            "
          >

            <div
              className="
                flex
                flex-col
                gap-4
                p-5
                sm:flex-row
                sm:items-center
                sm:justify-between
                sm:p-6
              "
            >

              <div
                className="
                  flex
                  items-center
                  gap-3
                "
              >

                <div
                  className="
                    flex
                    h-11
                    w-11
                    items-center
                    justify-center
                    rounded-xl
                    bg-blue-50
                    text-blue-600
                  "
                >

                  <Bell
                    size={
                      21
                    }
                  />

                </div>


                <div>

                  <h2
                    className="
                      text-base
                      font-bold
                      text-slate-900
                    "
                  >
                    Notifications système
                  </h2>


                  <p
                    className="
                      mt-1
                      text-sm
                      text-slate-500
                    "
                  >

                    {notificationCount >
                    0
                      ? `${notificationCount} notification(s) en attente de traitement.`
                      : 'Aucune notification en attente.'}

                  </p>

                </div>

              </div>


              <button
                type="button"
                onClick={() =>
                  navigate(
                    '/dashboard/admin/notifications'
                  )
                }
                className="
                  inline-flex
                  items-center
                  justify-center
                  rounded-xl
                  border
                  border-blue-200
                  bg-blue-50
                  px-4
                  py-2.5
                  text-sm
                  font-semibold
                  text-blue-700
                  transition
                  hover:bg-blue-100
                "
              >

                Consulter les notifications

              </button>

            </div>

          </section>


          {/* =================================================
              CONSOMMATION DU MOIS
          ================================================= */}

          <div
            className="
              mt-6
              grid
              grid-cols-1
              gap-4
              md:grid-cols-2
            "
          >

            {/* =================================================
                EAU
            ================================================= */}

            <div
              className="
                rounded-2xl
                border
                border-slate-200
                bg-white
                p-5
                shadow-sm
              "
            >

              <div
                className="
                  flex
                  items-center
                  justify-between
                  gap-4
                "
              >

                <div>

                  <p
                    className="
                      text-sm
                      font-medium
                      text-slate-500
                    "
                  >
                    Eau — consommation du mois
                  </p>


                  <p
                    className="
                      mt-2
                      text-2xl
                      font-bold
                      text-slate-900
                    "
                  >

                    {
                      formatNumber(
                        stats.consommationEauMois
                      )
                    }

                    <span
                      className="
                        ml-1
                        text-base
                        font-semibold
                        text-slate-500
                      "
                    >
                      m³
                    </span>

                  </p>

                </div>


                <div
                  className="
                    rounded-2xl
                    bg-cyan-50
                    p-3
                  "
                >

                  <Droplets
                    size={
                      22
                    }
                    className="
                      text-cyan-600
                    "
                  />

                </div>

              </div>

            </div>


            {/* =================================================
                ÉLECTRICITÉ
            ================================================= */}

            <div
              className="
                rounded-2xl
                border
                border-slate-200
                bg-white
                p-5
                shadow-sm
              "
            >

              <div
                className="
                  flex
                  items-center
                  justify-between
                  gap-4
                "
              >

                <div>

                  <p
                    className="
                      text-sm
                      font-medium
                      text-slate-500
                    "
                  >
                    Électricité — consommation du mois
                  </p>


                  <p
                    className="
                      mt-2
                      text-2xl
                      font-bold
                      text-slate-900
                    "
                  >

                    {
                      formatNumber(
                        stats.consommationElectriciteMois
                      )
                    }

                    <span
                      className="
                        ml-1
                        text-base
                        font-semibold
                        text-slate-500
                      "
                    >
                      kWh
                    </span>

                  </p>

                </div>


                <div
                  className="
                    rounded-2xl
                    bg-amber-50
                    p-3
                  "
                >

                  <Zap
                    size={
                      22
                    }
                    className="
                      text-amber-600
                    "
                  />

                </div>

              </div>

            </div>

          </div>


          {/* =================================================
              GRAPHIQUE
          ================================================= */}

          <div
            className="
              mt-6
            "
          >

            <ConsumptionChart

              data={
                evolutionData
              }

              title=
                "Évolution des consommations"

              description=
                "Données mensuelles récupérées directement depuis PostgreSQL."

            />

          </div>


          {/* =================================================
              ANOMALIES RÉCENTES
          ================================================= */}

          <section
            className="
              mt-6
              overflow-hidden
              rounded-2xl
              border
              border-slate-200
              bg-white
              shadow-sm
            "
          >

            <div
              className="
                flex
                items-center
                justify-between
                border-b
                border-slate-200
                p-5
                sm:p-6
              "
            >

              <div>

                <h2
                  className="
                    text-lg
                    font-bold
                    text-slate-900
                  "
                >
                  Anomalies récentes
                </h2>


                <p
                  className="
                    mt-1
                    text-xs
                    text-slate-500
                  "
                >

                  Détection par comparaison avec
                  la moyenne des trois relevés
                  précédents.

                </p>

              </div>


              <button

                type="button"

                onClick={() =>
                  navigate(
                    '/dashboard/admin/anomalies'
                  )
                }

                className="
                  text-sm
                  font-semibold
                  text-blue-600
                  hover:text-blue-700
                "
              >

                Voir tout →

              </button>

            </div>


            <div
              className="
                divide-y
                divide-slate-100
              "
            >

              {
                anomaliesRecentes.length >
                0

                  ? (

                    anomaliesRecentes.map(
                      (
                        anomalie
                      ) => (

                        <div
                          key={
                            anomalie.id
                          }
                          className="
                            flex
                            flex-col
                            gap-4
                            p-5
                            transition
                            hover:bg-slate-50
                            sm:flex-row
                            sm:items-center
                            sm:justify-between
                          "
                        >

                          <div
                            className="
                              flex
                              items-center
                              gap-3
                            "
                          >

                            <div
                              className="
                                rounded-xl
                                bg-red-50
                                p-3
                              "
                            >

                              <AlertTriangle

                                size={
                                  19
                                }

                                className="
                                  text-red-600
                                "

                              />

                            </div>


                            <div>

                              <p
                                className="
                                  font-semibold
                                  text-slate-800
                                "
                              >

                                {
                                  anomalie.compteur
                                }

                              </p>


                              <p
                                className="
                                  text-sm
                                  text-slate-500
                                "
                              >

                                {
                                  anomalie.type
                                }

                              </p>

                            </div>

                          </div>


                          <div
                            className="
                              flex
                              flex-wrap
                              items-center
                              gap-4
                              text-sm
                            "
                          >

                            <div>

                              <p
                                className="
                                  text-xs
                                  text-slate-400
                                "
                              >
                                Valeur
                              </p>


                              <p
                                className="
                                  font-semibold
                                  text-slate-800
                                "
                              >

                                {
                                  formatNumber(
                                    anomalie.valeur
                                  )
                                }{' '}

                                {
                                  anomalie.unite
                                }

                              </p>

                            </div>


                            <div>

                              <p
                                className="
                                  text-xs
                                  text-slate-400
                                "
                              >
                                Référence
                              </p>


                              <p
                                className="
                                  font-semibold
                                  text-slate-600
                                "
                              >

                                {
                                  formatNumber(
                                    anomalie.reference
                                  )
                                }{' '}

                                {
                                  anomalie.unite
                                }

                              </p>

                            </div>


                            <AnomalyStatusBadge

                              status={
                                anomalie.statut
                              }

                            />

                          </div>

                        </div>

                      )
                    )

                  )

                  : (

                    <div
                      className="
                        px-5
                        py-12
                        text-center
                        text-sm
                        text-slate-500
                      "
                    >

                      Aucune anomalie détectée
                      selon la règle actuelle.

                    </div>

                  )
              }

            </div>

          </section>


          {/* =================================================
              DERNIERS RELEVÉS
          ================================================= */}

          <div
            className="
              mt-6
            "
          >

            <RecentReadings

              readings={
                derniersReleves
              }

              onViewAll={() =>
                navigate(
                  '/dashboard/admin/releves'
                )
              }

            />

          </div>


        </main>

      </div>

    </div>
  );
}


/* =========================================================
   BADGE ANOMALIE
========================================================= */

function AnomalyStatusBadge({
  status,
}) {

  const config = {

    NOUVELLE: {

      label:
        'Nouvelle',

      className:
        'bg-red-50 text-red-700',

      icon:
        AlertTriangle,

    },


    EN_COURS: {

      label:
        'En cours',

      className:
        'bg-amber-50 text-amber-700',

      icon:
        Clock3,

    },


    VERIFIEE: {

      label:
        'Vérifiée',

      className:
        'bg-blue-50 text-blue-700',

      icon:
        CheckCircle2,

    },


    RESOLUE: {

      label:
        'Résolue',

      className:
        'bg-emerald-50 text-emerald-700',

      icon:
        CheckCircle2,

    },

  };


  const current =
    config[
      status
    ] ||
    config.NOUVELLE;


  const Icon =
    current.icon;


  return (

    <span
      className={`
        inline-flex
        items-center
        gap-1.5
        rounded-full
        px-3
        py-1.5
        text-xs
        font-semibold
        ${current.className}
      `}
    >

      <Icon
        size={
          13
        }
      />

      {
        current.label
      }

    </span>
  );
}


export default AdminDashboard;