import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  useNavigate,
} from 'react-router-dom';

import {
  Activity,
  ArrowLeft,
  BarChart3,
  CalendarDays,
  ClipboardList,
  Droplets,
  Gauge,
  RefreshCw,
  TrendingUp,
  UserRound,
  Zap,
} from 'lucide-react';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import axiosClient
  from '../../api/axiosClient.js';

import Sidebar
  from '../../components/admin/Sidebar.jsx';

import Header
  from '../../components/admin/Header.jsx';


/* =========================================================
   UTILITAIRES
========================================================= */

function getToday() {

  const date =
    new Date();

  return [
    date.getFullYear(),

    String(
      date.getMonth() + 1
    ).padStart(2, '0'),

    String(
      date.getDate()
    ).padStart(2, '0'),

  ].join('-');
}


function getMonthsAgo(
  months
) {

  const date =
    new Date();

  date.setMonth(
    date.getMonth() -
    months
  );

  return [
    date.getFullYear(),

    String(
      date.getMonth() + 1
    ).padStart(2, '0'),

    String(
      date.getDate()
    ).padStart(2, '0'),

  ].join('-');
}


function toNumber(
  value
) {

  const number =
    Number(value);

  return Number.isFinite(
    number
  )
    ? number
    : 0;
}


function formatNumber(
  value
) {

  if (
    value === '—'
  ) {
    return '—';
  }

  return toNumber(
    value
  ).toLocaleString(
    'fr-FR',
    {
      maximumFractionDigits: 2,
    }
  );
}


function formatMonth(
  value
) {

  if (!value) {
    return '';
  }

  const [
    year,
    month,
  ] =
    String(value).split(
      '-'
    );

  if (
    !year ||
    !month
  ) {
    return String(value);
  }

  const date =
    new Date(
      Number(year),
      Number(month) - 1,
      1
    );

  const label =
    new Intl.DateTimeFormat(
      'fr-FR',
      {
        month: 'short',
        year: 'numeric',
      }
    ).format(
      date
    );

  return (
    label.charAt(0).toUpperCase() +
    label.slice(1)
  );
}


/* =========================================================
   KPI
========================================================= */

function KpiCard({
  title,
  value,
  unit,
  description,
  icon: Icon,
  bg,
  color,
}) {

  return (

    <div
      className="
        rounded-2xl
        border
        border-slate-200
        bg-white
        p-5
        shadow-sm
      "
    >

      <div
        className="
          flex
          items-start
          justify-between
          gap-4
        "
      >

        <div>

          <p
            className="
              text-sm
              font-medium
              text-slate-500
            "
          >
            {title}
          </p>


          <p
            className="
              mt-2
              text-2xl
              font-bold
              text-slate-900
            "
          >

            {formatNumber(
              value
            )}

            {unit && (

              <span
                className="
                  ml-1
                  text-sm
                  text-slate-500
                "
              >
                {unit}
              </span>

            )}

          </p>


          <p
            className="
              mt-2
              text-xs
              text-slate-500
            "
          >
            {description}
          </p>

        </div>


        <div
          className={`
            rounded-2xl
            p-3
            ${bg}
          `}
        >

          <Icon
            size={21}
            className={color}
          />

        </div>

      </div>

    </div>
  );
}


/* =========================================================
   SECTION GRAPHIQUE
========================================================= */

function ChartSection({
  title,
  description,
  icon: Icon = BarChart3,
  empty,
  children,
}) {

  return (

    <section
      className="
        rounded-2xl
        border
        border-slate-200
        bg-white
        p-5
        shadow-sm
        sm:p-6
      "
    >

      <div
        className="
          mb-5
          flex
          items-start
          justify-between
          gap-4
        "
      >

        <div>

          <h2
            className="
              text-lg
              font-bold
              text-slate-900
            "
          >
            {title}
          </h2>


          <p
            className="
              mt-1
              text-xs
              text-slate-500
            "
          >
            {description}
          </p>

        </div>


        <div
          className="
            rounded-xl
            bg-blue-50
            p-2.5
          "
        >

          <Icon
            size={19}
            className="
              text-blue-600
            "
          />

        </div>

      </div>


      {empty ? (

        <div
          className="
            flex
            h-[320px]
            items-center
            justify-center
            rounded-xl
            bg-slate-50
            text-sm
            text-slate-400
          "
        >
          Aucune donnée disponible
          pour cette période.
        </div>

      ) : (

        children

      )}

    </section>
  );
}


/* =========================================================
   GRAPHIQUE CONSOMMATION
   Graphique dynamique orienté analyse JIRAMA
========================================================= */

