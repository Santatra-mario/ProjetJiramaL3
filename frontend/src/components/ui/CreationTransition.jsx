import { useCallback, useEffect, useRef, useState } from 'react';

import JiramaLoading from './JiramaLoading.jsx';

/* =========================================================
   TRANSITION APRÈS CRÉATION
   Après un enregistrement réussi, un bref écran de chargement
   JIRAMA (logo) couvre la page pendant que la liste se
   rafraîchit, puis laisse la place au retour toast/banner.
========================================================= */

export function useCreationTransition(duree = 900) {
  const [actif, setActif] = useState(false);
  const minuteur = useRef(null);

  useEffect(() => () => window.clearTimeout(minuteur.current), []);

  const jouerTransition = useCallback(() => {
    window.clearTimeout(minuteur.current);
    setActif(true);
    minuteur.current = window.setTimeout(() => setActif(false), duree);
  }, [duree]);

  return { transitionActive: actif, jouerTransition };
}

/**
 * Écran de transition post-création. Rendu nul inactif :
 * aucun coût visuel au repos.
 */
export default function CreationTransition({
  active,
  message = 'Enregistrement terminé',
  detail = 'Mise à jour de la liste…',
}) {
  if (!active) return null;

  return <JiramaLoading variant="overlay" message={message} detail={detail} />;
}
