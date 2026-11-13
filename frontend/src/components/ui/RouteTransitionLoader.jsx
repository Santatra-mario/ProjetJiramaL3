import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import JiramaLoading from './JiramaLoading.jsx';

/**
 * Bref écran de transition, affiché à l'ouverture de l'application
 * puis lors d'un changement de route React Router.
 * Il n'ajoute aucune temporisation aux appels API eux-mêmes.
 */
export default function RouteTransitionLoader() {
  const location = useLocation();
  const firstRender = useRef(true);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(true);
    const duration = firstRender.current ? 460 : 320;
    firstRender.current = false;

    const timer = window.setTimeout(() => setVisible(false), duration);
    return () => window.clearTimeout(timer);
  }, [location.pathname]);

  if (!visible) return null;

  return (
    <JiramaLoading
      variant="overlay"
      message="Ouverture de votre espace"
      detail="Gestion des consommations d’eau et d’électricité"
    />
  );
}