function ConsumptionLineChart({
  data = [],
  dataKey,
  name,
  unit,
  stroke,
}) {

  const chartData =
    useMemo(
      () => {
        const rows = data
          .map((item) => ({
            moisBrut: item?.mois,
            mois: formatMonth(item?.mois),
            valeur: toNumber(item?.[dataKey]),
            releves:
              toNumber(
                item?.[
                  dataKey === 'eau'
                    ? 'relevesEau'
                    : 'relevesElectricite'
                ]
              ),
          }))
          .filter((item) => item.moisBrut);

        return rows.sort((a, b) => {
          const dateA =
            new Date(
              `${String(a.moisBrut).slice(0, 7)}-01`
            ).getTime();

          const dateB =
            new Date(
              `${String(b.moisBrut).slice(0, 7)}-01`
            ).getTime();

          return dateA - dateB;
        });
      },
      [data, dataKey]
    );


  const analysis =
    useMemo(
      () => {
        if (chartData.length === 0) {
          return {
            total: 0,
            average: 0,
            maximum: 0,
            maximumMonth: '',
            minimum: 0,
            minimumMonth: '',
            variation: 0,
            totalReleves: 0,
            monthlyVariation: 0,
          };
        }

        const values =
          chartData.map(
            (item) => item.valeur
          );

        const total = values.reduce(
          (sum, value) =>
            sum + value,
          0
        );

        const average =
          total /
          chartData.length;

        const maximum =
          Math.max(...values);

        const minimum =
          Math.min(...values);

        const maxItem =
          chartData.find(
            (item) =>
              item.valeur === maximum
          );

        const minItem =
          chartData.find(
            (item) =>
              item.valeur === minimum
          );

        const firstValue =
          chartData[0]?.valeur || 0;

        const lastValue =
          chartData[
            chartData.length - 1
          ]?.valeur || 0;

        const variation =
          firstValue !== 0
            ? ((lastValue - firstValue) /
                Math.abs(firstValue)) *
              100
            : 0;

        const totalReleves =
          chartData.reduce(
            (sum, item) =>
              sum + item.releves,
            0
          );

        const monthlyVariation =
          chartData.length > 1 &&
          chartData[chartData.length - 2]
            .valeur !== 0
            ? ((lastValue -
                chartData[
                  chartData.length - 2
                ].valeur) /
                Math.abs(
                  chartData[
                    chartData.length - 2
                  ].valeur
                )) *
              100
            : 0;

        return {
          total,
          average,
          maximum,
          maximumMonth:
            maxItem?.mois || '',
          minimum,
          minimumMonth:
            minItem?.mois || '',
          variation,
          totalReleves,
          monthlyVariation,
        };
      },
      [chartData]
    );


  const averageLine =
    analysis.average;


  const gradientId =
    `consumptionGradient-${dataKey}`;


  const formatAxis = (value) => {
    const number =
      toNumber(value);

    if (number >= 1000000) {
      return `${(
        number / 1000000
      ).toFixed(1)} M`;
    }

    if (number >= 1000) {
      return `${(
        number / 1000
      ).toFixed(1)} k`;
    }

    return String(
      Math.round(number)
    );
  };


  const tooltipFormatter = (
    value,
    key
  ) => {
    if (key === 'valeur') {
      return [
        `${formatNumber(value)} ${unit}`,
        'Consommation mensuelle',
      ];
    }

    if (key === 'releves') {
      return [
        `${formatNumber(value)} relevés`,
        'Nombre de relevés',
      ];
    }

    return [
      formatNumber(value),
      key,
    ];
  };


  return (

    <div className="w-full">

      {/* ANALYSE AUTOMATIQUE */}
      <div
        className="
          mb-5
          grid
          grid-cols-2
          gap-3
          lg:grid-cols-4
        "
      >

        <div
          className="
            rounded-xl
            border
            border-slate-200
            bg-slate-50
            p-3
          "
        >
          <p
            className="
              text-[11px]
              font-medium
              uppercase
              tracking-wide
              text-slate-500
            "
          >
            Total période
          </p>

          <p
            className="
              mt-1
              text-base
              font-bold
              text-slate-900
            "
          >
            {formatNumber(
              analysis.total
            )}
            <span
              className="
                ml-1
                text-xs
                font-medium
                text-slate-500
              "
            >
              {unit}
            </span>
          </p>
        </div>


        <div
          className="
            rounded-xl
            border
            border-slate-200
            bg-slate-50
            p-3
          "
        >
          <p
            className="
              text-[11px]
              font-medium
              uppercase
              tracking-wide
              text-slate-500
            "
          >
            Moyenne mensuelle
          </p>

          <p
            className="
              mt-1
              text-base
              font-bold
              text-slate-900
            "
          >
            {formatNumber(
              analysis.average
            )}
            <span
              className="
                ml-1
                text-xs
                font-medium
                text-slate-500
              "
            >
              {unit}
            </span>
          </p>
        </div>


        <div
          className="
            rounded-xl
            border
            border-slate-200
            bg-slate-50
            p-3
          "
        >
          <p
            className="
              text-[11px]
              font-medium
              uppercase
              tracking-wide
              text-slate-500
            "
          >
            Pic mensuel
          </p>

          <p
            className="
              mt-1
              text-base
              font-bold
              text-slate-900
            "
          >
            {formatNumber(
              analysis.maximum
            )}
            <span
              className="
                ml-1
                text-xs
                font-medium
                text-slate-500
              "
            >
              {unit}
            </span>
          </p>

          <p
            className="
              mt-1
              truncate
              text-[11px]
              text-slate-500
            "
            title={
              analysis.maximumMonth
            }
          >
            {analysis.maximumMonth ||
              '—'}
          </p>
        </div>


        <div
          className="
            rounded-xl
            border
            border-slate-200
            bg-slate-50
            p-3
          "
        >
          <p
            className="
              text-[11px]
              font-medium
              uppercase
              tracking-wide
              text-slate-500
            "
          >
            Variation finale
          </p>

          <p
            className="
              mt-1
              text-base
              font-bold
              text-slate-900
            "
          >
            {analysis.variation > 0
              ? '+'
              : ''}
            {analysis.variation.toFixed(1)}
            %
          </p>

          <p
            className="
              mt-1
              truncate
              text-[11px]
              text-slate-500
            "
            title="Variation entre le premier et le dernier mois"
          >
            Premier mois → dernier mois
          </p>
        </div>

      </div>


      {/* GRAPHIQUE */}
      <div
        className="
          h-[350px]
          w-full
        "
      >

        <ResponsiveContainer
          width="100%"
          height="100%"
        >

          <AreaChart
            data={chartData}
            margin={{
              top: 8,
              right: 12,
              left: 4,
              bottom: 8,
            }}
          >

            <defs>
              <linearGradient
                id={gradientId}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor={stroke}
                  stopOpacity={0.24}
                />

                <stop
                  offset="100%"
                  stopColor={stroke}
                  stopOpacity={0.02}
                />
              </linearGradient>
            </defs>


            <CartesianGrid
              strokeDasharray="4 4"
              stroke="#e2e8f0"
              vertical={false}
            />


            <XAxis
              dataKey="mois"
              axisLine={false}
              tickLine={false}
              minTickGap={24}
              tick={{
                fill: '#64748b',
                fontSize: 11,
              }}
            />


            <YAxis
              axisLine={false}
              tickLine={false}
              width={64}
              tickFormatter={formatAxis}
              tick={{
                fill: '#64748b',
                fontSize: 11,
              }}
              label={{
                value: unit,
                angle: -90,
                position: 'insideLeft',
                style: {
                  fill: '#94a3b8',
                  fontSize: 11,
                },
              }}
            />


            <Tooltip
              cursor={{
                stroke: '#94a3b8',
                strokeDasharray: '4 4',
              }}
              contentStyle={{
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                boxShadow:
                  '0 8px 24px rgba(15, 23, 42, 0.10)',
              }}
              labelStyle={{
                color: '#0f172a',
                fontWeight: 700,
                marginBottom: 6,
              }}
              formatter={tooltipFormatter}
            />


            <ReferenceLine
              y={averageLine}
              stroke="#64748b"
              strokeDasharray="6 4"
              ifOverflow="extendDomain"
              label={{
                value: 'Moyenne mensuelle',
                position: 'insideTopRight',
                fill: '#64748b',
                fontSize: 11,
              }}
            />


            <Area
              type="monotone"
              dataKey="valeur"
              name={name}
              stroke={stroke}
              fill={`url(#${gradientId})`}
              strokeWidth={3}
              dot={{
                r: 3,
                strokeWidth: 1.5,
              }}
              activeDot={{
                r: 6,
                strokeWidth: 2,
              }}
              connectNulls
            />

          </AreaChart>

        </ResponsiveContainer>

      </div>


      {/* LECTURE AUTOMATIQUE DU GRAPHIQUE */}
      <div
        className="
          mt-4
          rounded-xl
          border
          border-slate-200
          bg-white
          px-4
          py-3
        "
      >

        <div
          className="
            flex
            flex-col
            gap-2
            text-xs
            text-slate-600
            sm:flex-row
            sm:items-center
            sm:justify-between
          "
        >

          <p>
            <span
              className="font-semibold text-slate-800"
            >
              Lecture :
            </span>{' '}
            {analysis.variation > 5
              ? 'la consommation progresse sur la période.'
              : analysis.variation < -5
                ? 'la consommation diminue sur la période.'
                : 'la consommation reste globalement stable sur la période.'}
          </p>

          <p className="shrink-0">
            Dernier mois :{' '}
            <span className="font-semibold text-slate-800">
              {analysis.monthlyVariation > 0
                ? '+'
                : ''}
              {analysis.monthlyVariation.toFixed(1)}%
            </span>
          </p>

        </div>

        <p
          className="
            mt-2
            text-xs
            text-slate-500
          "
        >
          Pic :{' '}
          <span className="font-medium text-slate-700">
            {analysis.maximumMonth || '—'}
          </span>{' '}
          avec{' '}
          <span className="font-medium text-slate-700">
            {formatNumber(
              analysis.maximum
            )}{' '}
            {unit}
          </span>
          {' · '}
          Minimum :{' '}
          <span className="font-medium text-slate-700">
            {analysis.minimumMonth || '—'}
          </span>{' '}
          avec{' '}
          <span className="font-medium text-slate-700">
            {formatNumber(
              analysis.minimum
            )}{' '}
            {unit}
          </span>
          {' · '}
          {formatNumber(
            analysis.totalReleves
          )}{' '}
          relevés analysés.
        </p>

      </div>

    </div>
  );
}


