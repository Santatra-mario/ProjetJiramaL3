import { TriangleAlert } from 'lucide-react';

import StatusBadge from './StatusBadge.jsx';
import useModalA11y from './useModalA11y.js';

const CONSEQUENCES = {
  INACTIF:
    'Un compteur inactif n’accepte plus de nouveaux relevés. Son historique est conservé.',
  A_VERIFIER:
    'Le compteur reste utilisable pour les relevés, mais il est signalé comme à contrôler.',
  ACTIF: 'Le compteur pourra de nouveau recevoir des relevés.',
};

/* =========================================================
   CONFIRMATION DE CHANGEMENT DE STATUT
   Remplace window.confirm : même style que les autres modales,
   avec explication de la conséquence.
========================================================= */
function ConfirmStatutDialog({ compteur, statut, onConfirmer, onAnnuler }) {
  const refModale = useModalA11y(true, onAnnuler);
  const destructif = statut === 'INACTIF';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-sm"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--jr-fond) 70%, transparent)',
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onAnnuler();
      }}
    >
      <div
        ref={refModale}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="titre-confirm-statut"
        aria-describedby="texte-confirm-statut"
        className="jr-verre-fort jr-pop w-full max-w-md rounded-lg border border-jr-bordure p-6 shadow-2xl"
      >
        <div className="flex items-start gap-3">
          {destructif && (
            <span
              aria-hidden="true"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-jr-err-pale text-jr-err"
            >
              <TriangleAlert size={18} />
            </span>
          )}

          <div>
            <h2
              id="titre-confirm-statut"
              className="text-lg font-semibold text-jr-titre"
            >
              Changer le statut du compteur ?
            </h2>

            <p id="texte-confirm-statut" className="mt-2 text-sm text-jr-doux">
              Le compteur{' '}
              <span className="font-mono font-semibold text-jr-texte">
                {compteur.numero_compteur}
              </span>{' '}
              va passer de <StatusBadge status={compteur.statut} /> à{' '}
              <StatusBadge status={statut} />.
            </p>

            <p className="mt-3 text-sm text-jr-doux">{CONSEQUENCES[statut]}</p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onAnnuler}
            data-autofocus={destructif ? '' : undefined}
            className="rounded-md border border-jr-bordure-forte px-4 py-2.5 text-sm font-medium text-jr-doux transition-colors hover:bg-[var(--jr-eau-pale)] hover:text-jr-texte motion-reduce:transition-none"
          >
            Annuler
          </button>

          <button
            type="button"
            onClick={onConfirmer}
            data-autofocus={destructif ? undefined : ''}
            className={`rounded-md px-4 py-2.5 text-sm font-semibold ${
              destructif ? 'text-white' : 'jr-btn jr-btn-elec'
            }`}
            style={destructif ? { backgroundColor: 'var(--jr-err)' } : undefined}
          >
            Confirmer
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmStatutDialog;
