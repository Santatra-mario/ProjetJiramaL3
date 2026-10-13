import { RotateCcw } from 'lucide-react';

import { periodeDepuis } from './relevesUtils.js';

/* =========================================================
   FILTRE PAR PÉRIODE + BOUTON « RÉINITIALISER »
   Filtrage côté client sur date_releve (aucun appel API ajouté).
   onChange reçoit { periode, debut, fin }.
========================================================= */
const PRESETS = [
  { cle: 'tout', libelle: 'Tout' },
  { cle: '7j', libelle: '7 jours' },
  { cle: '30j', libelle: '30 jours' },
  { cle: '3m', libelle: '3 mois' },
];

function FiltrePeriodeReleves({
  periode,
  debut,
  fin,
  onChange,
  filtresActifs = false,
  onReinitialiser,
}) {
  function choisir(cle) {
    const bornes = periodeDepuis(cle);

    onChange({
      periode: cle,
      debut: bornes ? bornes.debut : '',
      fin: bornes ? bornes.fin : '',
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div
        role="group"
        aria-label="Période"
        className="inline-flex rounded-md border border-jr-bordure bg-jr-surface p-0.5"
      >
        {PRESETS.map((preset) => {
          const actif = periode === preset.cle;

          return (
            <button
              key={preset.cle}
              type="button"
              aria-pressed={actif}
              onClick={() => choisir(preset.cle)}
              className={`rounded px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jr-focus motion-reduce:transition-none ${
                actif
                  ? 'bg-jr-eau text-white'
                  : 'text-jr-doux hover:bg-jr-eau-pale hover:text-jr-lien'
              }`}
            >
              {preset.libelle}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2 text-sm text-jr-doux">
        <label htmlFor="releves-date-debut" className="sr-only">
          Du
        </label>
        <input
          id="releves-date-debut"
          type="date"
          value={debut}
          max={fin || undefined}
          onChange={(evenement) =>
            onChange({ periode: 'perso', debut: evenement.target.value, fin })
          }
          className="jr-field rounded-md border px-3 py-2 text-sm"
        />

        <span aria-hidden="true">→</span>

        <label htmlFor="releves-date-fin" className="sr-only">
          Au
        </label>
        <input
          id="releves-date-fin"
          type="date"
          value={fin}
          min={debut || undefined}
          onChange={(evenement) =>
            onChange({ periode: 'perso', debut, fin: evenement.target.value })
          }
          className="jr-field rounded-md border px-3 py-2 text-sm"
        />
      </div>

      {filtresActifs && (
        <button
          type="button"
          onClick={onReinitialiser}
          className="inline-flex items-center gap-2 rounded-md border border-jr-bordure-forte bg-jr-surface px-3 py-2 text-sm font-semibold text-jr-lien transition-colors hover:bg-jr-eau-pale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jr-focus motion-reduce:transition-none"
        >
          <RotateCcw size={16} aria-hidden="true" />
          Réinitialiser
        </button>
      )}
    </div>
  );
}

export default FiltrePeriodeReleves;
