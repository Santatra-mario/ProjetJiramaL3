import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';

import Toast from './Toast.jsx';

/* =========================================================
   TOAST PROVIDER
   Utilisation :
     const { notify, dismiss } = useToast();

     notify({
       genre: 'succes' | 'erreur' | 'info' | 'attention',
       titre: 'Titre',
       message: 'Détail (facultatif)',
       duree: 5000,            // ms ; 0 = persistant
       cle: 'identifiant',     // facultatif : remplace le toast de même clé
       action: { label: 'Voir', onClick: () => {} },
     });

     dismiss('identifiant');   // ferme un toast par sa clé
========================================================= */

const MAX_TOASTS = 4;

const DUREES = {
  succes: 5000,
  info: 6000,
  attention: 7000,
  erreur: 8000,
};

const ToastContext = createContext(null);

const FALLBACK = {
  notify: () => null,
  dismiss: () => {},
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const compteur = useRef(0);

  const dismiss = useCallback((cle) => {
    setToasts((liste) => liste.filter((toast) => toast.cle !== cle));
  }, []);

  const notify = useCallback(
    ({
      genre = 'info',
      titre = '',
      message = '',
      duree,
      action,
      cle,
    } = {}) => {
      const clef = cle || `${genre}|${titre}|${message}`;

      const dureeFinale =
        typeof duree === 'number' ? duree : DUREES[genre] ?? 6000;

      compteur.current += 1;

      const revision = compteur.current;

      setToasts((liste) => {
        // même clé : l'ancien toast est remplacé et le temps repart de zéro
        const sansDoublon = liste.filter((toast) => toast.cle !== clef);

        return [
          ...sansDoublon,
          {
            cle: clef,
            revision,
            genre,
            titre,
            message,
            duree: dureeFinale,
            action,
          },
        ].slice(-MAX_TOASTS);
      });

      return clef;
    },
    []
  );

  const valeur = useMemo(
    () => ({ notify, dismiss }),
    [notify, dismiss]
  );

  return (
    <ToastContext.Provider value={valeur}>
      {children}

      <div
        role="region"
        aria-label="Messages"
        className="pointer-events-none fixed bottom-4 right-4 z-[120] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
      >
        {toasts.map((toast) => (
          <Toast
            key={`${toast.cle}-${toast.revision}`}
            toast={toast}
            onClose={() => dismiss(toast.cle)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext) || FALLBACK;
}

export default ToastProvider;