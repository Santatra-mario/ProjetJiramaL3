import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  useNavigate,
} from 'react-router-dom';

import {
  AlertCircle,
  Bell,
  Check,
  CheckCircle2,
  ChevronLeft,
  Clock3,
  Eye,
  Filter,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
  X,
  Zap,
  Droplets,
} from 'lucide-react';

import axiosClient from '../../api/axiosClient.js';

import Sidebar from '../../components/admin/Sidebar.jsx';

import Header from '../../components/admin/Header.jsx';


/* =========================================================
   OUTILS
========================================================= */

function formatDate(
  value,
  withTime = false
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

  return date.toLocaleString(
    'fr-FR',
    withTime
      ? {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }
      : {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        }
  );
}


function number(value) {
  const result =
    Number(value);

  return Number.isFinite(
    result
  )
    ? result
    : 0;
}


function formatNumber(value) {
  return number(
    value
  ).toLocaleString(
    'fr-FR',
    {
      maximumFractionDigits: 2,
    }
  );
}


function getStatusLabel(
  statut
) {
  if (
    statut ===
    'EN_ATTENTE'
  ) {
    return 'En attente';
  }

  if (
    statut ===
    'ENVOYE'
  ) {
    return 'Traitée';
  }

  return statut || '—';
}


function getStatusClasses(
  statut
) {
  if (
    statut ===
    'EN_ATTENTE'
  ) {
    return (
      'border-amber-200 bg-amber-50 text-amber-700'
    );
  }

  return (
    'border-emerald-200 bg-emerald-50 text-emerald-700'
  );
}


function getTypeLabel(type) {
  if (
    type ===
    'ALERTE_ANOMALIE'
  ) {
    return 'Alerte anomalie';
  }

  return type || 'Notification';
}


function getTypeClasses(type) {
  if (
    type ===
    'ALERTE_ANOMALIE'
  ) {
    return (
      'border-red-200 bg-red-50 text-red-700'
    );
  }

  return (
    'border-blue-200 bg-blue-50 text-blue-700'
  );
}


function getTypeIcon(
  notification
) {
  const type =
    String(
      notification?.type_compteur ||
        ''
    ).toUpperCase();

  if (
    type ===
    'EAU'
  ) {
    return Droplets;
  }

  if (
    type ===
    'ELECTRICITE'
  ) {
    return Zap;
  }

  return Bell;
}


/* =========================================================
   PAGE
========================================================= */