/* =========================================================
   NOMBRE DE RELEVÉS PAR MOIS
========================================================= */

function ReadingsChart({
  data,
}) {

  const rows =
    data.map(
      (item) => ({

        mois:
          formatMonth(
            item.mois
          ),

        releves:
          toNumber(
            item.nombreReleves
          ),

      })
    );


  return (

    <ChartSection

      title="
        Évolution du nombre de relevés
      "

      description="
        Volume mensuel des relevés enregistrés.
      "

      icon={Activity}

      empty={
        rows.length === 0
      }

    >

      <div
        className="
          h-[320px]
          w-full
        "
      >

        <ResponsiveContainer
          width="100%"
          height="100%"
        >

          <AreaChart
            data={rows}
            margin={{
              top: 10,
              right: 10,
              left: 0,
              bottom: 10,
            }}
          >

            <defs>

              <linearGradient
                id="
                  relevesGradient
                "
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >

                <stop
                  offset="5%"
                  stopColor="#2563eb"
                  stopOpacity={0.35}
                />

                <stop
                  offset="95%"
                  stopColor="#2563eb"
                  stopOpacity={0.03}
                />

              </linearGradient>

            </defs>


            <CartesianGrid
              strokeDasharray="
                3 3
              "
              stroke="#e2e8f0"
            />


            <XAxis
              dataKey="mois"
              axisLine={false}
              tickLine={false}
              tick={{
                fill: '#64748b',
                fontSize: 12,
              }}
            />


            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{
                fill: '#64748b',
                fontSize: 12,
              }}
            />


            <Tooltip
              formatter={(value) => [
                `${formatNumber(
                  value
                )} relevés`,

                'Relevés',
              ]}
            />


            <Area
              type="monotone"
              dataKey="releves"
              stroke="#2563eb"
              fill="
                url(#relevesGradient)
              "
              strokeWidth={3}
            />

          </AreaChart>

        </ResponsiveContainer>

      </div>

    </ChartSection>
  );
}


