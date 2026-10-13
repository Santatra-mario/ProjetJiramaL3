import { CalendarDays, ChevronRight, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';

import { dateLongue } from './relevesUtils.js';

/* =========================================================
   EN-TÊTE DE LA PAGE « GESTION DES RELEVÉS »
   Fil d'Ariane, titre, description, date du jour et bouton
   « Nouveau relevé » (affiché seulement si l'utilisateur a le droit
   d'écrire : le bouton appelle openCreateModal, qui existe déjà).
========================================================= */
function EnTeteReleves({ peutEcrire = false, onNouveau }) {
  return (
    <header className="jr-entree mb-6">
      <nav aria-label="Fil d'Ariane" className="mb-3">
        <ol className="flex items-center gap-1.5 text-sm text-jr-faible">
          <li>
            <Link
              to="/dashboard/admin"
              className="rounded px-1 py-0.5 font-medium text-jr-lien transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jr-focus"
            >
              Administration
            </Link>
          </li>

          <li aria-hidden="true">
            <ChevronRight size={14} />
          </li>

          <li aria-current="page" className="font-medium text-jr-texte">
            Relevés
          </li>
        </ol>
      </nav>

      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold tracking-tight text-jr-titre sm:text-4xl">
            Gestion des relevés
          </h1>

          <p className="mt-1.5 max-w-xl text-sm text-jr-doux">
            Consultez, recherchez et gérez les relevés des compteurs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <p
            className="inline-flex items-center gap-2 rounded-md border border-jr-bordure bg-jr-surface px-3 py-2 text-sm font-medium text-jr-doux shadow-sm"
            title="Date du jour"
          >
            <CalendarDays
              size={16}
              aria-hidden="true"
              className="text-jr-lien"
            />
            <span className="sr-only">Date du jour : </span>
            {dateLongue()}
          </p>

          {peutEcrire && (
            <button
              type="button"
              onClick={onNouveau}
              className="jr-btn jr-btn-bleu inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold shadow-sm"
            >
              <Plus size={18} aria-hidden="true" />
              Nouveau relevé
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

export default EnTeteReleves;
