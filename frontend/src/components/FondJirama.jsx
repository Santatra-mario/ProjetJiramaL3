/**
 * Fond partagé de l'application JIRAMA.
 * Direction /impeccable : arrière-plan de marque discret, stable et lisible.
 * Le décor ne capte pas les interactions et ne repose pas sur des animations
 * permanentes ; les thèmes clair et sombre sont pilotés par les variables CSS.
 */
export default function FondJirama({ children, fixe = false, intensite = 'calme' }) {
  return (
    <div
      data-intensite={intensite}
      className={`jr-page relative min-h-screen overflow-x-clip ${fixe ? 'jr-page--fixed' : ''}`}
    >
      <div className="jr-page__motif pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <svg
          viewBox="0 0 1440 560"
          preserveAspectRatio="xMidYMin slice"
          className="absolute -right-40 -top-10 h-[32rem] w-full max-w-[112rem] text-jr-eau"
          fill="none"
        >
          <path d="M520 24 C700 130 820 72 940 150 S1210 220 1510 48" stroke="currentColor" strokeWidth="1.1" opacity=".24" />
          <path d="M550 64 C730 170 850 112 970 190 S1240 260 1540 88" stroke="var(--jr-elec)" strokeWidth="1" strokeDasharray="3 10" opacity=".24" />
          <path d="M430 170 C620 278 790 206 945 282 S1230 350 1490 210" stroke="currentColor" strokeWidth=".8" opacity=".13" />
          <circle cx="945" cy="150" r="4" fill="var(--jr-eau)" opacity=".3" />
          <circle cx="970" cy="190" r="3" fill="var(--jr-elec)" opacity=".45" />
        </svg>
        <div className="jr-page__accent absolute -bottom-56 -left-40 h-[28rem] w-[28rem] rounded-full" />
      </div>
      <div className="relative z-10 min-h-screen">{children}</div>
    </div>
  );
}
