import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

const CONFIG = {
  error: {
    Icon: AlertCircle,
    role: 'alert',
    classes: 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200',
  },
  success: {
    Icon: CheckCircle2,
    role: 'status',
    classes: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200',
  },
  info: {
    Icon: Info,
    role: 'status',
    classes: 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-200',
  },
  warning: {
    Icon: AlertCircle,
    role: 'status',
    classes: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200',
  },
};

/**
 * Message d'interface réutilisable. Ce composant contient du JSX et doit
 * rester dans un fichier .jsx, jamais dans hooks/useTheme.js.
 */
export default function AlertMessage({
  type = 'info',
  title,
  children,
  onClose,
  actionLabel,
  onAction,
  className = '',
}) {
  const config = CONFIG[type] || CONFIG.info;
  const Icon = config.Icon;

  return (
    <div
      role={config.role}
      className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${config.classes} ${className}`}
    >
      <Icon size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title && <div className="mb-1 font-semibold">{title}</div>}
        <div>{children}</div>
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="mt-2 font-semibold underline underline-offset-2 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
          >
            {actionLabel}
          </button>
        )}
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 opacity-70 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
          aria-label="Fermer le message"
        >
          <X size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
