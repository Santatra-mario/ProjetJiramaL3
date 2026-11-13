import { useState } from 'react';

import { useNavigate } from 'react-router-dom';

import { AlertCircle, Bell, Check, ChevronLeft, RefreshCw, X } from 'lucide-react';

import Sidebar from '../../components/admin/Sidebar.jsx';
import Header from '../../components/admin/Header.jsx';
import AdminShell from '../../components/admin/AdminShell.jsx';

import NotificationConfirmDialog from '../../components/notifications/NotificationConfirmDialog.jsx';
import NotificationDeleteDialog from '../../components/notifications/NotificationDeleteDialog.jsx';
import NotificationDetailDialog from '../../components/notifications/NotificationDetailDialog.jsx';
import NotificationToast from '../../components/notifications/NotificationToast.jsx';
import NotificationsFiltres from '../../components/notifications/NotificationsFiltres.jsx';
import NotificationsKpis from '../../components/notifications/NotificationsKpis.jsx';
import NotificationsTable from '../../components/notifications/NotificationsTable.jsx';

import useNotifications from '../../hooks/useNotifications.js';

/* =========================================================
   PAGE — liste des notifications administrateur
========================================================= */

function NotificationsPage() {
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const {
    user,
    notifications,
    notificationsFiltrees,
    loading,
    refreshing,
    actionLoading,
    error,
    dismissError,
    toast,
    dismissToast,
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
  } = useNotifications();

  const goBack = () => {
    navigate('/dashboard/admin');
  };

  return (
    <AdminShell
      intensite="calme"
      className="selection:bg-[var(--jr-elec)] selection:text-[var(--jr-sur-elec)]"
    >
      <div className="jn-notifications min-h-screen">
        {/* =================================================
            SIDEBAR
        ================================================= */}

        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          activePath="/dashboard/admin/notifications"
          onNavigate={navigate}
          onLogout={() => {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            navigate('/', { replace: true });
          }}
          user={user}
        />

        <div className="lg:pl-72">
          {/* =================================================
              HEADER
          ================================================= */}

          <Header
            onOpenSidebar={() => setSidebarOpen(true)}
            onProfile={() => console.log('Profil administrateur')}
            onNotifications={() => navigate('/dashboard/admin/notifications')}
            notificationCount={enAttente}
            user={user}
          />

          {/* =================================================
              CONTENU
          ================================================= */}

          <main className="jn-notifications-content p-4 sm:p-6 lg:p-8">
            {/* =================================================
                EN-TÊTE
            ================================================= */}

            <div className="jn-page-heading mb-7 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <button
                  type="button"
                  onClick={goBack}
                  className="jn-back-button mb-3 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  <ChevronLeft size={17} />
                  Retour au dashboard
                </button>

                <div className="flex items-start gap-3">
                  <div className="jn-title-mark flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                    <Bell size={23} />
                  </div>

                  <div>
                    <h2 className="jn-page-title text-2xl font-bold text-slate-900 sm:text-3xl">
                      Notifications
                    </h2>

                    <p className="jn-page-summary mt-1 max-w-3xl text-sm text-slate-500">
                      Centralisation des alertes générées par le système, notamment lors de
                      la détection d'une consommation potentiellement anormale.
                    </p>
                  </div>
                </div>
              </div>

              <div className="jn-header-actions flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => loadNotifications(true)}
                  disabled={refreshing || loading}
                  className="jn-action-button jn-action-button--secondary inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RefreshCw size={17} className={refreshing ? 'animate-spin' : ''} />
                  Actualiser
                </button>

                <button
                  type="button"
                  onClick={markAllAsRead}
                  disabled={actionLoading || enAttente === 0}
                  className="jn-action-button jn-action-button--primary inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Check size={17} />
                  Tout traiter
                </button>
              </div>
            </div>

            {/* =================================================
                ERREUR
            ================================================= */}

            {error && (
              <div className="jn-alert jn-alert--error mb-5 flex items-start gap-3 rounded-2xl border border-[var(--jr-err-bordure)] bg-red-50 p-4 text-sm text-red-700">
                <AlertCircle size={19} className="mt-0.5 shrink-0" />

                <div className="flex-1">
                  <p className="font-semibold">Erreur</p>
                  <p className="mt-1">{error}</p>
                </div>

                <button
                  type="button"
                  onClick={dismissError}
                  aria-label="Fermer le message d'erreur"
                  className="rounded-lg p-1 transition hover:bg-red-100"
                >
                  <X size={17} />
                </button>
              </div>
            )}

            {/* =================================================
                KPI
            ================================================= */}

            <NotificationsKpis
              total={total}
              enAttente={enAttente}
              traitees={traitees}
              alertes={alertes}
            />

            {/* =================================================
                FILTRES
            ================================================= */}

            <NotificationsFiltres
              search={search}
              setSearch={setSearch}
              statutFilter={statutFilter}
              setStatutFilter={setStatutFilter}
              typeFilter={typeFilter}
              setTypeFilter={setTypeFilter}
              archiveView={archiveView}
              setArchiveView={setArchiveView}
              onShowArchives={() => navigate('/dashboard/admin/parametres?section=archives')}
            />

            {/* =================================================
                TABLEAU
            ================================================= */}

            <NotificationsTable
              loading={loading}
              notificationsFiltrees={notificationsFiltrees}
              notificationsTotal={notifications.length}
              archiveView={archiveView}
              actionLoading={actionLoading}
              onOpen={openNotification}
              onTreat={markAsRead}
              onArchive={archiveNotification}
              onRestore={restoreNotification}
              onDelete={deleteNotification}
              masquerTraitement
            />
          </main>
        </div>

        {/* =====================================================
            OVERLAYS
        ===================================================== */}

        <NotificationToast toast={toast} onClose={dismissToast} />

        <NotificationDeleteDialog
          notification={pendingDelete}
          deleting={deletingId !== null}
          onConfirm={confirmDeleteNotification}
          onCancel={() => setPendingDelete(null)}
        />

        <NotificationConfirmDialog
          open={Boolean(pendingArchive)}
          action="archive"
          subject={pendingArchive?.sujet || 'cette notification'}
          busy={actionLoading}
          onConfirm={confirmerArchivage}
          onCancel={() => {
            if (!actionLoading) setPendingArchive(null);
          }}
        />

        <NotificationDetailDialog
          notification={selectedNotification}
          actionLoading={actionLoading}
          onClose={() => setSelectedNotification(null)}
          onTreat={markAsRead}
          onDelete={deleteNotification}
          masquerTraitement
        />
      </div>
    </AdminShell>
  );
}

export default NotificationsPage;
