import {
  BarChart3,
  CalendarDays,
  ClipboardList,
  Droplets,
  Gauge,
  Minus,
  TrendingDown,
  TrendingUp,
  UserRound,
  Zap,
} from 'lucide-react';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import {
  DEFAULT_TYPE_STATS,
  formatDate,
  formatMonthLabel,
  formatNumber,
} from './analysisUtils.js';

/* ---------------------------------------------------------
   Cartes
--------------------------------------------------------- */

function IndicatorCard({
  title,
  value,
  unit = '',
  description = '',
  icon: Icon,
  iconBg = 'bg-blue-50',
  iconColor = 'text-blue-600',
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">{title}</p>

          <p className="mt-2 text-2xl font-bold text-slate-900">
            {formatNumber(value)}
            {unit && (
              <span className="ml-1 text-sm font-semibold text-slate-500">
                {unit}
              </span>
            )}
          </p>

          {description && (
            <p className="mt-2 text-xs leading-5 text-slate-500">
              {description}
            </p>
          )}
        </div>

        <div className={`shrink-0 rounded-2xl p-3 ${iconBg}`}>
          {Icon && <Icon size={21} className={iconColor} />}
        </div>
      </div>
    </div>
  );
}

function SmallStat({ label, value, unit = '' }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-[11px] font-medium text-slate-400">{label}</p>
      <p className="mt-1 text-base font-bold text-slate-800">
        {formatNumber(value)}
      </p>
      <p className="text-[10px] text-slate-400">{unit}</p>
    </div>
  );
}

function TypeSummaryCard({ title, type, data }) {
  const isWater = type === 'EAU';

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={
              isWater
                ? 'rounded-xl bg-cyan-50 p-3'
                : 'rounded-xl bg-amber-50 p-3'
            }
          >
            {isWater ? (
              <Droplets size={20} className="text-cyan-600" />
            ) : (
              <Zap size={20} className="text-amber-600" />
            )}
          </div>

          <div>
            <h3 className="font-bold text-slate-900">{title}</h3>
            <p className="text-xs text-slate-500">Indicateurs de la période</p>
          </div>
        </div>

        <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
          {data.unite}
        </span>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SmallStat label="Total" value={data.total} unit={data.unite} />
        <SmallStat label="Moyenne" value={data.moyenne} unit={data.unite} />
        <SmallStat label="Maximum" value={data.maximum} unit={data.unite} />
        <SmallStat label="Minimum" value={data.minimum} unit={data.unite} />
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <SmallStat label="Relevés" value={data.nombreReleves} />
        <SmallStat label="Compteurs" value={data.nombreCompteurs} />
        <SmallStat label="Abonnés" value={data.nombreAbonnes} />
      </div>
    </section>
  );
}

