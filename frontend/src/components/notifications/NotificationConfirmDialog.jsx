import { useEffect, useRef } from 'react';
import { Archive, LoaderCircle, Trash2, X } from 'lucide-react';

/**
 * Dialogue de confirmation partagé pour les opérations de notification.
 * Aucune requête n'est exécutée par ce composant : il ne fait qu'afficher
 * la confirmation et appeler les callbacks fournis par la page.
 */
export default function NotificationConfirmDialog({
  open,
  action = 'archiver',
  notification,
  loading = false,
  onCancel,
  onConfirm,
}) {
  const dialogRef = useRef(null);
  const cancelRef = useRef(null);
  const openerRef = useRef(null);

  const latestPropsRef = useRef({ loading, onCancel });

  useEffect(() => {
    latestPropsRef.current = { loading, onCancel };
  }, [loading, onCancel]);

  useEffect(() => {
    if (!open) return undefined;

    openerRef.current = document.activeElement;
    const frame = window.requestAnimationFrame(() => cancelRef.current?.focus());

    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !latestPropsRef.current.loading) {
        event.preventDefault();
        latestPropsRef.current.onCancel?.();
      }

      if (event.key !== 'Tab') return;
      const items = dialogRef.current?.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!items?.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('keydown', onKeyDown);
      if (openerRef.current && typeof openerRef.current.focus === 'function') {
        openerRef.current.focus();
      }
    };
  }, [open]);

  if (!open) return null;

  const deleting = action === 'supprimer';
  const title = deleting ? 'Confirmer la suppression' : 'Confirmer l’archivage';
  const confirmLabel = deleting ? 'Oui, supprimer' : 'Oui, archiver';
  const subject = String(notification?.sujet || 'Notification sans titre');
  const message = deleting
    ? 'Cette notification sera retirée de votre liste. Le relevé et l’anomalie associés seront conservés.'
    : 'Cette notification sera retirée de la liste active. Vous pourrez la retrouver dans les paramètres et la restaurer.';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !loading) onCancel?.();
      }}
    >
      <section
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="jr-notification-confirm-title"
        aria-describedby="jr-notification-confirm-description"
        className="jr-verre-fort w-full max-w-md rounded-2xl border border-jr-bordure p-5 shadow-2xl sm:p-6"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
              deleting ? 'bg-jr-err-pale text-jr-err' : 'bg-jr-eau-pale text-jr-lien'
            }`}
            aria-hidden="true"
          >
            {deleting ? <Trash2 size={20} /> : <Archive size={20} />}
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="jr-notification-confirm-title" className="text-lg font-bold text-jr-titre">
              {title}
            </h2>
            <p id="jr-notification-confirm-description" className="mt-2 text-sm leading-6 text-jr-doux">
              {message}
            </p>
            <p className="mt-3 break-words rounded-lg border border-jr-bordure bg-jr-champ px-3 py-2 text-sm font-semibold text-jr-texte">
              « {subject} »
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            aria-label="Fermer la confirmation"
            className="rounded-lg p-2 text-jr-faible transition-colors hover:bg-jr-eau-pale hover:text-jr-texte focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jr-focus disabled:opacity-50 motion-reduce:transition-none"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="inline-flex min-h-10 items-center justify-center rounded-lg border border-jr-bordure-forte bg-jr-surface px-4 py-2.5 text-sm font-semibold text-jr-texte transition-colors hover:bg-jr-champ focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jr-focus disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jr-focus focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none ${
              deleting ? 'bg-jr-err hover:brightness-95' : 'bg-jr-eau hover:bg-jr-eau-fonce'
            }`}
          >
            {loading && <LoaderCircle size={16} className="animate-spin motion-reduce:animate-none" />}
            {loading ? (deleting ? 'Suppression…' : 'Archivage…') : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
