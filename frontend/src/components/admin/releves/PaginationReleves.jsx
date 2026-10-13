import { ChevronLeft, ChevronRight } from 'lucide-react';

import { TAILLES_PAGE, fenetrePages } from './relevesUtils.js';

/* =========================================================
   PAGINATION CÔTÉ CLIENT
   pagination : résultat de paginer() { page, pages, total, premier, dernier }
========================================================= */
function PaginationReleves({ pagination, taille, onPage, onTaille }) {
  const { page, pages, total, premier, dernier } = pagination;

  if (total === 0) return null;

  const bouton =
    'inline-flex h-9 min-w-9 items-center justify-center rounded-md border px-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jr-focus disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none';

  return (
    <nav
      aria-label="Pagination des relevés"
      className="flex flex-col items-center justify-between gap-3 border-t border-jr-bordure px-5 py-3.5 sm:flex-row sm:px-6"
    >
      <div className="flex flex-wrap items-center gap-3 text-sm text-jr-doux">
        <p>
          <span className="font-semibold tabular-nums text-jr-texte">
            {premier.toLocaleString('fr-FR')}–{dernier.toLocaleString('fr-FR')}
          </span>{' '}
          sur{' '}
          <span className="font-semibold tabular-nums text-jr-texte">
            {total.toLocaleString('fr-FR')}
          </span>
        </p>

        <label className="flex items-center gap-2">
          <span className="text-jr-faible">Par page</span>
          <select
            value={taille}
            onChange={(evenement) => onTaille(Number(evenement.target.value))}
            className="jr-field rounded-md border px-2 py-1.5 text-sm"
          >
            {TAILLES_PAGE.map((valeur) => (
              <option key={valeur} value={valeur}>
                {valeur}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          aria-label="Page précédente"
          className={`${bouton} border-jr-bordure bg-jr-surface text-jr-doux hover:bg-jr-eau-pale hover:text-jr-lien`}
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </button>

        {fenetrePages(page, pages).map((element, index) =>
          element === '…' ? (
            <span
              key={`points-${index}`}
              aria-hidden="true"
              className="px-1 text-jr-faible"
            >
              …
            </span>
          ) : (
            <button
              key={element}
              type="button"
              onClick={() => onPage(element)}
              aria-label={`Page ${element}`}
              aria-current={element === page ? 'page' : undefined}
              className={`${bouton} ${
                element === page
                  ? 'border-jr-eau bg-jr-eau text-white'
                  : 'border-jr-bordure bg-jr-surface text-jr-doux hover:bg-jr-eau-pale hover:text-jr-lien'
              }`}
            >
              {element}
            </button>
          )
        )}

        <button
          type="button"
          onClick={() => onPage(page + 1)}
          disabled={page >= pages}
          aria-label="Page suivante"
          className={`${bouton} border-jr-bordure bg-jr-surface text-jr-doux hover:bg-jr-eau-pale hover:text-jr-lien`}
        >
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}

export default PaginationReleves;
