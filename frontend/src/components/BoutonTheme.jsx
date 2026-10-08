import { Moon, Sun } from 'lucide-react';

import { useTheme } from '../hooks/useTheme.js';

/* =========================================================
   BOUTON MODE CLAIR / SOMBRE
   - Par défaut : positionné en haut à droite (Login / Register,
     dans un conteneur « relative »).
   - integre : s'insère dans une barre (Header admin), sans
     position absolue.
========================================================= */
function BoutonTheme({ className = '', integre = false }) {
  const { estSombre, basculer } = useTheme();

  const libelle = estSombre
    ? 'Passer en mode clair'
    : 'Passer en mode sombre';

  const position = integre ? 'relative' : 'absolute right-4 top-4 z-20';

  return (
    <button
      type="button"
      onClick={basculer}
      aria-label={libelle}
      aria-pressed={estSombre}
      title={`${libelle} (T)`}
      className={`${position} flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md border border-jr-bordure bg-jr-surface shadow-md shadow-black/10 transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-jr-elec motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${className}`}
    >
      {/* Soleil : visible en mode sombre (pour revenir au clair) */}
      <Sun
        size={20}
        aria-hidden="true"
        className={`absolute text-jr-elec transition-all duration-300 motion-reduce:transition-none ${
          estSombre
            ? 'rotate-0 scale-100 opacity-100'
            : '-rotate-90 scale-50 opacity-0'
        }`}
      />

      {/* Lune : visible en mode clair (pour passer au sombre) */}
      <Moon
        size={20}
        aria-hidden="true"
        className={`absolute text-jr-lien transition-all duration-300 motion-reduce:transition-none ${
          estSombre
            ? 'rotate-90 scale-50 opacity-0'
            : 'rotate-0 scale-100 opacity-100'
        }`}
      />
    </button>
  );
}

export default BoutonTheme;