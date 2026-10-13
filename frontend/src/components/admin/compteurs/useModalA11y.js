import { useEffect, useRef } from 'react';

/* =========================================================
   ACCESSIBILITÉ DES MODALES
   - focus initial (élément marqué data-autofocus, sinon le
     premier champ ou bouton)
   - focus piégé dans la modale (Tab / Maj+Tab)
   - fermeture avec Échap
   - défilement de la page bloqué pendant l'ouverture
   - focus rendu à l'élément précédent à la fermeture
   Retourne la ref à poser sur le conteneur role="dialog".
========================================================= */
const SELECTEUR_FOCUSABLES =
  'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

function useModalA11y(ouvert, onFermer) {
  const refModale = useRef(null);
  const refFermer = useRef(onFermer);
  refFermer.current = onFermer;

  useEffect(() => {
    if (!ouvert) return undefined;

    const precedent = document.activeElement;
    const overflowAvant = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusables = () =>
      Array.from(refModale.current?.querySelectorAll(SELECTEUR_FOCUSABLES) || []);

    const focusInitial = setTimeout(() => {
      const cible =
        refModale.current?.querySelector('[data-autofocus]') ||
        refModale.current?.querySelector('input, button');
      cible?.focus();
    }, 30);

    const surTouche = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        refFermer.current?.();
        return;
      }

      if (e.key !== 'Tab') return;

      const items = focusables();
      if (!items.length) return;

      const premier = items[0];
      const dernier = items[items.length - 1];

      if (e.shiftKey && document.activeElement === premier) {
        e.preventDefault();
        dernier.focus();
      } else if (!e.shiftKey && document.activeElement === dernier) {
        e.preventDefault();
        premier.focus();
      }
    };

    document.addEventListener('keydown', surTouche);

    return () => {
      clearTimeout(focusInitial);
      document.removeEventListener('keydown', surTouche);
      document.body.style.overflow = overflowAvant;
      precedent?.focus?.();
    };
  }, [ouvert]);

  return refModale;
}

export default useModalA11y;
