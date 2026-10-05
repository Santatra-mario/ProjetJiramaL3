import {
  useEffect,
  useState,
} from 'react';

import {
  useNavigate,
} from 'react-router-dom';

import {
  ArrowLeft,
  BarChart3,
  CalendarDays,
  ClipboardList,
  Droplets,
  Gauge,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  UserRound,
  Minus,
  Zap,
} from 'lucide-react';

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  Legend,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import axiosClient from '../../api/axiosClient.js';

import Sidebar from '../../components/admin/Sidebar.jsx';

import Header from '../../components/admin/Header.jsx';


/* =========================================================
   UTILITAIRES
========================================================= */

function getToday() {
  const date = new Date();

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


function getDateMonthsAgo(months) {
  const date = new Date();

  date.setMonth(
    date.getMonth() - months
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


function formatNumber(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return '0';
  }

  return number.toLocaleString(
    'fr-FR',
    {
      maximumFractionDigits: 2,
    }
  );
}


function formatDate(value) {
  if (!value) {
    return '—';
  }

  const cleanValue =
    String(value).slice(0, 10);

  const date = new Date(
    `${cleanValue}T00:00:00`
  );

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleDateString(
    'fr-FR'
  );
}


function formatMonthLabel(value) {
  if (!value) {
    return '';
  }

  const parts =
    String(value).split('-');

  if (parts.length !== 2) {
    return String(value);
  }

  const year =
    Number(parts[0]);

  const month =
    Number(parts[1]);

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month)
  ) {
    return String(value);
  }

  const date =
    new Date(
      year,
      month - 1,
      1
    );

  const label =
    new Intl.DateTimeFormat(
      'fr-FR',
      {
        month: 'short',
        year: 'numeric',
      }
    ).format(date);

  return (
    label.charAt(0).toUpperCase() +
    label.slice(1)
  );
}


/* =========================================================
   CARTE INDICATEUR
========================================================= */

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
    <div
      className="
        rounded-2xl
        border
        border-slate-200
        bg-white
        p-5
        shadow-sm
        transition
        duration-300
        hover:-translate-y-0.5
        hover:shadow-md
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
        <div className="min-w-0">
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
            {formatNumber(value)}

            {unit && (
              <span
                className="
                  ml-1
                  text-sm
                  font-semibold
                  text-slate-500
                "
              >
                {unit}
              </span>
            )}
          </p>

          {description && (
            <p
              className="
                mt-2
                text-xs
                leading-5
                text-slate-500
              "
            >
              {description}
            </p>
          )}
        </div>

        <div
          className={`
            shrink-0
            rounded-2xl
            p-3
            ${iconBg}
          `}
        >
          {Icon && (
            <Icon
              size={21}
              className={iconColor}
            />
          )}
        </div>
      </div>
    </div>
  );
}


/* =========================================================
   PETITE CARTE
========================================================= */

function SmallStat({
  label,
  value,
  unit = '',
}) {
  return (
    <div
      className="
        rounded-xl
        bg-slate-50
        p-3
      "
    >
      <p
        className="
          text-[11px]
          font-medium
          text-slate-400
        "
      >
        {label}
      </p>

      <p
        className="
          mt-1
          text-base
          font-bold
          text-slate-800
        "
      >
        {formatNumber(value)}
      </p>

      <p
        className="
          text-[10px]
          text-slate-400
        "
      >
        {unit}
      </p>
    </div>
  );
}


/* =========================================================
   RÉSUMÉ PAR TYPE
========================================================= */

