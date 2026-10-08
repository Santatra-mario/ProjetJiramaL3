import { useEffect, useRef, useState } from 'react';
import { Droplets, Zap } from 'lucide-react';

import { COULEURS } from '../theme/couleurs.js';

/* =========================================================
   FOND JIRAMA (version dynamique)
   Eau : dégradé bleu, vagues avec houle et écume, bulles qui montent.
   Électricité : halos qui respirent, câbles avec impulsions lumineuses,
   étincelles et éclair rare.
   Profondeur : les halos et grandes icônes suivent légèrement la souris.
   Tout est en CSS / SVG intégré, décoratif (aria-hidden). Les couleurs
   viennent des variables de index.css (clair et sombre).
   Les animations et le suivi de la souris sont coupés si
   « réduire les animations » est activé dans le système.
========================================================= */

// Largeur du tracé : la moitié (1440) sert de boucle à l'animation
const LARGEUR = 2880;

// Courbe d'une vague périodique (boucle sans couture).
// `periodes` doit être pair pour que la moitié gauche = la moitié droite.
function courbeVague({ periodes, amplitude, base }) {
  const pas = LARGEUR / periodes;
  const demi = pas / 2;

  let d = `M0,${base} Q${pas / 4},${base - amplitude} ${demi},${base}`;
  for (let i = 2; i <= periodes * 2; i += 1) {
    d += ` T${demi * i},${base}`;
  }
  return d;
}

const VAGUES = [
  { cle: 'arriere', periodes: 4, amplitude: 26, base: 110, couleur: 'var(--jr-vague-1)', duree: '70s', houle: '9s', sens: 'normal', ecume: false },
  { cle: 'milieu', periodes: 6, amplitude: 20, base: 150, couleur: 'var(--jr-vague-2)', duree: '52s', houle: '7s', sens: 'reverse', ecume: true },
  { cle: 'avant', periodes: 8, amplitude: 15, base: 195, couleur: 'var(--jr-vague-3)', duree: '38s', houle: '5.5s', sens: 'normal', ecume: true },
].map((v) => {
  const courbe = courbeVague(v);
  return { ...v, courbe, surface: `${courbe} L${LARGEUR},300 L0,300 Z` };
});

// Câbles aériens (affaissement régulier entre les pylônes)
const CABLE_HAUT =
  'M0,40 Q120,95 240,48 Q360,100 480,56 Q600,95 720,40 Q840,100 960,60 Q1080,95 1200,44 Q1320,100 1440,52';
const CABLE_BAS =
  'M0,64 Q120,119 240,72 Q360,124 480,80 Q600,119 720,64 Q840,124 960,84 Q1080,119 1200,68 Q1320,124 1440,76';

// Pylônes : [x, y du câble haut]
const PYLONES = [
  [240, 48],
  [720, 40],
  [1200, 44],
];

// Impulsions lumineuses : [câble, durée, décalage, sens inverse ?]
const IMPULSIONS = [
  [CABLE_HAUT, '7s', '0s', false],
  [CABLE_HAUT, '11s', '-5s', false],
  [CABLE_BAS, '9s', '-2s', true],
];

// Bulles d'eau : valeurs déterministes (pas de hasard, rendu stable).
// Le délai est négatif : les bulles sont déjà en route au chargement.
const BULLES = Array.from({ length: 16 }, (_, i) => ({
  cle: i,
  gauche: (i * 37 + 8) % 100,
  taille: 6 + ((i * 7) % 14),
  duree: 14 + ((i * 5) % 12),
  delai: -((i * 3) % 14),
  derive: 10 + ((i * 11) % 24),
}));

// Étincelles dans la moitié haute de la page
const ETINCELLES = Array.from({ length: 12 }, (_, i) => ({
  cle: i,
  gauche: (i * 53 + 11) % 96,
  haut: (i * 29 + 6) % 52,
  taille: 3 + (i % 3),
  duree: 3.5 + ((i * 7) % 5),
  delai: -((i * 5) % 7),
  dx: (i % 2 === 0 ? 1 : -1) * (6 + ((i * 3) % 10)),
}));

// Lit une préférence système (avec abonnement aux changements)
function usePreference(requete) {
  const lire = () =>
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia(requete).matches;

  const [actif, setActif] = useState(lire);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const mq = window.matchMedia(requete);
    const surChangement = (e) => setActif(e.matches);

    setActif(mq.matches);
    if (mq.addEventListener) {
      mq.addEventListener('change', surChangement);
      return () => mq.removeEventListener('change', surChangement);
    }
    mq.addListener(surChangement);
    return () => mq.removeListener(surChangement);
  }, [requete]);

  return actif;
}

