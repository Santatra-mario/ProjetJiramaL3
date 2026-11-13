import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import axiosClient from '../api/axiosClient.js';
import { TYPES_ALERTE } from '../components/notifications/notificationsFormat.js';
import { ecouterChangementAbonnes } from './abonnesSync.js';

/**
 * État et actions de la liste des notifications administrateur.
 * Centralise le chargement, les filtres, les statistiques, le détail
 * et les actions (traiter, archiver, restaurer, supprimer).
 */
export default function useNotifications() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [statutFilter, setStatutFilter] = useState('TOUS');
  const [archiveView, setArchiveView] = useState('actives');
  const [typeFilter, setTypeFilter] = useState('TOUS');

  const [selectedNotification, setSelectedNotification] = useState(null);

  // Suppression confirmée uniquement après validation explicite de l'utilisateur.
  const [pendingDelete, setPendingDelete] = useState(null);
  const [pendingArchive, setPendingArchive] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const [toast, setToast] = useState(null);

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
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (!token || !storedUser) {
      navigate('/', { replace: true });
      return;
    }

    try {
      const parsedUser = JSON.parse(storedUser);
      const role = String(parsedUser?.role || '')
        .trim()
        .toUpperCase();

      if (role !== 'ADMINISTRATEUR') {
        navigate('/', { replace: true });
        return;
      }

      setUser(parsedUser);
    } catch (parseError) {
      console.error('Erreur lecture utilisateur :', parseError);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      navigate('/', { replace: true });
    }
  }, [navigate]);

  /* =======================================================
     CHARGER LES NOTIFICATIONS
  ======================================================= */

  const loadNotifications = useCallback(
    async (isRefresh = false) => {
      try {
        setError('');

        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        // Le backend synchronise déjà les anomalies et les notifications
        // dans GET /notifications. Éviter un second POST ici empêche
        // de lancer deux analyses à chaque chargement ou actualisation.
        const response = await axiosClient.get('/notifications', {
          params: { vue: archiveView },
        });

        if (response.data?.status !== 'success') {
          throw new Error(
            response.data?.message || 'Impossible de récupérer les notifications.'
          );
        }

        const notificationList = response.data?.notifications ?? response.data?.data;

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
      } catch (requestError) {
        console.error('Erreur chargement notifications :', requestError);

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
            'Impossible de récupérer les notifications.'
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [navigate, archiveView]
  );

  useEffect(() => {
    if (!user) return;
    loadNotifications();
  }, [user, loadNotifications]);

  useEffect(() => ecouterChangementAbonnes(() => loadNotifications(true)), [loadNotifications]);

  /* =======================================================
     FILTRES
  ======================================================= */

  const notificationsFiltrees = useMemo(() => {
    const texte = search.trim().toLowerCase();

    return notifications.filter((notification) => {
      const statutNotification = String(notification.statut || '')
        .trim()
        .toUpperCase();

      const correspondStatut =
        statutFilter === 'TOUS' || statutNotification === statutFilter;

      const correspondType = typeFilter === 'TOUS' || notification.type === typeFilter;

      if (!correspondStatut || !correspondType) return false;
      if (!texte) return true;

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
      ].some((value) =>
        String(value || '')
          .toLowerCase()
          .includes(texte)
      );
    });
  }, [notifications, search, statutFilter, typeFilter]);

  /* =======================================================
     STATISTIQUES
  ======================================================= */

  const total = notifications.length;

  const enAttente = notifications.filter(
    (notification) =>
      String(notification.statut || '')
        .trim()
        .toUpperCase() === 'EN_ATTENTE'
  ).length;

  const traitees = notifications.filter(
    (notification) =>
      String(notification.statut || '')
        .trim()
        .toUpperCase() === 'ENVOYE'
  ).length;

  const alertes = notifications.filter((notification) =>
    TYPES_ALERTE.includes(String(notification.type || '').trim().toUpperCase())
  ).length;

  /* =======================================================
     DÉTAIL
  ======================================================= */

  const openNotification = async (notification) => {
    try {
      const response = await axiosClient.get(`/notifications/${notification.id}`);

      if (response.data?.status === 'error') {
        throw new Error(
          response.data?.message || 'Impossible de récupérer le détail de la notification.'
        );
      }

      setSelectedNotification(
        response.data?.notification || response.data?.data || notification
      );
    } catch (requestError) {
      console.error('Erreur détail notification :', requestError);
      setSelectedNotification(notification);
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

      const response = await axiosClient.patch(`/notifications/${notificationId}/lue`);

      if (response.data?.status !== 'success') {
        throw new Error(
          response.data?.message ||
            'Le serveur n’a pas confirmé le traitement de cette notification.'
        );
      }

      // Le backend renvoie la ligne réellement enregistrée en base.
      const notificationServeur = response.data?.notification ?? response.data?.data ?? null;

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

      setNotifications((previous) =>
        previous.map((notification) =>
          String(notification.id) === String(notificationId)
            ? { ...notification, ...notificationTraitee }
            : notification
        )
      );

      setSelectedNotification((previous) =>
        previous && String(previous.id) === String(notificationId)
          ? { ...previous, ...notificationTraitee }
          : previous
      );

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

      const message =
        requestError.response?.data?.message ||
        requestError.message ||
        'Impossible de traiter la notification. Veuillez réessayer.';

      setError(message);
      setToast({ type: 'error', message });
    } finally {
      setActionLoading(false);
    }
  };

  /* =======================================================
     TRAITER TOUTES
  ======================================================= */

  const markAllAsRead = async () => {
    try {
      setActionLoading(true);
      setError('');

      const response = await axiosClient.patch('/notifications/lire-tout');

      if (response.data?.status !== 'success') {
        throw new Error(
          response.data?.message || 'Impossible de traiter les notifications.'
        );
      }

      const treatedAt = new Date().toISOString();

      setNotifications((previous) =>
        previous.map((notification) =>
          String(notification.statut || '').trim().toUpperCase() === 'EN_ATTENTE'
            ? {
                ...notification,
                statut: 'ENVOYE',
                date_envoi: notification.date_envoi || treatedAt,
              }
            : notification
        )
      );

      setSelectedNotification((previous) =>
        previous?.statut === 'EN_ATTENTE'
          ? {
              ...previous,
              statut: 'ENVOYE',
              date_envoi: previous.date_envoi || treatedAt,
            }
          : previous
      );

      setToast({
        type: 'success',
        message: response.data?.message || 'Toutes les notifications ont été traitées.',
      });
    } catch (requestError) {
      console.error('Erreur traitement notifications :', requestError);

      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          'Impossible de traiter les notifications.'
      );
    } finally {
      setActionLoading(false);
    }
  };

  /* =======================================================
     SUPPRIMER
  ======================================================= */

  // Ouvre la confirmation personnalisée sans appeler le backend.
  const deleteNotification = (notificationId) => {
    const notification = notifications.find((item) => item.id === notificationId);

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

      const response = await axiosClient.delete(`/notifications/${notificationId}`);

      if (response.data?.status !== 'success') {
        throw new Error(
          response.data?.message || 'Impossible de supprimer la notification.'
        );
      }

      // Le backend peut supprimer plusieurs doublons liés à la même anomalie.
      // Utiliser les identifiants réellement renvoyés par le serveur.
      const idsSupprimes = new Set(
        (
          Array.isArray(response.data?.deletedIds) && response.data.deletedIds.length > 0
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
        (selectedNotification?.id != null &&
          idsSupprimes.has(String(selectedNotification.id))) ||
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
    if (!notification || actionLoading) return false;

    const isRestore = action === 'restaurer';

    try {
      setActionLoading(true);
      setError('');

      const response = await axiosClient.patch(
        `/notifications/${notification.id}/${action}`
      );

      if (response.data?.status !== 'success') {
        throw new Error(response.data?.message || 'Impossible de modifier l’archivage.');
      }

      setNotifications((previous) =>
        previous.filter((item) => String(item.id) !== String(notification.id))
      );

      if (String(selectedNotification?.id) === String(notification.id)) {
        setSelectedNotification(null);
      }

      setToast({
        type: 'success',
        message:
          response.data?.message ||
          (isRestore ? 'Notification restaurée.' : 'Notification archivée.'),
      });

      return true;
    } catch (requestError) {
      const status = requestError.response?.status;
      if (status === 401 || status === 403) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/', { replace: true });
        return false;
      }

      setToast({
        type: 'error',
        message:
          requestError.response?.data?.message ||
          requestError.message ||
          'Impossible de modifier l’archivage.',
      });
      return false;
    } finally {
      setActionLoading(false);
    }
  };

  const archiveNotification = (notification) => setPendingArchive(notification);

  const confirmerArchivage = async () => {
    if (!pendingArchive || actionLoading) return;
    const ok = await changeArchiveState(pendingArchive, 'archiver');
    if (ok) setPendingArchive(null);
  };

  const restoreNotification = (notification) =>
    changeArchiveState(notification, 'restaurer');

  return {
    user,
    notifications,
    notificationsFiltrees,
    loading,
    refreshing,
    actionLoading,
    error,
    dismissError: () => setError(''),
    toast,
    dismissToast: () => setToast(null),
    search,
    setSearch,
    statutFilter,
    setStatutFilter,
    archiveView,
    setArchiveView,
    typeFilter,
    setTypeFilter,
    selectedNotification,
    setSelectedNotification,
    pendingDelete,
    setPendingDelete,
    pendingArchive,
    setPendingArchive,
    deletingId,
    loadNotifications,
    openNotification,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    confirmDeleteNotification,
    archiveNotification,
    confirmerArchivage,
    restoreNotification,
    total,
    enAttente,
    traitees,
    alertes,
  };
}
