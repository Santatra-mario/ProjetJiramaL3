import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  useNavigate,
} from 'react-router-dom';

import {
  Archive,
  Bell,
  CheckCheck,
  Clock3,
  Trash2,
  TriangleAlert,
  X,
} from 'lucide-react';

import axiosClient from "../../api/axiosClient";

import AgentLayout from "../../components/admin/agent/AgentLayout";
import NotificationConfirmDialog from '../../components/notifications/NotificationConfirmDialog.jsx';
import { signalerChangementNotifications } from '../../components/admin/agent/notificationsAgent.js';


function formatDateTime(
  value
) {

  if (!value) {
    return '—';
  }

  const date =
    new Date(
      value
    );

  return Number.isNaN(
    date.getTime()
  )
    ? '—'
    : date.toLocaleString(
        'fr-FR',
        {
          dateStyle:
            'short',

          timeStyle:
            'short',
        }
      );
}


function normalizeDecisionStatus(value) {
  return String(value || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
}

function getAdminDecision(notification) {
  const status = normalizeDecisionStatus(notification.statut_anomalie);
  const motif = String(
    notification.motif_administrateur ??
    notification.commentaire_anomalie ??
    ''
  ).trim();

  if (['REFUSEE', 'REFUSE', 'REJETEE', 'REJETE'].includes(status)) {
    return {
      type: 'refusee',
      label: 'Refusé par l’Administrateur',
      motif,
    };
  }

  if (['TRAITEE', 'TRAITE', 'RESOLUE', 'RESOLU', 'VALIDEE', 'VALIDE'].includes(status)) {
    return {
      type: 'traitee',
      label: 'Déjà traité par l’Administrateur',
      motif,
    };
  }

  return null;
}

function decisionBadgeClass(decision) {
  return decision?.type === 'refusee'
    ? 'border-red-200 bg-red-50 text-red-700'
    : 'border-emerald-200 bg-emerald-50 text-emerald-700';
}

function decisionMessageClass(decision) {
  return decision?.type === 'refusee'
    ? 'border-red-200 bg-red-50/80 text-red-800'
    : 'border-emerald-200 bg-emerald-50/80 text-emerald-800';
}

function AgentNotificationsPage() {

  const navigate =
    useNavigate();


  const [
    notifications,
    setNotifications,
  ] =
    useState([]);


  const [
    loading,
    setLoading,
  ] =
    useState(true);


  const [
    processing,
    setProcessing,
  ] =
    useState(false);


  const [
    error,
    setError,
  ] =
    useState('');

  const [success, setSuccess] = useState('');
  const [pendingAction, setPendingAction] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);


  async function loadNotifications() {

    try {

      setLoading(
        true
      );

      setError('');


      const response =
        await axiosClient.get(
          '/agent/notifications'
        );


      if (
        response.data?.status !==
        'success'
      ) {

        throw new Error(
          response.data?.message ||
          'Impossible de charger les notifications.'
        );

      }


      setNotifications(
        response.data?.data ||
        []
      );

    } catch (
      requestError
    ) {

      console.error(
        'Erreur notifications Agent :',
        requestError
      );


      if (
        requestError.response?.status ===
          401 ||
        requestError.response?.status ===
          403
      ) {

        navigate(
          '/',
          {
            replace: true,
          }
        );

        return;
      }


      setError(
        requestError.response?.data?.message ||
        requestError.message ||
        'Erreur lors du chargement des notifications.'
      );

    } finally {

      setLoading(
        false
      );

    }

  }


  useEffect(
    () => {

      loadNotifications();

    },
    []
  );


  const unread =
    useMemo(
      () =>
        notifications.filter(
          (
            item
          ) =>
            item.statut ===
            'EN_ATTENTE'
        ),

      [
        notifications,
      ]
    );


  async function markAsRead(
    id
  ) {

    try {

      setProcessing(
        true
      );


      await axiosClient.patch(
        `/agent/notifications/${id}/lue`
      );


      setNotifications(
        (
          previous
        ) =>
          previous.map(
            (
              item
            ) =>
              Number(
                item.id
              ) ===
              Number(id)

                ? {
                    ...item,
                    statut:
                      'ENVOYE',
                  }

                : item
          )
      );
      signalerChangementNotifications({ source: 'lecture', id });

    } catch (
      requestError
    ) {

      console.error(
        'Erreur lecture notification :',
        requestError
      );


      setError(
        requestError.response?.data?.message ||
        requestError.message ||
        'Impossible de traiter la notification.'
      );

    } finally {

      setProcessing(
        false
      );

    }

  }


  function requestNotificationAction(notification, action) {
    if (!notification || actionBusy) return;
    setError('');
    setSuccess('');
    setPendingAction({ notification, action });
  }

  async function confirmNotificationAction() {
    if (!pendingAction || actionBusy) return;
    const { notification, action } = pendingAction;
    const id = notification.id;

    try {
      setActionBusy(true);
      setError('');
      setSuccess('');

      const response = action === 'archiver'
        ? await axiosClient.patch(`/notifications/${id}/archiver`)
        : await axiosClient.delete(`/notifications/${id}`);

      if (response.data?.status !== 'success') {
        throw new Error(response.data?.message || 'L’opération sur la notification a échoué.');
      }

      setNotifications((previous) => previous.filter((item) => String(item.id) !== String(id)));
      signalerChangementNotifications({ source: action, id });
      setPendingAction(null);
      setSuccess(response.data?.message || (action === 'archiver'
        ? 'Notification archivée. Vous pourrez la restaurer depuis les paramètres.'
        : 'Notification supprimée de votre liste.'));
    } catch (requestError) {
      console.error('Erreur opération notification Agent :', requestError);
      if ([401, 403].includes(requestError.response?.status)) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/', { replace: true });
        return;
      }
      setPendingAction(null);
      setError(
        requestError.response?.data?.message ||
        requestError.message ||
        'Impossible de modifier cette notification.'
      );
    } finally {
      setActionBusy(false);
    }
  }

  async function markAllAsRead() {

    if (
      unread.length ===
      0
    ) {

      return;

    }


    try {

      setProcessing(
        true
      );


      await axiosClient.patch(
        '/agent/notifications/lire-tout'
      );


      setNotifications(
        (
          previous
        ) =>
          previous.map(
            (
              item
            ) => ({

              ...item,

              statut:
                'ENVOYE',

            })
          )
      );
      signalerChangementNotifications({ source: 'lecture-globale' });

    } catch (
      requestError
    ) {

      console.error(
        'Erreur lecture globale notifications :',
        requestError
      );


      setError(
        requestError.response?.data?.message ||
        requestError.message ||
        'Impossible de traiter les notifications.'
      );

    } finally {

      setProcessing(
        false
      );

    }

  }


  return (

    <AgentLayout
      title="Notifications"
    >

      <div
        className="
          space-y-6
        "
      >

        <section
          className="
            rounded-3xl
            border
            border-slate-200
            bg-white
            p-5
            shadow-sm
            sm:p-6
          "
        >

          <div
            className="
              flex
              flex-col
              justify-between
              gap-5
              lg:flex-row
              lg:items-center
            "
          >

            <div>

              <p
                className="
                  text-xs
                  font-bold
                  uppercase
                  tracking-[0.16em]
                  text-amber-600
                "
              >
                Alertes
              </p>

              <h2
                className="
                  mt-1
                  text-2xl
                  font-black
                  text-slate-900
                "
              >
                Notifications Agent
              </h2>

              <p
                className="
                  mt-2
                  text-sm
                  text-slate-500
                "
              >
                Les alertes de consommation
                détectées sont regroupées ici.
              </p>

            </div>


            <div
              className="
                flex
                flex-wrap
                items-center
                gap-3
              "
            >

              <div
                className="
                  rounded-2xl
                  bg-red-50
                  px-4
                  py-3
                  text-sm
                  font-bold
                  text-red-700
                "
              >
                {
                  unread.length
                } non lue(s)
              </div>


              <button
                type="button"
                onClick={() => navigate('/dashboard/agent/parametres?section=notifications-archivees')}
                className="inline-flex items-center gap-2 rounded-xl border border-jr-bordure-forte bg-jr-surface px-4 py-3 text-sm font-semibold text-jr-texte transition-colors hover:bg-jr-champ focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jr-focus motion-reduce:transition-none"
              >
                <Archive size={17} />
                Archives
              </button>

              <button
                type="button"
                onClick={
                  markAllAsRead
                }
                disabled={
                  processing ||
                  unread.length ===
                    0
                }
                className="
                  inline-flex
                  items-center
                  gap-2
                  rounded-2xl
                  bg-blue-600
                  px-4
                  py-3
                  text-sm
                  font-bold
                  text-white
                  hover:bg-blue-700
                  disabled:cursor-not-allowed
                  disabled:opacity-50
                "
              >

                <CheckCheck
                  size={17}
                />

                Tout marquer comme lu

              </button>

            </div>

          </div>

        </section>


        {error && (

          <div
            className="
              flex
              items-start
              gap-3
              rounded-2xl
              border
              border-red-200
              bg-red-50
              px-4
              py-3
              text-sm
              font-medium
              text-red-700
            "
          >

            <X
              size={18}
              className="
                mt-0.5
                shrink-0
              "
            />

            <span>
              {error}
            </span>

          </div>

        )}


        {success && (
          <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
            {success}
          </div>
        )}

        <section
          className="
            space-y-3
          "
        >

          {loading ? (

            <div
              className="
                rounded-3xl
                border
                border-slate-200
                bg-white
                px-5
                py-14
                text-center
                text-sm
                text-slate-500
                shadow-sm
              "
            >
              Chargement…
            </div>

          ) : notifications.length ===
            0 ? (

            <div
              className="
                rounded-3xl
                border
                border-slate-200
                bg-white
                px-5
                py-14
                text-center
                shadow-sm
              "
            >

              <div
                className="
                  mx-auto
                  flex
                  h-14
                  w-14
                  items-center
                  justify-center
                  rounded-2xl
                  bg-slate-100
                  text-slate-500
                "
              >
                <Bell size={25} />
              </div>


              <p
                className="
                  mt-4
                  font-bold
                  text-slate-800
                "
              >
                Aucune notification
              </p>


              <p
                className="
                  mt-1
                  text-sm
                  text-slate-500
                "
              >
                Vous n’avez aucune
                alerte à afficher.
              </p>

            </div>

          ) : (

            notifications.map(
              (
                notification
              ) => {

                const unreadItem =
                  notification.statut ===
                  'EN_ATTENTE';

                const decision = getAdminDecision(notification);

                return (

                  <article
                    key={
                      notification.id
                    }
                    className={`
                      rounded-3xl
                      border
                      p-5
                      shadow-sm
                      ${
                        unreadItem
                          ? `
                            border-amber-200
                            bg-amber-50/40
                          `
                          : `
                            border-slate-200
                            bg-white
                          `
                      }
                    `}
                  >

                    <div
                      className="
                        flex
                        flex-col
                        gap-4
                        lg:flex-row
                        lg:items-start
                      "
                    >

                      <div
                        className={`
                          rounded-2xl
                          p-3
                          ${
                            unreadItem
                              ? `
                                bg-amber-100
                                text-amber-700
                              `
                              : `
                                bg-slate-100
                                text-slate-500
                              `
                          }
                        `}
                      >

                        {
                          notification.type ===
                          'ALERTE_ANOMALIE'
                            ? (
                              <TriangleAlert
                                size={21}
                              />
                            )
                            : (
                              <Bell
                                size={21}
                              />
                            )
                        }

                      </div>


                      <div
                        className="
                          min-w-0
                          flex-1
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

                          <h3
                            className="
                              text-base
                              font-bold
                              text-slate-900
                            "
                          >
                            {
                              notification.sujet ||
                              'Notification'
                            }
                          </h3>


                          {decision ? (
                            <span
                              className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-extrabold ${decisionBadgeClass(decision)}`}
                            >
                              {decision.label}
                            </span>
                          ) : unreadItem ? (
                            <span
                              className="rounded-full bg-red-500 px-2.5 py-1 text-[10px] font-bold text-white"
                            >
                              NOUVELLE
                            </span>
                          ) : null}

                        </div>


                        <p
                          className="
                            mt-2
                            text-sm
                            leading-6
                            text-slate-600
                          "
                        >
                          {
                            notification.message
                          }
                        </p>

                        {decision && (
                          <div className={`mt-4 rounded-2xl border p-4 ${decisionMessageClass(decision)}`}>
                            <p className="text-xs font-extrabold uppercase tracking-wide">
                              Message de l’Administrateur
                            </p>
                            <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-6">
                              {decision.motif || 'Aucun motif enregistré par l’Administrateur.'}
                            </p>
                          </div>
                        )}

                        <div
                          className="
                            mt-3
                            flex
                            flex-wrap
                            items-center
                            gap-4
                            text-xs
                            text-slate-400
                          "
                        >

                          <span
                            className="
                              inline-flex
                              items-center
                              gap-1.5
                            "
                          >

                            <Clock3
                              size={14}
                            />

                            {
                              formatDateTime(
                                notification.created_at ||
                                notification.date_envoi
                              )
                            }

                          </span>


                          {notification.numero_compteur && (

                            <span>

                              Compteur :
                              {' '}

                              <strong
                                className="
                                  text-slate-600
                                "
                              >
                                {
                                  notification.numero_compteur
                                }
                              </strong>

                            </span>

                          )}


                          {notification.type_anomalie && (

                            <span>

                              Type :
                              {' '}

                              <strong
                                className="
                                  text-slate-600
                                "
                              >
                                {
                                  notification.type_anomalie
                                }
                              </strong>

                            </span>

                          )}

                        </div>

                      </div>


                      <div className="flex shrink-0 flex-wrap gap-2 lg:flex-col">
                        {unreadItem && (
                          <button
                            type="button"
                            onClick={() => markAsRead(notification.id)}
                            disabled={processing || actionBusy}
                            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-jr-eau px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-jr-eau-fonce disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
                          >
                            <CheckCheck size={16} />
                            Marquer lue
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => requestNotificationAction(notification, 'archiver')}
                          disabled={actionBusy || processing}
                          aria-label={`Archiver la notification ${notification.sujet || notification.id}`}
                          title="Archiver"
                          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-jr-bordure-forte bg-jr-surface px-3 py-2 text-sm font-semibold text-jr-texte transition-colors hover:bg-jr-champ disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
                        >
                          <Archive size={16} />
                          Archiver
                        </button>
                        <button
                          type="button"
                          onClick={() => requestNotificationAction(notification, 'supprimer')}
                          disabled={actionBusy || processing}
                          aria-label={`Supprimer la notification ${notification.sujet || notification.id}`}
                          title="Supprimer"
                          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-jr-err-bordure bg-jr-err-pale px-3 py-2 text-sm font-semibold text-jr-err transition-colors hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
                        >
                          <Trash2 size={16} />
                          Supprimer
                        </button>
                      </div>

                    </div>

                  </article>

                );

              }
            )

          )}

        </section>

      </div>

      <NotificationConfirmDialog
        open={Boolean(pendingAction)}
        action={pendingAction?.action || 'archiver'}
        notification={pendingAction?.notification}
        loading={actionBusy}
        onCancel={() => { if (!actionBusy) setPendingAction(null); }}
        onConfirm={confirmNotificationAction}
      />

    </AgentLayout>

  );
}

export default AgentNotificationsPage;