/* =========================================================
   RÉPARTITION
========================================================= */

function DistributionChart({
  data,
}) {

  const colors = [
    '#0891b2',
    '#f59e0b',
  ];


  return (

    <ChartSection

      title="
        Répartition des relevés
      "

      description="
        Nombre de relevés par type.
        Les consommations ne sont pas additionnées.
      "

      icon={ClipboardList}

      empty={
        data.length === 0
      }

    >

      <div
        className="
          h-[320px]
          w-full
        "
      >

        <ResponsiveContainer
          width="100%"
          height="100%"
        >

          <PieChart>

            <Pie

              data={data}

              dataKey="
                nombreReleves
              "

              nameKey="label"

              cx="50%"

              cy="50%"

              innerRadius={65}

              outerRadius={105}

              paddingAngle={3}

              label={({
                label,
                percent,
              }) =>
                `${label} ${
                  (
                    percent *
                    100
                  ).toFixed(0)
                }%`
              }

            >

              {data.map(
                (
                  item,
                  index
                ) => (

                  <Cell
                    key={
                      item.type
                    }
                    fill={
                      colors[
                        index %
                        colors.length
                      ]
                    }
                  />

                )
              )}

            </Pie>


            <Tooltip

              formatter={(
                value,
                name
              ) => [

                `${formatNumber(
                  value
                )} relevés`,

                name,

              ]}

            />


            <Legend />

          </PieChart>

        </ResponsiveContainer>

      </div>

    </ChartSection>
  );
}


/* =========================================================
   TOP COMPTEURS
========================================================= */