function ComparisonCard({ comparison, type }) {
  if (!comparison?.disponible) {
    return null;
  }

  const variation = Number(comparison.variationPourcentage || 0);
  const isIncrease = comparison.tendance === 'hausse';
  const isDecrease = comparison.tendance === 'baisse';

  const Icon = isIncrease ? TrendingUp : isDecrease ? TrendingDown : Minus;

  const iconBg = isIncrease
    ? 'bg-rose-50'
    : isDecrease
      ? 'bg-emerald-50'
      : 'bg-slate-100';

  const iconColor = isIncrease
    ? 'text-rose-600'
    : isDecrease
      ? 'text-emerald-600'
      : 'text-slate-500';

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Comparaison avec la période précédente
          </h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Comparaison sur une durée identique à la période sélectionnée.
          </p>
        </div>

        <div className={`rounded-xl p-3 ${iconBg}`}>
          <Icon size={20} className={iconColor} />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <p className="text-xs text-slate-400">Type</p>
          <p className="mt-1 font-semibold text-slate-800">
            {type === 'EAU'
              ? 'Eau'
              : type === 'ELECTRICITE'
                ? 'Électricité'
                : 'Eau + Électricité'}
          </p>
        </div>

        <div>
          <p className="text-xs text-slate-400">Total précédent</p>
          <p className="mt-1 font-semibold text-slate-800">
            {formatNumber(comparison.totalPrecedent)}
          </p>
        </div>

        <div>
          <p className="text-xs text-slate-400">Variation</p>
          <p className={`mt-1 font-bold ${iconColor}`}>
            {variation > 0 ? '+' : ''}
            {formatNumber(variation)} %
          </p>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------
   SECTION STATISTIQUES
   Props : data = réponse de GET /statistiques, type = filtre
--------------------------------------------------------- */

function StatistiquesSection({ data, type }) {
  const stats = data?.statistiques || {
    nombreReleves: 0,
    nombreCompteurs: 0,
    nombreAbonnes: 0,
    datePremierReleve: null,
    dateDernierReleve: null,
  };

  const parType = data?.parType || {
    EAU: { ...DEFAULT_TYPE_STATS, unite: 'm³' },
    ELECTRICITE: { ...DEFAULT_TYPE_STATS, unite: 'kWh' },
  };

  const currentType =
    type === 'EAU'
      ? parType.EAU
      : type === 'ELECTRICITE'
        ? parType.ELECTRICITE
        : null;

  const chartData = (data?.evolution || []).map((item) => ({
    mois: formatMonthLabel(item.mois),
    eau: Number(item.eau || 0),
    electricite: Number(item.electricite || 0),
  }));

  const showWater = type === 'TOUS' || type === 'EAU';
  const showElectricity = type === 'TOUS' || type === 'ELECTRICITE';

  return (
    <div className="space-y-6">
      {/* KPI */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <IndicatorCard
          title="Nombre de relevés"
          value={currentType ? currentType.nombreReleves : stats.nombreReleves}
          description="Relevés correspondant aux filtres."
          icon={ClipboardList}
        />

        <IndicatorCard
          title="Compteurs concernés"
          value={
            currentType ? currentType.nombreCompteurs : stats.nombreCompteurs
          }
          description="Compteurs présents dans les relevés."
          icon={Gauge}
          iconBg="bg-cyan-50"
          iconColor="text-cyan-600"
        />

        <IndicatorCard
          title="Abonnés concernés"
          value={currentType ? currentType.nombreAbonnes : stats.nombreAbonnes}
          description="Abonnés représentés dans les relevés."
          icon={UserRound}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
        />

        <IndicatorCard
          title="Consommation totale"
          value={currentType ? currentType.total : '—'}
          unit={currentType ? currentType.unite : ''}
          description={
            currentType
              ? 'Total de la période sélectionnée.'
              : 'Choisissez Eau ou Électricité pour afficher un total.'
          }
          icon={BarChart3}
          iconBg="bg-violet-50"
          iconColor="text-violet-600"
        />
      </div>

      {/* EAU / ÉLECTRICITÉ */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {showWater && (
          <TypeSummaryCard
            title="Consommation d'eau"
            type="EAU"
            data={parType.EAU}
          />
        )}

        {showElectricity && (
          <TypeSummaryCard
            title="Consommation d'électricité"
            type="ELECTRICITE"
            data={parType.ELECTRICITE}
          />
        )}
      </div>

      {/* MIN / MOYENNE / MAX */}
      {currentType && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5">
            <h2 className="text-lg font-bold text-slate-900">
              Indicateurs détaillés
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Valeurs extrêmes et moyenne observées pour le type sélectionné.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <IndicatorCard
              title="Minimum"
              value={currentType.minimum}
              unit={currentType.unite}
              description="Plus faible consommation enregistrée."
              icon={TrendingDown}
              iconBg="bg-emerald-50"
              iconColor="text-emerald-600"
            />

            <IndicatorCard
              title="Moyenne"
              value={currentType.moyenne}
              unit={currentType.unite}
              description="Consommation moyenne des relevés."
              icon={BarChart3}
            />

            <IndicatorCard
              title="Maximum"
              value={currentType.maximum}
              unit={currentType.unite}
              description="Plus forte consommation enregistrée."
              icon={TrendingUp}
              iconBg="bg-rose-50"
              iconColor="text-rose-600"
            />
          </div>
        </section>
      )}

      {/* ÉVOLUTION MENSUELLE */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Évolution mensuelle
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Consommations par mois sur la période sélectionnée.
            </p>
          </div>

          <div className="rounded-xl bg-blue-50 p-2.5">
            <BarChart3 size={19} className="text-blue-600" />
          </div>
        </div>

        {chartData.length === 0 ? (
          <div className="flex h-[340px] items-center justify-center rounded-xl bg-slate-50 text-sm text-slate-400">
            Aucune donnée disponible pour la période sélectionnée.
          </div>
        ) : (
          <div className="h-[340px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 10, right: 10, left: 0, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />

                <XAxis
                  dataKey="mois"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 12 }}
                />

                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 12 }}
                />

                <Tooltip
                  formatter={(value, name) => [
                    `${formatNumber(value)} ${name === 'Eau' ? 'm³' : 'kWh'}`,
                    name,
                  ]}
                />

                <Legend />

                {showWater && (
                  <Bar
                    dataKey="eau"
                    name="Eau"
                    fill="#0891b2"
                    radius={[5, 5, 0, 0]}
                  />
                )}

                {showElectricity && (
                  <Bar
                    dataKey="electricite"
                    name="Électricité"
                    fill="#f59e0b"
                    radius={[5, 5, 0, 0]}
                  />
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <ComparisonCard comparison={data?.comparaison} type={type} />

      {/* BORNES */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Bornes des données
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Premier et dernier relevé trouvé selon les filtres.
            </p>
          </div>

          <CalendarDays size={20} className="text-slate-400" />
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs text-slate-400">Premier relevé</p>
            <p className="mt-1 font-semibold text-slate-800">
              {formatDate(stats.datePremierReleve)}
            </p>
          </div>

          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs text-slate-400">Dernier relevé</p>
            <p className="mt-1 font-semibold text-slate-800">
              {formatDate(stats.dateDernierReleve)}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default StatistiquesSection;
