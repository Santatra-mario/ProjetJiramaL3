import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  TriangleAlert,
  X,
} from 'lucide-react';

/* =========================================================
   TOAST (message temporaire)
   - glisse depuis la droite (jr-toast), icône qui « pop »
   - se ferme seul, avec une barre de progression
   - le temps est mis en pause au survol et au focus clavier
   - Échap ferme le toast qui a le focus
   - duree = 0 : toast persistant (pas de fermeture automatique)
========================================================= */

const GENRES = {
  succes: {
    Icone: CheckCircle2,
    ligne: 'var(--jr-ok)',
    fond: 'var(--jr-ok-pale)',
    texte: 'var(--jr-ok)',
    role: 'status',
  },
  erreur: {
    Icone: AlertTriangle,
    ligne: 'var(--jr-err)',
    fond: 'var(--jr-err-pale)',
    texte: 'var(--jr-err)',
    role: 'alert',
  },
  attention: {
    Icone: TriangleAlert,
    ligne: 'var(--jr-elec)',
    fond: 'var(--jr-elec-pale)',
    texte: 'var(--jr-attention)',
    role: 'status',
  },
  info: {
    Icone: Info,
    ligne: 'var(--jr-eau-clair)',
    fond: 'var(--jr-eau-pale)',
    texte: 'var(--jr-lien)',
    role: 'status',
  },
};

function Toast({ toast, onClose }) {
  const { genre = 'info', titre, message, duree, action } = toast;

  const style = GENRES[genre] || GENRES.info;
  const Icone = style.Icone;
  const persistant = !duree || duree <= 0;

  const [pause, setPause] = useState(false);
  const reste = useRef(duree);
  const debut = useRef(0);
  const fermer = useRef(onClose);

  fermer.current = onClose;

  useEffect(() => {
    if (persistant || pause) {
      return undefined;
    }

    debut.current = Date.now();

    const minuteur = window.setTimeout(() => {
      fermer.current?.();
    }, reste.current);

    return () => {
      window.clearTimeout(minuteur);

      reste.current = Math.max(
        0,
        reste.current - (Date.now() - debut.current)
      );
    };
  }, [pause, persistant]);

  function surTouche(event) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose?.();
    }
  }

  return (
    <div
      role={style.role}
      aria-live={style.role === 'alert' ? 'assertive' : 'polite'}
      onMouseEnter={() => setPause(true)}
      onMouseLeave={() => setPause(false)}
      onFocus={() => setPause(true)}
      onBlur={() => setPause(false)}
      onKeyDown={surTouche}
      className="jr-toast jr-verre-fort pointer-events-auto relative overflow-hidden rounded-md border border-jr-bordure py-3 pl-3 pr-2 shadow-lg"
      style={{ borderLeft: `4px solid ${style.ligne}` }}
    >
      <div className="flex items-start gap-3">
        <span
          className="jr-pop mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: style.fond, color: style.texte }}
        >
          <Icone
            size={18}
            aria-hidden="true"
          />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-jr-titre">
            {titre}
          </p>

          {message && (
            <p className="mt-0.5 break-words text-sm text-jr-doux">
              {message}
            </p>
          )}

          {action?.label && (
            <button
              type="button"
              onClick={() => {
                action.onClick?.();
                onClose?.();
              }}
              className="mt-2 rounded-md border border-jr-bordure px-2.5 py-1 text-xs font-semibold text-jr-lien transition hover:bg-jr-eau-pale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jr-elec motion-reduce:transition-none"
            >
              {action.label}
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => onClose?.()}
          aria-label="Fermer le message"
          className="rounded p-1 text-jr-faible transition-colors hover:bg-jr-eau-pale hover:text-jr-texte focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jr-elec motion-reduce:transition-none"
        >
          <X
            size={16}
            aria-hidden="true"
          />
        </button>
      </div>

      {!persistant && (
        <span
          aria-hidden="true"
          className="jr-progression absolute bottom-0 left-0 h-0.5"
          style={{
            backgroundColor: style.ligne,
            animationDuration: `${duree}ms`,
            animationPlayState: pause ? 'paused' : 'running',
          }}
        />
      )}
    </div>
  );
}

export default Toast;