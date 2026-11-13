import { AlertCircle, CheckCircle2, X } from 'lucide-react';

/**
 * Toast de retour utilisateur (succès / erreur) affiché en haut à droite.
 * Fermeture automatique gérée par le hook useNotifications.
 */
export default function NotificationToast({ toast, onClose }) {
  if (!toast) return null;

  const estErreur = toast.type === 'error';

  return (
    <div
      className="fixed right-4 top-4 z-[80] w-[min(92vw,420px)]"
      role={estErreur ? 'alert' : 'status'}
      aria-live={estErreur ? 'assertive' : 'polite'}
    >
      <div
        className={`jn-toast-card flex items-start gap-3 rounded-2xl border p-4 shadow-xl ${
          estErreur
            ? 'border-red-200 bg-white text-red-800'
            : 'border-emerald-200 bg-white text-emerald-800'
        }`}
      >
        {estErreur ? (
          <AlertCircle size={20} className="mt-0.5 shrink-0" />
        ) : (
          <CheckCircle2 size={20} className="mt-0.5 shrink-0" />
        )}

        <p className="flex-1 text-sm font-semibold">{toast.message}</p>

        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer la notification"
          title="Fermer"
          className="rounded-lg p-1 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <X size={17} />
        </button>
      </div>
    </div>
  );
}
