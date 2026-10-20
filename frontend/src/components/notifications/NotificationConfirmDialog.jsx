import { useEffect, useRef } from 'react';
import { Archive, LoaderCircle, Trash2, X } from 'lucide-react';

export default function NotificationConfirmDialog({
  open,
  action = 'archive',
  subject = 'cette notification',
  busy = false,
  onConfirm,
  onCancel,
}) {
  const cancelRef = useRef(null);
  const confirmRef = useRef(null);
  const previousFocus = useRef(null);
  const onCancelRef = useRef(onCancel);
  const busyRef = useRef(busy);
  const isDelete = action === 'delete';
  const titleId = 'notification-confirm-title';
  const descriptionId = 'notification-confirm-description';

  // Keep the latest callback/state without reinstalling the keyboard listener
  // every time the parent renders while a request is running.
  onCancelRef.current = onCancel;
  busyRef.current = busy;

  useEffect(() => {
    if (!open) return undefined;
    previousFocus.current = document.activeElement;
    const focusTimer = window.setTimeout(() => confirmRef.current?.focus(), 0);
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !busyRef.current) onCancelRef.current?.();
      if (event.key === 'Tab') {
        const confirmButton = confirmRef.current;
        const cancelButton = cancelRef.current;
        if (event.shiftKey && document.activeElement === confirmButton) {
          event.preventDefault();
          cancelButton?.focus();
        } else if (!event.shiftKey && document.activeElement === cancelButton) {
          event.preventDefault();
          confirmButton?.focus();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKeyDown);
      previousFocus.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  const Icon = isDelete ? Trash2 : Archive;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[2px] motion-safe:animate-[jr-fade-in_140ms_ease-out] motion-reduce:animate-none" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onCancel?.(); }}>
      <section role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} className="w-full max-w-md overflow-hidden rounded-2xl border border-jr-bordure bg-jr-surface text-jr-texte shadow-2xl shadow-slate-950/20">
        <div className="flex items-start gap-3 border-b border-jr-bordure px-5 py-5 sm:px-6">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${isDelete ? 'bg-jr-err-pale text-jr-err' : 'bg-jr-elec-pale text-jr-elec-fonce'}`}><Icon size={21} aria-hidden="true" /></span>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-base font-bold text-jr-titre">{isDelete ? 'Confirmer la suppression' : 'Confirmer l’archivage'}</h2>
            <p id={descriptionId} className="mt-1 text-sm leading-6 text-jr-doux">{isDelete ? `Voulez-vous vraiment supprimer « ${subject} » ? Le relevé et l’anomalie associés seront conservés.` : `Voulez-vous vraiment archiver « ${subject} » ? Vous pourrez la retrouver et la restaurer depuis Paramètres.`}</p>
          </div>
          <button type="button" onClick={onCancel} disabled={busy} aria-label="Fermer la confirmation" className="rounded-lg p-1.5 text-jr-faible transition hover:bg-jr-fond hover:text-jr-texte disabled:opacity-50 motion-reduce:transition-none"><X size={17} /></button>
        </div>
        <div className="flex flex-col-reverse gap-2 bg-jr-fond/70 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button ref={cancelRef} type="button" onClick={onCancel} disabled={busy} className="inline-flex min-h-10 items-center justify-center rounded-xl border border-jr-bordure bg-jr-surface px-4 py-2.5 text-sm font-semibold text-jr-doux transition hover:bg-jr-fond focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jr-focus disabled:opacity-50 motion-reduce:transition-none">Annuler</button>
          <button ref={confirmRef} type="button" onClick={onConfirm} disabled={busy} className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60 motion-reduce:transition-none ${isDelete ? 'bg-jr-err hover:brightness-95 focus-visible:ring-jr-err' : 'bg-jr-eau hover:bg-jr-eau-fonce focus-visible:ring-jr-focus'}`}>
            {busy ? <LoaderCircle size={16} className="animate-spin motion-reduce:animate-none" /> : <Icon size={16} />}{isDelete ? 'Oui, supprimer' : 'Oui, archiver'}
          </button>
        </div>
      </section>
    </div>
  );
}