function NotificationsPage() {

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


  const [
    notifications,
    setNotifications,
  ] = useState([]);


  const [
    loading,
    setLoading,
  ] = useState(true);


  const [
    refreshing,
    setRefreshing,
  ] = useState(false);


  const [
    actionLoading,
    setActionLoading,
  ] = useState(false);


  const [
    error,
    setError,
  ] = useState('');


  const [
    success,
    setSuccess,
  ] = useState('');


  const [
    search,
    setSearch,
  ] = useState('');


  const [
    statutFilter,
    setStatutFilter,
  ] = useState('TOUS');


  const [
    typeFilter,
    setTypeFilter,
  ] = useState('TOUS');


  const [
    selectedNotification,
    setSelectedNotification,
  ] = useState(null);


  /* =======================================================
     UTILISATEUR CONNECTÉ
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

      const parsedUser =
        JSON.parse(
          storedUser
        );


      const role =
        String(
          parsedUser?.role || ''
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

    } catch (parseError) {

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

  }, [
    navigate,
  ]);


  /* =======================================================
     CHARGER LES NOTIFICATIONS
  ======================================================= */

  const loadNotifications =
    useCallback(
      async (
        isRefresh = false
      ) => {

        try {

          setError('');

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


          /*
           * Analyse automatique des anomalies.
           * Une nouvelle anomalie peut donc générer
           * automatiquement une notification.
           */

          try {

            await axiosClient.post(
              '/anomalies/analyser'
            );

          } catch (
            analysisError
          ) {

            console.warn(
              'Analyse anomalies avant notifications non disponible :',
              analysisError
            );
          }


          const response =
            await axiosClient.get(
              '/notifications'
            );


          if (
            response.data?.status !==
            'success'
          ) {

            throw new Error(
              response.data?.message ||
              'Impossible de récupérer les notifications.'
            );
          }


          setNotifications(
            Array.isArray(
              response.data?.data
            )
              ? response.data.data
              : []
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


          setError(
            requestError.response?.data
              ?.message ||
            requestError.message ||
            'Impossible de récupérer les notifications.'
          );

        } finally {

          setLoading(false);

          setRefreshing(false);
        }
      },
      [
        navigate,
      ]
    );


  useEffect(() => {

    if (!user) {
      return;
    }

    loadNotifications();

  }, [
    user,
    loadNotifications,
  ]);


  /* =======================================================
     FILTRES
  ======================================================= */

  const notificationsFiltrees =
    useMemo(() => {

      const texte =
        search
          .trim()
          .toLowerCase();


      return notifications.filter(
        (
          notification
        ) => {

          const correspondStatut =
            statutFilter ===
              'TOUS' ||
            notification.statut ===
              statutFilter;


          const correspondType =
            typeFilter ===
              'TOUS' ||
            notification.type ===
              typeFilter;


          if (
            !correspondStatut ||
            !correspondType
          ) {
            return false;
          }


          if (!texte) {
            return true;
          }


          return [
            notification.sujet,
            notification.message,
            notification.destinataire,
            notification.numero_compteur,
            notification.numero_abonne,
            notification.abonne_nom,
            notification.abonne_prenom,
            notification.type,
          ].some(
            value =>
              String(
                value || ''
              )
                .toLowerCase()
                .includes(
                  texte
                )
          );
        }
      );

    }, [
      notifications,
      search,
      statutFilter,
      typeFilter,
    ]);


  /* =======================================================
     STATISTIQUES
  ======================================================= */

  const total =
    notifications.length;


  const enAttente =
    notifications.filter(
      notification =>
        notification.statut ===
        'EN_ATTENTE'
    ).length;


  const traitees =
    notifications.filter(
      notification =>
        notification.statut ===
        'ENVOYE'
    ).length;


  const alertes =
    notifications.filter(
      notification =>
        notification.type ===
        'ALERTE_ANOMALIE'
    ).length;


  /* =======================================================
     DÉTAIL
  ======================================================= */

  const openNotification =
    async (
      notification
    ) => {

      try {

        const response =
          await axiosClient.get(
            `/notifications/${notification.id}`
          );


        setSelectedNotification(
          response.data?.data ||
          notification
        );

      } catch (
        requestError
      ) {

        console.error(
          'Erreur détail notification :',
          requestError
        );

        setSelectedNotification(
          notification
        );
      }
    };


  /* =======================================================
     TRAITER UNE NOTIFICATION
  ======================================================= */

  const markAsRead =
    async (
      notificationId
    ) => {

      try {

        setActionLoading(
          true
        );

        setError('');
        setSuccess('');


        const response =
          await axiosClient.patch(
            `/notifications/${notificationId}/lue`
          );


        if (
          response.data?.status !==
          'success'
        ) {

          throw new Error(
            response.data?.message ||
            'Impossible de traiter la notification.'
          );
        }


        setNotifications(
          previous =>
            previous.map(
              notification =>
                notification.id ===
                notificationId
                  ? {
                      ...notification,
                      statut:
                        'ENVOYE',
                      date_envoi:
                        response.data?.data
                          ?.date_envoi ||
                        notification.date_envoi ||
                        new Date().toISOString(),
                    }
                  : notification
            )
        );


        if (
          selectedNotification?.id ===
          notificationId
        ) {

          setSelectedNotification(
            previous =>
              previous
                ? {
                    ...previous,
                    statut:
                      'ENVOYE',
                    date_envoi:
                      response.data?.data
                        ?.date_envoi ||
                      previous.date_envoi ||
                      new Date().toISOString(),
                  }
                : previous
          );
        }


        setSuccess(
          'Notification traitée avec succès.'
        );

      } catch (
        requestError
      ) {

        console.error(
          'Erreur traitement notification :',
          requestError
        );


        setError(
          requestError.response?.data
            ?.message ||
          requestError.message ||
          'Impossible de traiter la notification.'
        );

      } finally {

        setActionLoading(
          false
        );
      }
    };


  /* =======================================================
     TRAITER TOUTES
  ======================================================= */

  const markAllAsRead =
    async () => {

      try {

        setActionLoading(
          true
        );

        setError('');
        setSuccess('');


        const response =
          await axiosClient.patch(
            '/notifications/lire-tout'
          );


        if (
          response.data?.status !==
          'success'
        ) {

          throw new Error(
            response.data?.message ||
            'Impossible de traiter les notifications.'
          );
        }


        setNotifications(
          previous =>
            previous.map(
              notification =>
                notification.statut ===
                'EN_ATTENTE'
                  ? {
                      ...notification,
                      statut:
                        'ENVOYE',
                      date_envoi:
                        notification.date_envoi ||
                        new Date().toISOString(),
                    }
                  : notification
            )
        );


        setSuccess(
          response.data?.message ||
          'Toutes les notifications ont été traitées.'
        );

      } catch (
        requestError
      ) {

        console.error(
          'Erreur traitement notifications :',
          requestError
        );


        setError(
          requestError.response?.data
            ?.message ||
          requestError.message ||
          'Impossible de traiter les notifications.'
        );

      } finally {

        setActionLoading(
          false
        );
      }
    };


  /* =======================================================
     SUPPRIMER
  ======================================================= */

  const deleteNotification =
    async (
      notificationId
    ) => {

      const confirmed =
        window.confirm(
          'Voulez-vous vraiment supprimer cette notification ?'
        );


      if (!confirmed) {
        return;
      }


      try {

        setActionLoading(
          true
        );

        setError('');
        setSuccess('');


        const response =
          await axiosClient.delete(
            `/notifications/${notificationId}`
          );


        if (
          response.data?.status !==
          'success'
        ) {

          throw new Error(
            response.data?.message ||
            'Impossible de supprimer la notification.'
          );
        }


        setNotifications(
          previous =>
            previous.filter(
              notification =>
                notification.id !==
                notificationId
            )
        );


        if (
          selectedNotification?.id ===
          notificationId
        ) {

          setSelectedNotification(
            null
          );
        }


        setSuccess(
          'Notification supprimée avec succès.'
        );

      } catch (
        requestError
      ) {

        console.error(
          'Erreur suppression notification :',
          requestError
        );


        setError(
          requestError.response?.data
            ?.message ||
          requestError.message ||
          'Impossible de supprimer la notification.'
        );

      } finally {

        setActionLoading(
          false
        );
      }
    };


  /* =======================================================
     RETOUR
  ======================================================= */

  const goBack =
    () => {

      navigate(
        '/dashboard/admin'
      );
    };


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
          setSidebarOpen(false)
        }

        activePath=
          "/dashboard/admin/notifications"

        onNavigate={
          navigate
        }

        onLogout={() => {

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
        }}

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
            setSidebarOpen(true)
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
            enAttente
          }

          user={
            user
          }
        />


        {/* =================================================
            CONTENU
        ================================================= */}

        <main
          className="
            p-4
            sm:p-6
            lg:p-8
          "
        >

          {/* =================================================
              EN-TÊTE
          ================================================= */}

          <div
            className="
              mb-7
              flex
              flex-col
              gap-4
              xl:flex-row
              xl:items-end
              xl:justify-between
            "
          >

            <div>

              <button
                type="button"
                onClick={
                  goBack
                }
                className="
                  mb-3
                  inline-flex
                  items-center
                  gap-2
                  rounded-xl
                  border
                  border-slate-200
                  bg-white
                  px-3
                  py-2
                  text-sm
                  font-semibold
                  text-slate-600
                  transition
                  hover:bg-slate-50
                "
              >

                <ChevronLeft
                  size={17}
                />

                Retour au dashboard

              </button>


              <div
                className="
                  flex
                  items-start
                  gap-3
                "
              >

                <div
                  className="
                    flex
                    h-12
                    w-12
                    items-center
                    justify-center
                    rounded-2xl
                    bg-blue-50
                    text-blue-600
                  "
                >

                  <Bell
                    size={23}
                  />

                </div>


                <div>

                  <h2
                    className="
                      text-2xl
                      font-bold
                      text-slate-900
                      sm:text-3xl
                    "
                  >
                    Notifications
                  </h2>


                  <p
                    className="
                      mt-1
                      max-w-3xl
                      text-sm
                      text-slate-500
                    "
                  >
                    Centralisation des alertes générées par le système, notamment lors de la détection d'une consommation potentiellement anormale.
                  </p>

                </div>

              </div>

            </div>


            <div
              className="
                flex
                flex-wrap
                items-center
                gap-2
              "
            >

              <button
                type="button"
                onClick={() =>
                  loadNotifications(true)
                }
                disabled={
                  refreshing ||
                  loading
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
                  transition
                  hover:bg-slate-50
                  disabled:cursor-not-allowed
                  disabled:opacity-60
                "
              >

                <RefreshCw
                  size={17}
                  className={
                    refreshing
                      ? 'animate-spin'
                      : ''
                  }
                />

                Actualiser

              </button>


              <button
                type="button"
                onClick={
                  markAllAsRead
                }
                disabled={
                  actionLoading ||
                  enAttente === 0
                }
                className="
                  inline-flex
                  items-center
                  gap-2
                  rounded-xl
                  bg-blue-600
                  px-4
                  py-2.5
                  text-sm
                  font-semibold
                  text-white
                  transition
                  hover:bg-blue-700
                  disabled:cursor-not-allowed
                  disabled:opacity-50
                "
              >

                <Check
                  size={17}
                />

                Tout traiter

              </button>

            </div>

          </div>


          {/* =================================================
              ERREURS / SUCCÈS
          ================================================= */}

          {error && (

            <div
              className="
                mb-5
                flex
                items-start
                gap-3
                rounded-2xl
                border
                border-red-200
                bg-red-50
                p-4
                text-sm
                text-red-700
              "
            >

              <AlertCircle
                size={19}
                className="
                  mt-0.5
                  shrink-0
                "
              />

              <div
                className="
                  flex-1
                "
              >

                <p
                  className="
                    font-semibold
                  "
                >
                  Erreur
                </p>

                <p
                  className="
                    mt-1
                  "
                >
                  {error}
                </p>

              </div>


              <button
                type="button"
                onClick={() =>
                  setError('')
                }
                className="
                  rounded-lg
                  p-1
                  transition
                  hover:bg-red-100
                "
              >

                <X
                  size={17}
                />

              </button>

            </div>

          )}


          {success && (

            <div
              className="
                mb-5
                flex
                items-start
                gap-3
                rounded-2xl
                border
                border-emerald-200
                bg-emerald-50
                p-4
                text-sm
                text-emerald-700
              "
            >

              <CheckCircle2
                size={19}
                className="
                  mt-0.5
                  shrink-0
                "
              />

              <div
                className="
                  flex-1
                "
              >

                <p
                  className="
                    font-semibold
                  "
                >
                  Opération réussie
                </p>

                <p
                  className="
                    mt-1
                  "
                >
                  {success}
                </p>

              </div>


              <button
                type="button"
                onClick={() =>
                  setSuccess('')
                }
                className="
                  rounded-lg
                  p-1
                  transition
                  hover:bg-emerald-100
                "
              >

                <X
                  size={17}
                />

              </button>

            </div>

          )}


          {/* =================================================
              KPI
          ================================================= */}

          <div
            className="
              mb-6
              grid
              grid-cols-1
              gap-4
              sm:grid-cols-2
              xl:grid-cols-4
            "
          >

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
                  items-start
                  justify-between
                  gap-3
                "
              >

                <div>

                  <p
                    className="
                      text-xs
                      font-semibold
                      uppercase
                      tracking-wider
                      text-slate-400
                    "
                  >
                    Total
                  </p>

                  <p
                    className="
                      mt-2
                      text-3xl
                      font-bold
                      text-slate-900
                    "
                  >
                    {total}
                  </p>

                  <p
                    className="
                      mt-1
                      text-xs
                      text-slate-500
                    "
                  >
                    Notifications enregistrées
                  </p>

                </div>


                <div
                  className="
                    rounded-xl
                    bg-blue-50
                    p-3
                    text-blue-600
                  "
                >

                  <Bell
                    size={20}
                  />

                </div>

              </div>

            </div>


            <div
              className="
                rounded-2xl
                border
                border-amber-200
                bg-amber-50/70
                p-5
                shadow-sm
              "
            >

              <div
                className="
                  flex
                  items-start
                  justify-between
                  gap-3
                "
              >

                <div>

                  <p
                    className="
                      text-xs
                      font-semibold
                      uppercase
                      tracking-wider
                      text-amber-600
                    "
                  >
                    En attente
                  </p>

                  <p
                    className="
                      mt-2
                      text-3xl
                      font-bold
                      text-amber-800
                    "
                  >
                    {enAttente}
                  </p>

                  <p
                    className="
                      mt-1
                      text-xs
                      text-amber-700
                    "
                  >
                    À traiter
                  </p>

                </div>


                <div
                  className="
                    rounded-xl
                    bg-white
                    p-3
                    text-amber-600
                    shadow-sm
                  "
                >

                  <Clock3
                    size={20}
                  />

                </div>

              </div>

            </div>


            <div
              className="
                rounded-2xl
                border
                border-emerald-200
                bg-emerald-50/70
                p-5
                shadow-sm
              "
            >

              <div
                className="
                  flex
                  items-start
                  justify-between
                  gap-3
                "
              >

                <div>

                  <p
                    className="
                      text-xs
                      font-semibold
                      uppercase
                      tracking-wider
                      text-emerald-600
                    "
                  >
                    Traitées
                  </p>

                  <p
                    className="
                      mt-2
                      text-3xl
                      font-bold
                      text-emerald-800
                    "
                  >
                    {traitees}
                  </p>

                  <p
                    className="
                      mt-1
                      text-xs
                      text-emerald-700
                    "
                  >
                    Notifications terminées
                  </p>

                </div>


                <div
                  className="
                    rounded-xl
                    bg-white
                    p-3
                    text-emerald-600
                    shadow-sm
                  "
                >

                  <CheckCircle2
                    size={20}
                  />

                </div>

              </div>

            </div>


            <div
              className="
                rounded-2xl
                border
                border-red-200
                bg-red-50/70
                p-5
                shadow-sm
              "
            >

              <div
                className="
                  flex
                  items-start
                  justify-between
                  gap-3
                "
              >

                <div>

                  <p
                    className="
                      text-xs
                      font-semibold
                      uppercase
                      tracking-wider
                      text-red-600
                    "
                  >
                    Alertes anomalie
                  </p>

                  <p
                    className="
                      mt-2
                      text-3xl
                      font-bold
                      text-red-800
                    "
                  >
                    {alertes}
                  </p>

                  <p
                    className="
                      mt-1
                      text-xs
                      text-red-700
                    "
                  >
                    Issues du suivi des consommations
                  </p>

                </div>


                <div
                  className="
                    rounded-xl
                    bg-white
                    p-3
                    text-red-600
                    shadow-sm
                  "
                >

                  <AlertCircle
                    size={20}
                  />

                </div>

              </div>

            </div>

          </div>


          {/* =================================================
              FILTRES
          ================================================= */}

          <div
            className="
              mb-5
              rounded-2xl
              border
              border-slate-200
              bg-white
              p-4
              shadow-sm
            "
          >

            <div
              className="
                mb-4
                flex
                items-center
                gap-2
              "
            >

              <Filter
                size={17}
                className="
                  text-slate-500
                "
              />

              <h3
                className="
                  text-sm
                  font-bold
                  text-slate-800
                "
              >
                Filtres
              </h3>

            </div>


            <div
              className="
                grid
                grid-cols-1
                gap-3
                lg:grid-cols-[minmax(0,1fr)_220px_220px]
              "
            >

              <div
                className="
                  relative
                "
              >

                <Search
                  size={18}
                  className="
                    pointer-events-none
                    absolute
                    left-3
                    top-1/2
                    -translate-y-1/2
                    text-slate-400
                  "
                />

                <input
                  type="text"
                  value={
                    search
                  }
                  onChange={
                    event =>
                      setSearch(
                        event.target.value
                      )
                  }
                  placeholder="Rechercher par sujet, compteur, abonné, destinataire..."
                  className="
                    w-full
                    rounded-xl
                    border
                    border-slate-200
                    bg-slate-50
                    py-3
                    pl-10
                    pr-4
                    text-sm
                    text-slate-700
                    outline-none
                    transition
                    focus:border-blue-400
                    focus:bg-white
                    focus:ring-4
                    focus:ring-blue-100
                  "
                />

              </div>


              <select
                value={
                  statutFilter
                }
                onChange={
                  event =>
                    setStatutFilter(
                      event.target.value
                    )
                }
                className="
                  rounded-xl
                  border
                  border-slate-200
                  bg-slate-50
                  px-4
                  py-3
                  text-sm
                  font-medium
                  text-slate-700
                  outline-none
                  focus:border-blue-400
                  focus:bg-white
                  focus:ring-4
                  focus:ring-blue-100
                "
              >

                <option value="TOUS">
                  Tous les statuts
                </option>

                <option value="EN_ATTENTE">
                  En attente
                </option>

                <option value="ENVOYE">
                  Traitées
                </option>

              </select>


              <select
                value={
                  typeFilter
                }
                onChange={
                  event =>
                    setTypeFilter(
                      event.target.value
                    )
                }
                className="
                  rounded-xl
                  border
                  border-slate-200
                  bg-slate-50
                  px-4
                  py-3
                  text-sm
                  font-medium
                  text-slate-700
                  outline-none
                  focus:border-blue-400
                  focus:bg-white
                  focus:ring-4
                  focus:ring-blue-100
                "
              >

                <option value="TOUS">
                  Tous les types
                </option>

                <option value="ALERTE_ANOMALIE">
                  Alerte anomalie
                </option>

              </select>

            </div>

          </div>


          {/* =================================================
              TABLEAU
          ================================================= */}

          <div
            className="
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
                border-b
                border-slate-100
                px-5
                py-4
                sm:px-6
              "
            >

              <h3
                className="
                  text-lg
                  font-bold
                  text-slate-900
                "
              >
                Liste des notifications
              </h3>

              <p
                className="
                  mt-1
                  text-xs
                  text-slate-400
                "
              >
                {notificationsFiltrees.length}
                {' '}
                résultat(s) affiché(s)
              </p>

            </div>


            {loading ? (

              <div
                className="
                  flex
                  min-h-80
                  items-center
                  justify-center
                "
              >

                <div
                  className="
                    flex
                    flex-col
                    items-center
                    gap-3
                    text-slate-500
                  "
                >

                  <Loader2
                    size={30}
                    className="
                      animate-spin
                      text-blue-600
                    "
                  />

                  <p
                    className="
                      text-sm
                    "
                  >
                    Chargement des notifications...
                  </p>

                </div>

              </div>

            ) : notificationsFiltrees.length === 0 ? (

              <div
                className="
                  flex
                  min-h-80
                  flex-col
                  items-center
                  justify-center
                  px-6
                  text-center
                "
              >

                <div
                  className="
                    flex
                    h-14
                    w-14
                    items-center
                    justify-center
                    rounded-2xl
                    bg-slate-100
                    text-slate-400
                  "
                >

                  <Bell
                    size={24}
                  />

                </div>


                <h4
                  className="
                    mt-4
                    text-base
                    font-bold
                    text-slate-800
                  "
                >
                  Aucune notification
                </h4>


                <p
                  className="
                    mt-1
                    max-w-md
                    text-sm
                    text-slate-400
                  "
                >
                  Aucune notification ne correspond aux filtres actuels.
                </p>

              </div>

            ) : (

              <div
                className="
                  overflow-x-auto
                "
              >

                <table
                  className="
                    min-w-[1000px]
                    w-full
                  "
                >

                  <thead>

                    <tr
                      className="
                        border-b
                        border-slate-100
                        bg-slate-50/70
                        text-left
                        text-xs
                        font-bold
                        uppercase
                        tracking-wider
                        text-slate-400
                      "
                    >

                      <th
                        className="
                          px-5
                          py-4
                        "
                      >
                        Notification
                      </th>

                      <th
                        className="
                          px-5
                          py-4
                        "
                      >
                        Compteur / Abonné
                      </th>

                      <th
                        className="
                          px-5
                          py-4
                        "
                      >
                        Anomalie
                      </th>

                      <th
                        className="
                          px-5
                          py-4
                        "
                      >
                        Date
                      </th>

                      <th
                        className="
                          px-5
                          py-4
                        "
                      >
                        Statut
                      </th>

                      <th
                        className="
                          px-5
                          py-4
                          text-right
                        "
                      >
                        Actions
                      </th>

                    </tr>

                  </thead>


                  <tbody>

                    {notificationsFiltrees.map(
                      notification => {

                        const Icon =
                          getTypeIcon(
                            notification
                          );


                        return (

                          <tr
                            key={
                              notification.id
                            }
                            className={`
                              border-b
                              border-slate-100
                              transition
                              hover:bg-slate-50/70
                              ${
                                notification.statut ===
                                'EN_ATTENTE'
                                  ? 'bg-amber-50/20'
                                  : 'bg-white'
                              }
                            `}
                          >

                            <td
                              className="
                                px-5
                                py-5
                                align-top
                              "
                            >

                              <div
                                className="
                                  flex
                                  items-start
                                  gap-3
                                "
                              >

                                <div
                                  className="
                                    flex
                                    h-10
                                    w-10
                                    shrink-0
                                    items-center
                                    justify-center
                                    rounded-xl
                                    bg-blue-50
                                    text-blue-600
                                  "
                                >

                                  <Icon
                                    size={19}
                                  />

                                </div>


                                <div
                                  className="
                                    min-w-0
                                  "
                                >

                                  <div
                                    className="
                                      flex
                                      flex-wrap
                                      items-center
                                      gap-2
                                    "
                                  >

                                    <p
                                      className="
                                        max-w-md
                                        truncate
                                        text-sm
                                        font-bold
                                        text-slate-800
                                      "
                                    >
                                      {
                                        notification.sujet ||
                                        'Notification'
                                      }
                                    </p>


                                    <span
                                      className={`
                                        rounded-full
                                        border
                                        px-2.5
                                        py-1
                                        text-[10px]
                                        font-bold
                                        ${getTypeClasses(
                                          notification.type
                                        )}
                                      `}
                                    >
                                      {getTypeLabel(
                                        notification.type
                                      )}
                                    </span>

                                  </div>


                                  <p
                                    className="
                                      mt-1
                                      max-w-xl
                                      text-xs
                                      leading-5
                                      text-slate-500
                                    "
                                  >
                                    {
                                      notification.message ||
                                      'Aucun message.'
                                    }
                                  </p>

                                </div>

                              </div>

                            </td>


                            <td
                              className="
                                px-5
                                py-5
                                align-top
                              "
                            >

                              <p
                                className="
                                  text-sm
                                  font-bold
                                  text-slate-800
                                "
                              >
                                {
                                  notification.numero_compteur ||
                                  '—'
                                }
                              </p>


                              <p
                                className="
                                  mt-1
                                  text-xs
                                  text-slate-500
                                "
                              >
                                {[
                                  notification.abonne_prenom,
                                  notification.abonne_nom,
                                ]
                                  .filter(Boolean)
                                  .join(' ') ||
                                  'Abonné non renseigné'}
                              </p>

                            </td>


                            <td
                              className="
                                px-5
                                py-5
                                align-top
                              "
                            >

                              {notification.anomalie_id ? (

                                <div>

                                  <p
                                    className="
                                      text-sm
                                      font-bold
                                      text-slate-800
                                    "
                                  >
                                    {
                                      notification.valeur_detectee !=
                                      null
                                        ? `${formatNumber(
                                            notification.valeur_detectee
                                          )} ${
                                            String(
                                              notification.type_compteur ||
                                              ''
                                            ).toUpperCase() ===
                                            'EAU'
                                              ? 'm³'
                                              : 'kWh'
                                          }`
                                        : '—'
                                    }
                                  </p>


                                  <p
                                    className="
                                      mt-1
                                      text-xs
                                      text-slate-500
                                    "
                                  >
                                    Référence :{' '}
                                    {
                                      notification.valeur_reference !=
                                      null
                                        ? `${formatNumber(
                                            notification.valeur_reference
                                          )} ${
                                            String(
                                              notification.type_compteur ||
                                              ''
                                            ).toUpperCase() ===
                                            'EAU'
                                              ? 'm³'
                                              : 'kWh'
                                          }`
                                        : '—'
                                    }
                                  </p>


                                  <p
                                    className="
                                      mt-1
                                      text-xs
                                      font-semibold
                                      text-red-600
                                    "
                                  >
                                    Seuil :{' '}
                                    {
                                      notification.seuil !=
                                      null
                                        ? `${formatNumber(
                                            notification.seuil
                                          )} %`
                                        : '—'
                                    }
                                  </p>

                                </div>

                              ) : (

                                <span
                                  className="
                                    text-sm
                                    text-slate-400
                                  "
                                >
                                  Sans anomalie liée
                                </span>

                              )}

                            </td>


                            <td
                              className="
                                px-5
                                py-5
                                align-top
                              "
                            >

                              <p
                                className="
                                  text-sm
                                  font-semibold
                                  text-slate-700
                                "
                              >
                                {formatDate(
                                  notification.created_at,
                                  true
                                )}
                              </p>


                              <p
                                className="
                                  mt-1
                                  text-xs
                                  text-slate-400
                                "
                              >
                                {
                                  notification.date_envoi
                                    ? `Traitée le ${formatDate(
                                        notification.date_envoi,
                                        true
                                      )}`
                                    : 'En attente de traitement'
                                }
                              </p>

                            </td>


                            <td
                              className="
                                px-5
                                py-5
                                align-top
                              "
                            >

                              <span
                                className={`
                                  inline-flex
                                  rounded-full
                                  border
                                  px-3
                                  py-1.5
                                  text-xs
                                  font-bold
                                  ${getStatusClasses(
                                    notification.statut
                                  )}
                                `}
                              >
                                {getStatusLabel(
                                  notification.statut
                                )}
                              </span>

                            </td>


                            <td
                              className="
                                px-5
                                py-5
                                align-top
                              "
                            >

                              <div
                                className="
                                  flex
                                  justify-end
                                  gap-2
                                "
                              >

                                <button
                                  type="button"
                                  onClick={() =>
                                    openNotification(
                                      notification
                                    )
                                  }
                                  className="
                                    inline-flex
                                    items-center
                                    gap-2
                                    rounded-lg
                                    border
                                    border-slate-200
                                    bg-white
                                    px-3
                                    py-2
                                    text-xs
                                    font-bold
                                    text-slate-600
                                    transition
                                    hover:bg-slate-50
                                  "
                                >

                                  <Eye
                                    size={15}
                                  />

                                  Détail

                                </button>


                                {notification.statut ===
                                  'EN_ATTENTE' && (

                                  <button
                                    type="button"
                                    onClick={() =>
                                      markAsRead(
                                        notification.id
                                      )
                                    }
                                    disabled={
                                      actionLoading
                                    }
                                    className="
                                      inline-flex
                                      items-center
                                      gap-2
                                      rounded-lg
                                      bg-emerald-600
                                      px-3
                                      py-2
                                      text-xs
                                      font-bold
                                      text-white
                                      transition
                                      hover:bg-emerald-700
                                      disabled:opacity-50
                                    "
                                  >

                                    <Check
                                      size={15}
                                    />

                                    Traiter

                                  </button>

                                )}


                                <button
                                  type="button"
                                  onClick={() =>
                                    deleteNotification(
                                      notification.id
                                    )
                                  }
                                  disabled={
                                    actionLoading
                                  }
                                  className="
                                    inline-flex
                                    items-center
                                    justify-center
                                    rounded-lg
                                    border
                                    border-red-200
                                    bg-red-50
                                    p-2
                                    text-red-600
                                    transition
                                    hover:bg-red-100
                                    disabled:opacity-50
                                  "
                                  aria-label="Supprimer"
                                >

                                  <Trash2
                                    size={15}
                                  />

                                </button>

                              </div>

                            </td>

                          </tr>

                        );
                      }
                    )}

                  </tbody>

                </table>

              </div>

            )}

          </div>

        </main>

      </div>


      {/* =====================================================
          MODALE
      ===================================================== */}

      {selectedNotification && (

        <div
          className="
            fixed
            inset-0
            z-50
            flex
            items-center
            justify-center
            bg-slate-950/45
            p-4
            backdrop-blur-sm
          "
        >

          <div
            className="
              max-h-[92vh]
              w-full
              max-w-3xl
              overflow-hidden
              rounded-3xl
              bg-white
              shadow-2xl
            "
          >

            <div
              className="
                flex
                items-start
                justify-between
                border-b
                border-slate-100
                px-6
                py-5
              "
            >

              <div
                className="
                  flex
                  items-start
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
                    size={20}
                  />

                </div>


                <div>

                  <p
                    className="
                      text-xs
                      font-semibold
                      uppercase
                      tracking-wider
                      text-blue-600
                    "
                  >
                    Détail de la notification
                  </p>


                  <h3
                    className="
                      mt-1
                      text-xl
                      font-bold
                      text-slate-900
                    "
                  >
                    {
                      selectedNotification.sujet ||
                      'Notification'
                    }
                  </h3>

                </div>

              </div>


              <button
                type="button"
                onClick={() =>
                  setSelectedNotification(
                    null
                  )
                }
                className="
                  rounded-xl
                  p-2
                  text-slate-400
                  transition
                  hover:bg-slate-100
                  hover:text-slate-700
                "
              >

                <X
                  size={20}
                />

              </button>

            </div>


            <div
              className="
                max-h-[70vh]
                overflow-y-auto
                px-6
                py-6
              "
            >

              <div
                className="
                  grid
                  grid-cols-1
                  gap-4
                  sm:grid-cols-2
                "
              >

                <div
                  className="
                    rounded-2xl
                    border
                    border-slate-200
                    bg-slate-50
                    p-4
                  "
                >

                  <p
                    className="
                      text-xs
                      font-semibold
                      uppercase
                      tracking-wider
                      text-slate-400
                    "
                  >
                    Type
                  </p>

                  <p
                    className="
                      mt-2
                      text-sm
                      font-bold
                      text-slate-800
                    "
                  >
                    {getTypeLabel(
                      selectedNotification.type
                    )}
                  </p>

                </div>


                <div
                  className="
                    rounded-2xl
                    border
                    border-slate-200
                    bg-slate-50
                    p-4
                  "
                >

                  <p
                    className="
                      text-xs
                      font-semibold
                      uppercase
                      tracking-wider
                      text-slate-400
                    "
                  >
                    Statut
                  </p>

                  <div
                    className="
                      mt-2
                    "
                  >

                    <span
                      className={`
                        inline-flex
                        rounded-full
                        border
                        px-3
                        py-1.5
                        text-xs
                        font-bold
                        ${getStatusClasses(
                          selectedNotification.statut
                        )}
                      `}
                    >
                      {getStatusLabel(
                        selectedNotification.statut
                      )}
                    </span>

                  </div>

                </div>


                <div
                  className="
                    rounded-2xl
                    border
                    border-slate-200
                    bg-slate-50
                    p-4
                  "
                >

                  <p
                    className="
                      text-xs
                      font-semibold
                      uppercase
                      tracking-wider
                      text-slate-400
                    "
                  >
                    Destinataire
                  </p>

                  <p
                    className="
                      mt-2
                      break-all
                      text-sm
                      font-bold
                      text-slate-800
                    "
                  >
                    {
                      selectedNotification.destinataire ||
                      '—'
                    }
                  </p>

                </div>


                <div
                  className="
                    rounded-2xl
                    border
                    border-slate-200
                    bg-slate-50
                    p-4
                  "
                >

                  <p
                    className="
                      text-xs
                      font-semibold
                      uppercase
                      tracking-wider
                      text-slate-400
                    "
                  >
                    Date
                  </p>

                  <p
                    className="
                      mt-2
                      text-sm
                      font-bold
                      text-slate-800
                    "
                  >
                    {formatDate(
                      selectedNotification.created_at,
                      true
                    )}
                  </p>

                </div>

              </div>


              <div
                className="
                  mt-5
                  rounded-2xl
                  border
                  border-slate-200
                  p-5
                "
              >

                <p
                  className="
                    text-xs
                    font-semibold
                    uppercase
                    tracking-wider
                    text-slate-400
                  "
                >
                  Message
                </p>


                <p
                  className="
                    mt-3
                    whitespace-pre-line
                    text-sm
                    leading-6
                    text-slate-700
                  "
                >
                  {
                    selectedNotification.message ||
                    'Aucun message.'
                  }
                </p>

              </div>


              {selectedNotification.anomalie_id && (

                <div
                  className="
                    mt-5
                    rounded-2xl
                    border
                    border-red-200
                    bg-red-50/60
                    p-5
                  "
                >

                  <div
                    className="
                      flex
                      items-center
                      gap-2
                    "
                  >

                    <AlertCircle
                      size={18}
                      className="
                        text-red-600
                      "
                    />

                    <h4
                      className="
                        text-sm
                        font-bold
                        text-red-800
                      "
                    >
                      Anomalie associée
                    </h4>

                  </div>


                  <div
                    className="
                      mt-4
                      grid
                      grid-cols-1
                      gap-3
                      sm:grid-cols-2
                      lg:grid-cols-4
                    "
                  >

                    <div
                      className="
                        rounded-xl
                        bg-white
                        p-3
                      "
                    >

                      <p
                        className="
                          text-xs
                          text-slate-400
                        "
                      >
                        Compteur
                      </p>

                      <p
                        className="
                          mt-1
                          text-sm
                          font-bold
                          text-slate-800
                        "
                      >
                        {
                          selectedNotification.numero_compteur ||
                          '—'
                        }
                      </p>

                    </div>


                    <div
                      className="
                        rounded-xl
                        bg-white
                        p-3
                      "
                    >

                      <p
                        className="
                          text-xs
                          text-slate-400
                        "
                      >
                        Consommation
                      </p>

                      <p
                        className="
                          mt-1
                          text-sm
                          font-bold
                          text-slate-800
                        "
                      >
                        {
                          selectedNotification.valeur_detectee !=
                          null
                            ? `${formatNumber(
                                selectedNotification.valeur_detectee
                              )} ${
                                String(
                                  selectedNotification.type_compteur ||
                                  ''
                                ).toUpperCase() ===
                                'EAU'
                                  ? 'm³'
                                  : 'kWh'
                              }`
                            : '—'
                        }
                      </p>

                    </div>


                    <div
                      className="
                        rounded-xl
                        bg-white
                        p-3
                      "
                    >

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
                          mt-1
                          text-sm
                          font-bold
                          text-slate-800
                        "
                      >
                        {
                          selectedNotification.valeur_reference !=
                          null
                            ? `${formatNumber(
                                selectedNotification.valeur_reference
                              )} ${
                                String(
                                  selectedNotification.type_compteur ||
                                  ''
                                ).toUpperCase() ===
                                'EAU'
                                  ? 'm³'
                                  : 'kWh'
                              }`
                            : '—'
                        }
                      </p>

                    </div>


                    <div
                      className="
                        rounded-xl
                        bg-white
                        p-3
                      "
                    >

                      <p
                        className="
                          text-xs
                          text-slate-400
                        "
                      >
                        Seuil
                      </p>

                      <p
                        className="
                          mt-1
                          text-sm
                          font-bold
                          text-red-700
                        "
                      >
                        {
                          selectedNotification.seuil !=
                          null
                            ? `${formatNumber(
                                selectedNotification.seuil
                              )} %`
                            : '—'
                        }
                      </p>

                    </div>

                  </div>


                  <div
                    className="
                      mt-4
                      text-xs
                      text-red-700
                    "
                  >

                    Date de détection :{' '}

                    <span
                      className="
                        font-semibold
                      "
                    >
                      {formatDate(
                        selectedNotification.date_detection,
                        true
                      )}
                    </span>

                  </div>

                </div>

              )}

            </div>


            <div
              className="
                flex
                flex-col-reverse
                gap-3
                border-t
                border-slate-100
                bg-slate-50
                px-6
                py-4
                sm:flex-row
                sm:items-center
                sm:justify-end
              "
            >

              <button
                type="button"
                onClick={() =>
                  setSelectedNotification(
                    null
                  )
                }
                className="
                  rounded-xl
                  border
                  border-slate-200
                  bg-white
                  px-4
                  py-2.5
                  text-sm
                  font-semibold
                  text-slate-700
                  transition
                  hover:bg-slate-100
                "
              >
                Fermer
              </button>


              {selectedNotification.statut ===
                'EN_ATTENTE' && (

                <button
                  type="button"
                  onClick={() =>
                    markAsRead(
                      selectedNotification.id
                    )
                  }
                  disabled={
                    actionLoading
                  }
                  className="
                    inline-flex
                    items-center
                    justify-center
                    gap-2
                    rounded-xl
                    bg-emerald-600
                    px-4
                    py-2.5
                    text-sm
                    font-bold
                    text-white
                    transition
                    hover:bg-emerald-700
                    disabled:cursor-not-allowed
                    disabled:opacity-60
                  "
                >

                  {actionLoading ? (

                    <Loader2
                      size={17}
                      className="
                        animate-spin
                      "
                    />

                  ) : (

                    <Check
                      size={17}
                    />

                  )}

                  Marquer comme traitée

                </button>

              )}


              <button
                type="button"
                onClick={() =>
                  deleteNotification(
                    selectedNotification.id
                  )
                }
                disabled={
                  actionLoading
                }
                className="
                  inline-flex
                  items-center
                  justify-center
                  gap-2
                  rounded-xl
                  border
                  border-red-200
                  bg-red-50
                  px-4
                  py-2.5
                  text-sm
                  font-bold
                  text-red-700
                  transition
                  hover:bg-red-100
                  disabled:cursor-not-allowed
                  disabled:opacity-60
                "
              >

                <Trash2
                  size={17}
                />

                Supprimer

              </button>

            </div>

          </div>

        </div>

      )}

    </div>
  );
}


export default NotificationsPage;