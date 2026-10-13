import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Power } from 'lucide-react';

import { COULEUR_POINT } from './StatusBadge.jsx';
import { STATUTS } from './compteursUtils.js';

const LARGEUR_MENU = 208;

/* =========================================================
   MENU « STATUT »
   Affiché dans un portail (position fixe) : il n'est jamais
   coupé par le tableau, même sur la dernière ligne.
   Clavier : Entrée / flèches pour ouvrir, flèches pour
   naviguer, Échap pour fermer.
========================================================= */
function MenuStatut({ compteur, onChoisir, avecTexte = false }) {
  const [ouvert, setOuvert] = useState(false);
  const [position, setPosition] = useState(null);

  const boutonRef = useRef(null);
  const menuRef = useRef(null);

  const fermer = useCallback((rendreFocus = true) => {
    setOuvert(false);
    if (rendreFocus) boutonRef.current?.focus();
  }, []);

  const ouvrir = () => {
    const zone = boutonRef.current?.getBoundingClientRect();
    if (!zone) return;

    const hauteurMenu = 136;
    const placeEnBas = window.innerHeight - zone.bottom > hauteurMenu + 12;
    const gauche = Math.max(
      8,
      Math.min(zone.right - LARGEUR_MENU, window.innerWidth - LARGEUR_MENU - 8)
    );

    setPosition(
      placeEnBas
        ? { left: gauche, top: zone.bottom + 4 }
        : { left: gauche, bottom: window.innerHeight - zone.top + 4 }
    );
    setOuvert(true);
  };

  // Focus sur l'option courante à l'ouverture
  useEffect(() => {
    if (!ouvert) return;

    const options = menuRef.current?.querySelectorAll('[role="menuitemradio"]');
    const courante = menuRef.current?.querySelector('[aria-checked="true"]');
    (courante || options?.[0])?.focus();
  }, [ouvert]);

  // Fermeture : clic extérieur, Échap, défilement, redimensionnement
  useEffect(() => {
    if (!ouvert) return undefined;

    const clicExterieur = (e) => {
      if (
        menuRef.current?.contains(e.target) ||
        boutonRef.current?.contains(e.target)
      ) {
        return;
      }
      fermer(false);
    };

    const surTouche = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        fermer();
      }
    };

    const surDefilement = () => fermer(false);

    document.addEventListener('mousedown', clicExterieur);
    document.addEventListener('keydown', surTouche);
    window.addEventListener('scroll', surDefilement, true);
    window.addEventListener('resize', surDefilement);

    return () => {
      document.removeEventListener('mousedown', clicExterieur);
      document.removeEventListener('keydown', surTouche);
      window.removeEventListener('scroll', surDefilement, true);
      window.removeEventListener('resize', surDefilement);
    };
  }, [ouvert, fermer]);

  const surToucheMenu = (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;

    e.preventDefault();

    const options = Array.from(
      menuRef.current?.querySelectorAll('[role="menuitemradio"]') || []
    );
    const index = options.indexOf(document.activeElement);
    const pas = e.key === 'ArrowDown' ? 1 : -1;

    options[(index + pas + options.length) % options.length]?.focus();
  };

  const choisir = (statut) => {
    setOuvert(false);
    // Le focus revient sur le bouton avant l'éventuelle boîte de confirmation
    boutonRef.current?.focus();

    if (statut !== compteur.statut) onChoisir(statut);
  };

  return (
    <>
      <button
        ref={boutonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={ouvert}
        onClick={() => (ouvert ? fermer(false) : ouvrir())}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !ouvert) {
            e.preventDefault();
            ouvrir();
          }
        }}
        title="Changer le statut"
        aria-label={`Changer le statut du compteur ${compteur.numero_compteur}`}
        className="inline-flex items-center gap-1.5 rounded-md p-2 text-sm font-medium text-jr-doux transition-colors hover:bg-[var(--jr-eau-pale)] hover:text-jr-lien aria-expanded:bg-[var(--jr-eau-pale)] aria-expanded:text-jr-lien motion-reduce:transition-none"
      >
        <Power size={17} aria-hidden="true" />
        {avecTexte && 'Statut'}
        <ChevronDown size={14} aria-hidden="true" />
      </button>

      {ouvert &&
        position &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label={`Statut du compteur ${compteur.numero_compteur}`}
            onKeyDown={surToucheMenu}
            className="jr-admin jr-verre-fort jr-pop fixed z-[130] overflow-hidden rounded-md border border-jr-bordure p-1 shadow-xl"
            style={{ width: LARGEUR_MENU, ...position }}
          >
            {STATUTS.map((statut) => {
              const courant = statut.valeur === compteur.statut;

              return (
                <button
                  key={statut.valeur}
                  type="button"
                  role="menuitemradio"
                  aria-checked={courant}
                  onClick={() => choisir(statut.valeur)}
                  className="flex w-full items-center gap-2.5 rounded px-3 py-2 text-left text-sm text-jr-texte transition-colors hover:bg-[var(--jr-eau-pale)] focus:bg-[var(--jr-eau-pale)] focus:outline-none motion-reduce:transition-none"
                >
                  <span
                    aria-hidden="true"
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: COULEUR_POINT(statut.valeur) }}
                  />
                  <span className="flex-1">{statut.libelle}</span>
                  {courant && (
                    <Check size={15} aria-hidden="true" className="text-jr-lien" />
                  )}
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </>
  );
}

export default MenuStatut;