function TopMetersChart({
  title,
  description,
  data,
  unit,
}) {

  const rows =
    data.map(
      (item) => ({

        compteur:
          item.compteur,

        total:
          toNumber(
            item.total
          ),

      })
    );


  return (

    <ChartSection

      title={
        title
      }

      description={
        description
      }

      icon={Gauge}

      empty={
        rows.length === 0
      }

    >

      <div
        className="
          h-[330px]
          w-full
        "
      >

        <ResponsiveContainer
          width="100%"
          height="100%"
        >

          <BarChart

            data={rows}

            layout="vertical"

            margin={{
              top: 5,
              right: 20,
              left: 10,
              bottom: 5,
            }}

          >

            <CartesianGrid
              strokeDasharray="3 3"
              horizontal={false}
              stroke="#e2e8f0"
            />


            <XAxis

              type="number"

              axisLine={false}

              tickLine={false}

              tick={{
                fill: '#64748b',
                fontSize: 12,
              }}

            />


            <YAxis

              type="category"

              dataKey="compteur"

              width={100}

              axisLine={false}

              tickLine={false}

              tick={{
                fill: '#334155',
                fontSize: 11,
              }}

            />


            <Tooltip

              formatter={(value) => [

                `${formatNumber(
                  value
                )} ${unit}`,

                'Total',

              ]}

            />


            <Bar

              dataKey="total"

              name="Total"

              fill="#2563eb"

              radius={[
                0,
                6,
                6,
                0,
              ]}

            />

          </BarChart>

        </ResponsiveContainer>

      </div>

    </ChartSection>
  );
}


/* =========================================================
   PAGE
========================================================= */

