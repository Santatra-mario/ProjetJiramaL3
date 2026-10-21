import { useEffect, useRef, useState } from 'react';
import {
  Check,
  Maximize2,
  Minimize2,
  Presentation,
  RotateCcw,
  Type,
  X,
} from 'lucide-react';
import { useDisplayPreferences } from '../hooks/useDisplayPreferences.js';

const OPTIONS = [
  { id: 'standard', label: 'Standard', description: 'Utilisation quotidienne' },
  { id: 'grand', label: 'Grand', description: 'Texte et valeurs agrandis' },
  { id: 'presentation', label: 'Présentation', description: 'Lisibilité renforcée au projecteur' },
];

export default function DisplayControls() {
  const [open, setOpen] = useState(false);
  const [pleinEcran, setPleinEcran] = useState(Boolean(document.fullscreenElement));
  const [erreurPleinEcran, setErreurPleinEcran] = useState('');
  const rootRef = useRef(null);
  const { taille, definirTaille, augmenterTaille, reduireTaille, reinitialiser } = useDisplayPreferences();

  useEffect(() => {
    const updateFullscreen = () => setPleinEcran(Boolean(document.fullscreenElement));
    const onPointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('fullscreenchange', updateFullscreen);
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('fullscreenchange', updateFullscreen);
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const basculerPleinEcran = async () => {
    setErreurPleinEcran('');
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      } else {
        setErreurPleinEcran('Le plein écran n’est pas disponible dans ce navigateur.');
      }
    } catch {
      setErreurPleinEcran('Le navigateur a refusé le plein écran. Réessayez depuis ce bouton.');
    }
  };

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        aria-label="Ouvrir les réglages d’affichage"
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Réglages d’affichage"
        onClick={() => setOpen((value) => !value)}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-jr-bordure bg-jr-surface text-jr-doux transition-colors hover:border-jr-bordure-forte hover:bg-jr-eau-pale hover:text-jr-lien focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jr-focus motion-reduce:transition-none"
      >
        <Type size={20} aria-hidden="true" />
      </button>

      {open && (
        <section
          role="dialog"
          aria-label="Réglages d’affichage"
          className="jr-display-panel absolute right-0 top-[calc(100%_+_10px)] z-[80] w-[min(22rem,calc(100vw_-_2rem))] rounded-xl border border-jr-bordure bg-jr-surface p-4 text-jr-texte shadow-xl shadow-slate-950/15"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-jr-titre">Affichage</h2>
              <p className="mt-1 text-sm leading-5 text-jr-doux">Adaptez la taille aux conditions de lecture.</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Fermer les réglages d’affichage" className="rounded-md p-1.5 text-jr-faible hover:bg-jr-champ hover:text-jr-texte focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jr-focus">
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2" aria-label="Taille du texte">
            <button type="button" onClick={reduireTaille} disabled={taille === 'standard'} className="min-h-10 rounded-lg border border-jr-bordure px-2 py-2 text-sm font-semibold text-jr-texte hover:bg-jr-champ disabled:cursor-not-allowed disabled:opacity-40" aria-label="Réduire la taille du texte">A−</button>
            <div className="flex items-center justify-center rounded-lg bg-jr-fond px-2 text-sm font-semibold text-jr-doux" aria-live="polite">{taille === 'standard' ? '100 %' : taille === 'grand' ? '112 %' : '125 %'}</div>
            <button type="button" onClick={augmenterTaille} disabled={taille === 'presentation'} className="min-h-10 rounded-lg border border-jr-bordure px-2 py-2 text-sm font-semibold text-jr-texte hover:bg-jr-champ disabled:cursor-not-allowed disabled:opacity-40" aria-label="Agrandir la taille du texte">A+</button>
          </div>

          <div className="mt-3 space-y-2">
            {OPTIONS.map((option) => {
              const active = taille === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => definirTaille(option.id)}
                  className={`flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jr-focus motion-reduce:transition-none ${active ? 'border-jr-eau bg-jr-eau-pale' : 'border-jr-bordure hover:bg-jr-champ'}`}
                >
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${active ? 'bg-jr-surface text-jr-lien' : 'bg-jr-fond text-jr-doux'}`}>
                    {option.id === 'presentation' ? <Presentation size={18} aria-hidden="true" /> : <Type size={18} aria-hidden="true" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-jr-texte">{option.label}</span>
                    <span className="mt-0.5 block text-xs leading-4 text-jr-doux">{option.description}</span>
                  </span>
                  {active && <Check size={17} className="shrink-0 text-jr-lien" aria-label="Sélectionné" />}
                </button>
              );
            })}
          </div>

          <div className="mt-4 border-t border-jr-bordure pt-3">
            <button type="button" onClick={basculerPleinEcran} className="flex min-h-10 w-full items-center gap-2 rounded-lg border border-jr-bordure px-3 py-2 text-sm font-semibold text-jr-texte hover:bg-jr-champ focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jr-focus">
              {pleinEcran ? <Minimize2 size={17} aria-hidden="true" /> : <Maximize2 size={17} aria-hidden="true" />}
              {pleinEcran ? 'Quitter le plein écran' : 'Activer le plein écran'}
            </button>
            {erreurPleinEcran && <p className="mt-2 text-xs leading-5 text-jr-err" role="status">{erreurPleinEcran}</p>}
            <button type="button" onClick={reinitialiser} className="mt-2 inline-flex min-h-9 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-jr-doux hover:bg-jr-champ hover:text-jr-texte focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jr-focus">
              <RotateCcw size={15} aria-hidden="true" /> Réinitialiser la taille
            </button>
            {taille === 'presentation' && <p className="mt-2 text-xs leading-5 text-jr-doux">Le mode présentation reste actif lorsque vous changez de page. Sélectionnez « Standard » pour revenir à la taille normale.</p>}
          </div>
        </section>
      )}
    </div>
  );
}
