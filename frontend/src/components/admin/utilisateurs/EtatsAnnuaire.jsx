import { FilterX, RefreshCw, TriangleAlert, UserPlus } from 'lucide-react';

/* =========================================================
   ÉTATS DE L'ANNUAIRE (chargement, vide, erreur)
   Chaque composant renvoie une ou plusieurs lignes <tr> à
   placer dans le <tbody> de la page Utilisateurs.
========================================================= */
const NB_COLONNES = 6;

/* Illustration : cadran de compteur, couleurs de la charte */
function IllustrationCompteur() {
  return (
    <svg
      width="112"
      height="112"
      viewBox="0 0 112 112"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="56"
        cy="62"
        r="46"
        fill="var(--jr-eau-pale)"
        stroke="var(--jr-bordure-forte)"
        strokeWidth="2"
      />
      <path
        d="M20 62 A36 36 0 0 1 74 30.8"
        stroke="var(--jr-eau)"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path
        d="M74 30.8 A36 36 0 0 1 92 62"
        stroke="var(--jr-elec)"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <line
        x1="56"
        y1="62"
        x2="39"
        y2="45"
        stroke="var(--jr-titre)"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="56" cy="62" r="5" fill="var(--jr-elec)" />
      <rect
        x="40"
        y="82"
        width="32"
        height="10"
        rx="2"
        fill="var(--jr-surface)"
        stroke="var(--jr-bordure-forte)"
      />
    </svg>
  );
}

/* ---------- Chargement : lignes à la forme de l'annuaire ---------- */
export function SqueletteLignes({ nombre = 6 }) {
  return Array.from({ length: nombre }, (_, i) => (
    <tr
      key={i}
      aria-hidden="true"
      className="animate-pulse motion-reduce:animate-none"
    >
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 shrink-0 rounded-full bg-jr-bordure" />
          <div className="space-y-2">
            <div className="h-3 w-32 rounded bg-jr-bordure" />
            <div className="h-2.5 w-14 rounded bg-jr-bordure" />
          </div>
        </div>
      </td>
      <td className="px-5 py-4">
        <div className="h-3 w-24 rounded bg-jr-bordure" />
      </td>
      <td className="px-5 py-4">
        <div className="h-3 w-44 rounded bg-jr-bordure" />
      </td>
      <td className="px-5 py-4">
        <div className="h-6 w-28 rounded-md bg-jr-bordure" />
      </td>
      <td className="px-5 py-4">
        <div className="h-6 w-16 rounded-md bg-jr-bordure" />
      </td>
      <td className="px-5 py-4">
        <div className="flex justify-end gap-2">
          <div className="h-8 w-8 rounded-lg bg-jr-bordure" />
          <div className="h-8 w-8 rounded-lg bg-jr-bordure" />
        </div>
      </td>
    </tr>
  ));
}

/* ---------- Vide : aucun compte, ou aucun résultat pour les filtres ---------- */
export function EtatVide({ filtre = false, onAjouter, onReinitialiser }) {
  return (
    <tr>
      <td colSpan={NB_COLONNES} className="px-5 py-14">
        <div className="mx-auto flex max-w-sm flex-col items-center text-center">
          <IllustrationCompteur />

          <h3 className="mt-4 text-base font-bold text-jr-titre">
            {filtre ? 'Aucun compte ne correspond' : 'Aucun compte pour le moment'}
          </h3>

          <p className="mt-1 text-sm text-jr-doux">
            {filtre
              ? 'Modifiez la recherche ou les filtres pour élargir la liste.'
              : 'Créez le premier compte agent ou responsable pour commencer.'}
          </p>

          {filtre ? (
            <button
              type="button"
              onClick={onReinitialiser}
              className="mt-5 inline-flex items-center gap-2 rounded-xl border border-jr-bordure-forte px-4 py-2.5 text-sm font-semibold text-jr-texte transition hover:bg-jr-eau-pale focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-jr-elec"
            >
              <FilterX size={18} aria-hidden="true" />
              Réinitialiser les filtres
            </button>
          ) : (
            <button
              type="button"
              onClick={onAjouter}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-jr-eau px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-jr-eau-fonce focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-jr-elec"
            >
              <UserPlus size={18} aria-hidden="true" />
              Ajouter un utilisateur
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

/* ---------- Erreur de chargement ---------- */
export function EtatErreur({ message, onReessayer }) {
  return (
    <tr>
      <td colSpan={NB_COLONNES} className="px-5 py-14">
        <div
          role="alert"
          className="mx-auto flex max-w-sm flex-col items-center text-center"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-jr-err-pale text-jr-err">
            <TriangleAlert size={28} strokeWidth={1.75} aria-hidden="true" />
          </div>

          <h3 className="mt-4 text-base font-bold text-jr-titre">
            Impossible de charger les comptes
          </h3>

          <p className="mt-1 text-sm text-jr-doux">{message}</p>

          <button
            type="button"
            onClick={onReessayer}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-jr-eau px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-jr-eau-fonce focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-jr-elec"
          >
            <RefreshCw size={18} aria-hidden="true" />
            Réessayer
          </button>
        </div>
      </td>
    </tr>
  );
}