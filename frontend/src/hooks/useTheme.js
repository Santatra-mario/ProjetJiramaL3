import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

/* =========================================================
   THÈME CLAIR / SOMBRE
   - Choix enregistré dans localStorage (clé « jirama-theme »)
   - Sans choix : on suit la préférence du système
   - La classe « dark » est posée sur <html>
   La clé doit rester identique à celle du script de index.html.
========================================================= */
const CLE_STOCKAGE = 'jirama-theme';
const THEMES = ['clair', 'sombre'];

// Lecture / écriture protégées : le stockage peut être bloqué
// (navigation privée, politique du navigateur…)
const lireChoix = () => {
  try {
    const valeur = localStorage.getItem(CLE_STOCKAGE);
    return THEMES.includes(valeur) ? valeur : null;
  } catch {
    return null;
  }
};

const ecrireChoix = (valeur) => {
  try {
    if (valeur === null) localStorage.removeItem(CLE_STOCKAGE);
    else localStorage.setItem(CLE_STOCKAGE, valeur);
  } catch {
    /* Stockage indisponible : le thème reste valable pour la session */
  }
};

const requeteSysteme = () => {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)');
  } catch {
    return null;
  }
};

const preferenceSysteme = () =>
  requeteSysteme()?.matches ? 'sombre' : 'clair';

const mouvementReduit = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

// Transition douce des couleurs pendant ~0,4 s (voir index.css)
let minuteurTransition = null;
const animerChangement = () => {
  if (mouvementReduit()) return;

  const racine = document.documentElement;
  racine.classList.add('jr-theme-anim');

  clearTimeout(minuteurTransition);
  minuteurTransition = setTimeout(() => {
    racine.classList.remove('jr-theme-anim');
  }, 400);
};

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  // null = l'utilisateur n'a pas choisi : on suit le système
  const [choix, setChoix] = useState(lireChoix);
  const [systeme, setSysteme] = useState(preferenceSysteme);

  const theme = choix ?? systeme;

  // Applique la classe « dark » sur <html>
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'sombre');
  }, [theme]);

  // Suit les changements de préférence du système
  useEffect(() => {
    const requete = requeteSysteme();
    if (!requete) return undefined;

    const surChangement = (e) => setSysteme(e.matches ? 'sombre' : 'clair');

    if (requete.addEventListener) {
      requete.addEventListener('change', surChangement);
      return () => requete.removeEventListener('change', surChangement);
    }
    // Anciens navigateurs
    requete.addListener(surChangement);
    return () => requete.removeListener(surChangement);
  }, []);

  // Synchronise les autres onglets ouverts
  useEffect(() => {
    const surStockage = (e) => {
      if (e.key === null || e.key === CLE_STOCKAGE) {
        animerChangement();
        setChoix(lireChoix());
      }
    };
    window.addEventListener('storage', surStockage);
    return () => window.removeEventListener('storage', surStockage);
  }, []);

  // Choisit explicitement un thème ('clair' ou 'sombre')
  const definirTheme = useCallback((nouveau) => {
    if (!THEMES.includes(nouveau)) return;
    animerChangement();
    setChoix(nouveau);
    ecrireChoix(nouveau);
  }, []);

  const basculer = useCallback(() => {
    definirTheme(theme === 'sombre' ? 'clair' : 'sombre');
  }, [theme, definirTheme]);

  // Oublie le choix manuel et revient à la préférence du système
  const suivreSysteme = useCallback(() => {
    animerChangement();
    setChoix(null);
    ecrireChoix(null);
  }, []);

  const valeur = useMemo(
    () => ({
      theme,
      estSombre: theme === 'sombre',
      suitLeSysteme: choix === null,
      basculer,
      definirTheme,
      suivreSysteme,
    }),
    [theme, choix, basculer, definirTheme, suivreSysteme]
  );

  // createElement : ce fichier reste en .js (pas de JSX)
  return createElement(ThemeContext.Provider, { value: valeur }, children);
}

export function useTheme() {
  const contexte = useContext(ThemeContext);

  if (!contexte) {
    throw new Error(
      'useTheme doit être utilisé à l’intérieur de <ThemeProvider> (voir main.jsx).'
    );
  }

  return contexte;
}
