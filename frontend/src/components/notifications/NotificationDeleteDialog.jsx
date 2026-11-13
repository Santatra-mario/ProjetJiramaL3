import { Loader2, Trash2, X } from 'lucide-react';

/**
 * Confirmation de suppression (role="alertdialog"). Le backend n'est appelé
 * qu'après validation explicite via onConfirm.
 */
export default function NotificationDeleteDialog({
  notification,
  deleting,
  onConfirm,
  onCancel,
}) {
  if (!notification) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/55 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && deleting === false) {
          onCancel();
        }
      }}
    >
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-notification-title"
        aria-describedby="delete-notification-description"
        className="jn-modal-surface w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
            <Trash2 size={21} />
          </div>

          <div className="min-w-0 flex-1">
            <h2
              id="delete-notification-title"
              className="text-lg font-bold text-slate-900"
            >
              Confirmer la suppression
            </h2>
            <p
              id="delete-notification-description"
              className="mt-2 text-sm leading-6 text-slate-600"
            >
              Voulez-vous vraiment supprimer cette notification ?
            </p>
            {notification.sujet && (
              <p className="mt-2 break-words text-sm font-semibold text-slate-800">
                « {notification.sujet} »
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            aria-label="Fermer la confirmation"
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Annuler
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-700 active:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {deleting ? (
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
  );
}
