import { useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';

import { formatNombre, STATUTS, TYPES } from './compteursUtils.js';

const OPTIONS_TYPE = [{ valeur: '', libelle: 'Tous' }, ...TYPES];
const OPTIONS_STATUT = [{ valeur: '', libelle: 'Tous' }, ...STATUTS];

/* Groupe de pastilles avec compteur de résultats */
function Pastilles({ legende, options, valeur, onChange, comptes }) {
  return (
    <div
      role="group"
      aria-label={legende}
      className="jr-verre inline-flex self-start rounded-md border border-jr-bordure p-0.5"
    >
      {options.map((option) => {
        const actif = valeur === option.valeur;

        return (
          <button
            key={option.valeur || 'tous'}
            type="button"
            aria-pressed={actif}
            onClick={() => onChange(option.valeur)}
            className="inline-flex items-center gap-2 rounded px-3 py-2 text-sm font-medium transition-colors motion-reduce:transition-none"
            style={
              actif
                ? { backgroundColor: 'var(--jr-eau)', color: '#ffffff' }
                : { color: 'var(--jr-texte-doux)' }
            }
          >
            {option.libelle}
            <span
              className="text-xs tabular-nums"
              style={{ opacity: actif ? 0.85 : 0.7 }}
            >
              {formatNombre(comptes[option.valeur])}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* =========================================================
   BARRE DE FILTRES
   Recherche (raccourci « / »), pastilles type et statut avec
   nombre de résultats, filtre par abonné, réinitialisation.
========================================================= */
function CompteursFiltres({
  saisie,
  onSaisie,
  type,
  onType,
  statut,
  onStatut,
  abonne,
  onAbonne,
  abonnesOptions,
  comptesType,
  comptesStatut,
  filtreActif,
  onReset,
  raccourciActif,
}) {
  const rechercheRef = useRef(null);

  // Raccourci « / » : place le curseur dans la recherche
  useEffect(() => {
    if (!raccourciActif) return undefined;

    const surTouche = (e) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;

      const cible = e.target;
      const enSaisie =
        cible instanceof HTMLElement &&
        (cible.isContentEditable ||
          ['INPUT', 'TEXTAREA', 'SELECT'].includes(cible.tagName));

      if (enSaisie) return;

      e.preventDefault();
      rechercheRef.current?.focus();
    };

    window.addEventListener('keydown', surTouche);
    return () => window.removeEventListener('keydown', surTouche);
  }, [raccourciActif]);

  return (
    <section aria-label="Recherche et filtres" className="mb-4 space-y-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        {/* Recherche */}
        <div className="relative flex-1">
          <Search
            size={18}
            aria-hidden="true"
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-jr-faible"
          />

          <input
            ref={rechercheRef}
            type="text"
            value={saisie}
            onChange={(event) => onSaisie(event.target.value)}
            placeholder="Rechercher par numéro, type, abonné ou nom"
            aria-label="Rechercher un compteur"
            className="jr-field w-full rounded-md border py-2.5 pl-10 pr-10 text-sm"
          />

          {saisie ? (
            <button
              type="button"
              onClick={() => {
                onSaisie('');
                rechercheRef.current?.focus();
              }}
              aria-label="Effacer la recherche"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-jr-faible transition-colors hover:text-jr-texte motion-reduce:transition-none"
            >
              <X size={16} aria-hidden="true" />
            </button>
          ) : (
            <kbd
              aria-hidden="true"
              className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-jr-bordure-forte px-1.5 text-xs text-jr-faible sm:block"
            >
              /
            </kbd>
          )}
        </div>

        {/* Abonné : la liste native permet aussi la saisie au clavier */}
        <select
          value={abonne}
          onChange={(event) => onAbonne(event.target.value)}
          aria-label="Filtrer par abonné"
          className="jr-field rounded-md border px-3 py-2.5 text-sm lg:w-64"
        >
          <option value="">Tous les abonnés</option>
          {abonnesOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
        <Pastilles
          legende="Filtrer par type"
          options={OPTIONS_TYPE}
          valeur={type}
          onChange={onType}
          comptes={comptesType}
        />

        <Pastilles
          legende="Filtrer par statut"
          options={OPTIONS_STATUT}
          valeur={statut}
          onChange={onStatut}
          comptes={comptesStatut}
        />

        {filtreActif && (
          <button
            type="button"
            onClick={onReset}
            className="jr-entree inline-flex items-center gap-1.5 self-start rounded-md px-3 py-2 text-sm font-medium text-jr-lien transition-colors hover:bg-[var(--jr-eau-pale)] motion-reduce:transition-none"
          >
            <X size={15} aria-hidden="true" />
            Réinitialiser les filtres
          </button>
        )}
      </div>
    </section>
  );
}

export default CompteursFiltres;
