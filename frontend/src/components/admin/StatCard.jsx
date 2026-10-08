import { TrendingUp, TriangleAlert, Info } from 'lucide-react';

/* Les props iconBg / iconColor restent acceptées (compatibilité) :
   leurs couleurs Tailwind sont adaptées au thème par index.css. */
function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconBg = 'bg-blue-50',
  iconColor = 'text-blue-600',
  trend = 'up',
}) {
  const isAlert = trend === 'alert';
  const isInfo = trend === 'info';

  const TrendIcon = isAlert ? TriangleAlert : isInfo ? Info : TrendingUp;

  const couleurTendance = isAlert
    ? 'text-jr-err'
    : isInfo
      ? 'text-jr-lien'
      : 'text-jr-ok';

  return (
    <div className="jr-verre group rounded-2xl border border-jr-bordure p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-jr-bordure-forte hover:shadow-lg motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-jr-doux">{title}</p>

          <p className="mt-2 text-3xl font-bold tracking-tight text-jr-texte">
            {value}
          </p>

          <div className="mt-2 flex items-center gap-1.5">
            <TrendIcon size={14} aria-hidden="true" className={couleurTendance} />
            <span className={`text-xs font-semibold ${couleurTendance}`}>
              {subtitle}
            </span>
          </div>
        </div>

        <div
          className={`rounded-2xl p-3 transition duration-300 group-hover:scale-110 motion-reduce:transition-none motion-reduce:group-hover:scale-100 ${iconBg}`}
        >
          {Icon && <Icon size={24} aria-hidden="true" className={iconColor} />}
        </div>
      </div>
    </div>
  );
}

export default StatCard;