function TypeSummaryCard({
  title,
  type,
  data,
}) {
  const isWater =
    type === 'EAU';

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
          flex
          items-center
          justify-between
          gap-4
        "
      >
        <div
          className="
            flex
            items-center
            gap-3
          "
        >
          <div
            className={
              isWater
                ? 'rounded-xl bg-cyan-50 p-3'
                : 'rounded-xl bg-amber-50 p-3'
            }
          >
            {isWater ? (
              <Droplets
                size={20}
                className="
                  text-cyan-600
                "
              />
            ) : (
              <Zap
                size={20}
                className="
                  text-amber-600
                "
              />
            )}
          </div>

          <div>
            <h3
              className="
                font-bold
                text-slate-900
              "
            >
              {title}
            </h3>

            <p
              className="
                text-xs
                text-slate-500
              "
            >
              Indicateurs de la période
            </p>
          </div>
        </div>

        <span
          className="
            rounded-full
            bg-slate-100
            px-3
            py-1.5
            text-xs
            font-semibold
            text-slate-600
          "
        >
          {data.unite}
        </span>
      </div>

      <div
        className="
          mt-6
          grid
          grid-cols-2
          gap-3
          lg:grid-cols-4
        "
      >
        <SmallStat
          label="Total"
          value={data.total}
          unit={data.unite}
        />

        <SmallStat
          label="Moyenne"
          value={data.moyenne}
          unit={data.unite}
        />

        <SmallStat
          label="Maximum"
          value={data.maximum}
          unit={data.unite}
        />

        <SmallStat
          label="Minimum"
          value={data.minimum}
          unit={data.unite}
        />
      </div>

      <div
        className="
          mt-5
          grid
          grid-cols-3
          gap-3
        "
      >
        <SmallStat
          label="Relevés"
          value={data.nombreReleves}
        />

        <SmallStat
          label="Compteurs"
          value={data.nombreCompteurs}
        />

        <SmallStat
          label="Abonnés"
          value={data.nombreAbonnes}
        />
      </div>
    </section>
  );
}


/* =========================================================
   COMPARAISON
========================================================= */

function ComparisonCard({
  comparison,
  type,
}) {
  if (!comparison?.disponible) {
    return null;
  }

  const variation =
    Number(
      comparison.variationPourcentage || 0
    );

  const isIncrease =
    comparison.tendance ===
    'hausse';

  const isDecrease =
    comparison.tendance ===
    'baisse';

  const Icon =
    isIncrease
      ? TrendingUp
      : isDecrease
        ? TrendingDown
        : Minus;

  const iconBg =
    isIncrease
      ? 'bg-rose-50'
      : isDecrease
        ? 'bg-emerald-50'
        : 'bg-slate-100';

  const iconColor =
    isIncrease
      ? 'text-rose-600'
      : isDecrease
        ? 'text-emerald-600'
        : 'text-slate-500';

  return (
    <section
      className="
        mt-6
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
            Comparaison avec la période précédente
          </h2>

          <p
            className="
              mt-1
              text-xs
              leading-5
              text-slate-500
            "
          >
            Comparaison sur une durée identique à la période sélectionnée.
          </p>
        </div>

        <div
          className={`
            rounded-xl
            p-3
            ${iconBg}
          `}
        >
          <Icon
            size={20}
            className={iconColor}
          />
        </div>
      </div>

      <div
        className="
          mt-5
          grid
          grid-cols-1
          gap-4
          sm:grid-cols-3
        "
      >
        <div>
          <p
            className="
              text-xs
              text-slate-400
            "
          >
            Type
          </p>

          <p
            className="
              mt-1
              font-semibold
              text-slate-800
            "
          >
            {type === 'EAU'
              ? 'Eau'
              : 'Électricité'}
          </p>
        </div>

        <div>
          <p
            className="
              text-xs
              text-slate-400
            "
          >
            Total précédent
          </p>

          <p
            className="
              mt-1
              font-semibold
              text-slate-800
            "
          >
            {formatNumber(
              comparison.totalPrecedent
            )}
          </p>
        </div>

        <div>
          <p
            className="
              text-xs
              text-slate-400
            "
          >
            Variation
          </p>

          <p
            className={`
              mt-1
              font-bold
              ${iconColor}
            `}
          >
            {variation > 0 ? '+' : ''}
            {formatNumber(variation)} %
          </p>
        </div>
      </div>
    </section>
  );
}


