import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

const STORAGE_KEY = 'jirama-display-size';
const SIZES = ['standard', 'grand', 'presentation'];

function readSize() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return SIZES.includes(saved) ? saved : 'standard';
  } catch {
    return 'standard';
  }
}

function saveSize(size) {
  try {
    window.localStorage.setItem(STORAGE_KEY, size);
  } catch {
    // La préférence reste active pour la session si le stockage est bloqué.
  }
}

const DisplayPreferencesContext = createContext(null);

export function DisplayPreferencesProvider({ children }) {
  const [taille, setTaille] = useState(readSize);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('jr-font-grand', taille === 'grand');
    root.classList.toggle('jr-presentation-mode', taille === 'presentation');
    root.dataset.jrDisplaySize = taille;
    saveSize(taille);
  }, [taille]);

  useEffect(() => {
    const syncFromStorage = (event) => {
      if (event.key !== STORAGE_KEY) return;
      const incoming = SIZES.includes(event.newValue) ? event.newValue : 'standard';
      setTaille(incoming);
    };
    window.addEventListener('storage', syncFromStorage);
    return () => window.removeEventListener('storage', syncFromStorage);
  }, []);

  const definirTaille = useCallback((nouvelleTaille) => {
    if (SIZES.includes(nouvelleTaille)) setTaille(nouvelleTaille);
  }, []);

  const augmenterTaille = useCallback(() => {
    setTaille((current) => SIZES[Math.min(SIZES.length - 1, SIZES.indexOf(current) + 1)]);
  }, []);

  const reduireTaille = useCallback(() => {
    setTaille((current) => SIZES[Math.max(0, SIZES.indexOf(current) - 1)]);
  }, []);

  const reinitialiser = useCallback(() => setTaille('standard'), []);

  const value = useMemo(() => ({
    taille,
    estPresentation: taille === 'presentation',
    definirTaille,
    augmenterTaille,
    reduireTaille,
    reinitialiser,
  }), [taille, definirTaille, augmenterTaille, reduireTaille, reinitialiser]);

  return createElement(DisplayPreferencesContext.Provider, { value }, children);
}

export function useDisplayPreferences() {
  const context = useContext(DisplayPreferencesContext);
  if (!context) {
    throw new Error('useDisplayPreferences doit être utilisé à l’intérieur de DisplayPreferencesProvider.');
  }
  return context;
}
