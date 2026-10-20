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
  Archive,
  ArchiveRestore,
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

import AdminShell from '../../components/admin/AdminShell.jsx';
import NotificationConfirmDialog from '../../components/notifications/NotificationConfirmDialog.jsx';


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


function getStatusClasses(statut) {
  if (statut === 'EN_ATTENTE') {
    return 'border-[var(--jr-elec-anneau)] bg-[var(--jr-elec-pale)] text-jr-attention';
  }

  return 'border-[var(--jr-ok-anneau)] bg-[var(--jr-ok-pale)] text-jr-ok';
}


function getTypeLabel(type) {
  if (type === 'ALERTE_ANOMALIE') return 'Alerte anomalie';
  if (type === 'DECISION_ANOMALIE') return 'Décision sur anomalie';
  return type || 'Notification';
}


function getDecisionLabel(decision) {
  const labels = {
    ACCEPTE: 'Relevé accepté après vérification',
    REFUSE: 'Relevé refusé',
    A_VERIFIER: 'Vérification complémentaire nécessaire',
  };
  const key = String(decision || '').trim().toUpperCase();
  return labels[key] || decision || 'Décision non renseignée';
}


function getTypeClasses(type) {
  if (type === 'ALERTE_ANOMALIE') {
    return 'border-[var(--jr-err-bordure)] bg-[var(--jr-err-pale)] text-jr-err';
  }
  if (type === 'DECISION_ANOMALIE') {
    return 'border-[var(--jr-eau-clair)] bg-[var(--jr-eau-pale)] text-jr-lien';
  }
  return 'border-[var(--jr-eau-clair)] bg-[var(--jr-eau-pale)] text-jr-lien';
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


function getSubscriberName(notification = {}) {
  // Le backend renvoie nom_abonne / prenom_abonne.
  // Les deux anciens alias sont gardés pour compatibilité.
  const prenom =
    notification.prenom_abonne ||
    notification.abonne_prenom ||
    '';

  const nom =
    notification.nom_abonne ||
    notification.abonne_nom ||
    '';

  return [prenom, nom]
    .filter(Boolean)
    .join(' ')
    .trim() || 'Abonné non renseigné';
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


  // Toutes les notifications actives restent consultables après traitement.
  const [statutFilter, setStatutFilter] = useState('TOUS');
  const [archiveView, setArchiveView] = useState('actives');


  const [
    typeFilter,
    setTypeFilter,
  ] = useState('TOUS');


  const [
    selectedNotification,
    setSelectedNotification,
  ] = useState(null);

  // Suppression confirmée uniquement après validation explicite de l'utilisateur.
  const [
    pendingDelete,
    setPendingDelete,
  ] = useState(null);
  const [pendingArchive, setPendingArchive] = useState(null);

  const [
    deletingId,
    setDeletingId,
  ] = useState(null);

  const [
    toast,
    setToast,
  ] = useState(null);


  // Toast temporaire avec nettoyage du timer.
  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  // Fermer les dialogues avec Échap.
  useEffect(() => {
    if (!selectedNotification && !pendingDelete) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        if (pendingDelete && deletingId === null) {
          setPendingDelete(null);
        } else if (selectedNotification && !pendingDelete) {
          setSelectedNotification(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNotification, pendingDelete, deletingId]);

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


          // Le backend synchronise déjà les anomalies et les notifications
          // dans GET /notifications. Éviter un second POST ici empêche
          // de lancer deux analyses à chaque chargement ou actualisation.
          const response =
            await axiosClient.get(
              '/notifications',
              { params: { vue: archiveView } }
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


          const notificationList =
            response.data?.notifications ??
            response.data?.data;

          if (!Array.isArray(notificationList)) {
            throw new Error(
              'Format de réponse inattendu : la liste des notifications est absente.'
            );
          }

          // Normaliser les statuts provenant de l'API pour éviter les écarts
          // de casse ou les espaces (ex. « envoye » / « ENVOYE ») dans les filtres.
          const notificationsNormalisees = notificationList.map((notification) => ({
            ...notification,
            statut: String(notification?.statut ?? '')
              .trim()
              .toUpperCase(),
          }));

          setNotifications(notificationsNormalisees);
          if (isRefresh) {
            setToast({ type: 'success', message: 'Notifications actualisées.' });
          }

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
        archiveView,
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

          const statutNotification = String(notification.statut || '')
            .trim()
            .toUpperCase();

          const correspondStatut =
            statutFilter === 'TOUS' ||
            statutNotification === statutFilter;


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
            notification.nom_abonne,
            notification.prenom_abonne,
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
        String(notification.statut || '').trim().toUpperCase() ===
        'EN_ATTENTE'
    ).length;


  const traitees =
    notifications.filter(
      notification =>
        String(notification.statut || '').trim().toUpperCase() ===
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


        if (response.data?.status === 'error') {
          throw new Error(
            response.data?.message ||
            'Impossible de récupérer le détail de la notification.'
          );
        }

        setSelectedNotification(
          response.data?.notification ||
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

  const markAsRead = async (notificationId) => {
    // Empêcher les traitements concurrents et doubles clics.
    if (actionLoading) return;

    try {
      setActionLoading(true);
      setError('');
      setSuccess('');

      const response = await axiosClient.patch(
        `/notifications/${notificationId}/lue`
      );

      if (response.data?.status !== 'success') {
        throw new Error(
          response.data?.message ||
          'Le serveur n’a pas confirmé le traitement de cette notification.'
        );
      }

      // Le backend renvoie la ligne réellement enregistrée en base.
      const notificationServeur =
        response.data?.notification ?? response.data?.data ?? null;

      const notificationActuelle = notifications.find(
        (item) => String(item.id) === String(notificationId)
      );

      const notificationTraitee = {
        ...(notificationActuelle || {}),
        ...(notificationServeur || {}),
        id: notificationServeur?.id ?? notificationId,
        statut: String(notificationServeur?.statut || 'ENVOYE')
          .trim()
          .toUpperCase(),
        date_envoi:
          notificationServeur?.date_envoi ||
          notificationActuelle?.date_envoi ||
          new Date().toISOString(),
      };

      // Mettre à jour selon la réponse confirmée du backend. Avec le filtre
      // par défaut EN_ATTENTE, la ligne traitée disparaît sans être supprimée.
      setNotifications((previous) => previous.map((notification) =>
        String(notification.id) === String(notificationId)
          ? { ...notification, ...notificationTraitee }
          : notification
      ));

      setSelectedNotification((previous) => (
        previous && String(previous.id) === String(notificationId)
          ? { ...previous, ...notificationTraitee }
          : previous
      ));

      setToast({
        type: 'success',
        message: response.data?.message || 'Notification traitée avec succès.',
      });
    } catch (requestError) {
      console.error('Erreur traitement notification :', requestError);

      const status = requestError.response?.status;
      if (status === 401 || status === 403) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/', { replace: true });
        return;
      }

      setError(
        requestError.response?.data?.message ||
        requestError.message ||
        'Impossible de traiter la notification.'
      );
      setToast({
        type: 'error',
        message:
          requestError.response?.data?.message ||
          requestError.message ||
          'Impossible de traiter la notification. Veuillez réessayer.',
      });
    } finally {
      setActionLoading(false);
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


        const treatedAt = new Date().toISOString();

        setNotifications(
          previous =>
            previous.map(
              notification =>
                String(notification.statut || '').trim().toUpperCase() ===
                'EN_ATTENTE'
                  ? {
                      ...notification,
                      statut: 'ENVOYE',
                      date_envoi:
                        notification.date_envoi ||
                        treatedAt,
                    }
                  : notification
            )
        );

        setSelectedNotification(
          previous =>
            previous?.statut === 'EN_ATTENTE'
              ? {
                  ...previous,
                  statut: 'ENVOYE',
                  date_envoi: previous.date_envoi || treatedAt,
                }
              : previous
        );


        setSuccess('');
        setToast({
          type: 'success',
          message: response.data?.message || 'Toutes les notifications ont été traitées.',
        });

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

  // Ouvre la confirmation personnalisée sans appeler le backend.
  const deleteNotification = (notificationId) => {
    const notification = notifications.find(
      (item) => item.id === notificationId
    );

    if (!notification || deletingId !== null) return;
    setPendingDelete(notification);
  };

  // Le backend est appelé uniquement après confirmation.
  const confirmDeleteNotification = async () => {
    if (!pendingDelete || deletingId !== null) return;

    const notificationId = pendingDelete.id;

    try {
      setDeletingId(notificationId);
      setActionLoading(true);
      setError('');
      setSuccess('');

      const response = await axiosClient.delete(
        `/notifications/${notificationId}`
      );

      if (response.data?.status !== 'success') {
        throw new Error(
          response.data?.message ||
          'Impossible de supprimer la notification.'
        );
      }

      // Le backend peut supprimer plusieurs doublons liés à la même anomalie.
      // Utiliser les identifiants réellement renvoyés par le serveur.
      const idsSupprimes = new Set(
        (Array.isArray(response.data?.deletedIds) && response.data.deletedIds.length > 0
          ? response.data.deletedIds
          : [response.data?.deletedId ?? notificationId]
        ).map((id) => String(id))
      );

      setNotifications((previous) =>
        previous.filter((notification) => !idsSupprimes.has(String(notification.id)))
      );

      const memeAnomalieSupprimee =
        pendingDelete?.anomalie_id != null &&
        selectedNotification?.anomalie_id != null &&
        String(selectedNotification.anomalie_id) === String(pendingDelete.anomalie_id);

      if (
        (selectedNotification?.id != null && idsSupprimes.has(String(selectedNotification.id))) ||
        memeAnomalieSupprimee
      ) {
        setSelectedNotification(null);
      }

      setPendingDelete(null);
      setToast({
        type: 'success',
        message: response.data?.message || 'Notification supprimée avec succès.',
      });
    } catch (requestError) {
      console.error('Erreur suppression notification :', requestError);

      const status = requestError.response?.status;
      if (status === 401 || status === 403) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/', { replace: true });
        return;
      }

      setToast({
        type: 'error',
        message:
          requestError.response?.data?.message ||
          requestError.message ||
          'Impossible de supprimer la notification. Veuillez réessayer.',
      });
    } finally {
      setDeletingId(null);
      setActionLoading(false);
    }
  };

  /* =======================================================
     ARCHIVER / RESTAURER
  ======================================================= */

  const changeArchiveState = async (notification, action) => {
    if (!notification || actionLoading) return;
    const isRestore = action === 'restaurer';
    try {
      setActionLoading(true);
      setError('');
      setSuccess('');
      const response = await axiosClient.patch(`/notifications/${notification.id}/${action}`);
      if (response.data?.status !== 'success') throw new Error(response.data?.message || 'Impossible de modifier l’archivage.');
      setNotifications((previous) => previous.filter((item) => String(item.id) !== String(notification.id)));
      if (String(selectedNotification?.id) === String(notification.id)) setSelectedNotification(null);
      setToast({ type: 'success', message: response.data?.message || (isRestore ? 'Notification restaurée.' : 'Notification archivée.') });
      return true;
    } catch (requestError) {
      const status = requestError.response?.status;
      if (status === 401 || status === 403) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/', { replace: true });
        return false;
      }
      setToast({ type: 'error', message: requestError.response?.data?.message || requestError.message || 'Impossible de modifier l’archivage.' });
      return false;
    } finally { setActionLoading(false); }
  };

  const archiveNotification = (notification) => setPendingArchive(notification);
  const confirmerArchivage = async () => {
    if (!pendingArchive || actionLoading) return;
    const ok = await changeArchiveState(pendingArchive, 'archiver');
    if (ok) setPendingArchive(null);
  };
  const restoreNotification = (notification) => changeArchiveState(notification, 'restaurer');

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
    <AdminShell
      intensite="calme"
      className="selection:bg-[var(--jr-elec)] selection:text-[var(--jr-sur-elec)]"
    >
      <div className="min-h-screen">

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
                border-[var(--jr-err-bordure)]
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
                border-[var(--jr-ok-anneau)]
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
                border-[var(--jr-elec-anneau)]
                bg-[var(--jr-elec-pale)]
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
                border-[var(--jr-ok-anneau)]
                bg-[var(--jr-ok-pale)]
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
                border-[var(--jr-err-bordure)]
                bg-[var(--jr-err-pale)]
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

            <div className="mb-4 flex flex-wrap items-center gap-2" role="group" aria-label="Vue des notifications">
              <button type="button" onClick={() => { setArchiveView('actives'); setStatutFilter('TOUS'); }} aria-pressed={archiveView === 'actives'} className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${archiveView === 'actives' ? 'border-blue-700 bg-blue-700 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>
                <Bell size={15} /> Notifications actives
              </button>
              <button type="button" onClick={() => navigate('/dashboard/admin/parametres?section=archives')} aria-pressed={archiveView === 'archivees'} className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${archiveView === 'archivees' ? 'border-blue-700 bg-blue-700 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>
                <Archive size={15} /> Archives
              </button>
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
                <option value="DECISION_ANOMALIE">
                  Décision sur anomalie
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
                  {notifications.length === 0
                    ? 'Aucune notification n’est enregistrée pour le moment.'
                    : 'Aucun résultat ne correspond à votre recherche ou aux filtres sélectionnés.'}
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
                        Référence client / Abonné
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
                              group border-b border-slate-100 dark:border-slate-700/70
                              transition-colors duration-200 ease-out
                              hover:bg-blue-50/80 dark:hover:bg-blue-900/30
                              hover:[box-shadow:inset_3px_0_0_#29b6f6]
                              ${
                                notification.statut ===
                                'EN_ATTENTE'
                                  ? 'bg-[color:color-mix(in_srgb,var(--jr-elec-pale)_22%,transparent)]'
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
                                    bg-blue-50 dark:bg-blue-900/40
                                    text-blue-600 dark:text-sky-300
                                    transition-colors duration-200
                                    group-hover:bg-blue-100 dark:group-hover:bg-blue-800/60
                                  "
                                >

                                  <Icon
                                    size={19}
                                    className="transition-colors duration-200"
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
                                    <span className="whitespace-pre-line">
                                      {notification.message || 'Aucun message.'}
                                    </span>
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
                                {getSubscriberName(notification)}
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
                                    transition-colors duration-200
                                    hover:bg-blue-50
                                    dark:hover:bg-blue-900/40
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
                                  onClick={() => archiveView === 'archivees' ? restoreNotification(notification) : archiveNotification(notification)}
                                  disabled={actionLoading}
                                  className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                                  aria-label={archiveView === 'archivees' ? 'Restaurer la notification' : 'Archiver la notification'}
                                  title={archiveView === 'archivees' ? 'Restaurer' : 'Archiver'}
                                >
                                  {archiveView === 'archivees' ? <ArchiveRestore size={15} /> : <Archive size={15} />}
                                </button>

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
                                    border-[var(--jr-err-bordure)]
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

      {/* Toast de retour utilisateur */}
      {toast && (
        <div
          className="fixed right-4 top-4 z-[80] w-[min(92vw,420px)]"
          role={toast.type === 'error' ? 'alert' : 'status'}
          aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
        >
          <div className={`flex items-start gap-3 rounded-2xl border p-4 shadow-xl ${
            toast.type === 'error'
              ? 'border-red-200 bg-white text-red-800'
              : 'border-emerald-200 bg-white text-emerald-800'
          }`}>
            {toast.type === 'error'
              ? <AlertCircle size={20} className="mt-0.5 shrink-0" />
              : <CheckCircle2 size={20} className="mt-0.5 shrink-0" />}
            <p className="flex-1 text-sm font-semibold">{toast.message}</p>
            <button
              type="button"
              onClick={() => setToast(null)}
              aria-label="Fermer la notification"
              title="Fermer"
              className="rounded-lg p-1 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <X size={17} />
            </button>
          </div>
        </div>
      )}

      {/* Confirmation de suppression */}
      {pendingDelete && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/55 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && deletingId === null) {
              setPendingDelete(null);
            }
          }}
        >
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-notification-title"
            aria-describedby="delete-notification-description"
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
                <Trash2 size={21} />
              </div>
              <div className="min-w-0 flex-1">
                <h2 id="delete-notification-title" className="text-lg font-bold text-slate-900">
                  Confirmer la suppression
                </h2>
                <p id="delete-notification-description" className="mt-2 text-sm leading-6 text-slate-600">
                  Voulez-vous vraiment supprimer cette notification ?
                </p>
                {pendingDelete.sujet && (
                  <p className="mt-2 break-words text-sm font-semibold text-slate-800">
                    « {pendingDelete.sujet} »
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                disabled={deletingId !== null}
                aria-label="Fermer la confirmation"
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                disabled={deletingId !== null}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={confirmDeleteNotification}
                disabled={deletingId !== null}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-700 active:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deletingId !== null ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Suppression...
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    Supprimer
                  </>
                )}
              </button>
            </div>
          </section>
        </div>
      )}

      <NotificationConfirmDialog
        open={Boolean(pendingArchive)}
        action="archive"
        subject={pendingArchive?.sujet || 'cette notification'}
        busy={actionLoading}
        onConfirm={confirmerArchivage}
        onCancel={() => { if (!actionLoading) setPendingArchive(null); }}
      />

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
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedNotification(null);
            }
          }}
        >

          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="notification-detail-title"
            onMouseDown={(event) => event.stopPropagation()}
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
                    id="notification-detail-title"
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


              {selectedNotification.decision_admin && (
                <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-slate-700">
                  <p className="font-semibold text-blue-900">Décision de l’Administrateur : {getDecisionLabel(selectedNotification.decision_admin)}</p>
                  {selectedNotification.motif_decision && <p className="mt-1 whitespace-pre-line">Motif : {selectedNotification.motif_decision}</p>}
                  {selectedNotification.date_decision && <p className="mt-1 text-xs text-slate-500">Décision enregistrée le {formatDate(selectedNotification.date_decision, true)}</p>}
                </div>
              )}

              {selectedNotification.anomalie_id && (

                <div
                  className="
                    mt-5
                    rounded-2xl
                    border
                    border-[var(--jr-err-bordure)]
                    bg-[var(--jr-err-pale)]
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
                        Référence client
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
                  border-[var(--jr-err-bordure)]
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
    </AdminShell>
  );
}


export default NotificationsPage;