// Place la position de la souris (-1 à 1) dans --px / --py sur la racine
function useSuiviSouris(refRacine, actif) {
  useEffect(() => {
    const racine = refRacine.current;
    if (!actif || !racine) return undefined;

    let image = 0;
    let x = 0;
    let y = 0;

    const appliquer = () => {
      racine.style.setProperty('--px', x.toFixed(3));
      racine.style.setProperty('--py', y.toFixed(3));
      image = 0;
    };

    const surMouvement = (e) => {
      x = (e.clientX / window.innerWidth - 0.5) * 2;
      y = (e.clientY / window.innerHeight - 0.5) * 2;
      if (!image) image = requestAnimationFrame(appliquer);
    };

    window.addEventListener('pointermove', surMouvement, { passive: true });
    return () => {
      window.removeEventListener('pointermove', surMouvement);
      if (image) cancelAnimationFrame(image);
    };
  }, [refRacine, actif]);
}

// Décalage « profondeur » : propriété CSS `translate` (se combine avec
// les rotations et animations déjà présentes sur l'élément)
const profondeur = (px, py) => ({
  translate: `calc(var(--px, 0) * ${px}px) calc(var(--py, 0) * ${py}px)`,
  transition: 'translate 0.8s ease-out',
});

function FondJirama({ children, fixe = false, intensite = 'vivant' }) {
  const racine = useRef(null);

  // « calme » : pour les pages de données (tableaux) - décor atténué
  const calme = intensite === 'calme';

  const reduit = usePreference('(prefers-reduced-motion: reduce)');
  const pointeurFin = usePreference('(pointer: fine)');

  useSuiviSouris(racine, !reduit && pointeurFin);

  return (
    <div
      ref={racine}
      data-intensite={intensite}
            className={`jr-page relative min-h-screen ${
        fixe ? 'overflow-clip' : 'overflow-hidden'
      }`}
      style={{
        background:
          'linear-gradient(160deg, var(--jr-fond-debut) 0%, var(--jr-fond) 50%, var(--jr-fond-fin) 100%)',
        backgroundAttachment: fixe ? 'fixed' : undefined,
        color: COULEURS.texte,
      }}
    >
      {/* ---------- Décor (aucun clic, ignoré des lecteurs d'écran) ---------- */}
      <div
        aria-hidden="true"
                className={`pointer-events-none ${
          fixe ? 'fixed' : 'absolute'
        } inset-0 overflow-hidden`}
      >
        {/* Halos qui respirent : eau en haut à gauche, électricité en haut à droite */}
        <div
          className="absolute -left-40 -top-40 h-[30rem] w-[30rem]"
          style={{ ...profondeur(-26, -18), opacity: calme ? 0.5 : 1 }}
        >
          <div
            className="jr-respire h-full w-full rounded-full"
            style={{
              background:
                'radial-gradient(circle at center, var(--jr-halo-eau), transparent 68%)',
            }}
          />
        </div>
        <div
          className="absolute -right-40 -top-32 h-[34rem] w-[34rem]"
          style={{ ...profondeur(30, -20), opacity: calme ? 0.45 : 1 }}
        >
          <div
            className="jr-respire h-full w-full rounded-full"
            style={{
              animationDelay: '-4s',
              background:
                'radial-gradient(circle at center, var(--jr-halo-elec), transparent 66%)',
            }}
          />
        </div>

        {/* Réseau électrique : câbles, pylônes, courant et impulsions */}
        <svg
          viewBox="0 0 1440 220"
          preserveAspectRatio="xMidYMin slice"
          className="absolute left-0 top-0 h-44 w-full sm:h-56"
          fill="none"
          stroke="var(--jr-elec)"
          strokeLinecap="round"
          style={{ opacity: calme ? 0.4 : 1 }}
        >
          <path d={CABLE_HAUT} strokeWidth="1.5" opacity="0.35" />
          <path d={CABLE_BAS} strokeWidth="1.5" opacity="0.22" />

          {/* Courant qui circule sur le câble du haut */}
          <path
            className="jr-flux"
            d={CABLE_HAUT}
            strokeWidth="3"
            strokeDasharray="2 22"
            opacity="0.7"
          />

          {PYLONES.map(([x, y]) => (
            <g key={x} opacity="0.3" strokeWidth="1.5">
              <path d={`M${x},${y} V200 M${x - 26},${y + 28} H${x + 26} M${x - 18},${y + 64} H${x + 18}`} />
              <circle cx={x} cy={y} r="3.5" fill="var(--jr-elec)" stroke="none" />
            </g>
          ))}

          {/* Impulsions lumineuses qui parcourent les câbles */}
          {!reduit && !calme &&
            IMPULSIONS.map(([chemin, duree, decalage, inverse], i) => (
              <circle
                key={i}
                r="4"
                fill="var(--jr-elec)"
                stroke="none"
                style={{ filter: 'drop-shadow(0 0 6px var(--jr-elec))' }}
              >
                <animateMotion
                  path={chemin}
                  dur={duree}
                  begin={decalage}
                  repeatCount="indefinite"
                  calcMode="linear"
                  {...(inverse
                    ? { keyPoints: '1;0', keyTimes: '0;1' }
                    : {})}
                />
              </circle>
            ))}
        </svg>

        {/* Éclair rare (haut droite) : coupé en mode calme */}
        {!calme && (
        <svg
          viewBox="0 0 60 100"
          className="jr-eclair absolute right-[12%] top-[8%] hidden h-40 w-24 md:block"
          style={{ filter: 'drop-shadow(0 0 14px var(--jr-elec))' }}
        >
          <path d="M36 0 8 54h20L22 100 52 40H32z" fill="var(--jr-elec)" />
        </svg>
        )}

        {/* Grandes icônes très discrètes (écrans moyens et grands) */}
        {!calme && (
        <div
          className="absolute -right-6 top-1/3 hidden md:block"
          style={profondeur(-38, -26)}
        >
          <Zap
            size={260}
            strokeWidth={0.8}
            className="rotate-12"
            style={{ color: COULEURS.elec, opacity: 0.09 }}
          />
        </div>
        )}
        {!calme && (
        <div
          className="absolute -left-8 bottom-1/4 hidden md:block"
          style={profondeur(34, 24)}
        >
          <Droplets
            size={240}
            strokeWidth={0.8}
            className="-rotate-12"
            style={{ color: COULEURS.eauClair, opacity: 0.1 }}
          />
        </div>
        )}

        {/* Étincelles */}
        {!reduit && !calme &&
          ETINCELLES.map((e) => (
            <span
              key={e.cle}
              className="jr-scintille absolute rounded-full"
              style={{
                left: `${e.gauche}%`,
                top: `${e.haut}%`,
                width: e.taille,
                height: e.taille,
                backgroundColor: 'var(--jr-elec)',
                boxShadow: '0 0 10px 2px var(--jr-elec)',
                animationDuration: `${e.duree}s`,
                animationDelay: `${e.delai}s`,
                '--jr-dx': `${e.dx}px`,
              }}
            />
          ))}

        {/* Bulles d'eau qui montent */}
        {!reduit &&
          BULLES.slice(0, calme ? 6 : BULLES.length).map((b) => (
            <span
              key={b.cle}
              className="jr-bulle absolute rounded-full"
              style={{
                left: `${b.gauche}%`,
                bottom: -30,
                width: b.taille,
                height: b.taille,
                opacity: calme ? 0.45 : 1,
                backgroundColor: 'var(--jr-bulle-fond)',
                border: '1px solid var(--jr-bulle-bord)',
                animationDuration: `${b.duree}s`,
                animationDelay: `${b.delai}s`,
                '--jr-derive': `${b.derive}px`,
              }}
            />
          ))}

        {/* Vagues : défilement horizontal + houle verticale + écume */}
        {VAGUES.map((v) => (
          <div
            key={v.cle}
            className="jr-houle absolute bottom-0 left-0 h-56 w-full sm:h-72"
            style={{ animationDuration: v.houle, opacity: calme ? 0.5 : 1 }}
          >
            <svg
              viewBox={`0 0 ${LARGEUR} 300`}
              preserveAspectRatio="none"
              className="jr-vague absolute bottom-0 left-0 h-full w-[200%]"
              style={{
                animationDuration: v.duree,
                animationDirection: v.sens,
              }}
            >
              <path d={v.surface} fill={v.couleur} />
              {v.ecume && (
                <path
                  d={v.courbe}
                  fill="none"
                  stroke="var(--jr-ecume)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              )}
            </svg>
          </div>
        ))}

        {/* Grain très léger : casse l'aspect dégradé lisse */}
        <div className="jr-grain absolute inset-0" />
      </div>

      {/* ---------- Contenu de la page ---------- */}
      <div className="relative z-10 min-h-screen">{children}</div>
    </div>
  );
}

export default FondJirama;
