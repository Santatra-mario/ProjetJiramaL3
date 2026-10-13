import { RefreshCw, TriangleAlert } from 'lucide-react';

/* =========================================================
   ERREUR DE CHARGEMENT : message clair + bouton « Réessayer »
   (affiché à la place du tableau quand aucun relevé n'a pu être chargé)
========================================================= */
function EtatErreurReleves({ message, onReessayer, enCours = false }) {
  return (
    <div role="alert" className="px-5 py-14">
      <div className="mx-auto flex max-w-sm flex-col items-center text-center">
        <span
          className="flex h-14 w-14 items-center justify-center rounded-full"
          style={{ backgroundColor: 'var(--jr-err-pale)', color: 'var(--jr-err)' }}
        >
          <TriangleAlert size={28} strokeWidth={1.75} aria-hidden="true" />
        </span>

        <h3 className="mt-4 text-base font-bold text-jr-titre">
          Impossible de charger les relevés
        </h3>

        <p className="mt-1 text-sm text-jr-doux">{message}</p>

        <button
          type="button"
          onClick={onReessayer}
          disabled={enCours}
          className="jr-btn jr-btn-bleu mt-5 inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
        >
          <RefreshCw
            size={18}
            aria-hidden="true"
            className={enCours ? 'animate-spin motion-reduce:animate-none' : ''}
          />
          Réessayer
        </button>
      </div>
    </div>
  );
}

export default EtatErreurReleves;