function GraphiquesPage() {

  const navigate =
    useNavigate();


  const [
    sidebarOpen,
    setSidebarOpen,
  ] = useState(false);


  const [
    user,
    setUser,
  ] = useState(null);


  const [
    dateDebut,
    setDateDebut,
  ] = useState(
    getMonthsAgo(12)
  );


  const [
    dateFin,
    setDateFin,
  ] = useState(
    getToday()
  );


  const [
    type,
    setType,
  ] = useState(
    'TOUS'
  );


  const [
    data,
    setData,
  ] = useState(null);


  const [
    loading,
    setLoading,
  ] = useState(true);


  const [
    refreshing,
    setRefreshing,
  ] = useState(false);


  const [
    error,
    setError,
  ] = useState('');


  /* =======================================================
     UTILISATEUR
  ======================================================= */

  useEffect(
    () => {

      const token =
        localStorage.getItem(
          'token'
        );


      const savedUser =
        localStorage.getItem(
          'user'
        );


      if (
        !token ||
        !savedUser
      ) {

        navigate(
          '/',
          {
            replace: true,
          }
        );

        return;
      }


      try {

        const parsedUser =
          JSON.parse(
            savedUser
          );


        const role =
          String(
            parsedUser.role ||
            ''
          )
            .trim()
            .toUpperCase();


        if (
          ![
            'ADMINISTRATEUR',
            'RESPONSABLE',
          ].includes(
            role
          )
        ) {

          navigate(
            '/',
            {
              replace: true,
            }
          );

          return;
        }


        setUser(
          parsedUser
        );

      } catch (
        parseError
      ) {

        console.error(
          parseError
        );


        localStorage.removeItem(
          'token'
        );


        localStorage.removeItem(
          'user'
        );


        navigate(
          '/',
          {
            replace: true,
          }
        );
      }

    },
    [navigate]
  );


  /* =======================================================
     CHARGEMENT INITIAL
  ======================================================= */

  useEffect(
    () => {

      if (!user) {
        return;
      }

      loadGraphiques();

    },
    [user]
  );


  /* =======================================================
     CHARGER
  ======================================================= */

  async function loadGraphiques(
    refresh = false,
    override = null
  ) {

    const filters =
      override || {

        dateDebut,

        dateFin,

        type,

      };


    try {

      setError('');


      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }


      if (
        filters.dateDebut &&
        filters.dateFin &&
        filters.dateDebut >
          filters.dateFin
      ) {

        throw new Error(
          'La date de début doit être antérieure ou égale à la date de fin.'
        );
      }


      const response =
        await axiosClient.get(
          '/graphiques',
          {
            params:
              filters,
          }
        );


      if (
        response.data?.status !==
        'success'
      ) {

        throw new Error(
          response.data?.message ||
          'Impossible de charger les graphiques.'
        );
      }


      setData(
        response.data
      );

    } catch (
      requestError
    ) {

      console.error(
        'Erreur graphiques :',
        requestError
      );


      const status =
        requestError
          .response
          ?.status;


      if (
        status === 401 ||
        status === 403
      ) {

        localStorage.removeItem(
          'token'
        );

        localStorage.removeItem(
          'user'
        );

        navigate(
          '/',
          {
            replace: true,
          }
        );

        return;
      }


      setError(

        requestError
          .response
          ?.data
          ?.message ||

        requestError.message ||

        'Erreur lors du chargement des graphiques.'

      );

    } finally {

      setLoading(false);

      setRefreshing(false);
    }
  }


  /* =======================================================
     RÉINITIALISATION
  ======================================================= */

  function handleReset() {

    const newStart =
      getMonthsAgo(12);


    const newEnd =
      getToday();


    setDateDebut(
      newStart
    );


    setDateFin(
      newEnd
    );


    setType(
      'TOUS'
    );


    loadGraphiques(
      true,
      {

        dateDebut:
          newStart,

        dateFin:
          newEnd,

        type:
          'TOUS',

      }
    );
  }


  /* =======================================================
     DÉCONNEXION
  ======================================================= */

  function handleLogout() {

    localStorage.removeItem(
      'token'
    );

    localStorage.removeItem(
      'user'
    );


    navigate(
      '/',
      {
        replace: true,
      }
    );
  }


  /* =======================================================
     LOADING
  ======================================================= */

  if (
    !user ||
    loading
  ) {

    return (

      <div
        className="
          flex
          min-h-screen
          items-center
          justify-center
          bg-slate-100
        "
      >

        <div
          className="
            rounded-2xl
            border
            border-slate-200
            bg-white
            px-6
            py-5
            text-sm
            text-slate-500
            shadow-sm
          "
        >

          Chargement des graphiques...

        </div>

      </div>
    );
  }


  /* =======================================================
     DONNÉES
  ======================================================= */

  const global =
    data?.global || {

      nombreReleves:
        0,

      nombreCompteurs:
        0,

      nombreAbonnes:
        0,

    };


  const parType =
    data?.parType || {

      EAU: {

        total:
          0,

        nombreReleves:
          0,

        nombreCompteurs:
          0,

        nombreAbonnes:
          0,

      },


      ELECTRICITE: {

        total:
          0,

        nombreReleves:
          0,

        nombreCompteurs:
          0,

        nombreAbonnes:
          0,

      },

    };


  const evolution =
    data?.evolution || [];


  const evolutionReleves =
    data?.evolutionReleves ||
    [];


  const repartition =
    data?.repartition ||
    [];


  const eauTop =
    data?.topCompteursEau ||
    [];


  const electricityTop =
    data
      ?.topCompteursElectricite ||
    [];


  const active =
    type === 'EAU'

      ? parType.EAU

      : type === 'ELECTRICITE'

        ? parType.ELECTRICITE

        : null;


  const totalReleves =
    active

      ? active.nombreReleves

      : global.nombreReleves;


  const totalCompteurs =
    active

      ? active.nombreCompteurs

      : global.nombreCompteurs;


  const totalAbonnes =
    active

      ? active.nombreAbonnes

      : global.nombreAbonnes;


  /* =======================================================
     RENDER
  ======================================================= */

  return (

    <div
      className="
        min-h-screen
        bg-slate-100
      "
    >

      <Sidebar

        isOpen={
          sidebarOpen
        }

        onClose={() =>
          setSidebarOpen(
            false
          )
        }

        activePath=
          "/dashboard/admin/graphiques"

        onNavigate={
          navigate
        }

        onLogout={
          handleLogout
        }

        user={
          user
        }

      />


      <div
        className="
          lg:pl-72
        "
      >

        <Header

          onOpenSidebar={() =>
            setSidebarOpen(
              true
            )
          }

          onProfile={() => {}}

          user={
            user
          }

        />


        <main
          className="
            p-4
            sm:p-6
            lg:p-8
          "
        >

          {/* =================================================
              TITRE
          ================================================= */}

          <div
            className="
              mb-7
              flex
              flex-col
              justify-between
              gap-4
              md:flex-row
              md:items-end
            "
          >

            <div>

              <div
                className="
                  mb-2
                  flex
                  items-center
                  gap-2
                  text-sm
                  text-slate-500
                "
              >

                <button

                  type="button"

                  onClick={() =>
                    navigate(
                      '/dashboard/admin'
                    )
                  }

                  className="
                    inline-flex
                    items-center
                    gap-1
                    font-medium
                    text-blue-600
                    hover:text-blue-700
                  "
                >

                  <ArrowLeft
                    size={16}
                  />

                  Dashboard

                </button>


                <span>/</span>


                <span>
                  Graphiques
                </span>

              </div>


              <h1
                className="
                  text-2xl
                  font-bold
                  text-slate-900
                "
              >
                Graphiques avancés
              </h1>


              <p
                className="
                  mt-1
                  text-sm
                  text-slate-500
                "
              >
                Visualisation des tendances
                et des consommations réelles.
              </p>

            </div>


            <button

              type="button"

              onClick={() =>
                loadGraphiques(
                  true
                )
              }

              disabled={
                refreshing
              }

              className="
                inline-flex
                items-center
                justify-center
                gap-2
                rounded-xl
                border
                border-slate-200
                bg-white
                px-4
                py-2.5
                text-sm
                font-semibold
                text-slate-700
                shadow-sm
                hover:bg-slate-50
                disabled:opacity-60
              "
            >

              <RefreshCw

                size={16}

                className={
                  refreshing
                    ? 'animate-spin'
                    : ''
                }

              />

              Actualiser

            </button>

          </div>


          {/* =================================================
              FILTRES
          ================================================= */}

          <section
            className="
              mb-6
              rounded-2xl
              border
              border-slate-200
              bg-white
              p-5
              shadow-sm
              sm:p-6
            "
          >

            <div
              className="
                mb-5
                flex
                items-center
                gap-3
              "
            >

              <div
                className="
                  rounded-xl
                  bg-blue-50
                  p-2.5
                "
              >

                <BarChart3

                  size={19}

                  className="
                    text-blue-600
                  "

                />

              </div>


              <div>

                <h2
                  className="
                    font-bold
                    text-slate-900
                  "
                >
                  Filtres
                </h2>


                <p
                  className="
                    text-xs
                    text-slate-500
                  "
                >
                  Sélectionne une période
                  et un type.
                </p>

              </div>

            </div>


            <div
              className="
                grid
                grid-cols-1
                gap-4
                md:grid-cols-3
              "
            >

              {/* DATE DÉBUT */}

              <label>

                <span
                  className="
                    mb-2
                    block
                    text-xs
                    font-semibold
                    text-slate-600
                  "
                >
                  Date de début
                </span>


                <div
                  className="
                    relative
                  "
                >

                  <CalendarDays

                    size={17}

                    className="
                      pointer-events-none
                      absolute
                      left-3
                      top-1/2
                      -translate-y-1/2
                      text-slate-400
                    "

                  />


                  <input

                    type="date"

                    value={
                      dateDebut
                    }

                    max={
                      dateFin ||
                      getToday()
                    }

                    onChange={(event) =>
                      setDateDebut(
                        event.target.value
                      )
                    }

                    className="
                      w-full
                      rounded-xl
                      border
                      border-slate-300
                      bg-slate-50
                      py-3
                      pl-10
                      pr-3
                      text-sm
                      outline-none
                      focus:border-blue-600
                      focus:bg-white
                      focus:ring-4
                      focus:ring-blue-100
                    "

                  />

                </div>

              </label>


              {/* DATE FIN */}

              <label>

                <span
                  className="
                    mb-2
                    block
                    text-xs
                    font-semibold
                    text-slate-600
                  "
                >
                  Date de fin
                </span>


                <div
                  className="
                    relative
                  "
                >

                  <CalendarDays

                    size={17}

                    className="
                      pointer-events-none
                      absolute
                      left-3
                      top-1/2
                      -translate-y-1/2
                      text-slate-400
                    "

                  />


                  <input

                    type="date"

                    value={
                      dateFin
                    }

                    min={
                      dateDebut ||
                      undefined
                    }

                    max={
                      getToday()
                    }

                    onChange={(event) =>
                      setDateFin(
                        event.target.value
                      )
                    }

                    className="
                      w-full
                      rounded-xl
                      border
                      border-slate-300
                      bg-slate-50
                      py-3
                      pl-10
                      pr-3
                      text-sm
                      outline-none
                      focus:border-blue-600
                      focus:bg-white
                      focus:ring-4
                      focus:ring-blue-100
                    "

                  />

                </div>

              </label>


              {/* TYPE */}

              <label>

                <span
                  className="
                    mb-2
                    block
                    text-xs
                    font-semibold
                    text-slate-600
                  "
                >
                  Type
                </span>


                <select

                  value={
                    type
                  }

                  onChange={(event) =>
                    setType(
                      event.target.value
                    )
                  }

                  className="
                    w-full
                    rounded-xl
                    border
                    border-slate-300
                    bg-slate-50
                    px-3
                    py-3
                    text-sm
                    outline-none
                    focus:border-blue-600
                    focus:bg-white
                    focus:ring-4
                    focus:ring-blue-100
                  "
                >

                  <option
                    value="TOUS"
                  >
                    Eau + Électricité
                  </option>


                  <option
                    value="EAU"
                  >
                    Eau
                  </option>


                  <option
                    value="ELECTRICITE"
                  >
                    Électricité
                  </option>

                </select>

              </label>

            </div>


            <div
              className="
                mt-5
                flex
                flex-col
                justify-between
                gap-3
                border-t
                border-slate-100
                pt-5
                sm:flex-row
                sm:items-center
              "
            >

              <p
                className="
                  text-xs
                  text-slate-500
                "
              >
                Les consommations
                eau et électricité
                restent séparées.
              </p>


              <div
                className="
                  flex
                  gap-2
                "
              >

                <button

                  type="button"

                  onClick={
                    handleReset
                  }

                  className="
                    rounded-xl
                    border
                    border-slate-200
                    bg-white
                    px-4
                    py-2.5
                    text-sm
                    font-semibold
                    text-slate-700
                    hover:bg-slate-50
                  "
                >
                  Réinitialiser
                </button>


                <button

                  type="button"

                  onClick={() =>
                    loadGraphiques(
                      true
                    )
                  }

                  className="
                    rounded-xl
                    bg-blue-600
                    px-5
                    py-2.5
                    text-sm
                    font-semibold
                    text-white
                    hover:bg-blue-700
                  "
                >
                  Appliquer
                </button>

              </div>

            </div>

          </section>


          {/* =================================================
              ERREUR
          ================================================= */}

          {error && (

            <div
              className="
                mb-6
                rounded-2xl
                border
                border-red-200
                bg-red-50
                px-5
                py-4
                text-sm
                text-red-700
              "
            >
              {error}
            </div>

          )}


          {/* =================================================
              KPI
          ================================================= */}

          <div
            className="
              grid
              grid-cols-1
              gap-4
              sm:grid-cols-2
              xl:grid-cols-4
            "
          >

            <KpiCard

              title="Relevés"

              value={
                totalReleves
              }

              description="
                Selon la période et le type.
              "

              icon={
                ClipboardList
              }

              bg="bg-blue-50"

              color="
                text-blue-600
              "

            />


            <KpiCard

              title="Compteurs"

              value={
                totalCompteurs
              }

              description="
                Compteurs concernés.
              "

              icon={
                Gauge
              }

              bg="bg-cyan-50"

              color="
                text-cyan-600
              "

            />


            <KpiCard

              title="Abonnés"

              value={
                totalAbonnes
              }

              description="
                Abonnés représentés.
              "

              icon={
                UserRound
              }

              bg="bg-emerald-50"

              color="
                text-emerald-600
              "

            />


            <KpiCard

              title={
                type === 'EAU'

                  ? 'Total eau'

                  : type ===
                      'ELECTRICITE'

                    ? 'Total électricité'

                    : 'Consommations'
              }

              value={

                type === 'EAU'

                  ? parType
                      .EAU
                      .total

                  : type ===
                      'ELECTRICITE'

                    ? parType
                        .ELECTRICITE
                        .total

                    : '—'

              }

              unit={

                type === 'EAU'

                  ? 'm³'

                  : type ===
                      'ELECTRICITE'

                    ? 'kWh'

                    : ''

              }

              description={

                type === 'TOUS'

                  ? 'Totaux séparés ci-dessous.'

                  : 'Somme de la période.'

              }

              icon={

                type === 'EAU'

                  ? Droplets

                  : type ===
                      'ELECTRICITE'

                    ? Zap

                    : Activity

              }

              bg="
                bg-violet-50
              "

              color="
                text-violet-600
              "

            />

          </div>


          {/* =================================================
              ÉVOLUTION EAU / ELECTRICITÉ
          ================================================= */}

          <div
            className="
              mt-6
              grid
              grid-cols-1
              gap-6
              xl:grid-cols-2
            "
          >

            {
              (
                type ===
                  'TOUS' ||
                type === 'EAU'
              ) && (

                <ChartSection

                  title="
                    Évolution de la consommation d'eau
                  "

                  description="
                    Évolution du total mensuel avec moyenne de référence.
                  "

                  icon={
                    Droplets
                  }

                  empty={
                    evolution.length ===
                    0
                  }

                >

                  <ConsumptionLineChart

                    data={
                      evolution
                    }

                    dataKey="eau"

                    name="Eau"

                    unit="m³"

                    stroke="#0891b2"

                  />

                </ChartSection>

              )
            }


            {
              (
                type ===
                  'TOUS' ||
                type ===
                  'ELECTRICITE'
              ) && (

                <ChartSection

                  title="
                    Évolution de la consommation d'électricité
                  "

                  description="
                    Évolution du total mensuel avec moyenne de référence.
                  "

                  icon={
                    Zap
                  }

                  empty={
                    evolution.length ===
                    0
                  }

                >

                  <ConsumptionLineChart

                    data={
                      evolution
                    }

                    dataKey="
                      electricite
                    "

                    name="
                      Électricité
                    "

                    unit="
                      kWh
                    "

                    stroke="
                      #f59e0b
                    "

                  />

                </ChartSection>

              )
            }

          </div>


          {/* =================================================
              RELEVÉS + RÉPARTITION
          ================================================= */}

          <div
            className="
              mt-6
              grid
              grid-cols-1
              gap-6
              xl:grid-cols-2
            "
          >

            <ReadingsChart

              data={
                evolutionReleves
              }

            />


            <DistributionChart

              data={
                repartition
              }

            />

          </div>


          {/* =================================================
              TOP COMPTEURS
          ================================================= */}

          <div
            className="
              mt-6
              grid
              grid-cols-1
              gap-6
              xl:grid-cols-2
            "
          >

            {
              (
                type ===
                  'TOUS' ||
                type === 'EAU'
              ) && (

                <TopMetersChart

                  title="
                    Top 5 compteurs — Eau
                  "

                  description="
                    Consommation cumulée la plus élevée.
                  "

                  data={
                    eauTop
                  }

                  unit="
                    m³
                  "

                />

              )
            }


            {
              (
                type ===
                  'TOUS' ||
                type ===
                  'ELECTRICITE'
              ) && (

                <TopMetersChart

                  title="
                    Top 5 compteurs — Électricité
                  "

                  description="
                    Consommation cumulée la plus élevée.
                  "

                  data={
                    electricityTop
                  }

                  unit="
                    kWh
                  "

                />

              )
            }

          </div>

        </main>

      </div>

    </div>
  );
}


export default GraphiquesPage;