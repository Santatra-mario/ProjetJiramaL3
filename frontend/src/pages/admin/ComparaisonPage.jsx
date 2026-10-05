import {
  useEffect,
  useMemo,
  useState,
} from 'react';


import {
  useNavigate,
} from 'react-router-dom';


import {
  ArrowLeft,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Droplets,
  Gauge,
  RefreshCw,
  TrendingDown,
  TrendingUp,
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


function formatNumber(
  value
) {

  const number =
    Number(value);


  if (
    !Number.isFinite(
      number
    )
  ) {

    return '0';
  }


  return number.toLocaleString(
    'fr-FR',
    {
      maximumFractionDigits:
        2,
    }
  );
}


function formatDate(
  value
) {

  if (
    !value
  ) {

    return '—';
  }


  const date =
    new Date(
      `${String(value).slice(0, 10)}T00:00:00`
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return '—';
  }


  return date.toLocaleDateString(
    'fr-FR'
  );
}


function getDifferenceDays(
  start,
  end
) {

  if (
    !start ||
    !end
  ) {

    return 0;
  }


  const startDate =
    new Date(
      `${start}T00:00:00`
    );


  const endDate =
    new Date(
      `${end}T00:00:00`
    );


  if (
    Number.isNaN(
      startDate.getTime()
    ) ||
    Number.isNaN(
      endDate.getTime()
    )
  ) {

    return 0;
  }


  const difference =
    Math.round(

      (
        endDate.getTime() -
        startDate.getTime()
      ) /
      86400000

    ) + 1;


  return (
    difference > 0
      ? difference
      : 0
  );
}


/* =========================================================
   CARTE INDICATEUR
========================================================= */

function IndicatorCard({
  title,
  value,
  unit,
  icon: Icon,
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
              font-extrabold
              text-slate-900
            "
          >

            {value}


            {
              unit && (

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

              )
            }

          </p>

        </div>


        <div
          className="
            rounded-xl
            bg-blue-50
            p-3
            text-blue-600
          "
        >

          <Icon
            size={21}
          />

        </div>

      </div>

    </div>
  );
}


/* =========================================================
   PAGE
========================================================= */

function ComparaisonPage() {

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
    compteurs,
    setCompteurs,
  ] = useState([]);


  const [
    loadingCompteurs,
    setLoadingCompteurs,
  ] = useState(true);


  const [
    loading,
    setLoading,
  ] = useState(false);


  const [
    error,
    setError,
  ] = useState('');


  const [
    resultat,
    setResultat,
  ] = useState(null);


  const [
    filters,
    setFilters,
  ] = useState({

    type:
      'ELECTRICITE',

    compteurId:
      '',

    dateDebut1:
      getMonthsAgo(3),

    dateFin1:
      getMonthsAgo(1),

    dateDebut2:
      getMonthsAgo(1),

    dateFin2:
      getToday(),

  });


  /* =======================================================
     UTILISATEUR CONNECTÉ
  ======================================================= */

  useEffect(
    () => {

      const token =
        localStorage.getItem(
          'token'
        );


      const storedUser =
        localStorage.getItem(
          'user'
        );


      if (
        !token ||
        !storedUser
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

        const currentUser =
          JSON.parse(
            storedUser
          );


        setUser(
          currentUser
        );


        const role =
          String(
            currentUser?.role ||
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
        }

      } catch (
        err
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
      }

    },
    [
      navigate,
    ]
  );


  /* =======================================================
     CHARGER LES COMPTEURS
  ======================================================= */

  useEffect(
    () => {

      const loadCompteurs =
        async () => {

          setLoadingCompteurs(
            true
          );

          setError(
            ''
          );


          try {

            const response =
              await axiosClient.get(
                '/compteurs'
              );


            const data =
              response.data?.data ||
              response.data?.compteurs ||
              response.data ||
              [];


            setCompteurs(
              Array.isArray(
                data
              )
                ? data
                : []
            );

          } catch (
            err
          ) {

            if (
              err.response?.status ===
                401 ||
              err.response?.status ===
                403
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

              err.response?.data?.message ||

              'Impossible de charger la liste des compteurs.'

            );

          } finally {

            setLoadingCompteurs(
              false
            );

          }

        };


      loadCompteurs();

    },
    [
      navigate,
    ]
  );


  /* =======================================================
     COMPTEURS SELON TYPE
  ======================================================= */

  const compteursFiltres =
    useMemo(
      () => {

        return compteurs.filter(
          (
            compteur
          ) => {

            const type =
              String(
                compteur.type ||
                ''
              )
                .trim()
                .toUpperCase();


            return (
              type ===
              filters.type
            );

          }
        );

      },
      [
        compteurs,
        filters.type,
      ]
    );


  /* =======================================================
     RÉINITIALISER COMPTEUR
  ======================================================= */

  useEffect(
    () => {

      if (
        filters.compteurId &&
        !compteursFiltres.some(

          (
            compteur
          ) =>
            String(
              compteur.id
            ) ===
            String(
              filters.compteurId
            )

        )
      ) {

        setFilters(
          (
            previous
          ) => ({

            ...previous,

            compteurId:
              '',

          })
        );

      }

    },
    [
      compteursFiltres,
      filters.compteurId,
    ]
  );


  /* =======================================================
     CHANGEMENT FORMULAIRE
  ======================================================= */

  const handleChange =
    (
      event
    ) => {

      const {
        name,
        value,
      } =
        event.target;


      setFilters(
        (
          previous
        ) => ({

          ...previous,

          [name]:
            value,

        })
      );


      setError(
        ''
      );


      setResultat(
        null
      );

    };


  /* =======================================================
     VALIDATION
  ======================================================= */

  const validate =
    () => {

      if (
        !filters.dateDebut1 ||
        !filters.dateFin1 ||
        !filters.dateDebut2 ||
        !filters.dateFin2
      ) {

        return (
          'Veuillez renseigner les quatre dates.'
        );
      }


      if (
        filters.dateDebut1 >
        filters.dateFin1
      ) {

        return (
          'La période 1 est invalide.'
        );
      }


      if (
        filters.dateDebut2 >
        filters.dateFin2
      ) {

        return (
          'La période 2 est invalide.'
        );
      }


      return '';
    };


  /* =======================================================
     LANCER COMPARAISON
  ======================================================= */

  const lancerComparaison =
    async (
      event
    ) => {

      event.preventDefault();


      const validationMessage =
        validate();


      if (
        validationMessage
      ) {

        setError(
          validationMessage
        );

        return;
      }


      setLoading(
        true
      );


      setError(
        ''
      );


      setResultat(
        null
      );


      try {

        const response =
          await axiosClient.get(
            '/comparaison',
            {

              params: {

                type:
                  filters.type,

                compteurId:
                  filters.compteurId ||
                  undefined,

                dateDebut1:
                  filters.dateDebut1,

                dateFin1:
                  filters.dateFin1,

                dateDebut2:
                  filters.dateDebut2,

                dateFin2:
                  filters.dateFin2,

              },

            }
          );


        setResultat(
          response.data?.data ||
          null
        );

      } catch (
        err
      ) {

        if (
          err.response?.status ===
            401 ||
          err.response?.status ===
            403
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

          err.response?.data?.message ||

          'Impossible de calculer la comparaison.'

        );

      } finally {

        setLoading(
          false
        );

      }

    };


  /* =======================================================
     RÉINITIALISER
  ======================================================= */

  const reset =
    () => {

      setFilters({

        type:
          'ELECTRICITE',

        compteurId:
          '',

        dateDebut1:
          getMonthsAgo(3),

        dateFin1:
          getMonthsAgo(1),

        dateDebut2:
          getMonthsAgo(1),

        dateFin2:
          getToday(),

      });


      setResultat(
        null
      );


      setError(
        ''
      );

    };


  /* =======================================================
     DONNÉES RÉSULTAT
  ======================================================= */

  const unite =
    resultat?.unite ||
    (
      filters.type ===
      'EAU'
        ? 'm³'
        : 'kWh'
    );


  const evolution =
    resultat?.comparaison?.evolution;


  const tendance =
    resultat?.comparaison?.tendance;


  const chartData =
    resultat

      ? [

          {

            periode:
              'Période 1',

            consommation:
              Number(
                resultat.periode1?.total ||
                0
              ),

          },


          {

            periode:
              'Période 2',

            consommation:
              Number(
                resultat.periode2?.total ||
                0
              ),

          },

        ]

      : [];


  let TendanceIcon =
    Minus;


  if (
    tendance ===
    'HAUSSE'
  ) {

    TendanceIcon =
      TrendingUp;

  } else if (
    tendance ===
    'BAISSE'
  ) {

    TendanceIcon =
      TrendingDown;

  }


  const tendanceClass =

    tendance ===
    'HAUSSE'

      ? 'text-amber-600 bg-amber-50 border-amber-200'

      : tendance ===
        'BAISSE'

      ? 'text-emerald-600 bg-emerald-50 border-emerald-200'

      : 'text-slate-600 bg-slate-50 border-slate-200';


  /* =======================================================
     RENDU
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
          "/dashboard/admin/comparaison"

        onNavigate={
          (
            path
          ) =>
            navigate(
              path
            )
        }

        onLogout={() => {

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

        }}

        user={
          user
        }

      />


      <div
        className="
          lg:ml-72
        "
      >

        <Header

          onOpenSidebar={() =>
            setSidebarOpen(
              true
            )
          }

          onProfile={() =>
            navigate(
              '/dashboard/admin'
            )
          }

          user={
            user
          }

        />


        <main
          className="
            px-4
            py-6
            sm:px-6
            lg:px-8
          "
        >

          <div
            className="
              mx-auto
              max-w-7xl
              space-y-6
            "
          >

            {/* =================================================
                EN-TÊTE
            ================================================= */}

            <div
              className="
                flex
                flex-col
                gap-4
                sm:flex-row
                sm:items-center
                sm:justify-between
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
                    mb-3
                    inline-flex
                    items-center
                    gap-2
                    text-sm
                    font-semibold
                    text-blue-600
                    hover:text-blue-700
                  "
                >

                  <ArrowLeft
                    size={17}
                  />

                  Retour au dashboard

                </button>


                <div
                  className="
                    flex
                    items-center
                    gap-3
                  "
                >

                  <div
                    className="
                      rounded-2xl
                      bg-blue-600
                      p-3
                      text-white
                      shadow-lg
                      shadow-blue-600/20
                    "
                  >

                    <BarChart3
                      size={24}
                    />

                  </div>


                  <div>

                    <h1
                      className="
                        text-2xl
                        font-extrabold
                        text-slate-900
                        sm:text-3xl
                      "
                    >
                      Comparaison des consommations
                    </h1>


                    <p
                      className="
                        mt-1
                        text-sm
                        text-slate-500
                      "
                    >
                      Analyse de l’évolution entre deux périodes sélectionnées.
                    </p>

                  </div>

                </div>

              </div>


              <button

                type="button"

                onClick={
                  reset
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
                  py-3
                  text-sm
                  font-semibold
                  text-slate-700
                  shadow-sm
                  hover:bg-slate-50
                "
              >

                <RefreshCw
                  size={17}
                />

                Réinitialiser

              </button>

            </div>


            {/* =================================================
                ERREUR
            ================================================= */}

            {
              error && (

                <div
                  className="
                    rounded-2xl
                    border
                    border-red-200
                    bg-red-50
                    p-4
                    text-sm
                    font-medium
                    text-red-700
                  "
                >
                  {error}
                </div>

              )
            }


            {/* =================================================
                FORMULAIRE
            ================================================= */}

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
                "
              >

                <h2
                  className="
                    text-lg
                    font-bold
                    text-slate-900
                  "
                >
                  Paramètres de comparaison
                </h2>


                <p
                  className="
                    mt-1
                    text-sm
                    text-slate-500
                  "
                >
                  Sélectionnez le type, le compteur et les deux périodes à comparer.
                </p>

              </div>


              <form
                onSubmit={
                  lancerComparaison
                }
                className="
                  space-y-6
                "
              >

                {/* TYPE + COMPTEUR */}

                <div
                  className="
                    grid
                    gap-4
                    lg:grid-cols-3
                  "
                >

                  <div>

                    <label
                      className="
                        mb-2
                        block
                        text-sm
                        font-semibold
                        text-slate-700
                      "
                    >
                      Type de consommation
                    </label>


                    <select

                      name="type"

                      value={
                        filters.type
                      }

                      onChange={
                        handleChange
                      }

                      className="
                        w-full
                        rounded-xl
                        border
                        border-slate-300
                        bg-white
                        px-4
                        py-3
                        text-sm
                        outline-none
                        focus:border-blue-600
                        focus:ring-4
                        focus:ring-blue-100
                      "
                    >

                      <option
                        value="ELECTRICITE"
                      >
                        Électricité (kWh)
                      </option>


                      <option
                        value="EAU"
                      >
                        Eau (m³)
                      </option>

                    </select>

                  </div>


                  <div>

                    <label
                      className="
                        mb-2
                        block
                        text-sm
                        font-semibold
                        text-slate-700
                      "
                    >
                      Compteur
                    </label>


                    <select

                      name="compteurId"

                      value={
                        filters.compteurId
                      }

                      onChange={
                        handleChange
                      }

                      disabled={
                        loadingCompteurs
                      }

                      className="
                        w-full
                        rounded-xl
                        border
                        border-slate-300
                        bg-white
                        px-4
                        py-3
                        text-sm
                        outline-none
                        focus:border-blue-600
                        focus:ring-4
                        focus:ring-blue-100
                        disabled:bg-slate-100
                      "
                    >

                      <option
                        value=""
                      >
                        Tous les compteurs de ce type
                      </option>


                      {
                        compteursFiltres.map(
                          (
                            compteur
                          ) => (

                            <option
                              key={
                                compteur.id
                              }
                              value={
                                compteur.id
                              }
                            >

                              {
                                compteur.numero_compteur
                              }

                              {' — '}

                              {
                                compteur.type
                              }

                            </option>

                          )
                        )
                      }

                    </select>

                  </div>


                  <div
                    className="
                      rounded-xl
                      border
                      border-blue-100
                      bg-blue-50
                      p-4
                    "
                  >

                    <p
                      className="
                        text-xs
                        font-bold
                        uppercase
                        tracking-wide
                        text-blue-600
                      "
                    >
                      Unité
                    </p>


                    <p
                      className="
                        mt-1
                        text-lg
                        font-extrabold
                        text-blue-900
                      "
                    >

                      {
                        filters.type ===
                        'EAU'
                          ? 'm³'
                          : 'kWh'
                      }

                    </p>

                  </div>

                </div>


                {/* PÉRIODES */}

                <div
                  className="
                    grid
                    gap-6
                    xl:grid-cols-2
                  "
                >

                  {/* PÉRIODE 1 */}

                  <div
                    className="
                      rounded-2xl
                      border
                      border-slate-200
                      bg-slate-50
                      p-5
                    "
                  >

                    <div
                      className="
                        mb-4
                        flex
                        items-center
                        gap-3
                      "
                    >

                      <div
                        className="
                          rounded-xl
                          bg-white
                          p-2.5
                          text-slate-700
                          shadow-sm
                        "
                      >

                        <CalendarDays
                          size={18}
                        />

                      </div>


                      <div>

                        <h3
                          className="
                            font-bold
                            text-slate-900
                          "
                        >
                          Période 1
                        </h3>


                        <p
                          className="
                            text-xs
                            text-slate-500
                          "
                        >
                          Première période de référence
                        </p>

                      </div>

                    </div>


                    <div
                      className="
                        grid
                        gap-4
                        sm:grid-cols-2
                      "
                    >

                      <div>

                        <label
                          className="
                            mb-2
                            block
                            text-xs
                            font-semibold
                            text-slate-600
                          "
                        >
                          Date début
                        </label>


                        <input

                          type="date"

                          name="dateDebut1"

                          value={
                            filters.dateDebut1
                          }

                          onChange={
                            handleChange
                          }

                          className="
                            w-full
                            rounded-xl
                            border
                            border-slate-300
                            bg-white
                            px-3
                            py-2.5
                            text-sm
                          "
                        />

                      </div>


                      <div>

                        <label
                          className="
                            mb-2
                            block
                            text-xs
                            font-semibold
                            text-slate-600
                          "
                        >
                          Date fin
                        </label>


                        <input

                          type="date"

                          name="dateFin1"

                          value={
                            filters.dateFin1
                          }

                          onChange={
                            handleChange
                          }

                          className="
                            w-full
                            rounded-xl
                            border
                            border-slate-300
                            bg-white
                            px-3
                            py-2.5
                            text-sm
                          "
                        />

                      </div>

                    </div>

                  </div>


                  {/* PÉRIODE 2 */}

                  <div
                    className="
                      rounded-2xl
                      border
                      border-slate-200
                      bg-slate-50
                      p-5
                    "
                  >

                    <div
                      className="
                        mb-4
                        flex
                        items-center
                        gap-3
                      "
                    >

                      <div
                        className="
                          rounded-xl
                          bg-white
                          p-2.5
                          text-blue-600
                          shadow-sm
                        "
                      >

                        <CalendarDays
                          size={18}
                        />

                      </div>


                      <div>

                        <h3
                          className="
                            font-bold
                            text-slate-900
                          "
                        >
                          Période 2
                        </h3>


                        <p
                          className="
                            text-xs
                            text-slate-500
                          "
                        >
                          Deuxième période comparée
                        </p>

                      </div>

                    </div>


                    <div
                      className="
                        grid
                        gap-4
                        sm:grid-cols-2
                      "
                    >

                      <div>

                        <label
                          className="
                            mb-2
                            block
                            text-xs
                            font-semibold
                            text-slate-600
                          "
                        >
                          Date début
                        </label>


                        <input

                          type="date"

                          name="dateDebut2"

                          value={
                            filters.dateDebut2
                          }

                          onChange={
                            handleChange
                          }

                          className="
                            w-full
                            rounded-xl
                            border
                            border-slate-300
                            bg-white
                            px-3
                            py-2.5
                            text-sm
                          "
                        />

                      </div>


                      <div>

                        <label
                          className="
                            mb-2
                            block
                            text-xs
                            font-semibold
                            text-slate-600
                          "
                        >
                          Date fin
                        </label>


                        <input

                          type="date"

                          name="dateFin2"

                          value={
                            filters.dateFin2
                          }

                          onChange={
                            handleChange
                          }

                          className="
                            w-full
                            rounded-xl
                            border
                            border-slate-300
                            bg-white
                            px-3
                            py-2.5
                            text-sm
                          "
                        />

                      </div>

                    </div>

                  </div>

                </div>


                {/* BOUTON */}

                <button

                  type="submit"

                  disabled={
                    loading
                  }

                  className="
                    inline-flex
                    w-full
                    items-center
                    justify-center
                    gap-2
                    rounded-xl
                    bg-blue-600
                    px-5
                    py-3.5
                    text-sm
                    font-bold
                    text-white
                    shadow-lg
                    shadow-blue-600/20
                    transition
                    hover:bg-blue-700
                    disabled:cursor-not-allowed
                    disabled:opacity-60
                  "
                >

                  {
                    loading
                      ? (

                          <>

                            <span
                              className="
                                h-5
                                w-5
                                animate-spin
                                rounded-full
                                border-2
                                border-white/30
                                border-t-white
                              "
                            />

                            Calcul en cours...

                          </>

                        )

                      : (

                          <>

                            <BarChart3
                              size={19}
                            />

                            Comparer les consommations

                          </>

                        )
                  }

                </button>

              </form>

            </section>


            {/* =================================================
                RÉSULTATS
            ================================================= */}

            {
              resultat && (

                <>

                  {/* INDICATEURS */}

                  <section
                    className="
                      grid
                      gap-4
                      sm:grid-cols-2
                      xl:grid-cols-4
                    "
                  >

                    <IndicatorCard

                      title=
                        "Total période 1"

                      value={
                        formatNumber(
                          resultat.periode1?.total
                        )
                      }

                      unit={
                        unite
                      }

                      icon={
                        filters.type ===
                        'EAU'
                          ? Droplets
                          : Zap
                      }

                    />


                    <IndicatorCard

                      title=
                        "Total période 2"

                      value={
                        formatNumber(
                          resultat.periode2?.total
                        )
                      }

                      unit={
                        unite
                      }

                      icon={
                        filters.type ===
                        'EAU'
                          ? Droplets
                          : Zap
                      }

                    />


                    <IndicatorCard

                      title="Écart"

                      value={
                        formatNumber(
                          resultat.comparaison?.difference
                        )
                      }

                      unit={
                        unite
                      }

                      icon={
                        Gauge
                      }

                    />


                    <IndicatorCard

                      title="Évolution"

                      value={

                        evolution ===
                          null ||

                        evolution ===
                          undefined

                          ? '—'

                          : `${formatNumber(
                              evolution
                            )} %`

                      }

                      icon={
                        TendanceIcon
                      }

                    />

                  </section>


                  {/* GRAPHIQUE + ANALYSE */}

                  <section
                    className="
                      grid
                      gap-6
                      xl:grid-cols-[1.55fr_0.9fr]
                    "
                  >

                    {/* GRAPHIQUE */}

                    <div
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
                        "
                      >

                        <h2
                          className="
                            text-lg
                            font-bold
                            text-slate-900
                          "
                        >
                          Comparaison visuelle
                        </h2>


                        <p
                          className="
                            mt-1
                            text-sm
                            text-slate-500
                          "
                        >
                          Total des consommations enregistrées pour chaque période.
                        </p>

                      </div>


                      <div
                        className="
                          h-[330px]
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
                              top: 10,
                              right: 10,
                              left: 5,
                              bottom: 5,
                            }}
                          >

                            <CartesianGrid
                              strokeDasharray="3 3"
                            />


                            <XAxis
                              dataKey="periode"
                            />


                            <YAxis />


                            <Tooltip

                              formatter={
                                (
                                  value
                                ) => [

                                  `${formatNumber(
                                    value
                                  )} ${unite}`,

                                  'Consommation',

                                ]
                              }

                            />


                            <Legend />


                            <Bar

                              dataKey="consommation"

                              name={
                                `Consommation (${unite})`
                              }

                              radius={[
                                8,
                                8,
                                0,
                                0,
                              ]}

                            />

                          </BarChart>

                        </ResponsiveContainer>

                      </div>

                    </div>


                    {/* ANALYSE */}

                    <div
                      className="
                        space-y-4
                      "
                    >

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
                            mb-4
                            flex
                            items-center
                            justify-between
                            gap-3
                          "
                        >

                          <div>

                            <p
                              className="
                                text-xs
                                font-bold
                                uppercase
                                tracking-wide
                                text-slate-400
                              "
                            >
                              Analyse automatique
                            </p>


                            <h2
                              className="
                                mt-1
                                text-lg
                                font-extrabold
                                text-slate-900
                              "
                            >
                              Tendance détectée
                            </h2>

                          </div>


                          <div
                            className={`
                              rounded-xl
                              border
                              p-2.5
                              ${tendanceClass}
                            `}
                          >

                            <TendanceIcon
                              size={20}
                            />

                          </div>

                        </div>


                        <div
                          className={`
                            rounded-xl
                            border
                            px-4
                            py-3
                            text-sm
                            font-bold
                            ${tendanceClass}
                          `}
                        >

                          {
                            tendance ===
                            'HAUSSE'

                              ? 'La consommation a augmenté.'

                              : tendance ===
                                'BAISSE'

                              ? 'La consommation a diminué.'

                              : 'La consommation est stable ou non calculable.'
                          }

                        </div>


                        <p
                          className="
                            mt-4
                            text-sm
                            leading-6
                            text-slate-600
                          "
                        >

                          {
                            evolution ===
                              null ||
                            evolution ===
                              undefined

                              ? 'La variation en pourcentage ne peut pas être calculée lorsque le total de la période 1 est nul.'

                              : `Variation calculée : ${formatNumber(
                                  Math.abs(
                                    evolution
                                  )
                                )} % entre les deux périodes.`
                          }

                        </p>

                      </div>


                      {/* DÉTAIL */}

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
                            items-center
                            gap-3
                          "
                        >

                          <CheckCircle2
                            className="
                              text-emerald-600
                            "
                            size={20}
                          />


                          <h3
                            className="
                              font-bold
                              text-slate-900
                            "
                          >
                            Détail des périodes
                          </h3>

                        </div>


                        <div
                          className="
                            mt-4
                            space-y-3
                            text-sm
                          "
                        >

                          <div
                            className="
                              rounded-xl
                              bg-slate-50
                              p-3
                            "
                          >

                            <p
                              className="
                                font-semibold
                                text-slate-700
                              "
                            >
                              Période 1
                            </p>


                            <p
                              className="
                                mt-1
                                text-slate-500
                              "
                            >

                              {
                                formatDate(
                                  resultat.periode1?.dateDebut
                                )
                              }

                              {' → '}

                              {
                                formatDate(
                                  resultat.periode1?.dateFin
                                )
                              }

                            </p>


                            <p
                              className="
                                mt-2
                                font-bold
                                text-slate-900
                              "
                            >

                              {
                                getDifferenceDays(
                                  resultat.periode1?.dateDebut,
                                  resultat.periode1?.dateFin
                                )
                              }

                              {' jour(s) • '}

                              {
                                resultat.periode1?.nombre_releves ||
                                0
                              }

                              {' relevé(s)'}

                            </p>

                          </div>


                          <div
                            className="
                              rounded-xl
                              bg-blue-50
                              p-3
                            "
                          >

                            <p
                              className="
                                font-semibold
                                text-blue-800
                              "
                            >
                              Période 2
                            </p>


                            <p
                              className="
                                mt-1
                                text-blue-700/70
                              "
                            >

                              {
                                formatDate(
                                  resultat.periode2?.dateDebut
                                )
                              }

                              {' → '}

                              {
                                formatDate(
                                  resultat.periode2?.dateFin
                                )
                              }

                            </p>


                            <p
                              className="
                                mt-2
                                font-bold
                                text-blue-900
                              "
                            >

                              {
                                getDifferenceDays(
                                  resultat.periode2?.dateDebut,
                                  resultat.periode2?.dateFin
                                )
                              }

                              {' jour(s) • '}

                              {
                                resultat.periode2?.nombre_releves ||
                                0
                              }

                              {' relevé(s)'}

                            </p>

                          </div>

                        </div>

                      </div>

                    </div>

                  </section>


                  {/* EXPLICATION */}

                  <section
                    className="
                      rounded-2xl
                      border
                      border-blue-100
                      bg-blue-50
                      p-5
                      text-sm
                      leading-6
                      text-blue-900
                    "
                  >

                    <p
                      className="
                        font-bold
                      "
                    >
                      Lecture du résultat
                    </p>


                    <p
                      className="
                        mt-1
                      "
                    >
                      Cette fonctionnalité compare les consommations réellement enregistrées dans les relevés sélectionnés. Elle ne modifie aucune donnée et ne remplace pas la détection d’anomalies.
                    </p>

                  </section>

                </>

              )
            }

          </div>

        </main>

      </div>

    </div>

  );
}


export default ComparaisonPage;