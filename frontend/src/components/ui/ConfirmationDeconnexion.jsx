import { useEffect, useRef, useState } from 'react';
import { LoaderCircle, LogOut } from 'lucide-react';

/* =========================================================
   CONFIRMATION DE DÉCONNEXION
   Utilisée par les trois Sidebars (Administrateur, Responsable,
   Agent) pour éviter une déconnexion accidentelle.

   La déconnexion elle-même n'est pas gérée ici : le parent fournit
   sa fonction existante via onConfirmer, appelée une seule fois.
========================================================= */

const TITRE_ID = 'titre-confirmation-deconnexion';
const TEXTE_ID = 'texte-confirmation-deconnexion';

function ConfirmationDeconnexion({
  open = false,
  onAnnuler,
  onConfirmer,
}) {
  const [enCours, setEnCours] = useState(false);

  const refAnnuler = useRef(null);
  const refConfirmer = useRef(null);
  const focusPrecedent = useRef(null);

  // Toujours la dernière version des props, sans réinstaller les écouteurs.
  const annulerRef = useRef(onAnnuler);
  const enCoursRef = useRef(enCours);

  annulerRef.current = onAnnuler;
  enCoursRef.current = enCours;

  useEffect(() => {
    if (!open) {
      setEnCours(false);
      return undefined;
    }

    focusPrecedent.current = document.activeElement;

    // Focus sur « Annuler » : l'action la plus sûre.
    const minuteur = window.setTimeout(() => {
      refAnnuler.current?.focus();
    }, 0);

    const overflowPrecedent = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function surTouche(evenement) {
      if (evenement.key === 'Escape') {
        if (enCoursRef.current) {
          return;
        }

        evenement.preventDefault();
        annulerRef.current?.();
        return;
      }

      if (evenement.key !== 'Tab') {
        return;
      }

      const boutonAnnuler = refAnnuler.current;
      const boutonConfirmer = refConfirmer.current;

      if (!boutonAnnuler || !boutonConfirmer) {
        return;
      }

      // Piège de focus : on reste dans la boîte de dialogue.
      if (evenement.shiftKey && document.activeElement === boutonAnnuler) {
        evenement.preventDefault();
        boutonConfirmer.focus();
      } else if (
        !evenement.shiftKey &&
        document.activeElement === boutonConfirmer
      ) {
        evenement.preventDefault();
        boutonAnnuler.focus();
      }
    }

    document.addEventListener('keydown', surTouche);

    return () => {
      window.clearTimeout(minuteur);
      document.removeEventListener('keydown', surTouche);
      document.body.style.overflow = overflowPrecedent;
      focusPrecedent.current?.focus?.();
    };
  }, [open]);

  async function confirmer() {
    // Protection contre les doubles clics.
    if (enCoursRef.current) {
      return;
    }

    setEnCours(true);

    try {
      await onConfirmer?.();
    } finally {
      setEnCours(false);
    }
  }

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[2px]"
      onMouseDown={(evenement) => {
        if (evenement.target === evenement.currentTarget && !enCours) {
          onAnnuler?.();
        }
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={TITRE_ID}
        aria-describedby={TEXTE_ID}
        className="w-full max-w-md overflow-hidden rounded-2xl border border-jr-bordure bg-jr-surface text-jr-texte shadow-2xl shadow-slate-950/20"
      >
        <div className="flex items-start gap-3 px-5 py-5 sm:px-6">
          <span
            aria-hidden="true"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-jr-err-pale text-jr-err"
          >
            <LogOut size={21} />
          </span>

          <div className="min-w-0 flex-1">
            <h2
              id={TITRE_ID}
              className="text-base font-bold text-jr-titre"
            >
              Confirmer la déconnexion
            </h2>

            <p
              id={TEXTE_ID}
              className="mt-1 text-sm leading-6 text-jr-doux"
            >
              Voulez-vous vraiment vous déconnecter de votre compte JIRAMA ?
            </p>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-jr-bordure bg-jr-fond/70 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button
            ref={refAnnuler}
            type="button"
            onClick={onAnnuler}
            disabled={enCours}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-jr-bordure-forte bg-jr-surface px-4 py-2.5 text-sm font-semibold text-jr-texte transition hover:bg-jr-fond focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jr-focus disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
          >
            Annuler
          </button>

          <button
            ref={refConfirmer}
            type="button"
            onClick={confirmer}
            disabled={enCours}
            aria-busy={enCours || undefined}
            style={{ backgroundColor: '#E30613' }}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jr-err focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60 motion-reduce:transition-none"
          >
            {enCours ? (
              <LoaderCircle
                size={16}
                aria-hidden="true"
                className="animate-spin motion-reduce:animate-none"
              />
            ) : (
              <LogOut size={16} aria-hidden="true" />
            )}

            {enCours ? 'Déconnexion en cours…' : 'Oui, me déconnecter'}
          </button>
        </div>
      </section>
    </div>
  );
}

export default ConfirmationDeconnexion;
