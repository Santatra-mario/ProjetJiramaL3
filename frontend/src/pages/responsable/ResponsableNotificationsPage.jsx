import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  AlertTriangle,
  Bell,
  CheckCheck,
  RefreshCw,
} from 'lucide-react';

import { useNavigate } from 'react-router-dom';
import axiosClient from "../../api/axiosClient";
import ResponsableLayout from "../../components/admin/responsable/ResponsableLayout";

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString('fr-FR', {
        dateStyle: 'short',
        timeStyle: 'short',
      });
}

export default function ResponsableNotificationsPage() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  async function loadNotifications(refresh = false) {
    try {
      setError('');
      refresh ? setRefreshing(true) : setLoading(true);

      const response = await axiosClient.get('/responsable/notifications');

      if (response.data?.status !== 'success') {
        throw new Error(
          response.data?.message ||
            'Impossible de charger les notifications.'
        );
      }

      setNotifications(
        Array.isArray(response.data?.data)
          ? response.data.data
          : Array.isArray(response.data?.notifications)
            ? response.data.notifications
            : []
      );
    } catch (requestError) {
      console.error('Erreur notifications Responsable :', requestError);

      if ([401, 403].includes(requestError.response?.status)) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/', { replace: true });
        return;
      }

      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          'Erreur lors du chargement des notifications.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadNotifications();
  }, []);

  const unread = useMemo(
    () =>
      notifications.filter(
        (item) => String(item.statut || '').toUpperCase() === 'EN_ATTENTE'
      ),
    [notifications]
  );

  async function markAsRead(id) {
    try {
      setProcessing(true);
      await axiosClient.patch(`/responsable/notifications/${id}/lue`);
      await loadNotifications(true);
    } catch (requestError) {
      console.error('Erreur lecture notification :', requestError);
      setError(
        requestError.response?.data?.message ||
          'Impossible de marquer la notification comme lue.'
      );
    } finally {
      setProcessing(false);
    }
  }

  async function markAllAsRead() {
    if (unread.length === 0) return;

    try {
      setProcessing(true);
      await axiosClient.patch('/responsable/notifications/lire-tout');
      await loadNotifications(true);
    } catch (requestError) {
      console.error('Erreur lecture globale :', requestError);
      setError(
        requestError.response?.data?.message ||
          'Impossible de marquer les notifications comme lues.'
      );
    } finally {
      setProcessing(false);
    }
  }

  return (
    <ResponsableLayout title="Notifications Responsable">
      <div className="space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">
                Alertes
              </p>
              <h2 className="mt-1 text-2xl font-black text-slate-900">
                Toutes les notifications
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Les anomalies générées par le système sont visibles dans votre compte Responsable.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-black text-red-700">
                {unread.length} non lue(s)
              </span>
              <button
                type="button"
                onClick={() => loadNotifications(true)}
                disabled={refreshing}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCw size={17} className={refreshing ? 'animate-spin' : ''} />
                Actualiser
              </button>
              <button
                type="button"
                onClick={markAllAsRead}
                disabled={processing || unread.length === 0}
                className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <CheckCheck size={17} />
                Tout marquer comme lu
              </button>
            </div>
          </div>
        </section>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center text-slate-500 shadow-sm">
            Chargement des notifications...
          </div>
        ) : notifications.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-sm">
            <Bell size={42} className="mx-auto text-slate-300" />
            <h3 className="mt-4 text-lg font-black text-slate-800">
              Aucune notification
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              Les prochaines anomalies apparaîtront ici automatiquement.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {notifications.map((notification) => {
              const unreadItem =
                String(notification.statut || '').toUpperCase() === 'EN_ATTENTE';

              return (
                <article
                  key={notification.id}
                  className={`rounded-3xl border bg-white p-5 shadow-sm ${
                    unreadItem ? 'border-red-200' : 'border-slate-200'
                  }`}
                >
                  <div className="flex gap-4">
                    <div className={`rounded-2xl p-3 ${unreadItem ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-500'}`}>
                      <AlertTriangle size={22} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                        <div>
                          <h3 className="font-black text-slate-900">
                            {notification.sujet || 'Alerte de supervision'}
                          </h3>
                          <p className="mt-1 text-xs text-slate-400">
                            {formatDateTime(
                              notification.created_at || notification.date_envoi
                            )}
                          </p>
                        </div>

                        <span
                          className={`w-fit rounded-full border px-3 py-1 text-[11px] font-black ${
                            unreadItem
                              ? 'border-amber-200 bg-amber-50 text-amber-700'
                              : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          {unreadItem ? 'Non lue' : 'Lue'}
                        </span>
                      </div>

                      <p className="mt-4 text-sm leading-6 text-slate-700">
                        {notification.message || 'Notification de supervision.'}
                      </p>

                      {notification.anomalie_id && (
                        <p className="mt-3 text-xs font-semibold text-slate-400">
                          Anomalie #{notification.anomalie_id}
                        </p>
                      )}

                      {unreadItem && (
                        <button
                          type="button"
                          onClick={() => markAsRead(notification.id)}
                          disabled={processing}
                          className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50"
                        >
                          Marquer comme lue
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </ResponsableLayout>
  );
}