/* =========================================================
   PAGE
========================================================= */

function StatistiquesPage() {

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
    getDateMonthsAgo(12)
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
  ] = useState('TOUS');


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
     UTILISATEUR CONNECTÉ
  ======================================================= */

  useEffect(() => {

    const token =
      localStorage.getItem(
        'token'
      );

    const userData =
      localStorage.getItem(
        'user'
      );


    if (
      !token ||
      !userData
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
          userData
        );


      const role =
        String(
          parsedUser?.role || ''
        )
          .trim()
          .toUpperCase();


      if (
        role !==
        'ADMINISTRATEUR'
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

    } catch (parseError) {

      console.error(
        'Erreur lecture utilisateur :',
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

  }, [navigate]);


  /* =======================================================
     CHARGEMENT INITIAL
  ======================================================= */

  useEffect(() => {

    if (!user) {
      return;
    }

    loadStatistics();

  }, [user]);


  /* =======================================================
     CHARGEMENT API
  ======================================================= */

  async function loadStatistics(
    isRefresh = false,
    customFilters = null
  ) {

    const filters =
      customFilters || {

        dateDebut,

        dateFin,

        type,

      };


    if (
      filters.dateDebut &&
      filters.dateFin &&
      filters.dateDebut >
        filters.dateFin
    ) {

      setError(
        'La date de début doit être antérieure ou égale à la date de fin.'
      );

      return;
    }


    try {

      setError('');


      if (isRefresh) {

        setRefreshing(
          true
        );

      } else {

        setLoading(
          true
        );
      }


      const response =
        await axiosClient.get(
          '/statistiques',
          {
            params: {
              dateDebut:
                filters.dateDebut,

              dateFin:
                filters.dateFin,

              type:
                filters.type,
            },
          }
        );


      if (
        response.data?.status !==
        'success'
      ) {

        throw new Error(
          response.data?.message ||
          'Impossible de récupérer les statistiques.'
        );
      }


      setData(
        response.data
      );

    } catch (requestError) {

      console.error(
        'Erreur statistiques :',
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

        'Une erreur est survenue lors du chargement des statistiques.'

      );

    } finally {

      setLoading(
        false
      );

      setRefreshing(
        false
      );
    }
  }


  /* =======================================================
     RÉINITIALISATION
  ======================================================= */

  function handleReset() {

    const filters = {

      dateDebut:
        getDateMonthsAgo(12),

      dateFin:
        getToday(),

      type:
        'TOUS',

    };


    setDateDebut(
      filters.dateDebut
    );

    setDateFin(
      filters.dateFin
    );

    setType(
      filters.type
    );


    loadStatistics(
      true,
      filters
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
     CHARGEMENT
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
          p-6
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

          Chargement des statistiques...

        </div>

      </div>

    );
  }


  /* =======================================================
     DONNÉES PAR DÉFAUT
  ======================================================= */

  const stats =
    data?.statistiques || {

      nombreReleves:
        0,

      nombreCompteurs:
        0,

      nombreAbonnes:
        0,

      totalConsommation:
        0,

      consommationMoyenne:
        0,

      consommationMaximale:
        0,

      consommationMinimale:
        0,

      datePremierReleve:
        null,

      dateDernierReleve:
        null,

    };


  const parType =
    data?.parType || {

      EAU: {

        nombreReleves:
          0,

        nombreCompteurs:
          0,

        nombreAbonnes:
          0,

        total:
          0,

        moyenne:
          0,

        maximum:
          0,

        minimum:
          0,

        unite:
          'm³',

      },


      ELECTRICITE: {

        nombreReleves:
          0,

        nombreCompteurs:
          0,

        nombreAbonnes:
          0,

        total:
          0,

        moyenne:
          0,

        maximum:
          0,

        minimum:
          0,

        unite:
          'kWh',

      },

    };


  const evolution =
    data?.evolution || [];


  const comparison =
    data?.comparaison || null;


  /* =======================================================
     TYPE ACTUEL
  ======================================================= */

  const currentType =

    type === 'EAU'

      ? parType.EAU

      : type ===
          'ELECTRICITE'

        ? parType.ELECTRICITE

        : null;


  /* =======================================================
     GRAPHIQUE
  ======================================================= */

  const chartData =
    evolution.map(
      (item) => ({

        mois:
          formatMonthLabel(
            item.mois
          ),

        eau:
          Number(
            item.eau || 0
          ),

        electricite:
          Number(
            item.electricite ||
            0
          ),

      })
    );


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

      {/* =================================================
          SIDEBAR
      ================================================= */}

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
          "/dashboard/admin/statistiques"

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


      {/* =================================================
          CONTENU
      ================================================= */}

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

              <button

                type="button"

                onClick={() =>
                  navigate(
                    '/dashboard/admin'
                  )
                }

                className="
                  mb-2
                  inline-flex
                  items-center
                  gap-1
                  text-sm
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


              <h1
                className="
                  text-2xl
                  font-bold
                  text-slate-900
                "
              >
                Statistiques des consommations
              </h1>


              <p
                className="
                  mt-1
                  text-sm
                  text-slate-500
                "
              >
                Analyse des relevés réels enregistrés dans PostgreSQL.
              </p>

            </div>


            <button

              type="button"

              onClick={() =>
                loadStatistics(
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
                disabled:cursor-not-allowed
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
                  Filtres d'analyse
                </h2>


                <p
                  className="
                    text-xs
                    text-slate-500
                  "
                >
                  Sélectionnez une période et un type de consommation.
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

                    onChange={
                      (event) =>
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
                      text-slate-700
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

                    onChange={
                      (event) =>
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
                      text-slate-700
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

                  onChange={
                    (event) =>
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
                    text-slate-700
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


            {/* BOUTONS */}

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
                Les statistiques sont calculées à partir des relevés réels.
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
                    loadStatistics(
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
                    transition
                    hover:bg-blue-700
                  "
                >
                  Appliquer
                </button>

              </div>

            </div>

          </section>


          {/* =================================================
              MESSAGE ERREUR
          ================================================= */}

          {
            error && (

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

                {
                  error
                }

              </div>

            )
          }


          {/* =================================================
              RÉSUMÉ PÉRIODE
          ================================================= */}

          <div
            className="
              mb-6
              flex
              flex-wrap
              gap-2
              text-xs
              text-slate-500
            "
          >

            <span
              className="
                rounded-full
                bg-white
                px-3
                py-1.5
                shadow-sm
                ring-1
                ring-slate-200
              "
            >

              Type :

              {' '}

              <strong
                className="
                  text-slate-700
                "
              >

                {
                  data?.periode
                    ?.libelleType ||
                  'Eau + Électricité'
                }

              </strong>

            </span>


            <span
              className="
                rounded-full
                bg-white
                px-3
                py-1.5
                shadow-sm
                ring-1
                ring-slate-200
              "
            >

              Du

              {' '}

              <strong>
                {
                  formatDate(
                    data?.periode
                      ?.dateDebut
                  )
                }
              </strong>

              {' '}au{' '}

              <strong>
                {
                  formatDate(
                    data?.periode
                      ?.dateFin
                  )
                }
              </strong>

            </span>

          </div>


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

            <IndicatorCard

              title="Nombre de relevés"

              value={

                currentType

                  ? currentType.nombreReleves

                  : stats.nombreReleves

              }

              description="
                Relevés correspondant aux filtres.
              "

              icon={
                ClipboardList
              }

              iconBg="
                bg-blue-50
              "

              iconColor="
                text-blue-600
              "

            />


            <IndicatorCard

              title="
                Compteurs concernés
              "

              value={

                currentType

                  ? currentType.nombreCompteurs

                  : stats.nombreCompteurs

              }

              description="
                Compteurs présents dans les relevés.
              "

              icon={
                Gauge
              }

              iconBg="
                bg-cyan-50
              "

              iconColor="
                text-cyan-600
              "

            />


            <IndicatorCard

              title="
                Abonnés concernés
              "

              value={

                currentType

                  ? currentType.nombreAbonnes

                  : stats.nombreAbonnes

              }

              description="
                Abonnés représentés dans les relevés.
              "

              icon={
                UserRound
              }

              iconBg="
                bg-emerald-50
              "

              iconColor="
                text-emerald-600
              "

            />


            <IndicatorCard

              title="
                Consommation totale
              "

              value={
                currentType
                  ? currentType.total
                  : '—'
              }

              unit={
                currentType
                  ? currentType.unite
                  : ''
              }

              description={

                currentType

                  ? 'Total de la période sélectionnée.'

                  : 'Sélectionnez Eau ou Électricité pour afficher un total.'
              }

              icon={
                BarChart3
              }

              iconBg="
                bg-violet-50
              "

              iconColor="
                text-violet-600
              "

            />

          </div>


          {/* =================================================
              EAU / ÉLECTRICITÉ
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
                type === 'TOUS' ||
                type === 'EAU'
              ) && (

                <TypeSummaryCard

                  title="
                    Consommation d'eau
                  "

                  type="EAU"

                  data={
                    parType.EAU
                  }

                />

              )
            }


            {
              (
                type === 'TOUS' ||
                type ===
                  'ELECTRICITE'
              ) && (

                <TypeSummaryCard

                  title="
                    Consommation d'électricité
                  "

                  type="
                    ELECTRICITE
                  "

                  data={
                    parType
                      .ELECTRICITE
                  }

                />

              )
            }

          </div>


          {/* =================================================
              INDICATEURS MIN / MOYENNE / MAX
          ================================================= */}

          {
            currentType && (

              <section
                className="
                  mt-6
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
                  "
                >

                  <h2
                    className="
                      text-lg
                      font-bold
                      text-slate-900
                    "
                  >
                    Indicateurs détaillés
                  </h2>


                  <p
                    className="
                      mt-1
                      text-xs
                      text-slate-500
                    "
                  >
                    Valeurs extrêmes et moyenne observées pour le type sélectionné.
                  </p>

                </div>


                <div
                  className="
                    grid
                    grid-cols-1
                    gap-4
                    md:grid-cols-3
                  "
                >

                  <IndicatorCard

                    title="
                      Minimum
                    "

                    value={
                      currentType.minimum
                    }

                    unit={
                      currentType.unite
                    }

                    description="
                      Plus faible consommation enregistrée.
                    "

                    icon={
                      TrendingDown
                    }

                    iconBg="
                      bg-emerald-50
                    "

                    iconColor="
                      text-emerald-600
                    "

                  />


                  <IndicatorCard

                    title="
                      Moyenne
                    "

                    value={
                      currentType.moyenne
                    }

                    unit={
                      currentType.unite
                    }

                    description="
                      Consommation moyenne des relevés.
                    "

                    icon={
                      BarChart3
                    }

                    iconBg="
                      bg-blue-50
                    "

                    iconColor="
                      text-blue-600
                    "

                  />


                  <IndicatorCard

                    title="
                      Maximum
                    "

                    value={
                      currentType.maximum
                    }

                    unit={
                      currentType.unite
                    }

                    description="
                      Plus forte consommation enregistrée.
                    "

                    icon={
                      TrendingUp
                    }

                    iconBg="
                      bg-rose-50
                    "

                    iconColor="
                      text-rose-600
                    "

                  />

                </div>

              </section>

            )
          }


          {/* =================================================
              GRAPHIQUE
          ================================================= */}

          <section
            className="
              mt-6
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
                  Évolution mensuelle
                </h2>


                <p
                  className="
                    mt-1
                    text-xs
                    text-slate-500
                  "
                >
                  Évolution des consommations selon la période sélectionnée.
                </p>

              </div>


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

            </div>


            {
              chartData.length === 0

                ? (

                  <div
                    className="
                      flex
                      h-[340px]
                      items-center
                      justify-center
                      rounded-xl
                      bg-slate-50
                      text-sm
                      text-slate-400
                    "
                  >
                    Aucune donnée disponible
                    pour la période sélectionnée.
                  </div>

                )

                : (

                  <div
                    className="
                      h-[340px]
                      w-full
                    "
                  >

                    <ResponsiveContainer
                      width="100%"
                      height="100%"
                    >

                      <BarChart

                        data={
                          chartData
                        }

                        margin={{

                          top:
                            10,

                          right:
                            10,

                          left:
                            0,

                          bottom:
                            10,

                        }}

                      >

                        <CartesianGrid

                          strokeDasharray="
                            3 3
                          "

                          stroke="
                            #e2e8f0
                          "

                        />


                        <XAxis

                          dataKey="
                            mois
                          "

                          axisLine={
                            false
                          }

                          tickLine={
                            false
                          }

                          tick={{

                            fill:
                              '#64748b',

                            fontSize:
                              12,

                          }}

                        />


                        <YAxis

                          axisLine={
                            false
                          }

                          tickLine={
                            false
                          }

                          tick={{

                            fill:
                              '#64748b',

                            fontSize:
                              12,

                          }}

                        />


                        <Tooltip

                          formatter={
                            (
                              value,
                              name
                            ) => [

                              `${formatNumber(
                                value
                              )} ${
                                name ===
                                'Eau'
                                  ? 'm³'
                                  : 'kWh'
                              }`,

                              name,

                            ]
                          }

                        />


                        <Legend />


                        {
                          (
                            type ===
                              'TOUS' ||
                            type === 'EAU'
                          ) && (

                            <Bar

                              dataKey="
                                eau
                              "

                              name="
                                Eau
                              "

                              fill="
                                #0891b2
                              "

                              radius={[
                                5,
                                5,
                                0,
                                0,
                              ]}

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

                            <Bar

                              dataKey="
                                electricite
                              "

                              name="
                                Électricité
                              "

                              fill="
                                #f59e0b
                              "

                              radius={[
                                5,
                                5,
                                0,
                                0,
                              ]}

                            />

                          )
                        }

                      </BarChart>

                    </ResponsiveContainer>

                  </div>

                )
            }

          </section>


          {/* =================================================
              COMPARAISON
          ================================================= */}

          <ComparisonCard

            comparison={
              comparison
            }

            type={
              type
            }

          />


          {/* =================================================
              BORNES DES DONNÉES
          ================================================= */}

          <section
            className="
              mt-6
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
                  Bornes des données
                </h2>


                <p
                  className="
                    mt-1
                    text-xs
                    text-slate-500
                  "
                >
                  Premier et dernier relevé trouvé selon les filtres.
                </p>

              </div>


              <CalendarDays

                size={20}

                className="
                  text-slate-400
                "

              />

            </div>


            <div
              className="
                mt-5
                grid
                grid-cols-1
                gap-4
                sm:grid-cols-2
              "
            >

              <div
                className="
                  rounded-xl
                  bg-slate-50
                  p-4
                "
              >

                <p
                  className="
                    text-xs
                    text-slate-400
                  "
                >
                  Premier relevé
                </p>


                <p
                  className="
                    mt-1
                    font-semibold
                    text-slate-800
                  "
                >
                  {
                    formatDate(
                      stats.datePremierReleve
                    )
                  }
                </p>

              </div>


              <div
                className="
                  rounded-xl
                  bg-slate-50
                  p-4
                "
              >

                <p
                  className="
                    text-xs
                    text-slate-400
                  "
                >
                  Dernier relevé
                </p>


                <p
                  className="
                    mt-1
                    font-semibold
                    text-slate-800
                  "
                >
                  {
                    formatDate(
                      stats.dateDernierReleve
                    )
                  }
                </p>

              </div>

            </div>

          </section>

        </main>

      </div>

    </div>
  );
}


export default StatistiquesPage;