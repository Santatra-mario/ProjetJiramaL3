import { LIBELLE_STATUT } from './compteursUtils.js';

/* Couleurs : uniquement les variables du thème JIRAMA (clair + sombre) */
const CONFIG = {
  ACTIF: {
    fond: 'var(--jr-ok-pale)',
    texte: 'var(--jr-ok)',
    point: 'var(--jr-ok)',
  },
  INACTIF: {
    fond: 'var(--jr-desactive-fond)',
    texte: 'var(--jr-desactive-texte)',
    point: 'var(--jr-desactive-texte)',
  },
  A_VERIFIER: {
    fond: 'var(--jr-elec-pale)',
    texte: 'var(--jr-attention)',
    point: 'var(--jr-elec)',
  },
};

export const COULEUR_POINT = (statut) =>
  (CONFIG[statut] || CONFIG.INACTIF).point;

function StatusBadge({ status }) {
  const courant = CONFIG[status] || CONFIG.INACTIF;

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ backgroundColor: courant.fond, color: courant.texte }}
    >
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: courant.point }}
      />
      {LIBELLE_STATUT[status] || status || '—'}
    </span>
  );
}

export default StatusBadge;
