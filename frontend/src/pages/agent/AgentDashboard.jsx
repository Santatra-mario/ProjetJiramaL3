import {
  useEffect,
  useState,
} from 'react';

import {
  useNavigate,
} from 'react-router-dom';

import {
  Bell,
  ClipboardList,
  Gauge,
  Plus,
  RefreshCw,
  TriangleAlert,
  Users,
  Droplets,
  Zap,
  ArrowRight,
} from 'lucide-react';

import axiosClient
  from '../../api/axiosClient';

import AgentLayout
  from '../../components/admin/agent/AgentLayout';


function formatDate(value) {

  if (!value) {
    return '—';
  }

  const date =
    new Date(
      `${String(value).slice(
        0,
        10
      )}T00:00:00`
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


function formatNumber(
  value,
  digits = 2
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
      minimumFractionDigits:
        digits,

      maximumFractionDigits:
        digits,
    }
  );
}


function DashboardStat({

  icon: Icon,

  title,

  value,

  description,

}) {

  return (

    <div
      className="
        rounded-3xl
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
              text-3xl
              font-black
              tracking-tight
              text-slate-900
            "
          >
            {value}
          </p>

          <p
            className="
              mt-2
              text-xs
              text-slate-400
            "
          >
            {description}
          </p>

        </div>


        <div
          className="
            rounded-2xl
            bg-slate-100
            p-3
            text-slate-700
          "
        >
          <Icon size={22} />
        </div>

      </div>

    </div>
  );
}


function TypeIcon({
  type,
}) {

  return (
    String(
      type || ''
    ).toUpperCase() ===
    'EAU'
  ) ? (

    <span
      className="
        rounded-xl
        bg-cyan-50
        p-2
        text-cyan-600
      "
    >
      <Droplets size={17} />
    </span>

  ) : (

    <span
      className="
        rounded-xl
        bg-amber-50
        p-2
        text-amber-600
      "
    >
      <Zap size={17} />
    </span>

  );
}


function NiveauBadge({
  niveau,
}) {

  const styles = {

    CRITIQUE:
      'bg-red-50 text-red-700 border-red-200',

    SUSPECTE:
      'bg-orange-50 text-orange-700 border-orange-200',

    ATTENTION:
      'bg-yellow-50 text-yellow-700 border-yellow-200',

  };


  return (

    <span
      className={`
        inline-flex
        rounded-full
        border
        px-2.5
        py-1
        text-[11px]
        font-bold
        ${
          styles[niveau] ||
          'bg-slate-50 text-slate-600 border-slate-200'
        }
      `}
    >
      {niveau || '—'}
    </span>

  );
}


function AgentDashboard() {

  const navigate =
    useNavigate();


  const [
    loading,
    setLoading,
  ] =
    useState(true);


  const [
    refreshing,
    setRefreshing,
  ] =
    useState(false);


  const [
    error,
    setError,
  ] =
    useState('');


  const [
    data,
    setData,
  ] =
    useState({

      stats: {},

      relevesRecents: [],

      anomaliesRecentes: [],

    });


  async function loadDashboard(
    refresh = false
  ) {

    try {

      setError('');

      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }


      const response =
        await axiosClient.get(
          '/agent/dashboard'
        );


      if (
        response.data?.status !==
        'success'
      ) {

        throw new Error(
          response.data?.message ||
          'Impossible de charger le dashboard Agent.'
        );

      }


      setData({

        stats:
          response.data.stats ||
          {},

        relevesRecents:
          response.data.relevesRecents ||
          [],

        anomaliesRecentes:
          response.data.anomaliesRecentes ||
          [],

      });

    } catch (
      requestError
    ) {

      console.error(
        'Erreur dashboard Agent :',
        requestError
      );


      if (
        requestError.response?.status ===
          401 ||
        requestError.response?.status ===
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
        requestError.response?.data?.message ||
        requestError.message ||
        'Erreur lors du chargement du dashboard.'
      );

    } finally {

      setLoading(false);

      setRefreshing(false);

    }

  }


  useEffect(() => {

    loadDashboard();

  }, []);


  const stats =
    data.stats || {};


  return (

    <AgentLayout
      title="
        Tableau de bord Agent
      "
    >

      <div
        className="
          space-y-6
        "
      >

        {/* HERO */}

        <section
          className="
            overflow-hidden
            rounded-3xl
            border
            border-blue-100
            bg-gradient-to-r
            from-blue-700
            via-blue-600
            to-cyan-600
            p-6
            text-white
            shadow-lg
            sm:p-8
          "
        >

          <div
            className="
              flex
              flex-col
              justify-between
              gap-6
              lg:flex-row
              lg:items-center
            "
          >

            <div>

              <p
                className="
                  text-sm
                  font-semibold
                  uppercase
                  tracking-[0.16em]
                  text-blue-100
                "
              >
                Suivi opérationnel
              </p>

              <h2
                className="
                  mt-2
                  text-2xl
                  font-black
                  sm:text-3xl
                "
              >
                Bienvenue dans votre espace Agent
              </h2>

              <p
                className="
                  mt-3
                  max-w-2xl
                  text-sm
                  leading-6
                  text-blue-50
                  sm:text-base
                "
              >
                Saisissez les relevés,
                consultez les compteurs,
                suivez les anomalies
                et vérifiez les
                notifications liées
                aux consommations.
              </p>

            </div>


            <div
              className="
                flex
                flex-wrap
                gap-3
              "
            >

              <button
                type="button"
                onClick={() =>
                  navigate(
                    '/dashboard/agent/releves'
                  )
                }
                className="
                  inline-flex
                  items-center
                  gap-2
                  rounded-2xl
                  bg-white
                  px-4
                  py-3
                  text-sm
                  font-bold
                  text-blue-700
                  shadow-sm
                  hover:bg-blue-50
                "
              >

                <Plus size={18} />

                Nouveau relevé

              </button>


              <button
                type="button"
                onClick={() =>
                  loadDashboard(true)
                }
                className="
                  inline-flex
                  items-center
                  gap-2
                  rounded-2xl
                  border
                  border-white/20
                  bg-white/10
                  px-4
                  py-3
                  text-sm
                  font-bold
                  text-white
                  hover:bg-white/20
                "
              >

                <RefreshCw
                  size={18}
                  className={
                    refreshing
                      ? 'animate-spin'
                      : ''
                  }
                />

                Actualiser

              </button>

            </div>

          </div>

        </section>


        {/* ERREUR */}

        {error && (

          <div
            className="
              rounded-2xl
              border
              border-red-200
              bg-red-50
              px-4
              py-3
              text-sm
              font-medium
              text-red-700
            "
          >
            {error}
          </div>

        )}


        {/* KPI */}

        <section
          className="
            grid
            gap-4
            sm:grid-cols-2
            xl:grid-cols-4
          "
        >

          <DashboardStat

            icon={Gauge}

            title="Compteurs"

            value={
              loading
                ? '…'
                : formatNumber(
                    stats.compteurs ||
                    0,
                    0
                  )
            }

            description={`
              ${formatNumber(
                stats.compteursActifs ||
                0,
                0
              )} actifs
            `}

          />


          <DashboardStat

            icon={Users}

            title="Abonnés"

            value={
              loading
                ? '…'
                : formatNumber(
                    stats.abonnes ||
                    0,
                    0
                  )
            }

            description="
              Clients enregistrés
            "

          />


          <DashboardStat

            icon={ClipboardList}

            title="
              Relevés du mois
            "

            value={
              loading
                ? '…'
                : formatNumber(
                    stats.relevesMois ||
                    0,
                    0
                  )
            }

            description="
              Relevés saisis depuis
              le début du mois
            "

          />


          <DashboardStat

            icon={TriangleAlert}

            title="
              Anomalies à vérifier
            "

            value={
              loading
                ? '…'
                : formatNumber(
                    stats.anomalies ||
                    0,
                    0
                  )
            }

            description={`
              ${formatNumber(
                stats.notifications ||
                0,
                0
              )} notification(s)
              en attente
            `}

          />

        </section>


        {/* ACTIVITÉ */}

        <section
          className="
            grid
            gap-6
            xl:grid-cols-2
          "
        >

          <div
            className="
              overflow-hidden
              rounded-3xl
              border
              border-slate-200
              bg-white
              shadow-sm
            "
          >

            <div
              className="
                flex
                items-center
                justify-between
                border-b
                border-slate-100
                px-5
                py-4
              "
            >

              <div>

                <p
                  className="
                    text-xs
                    font-bold
                    uppercase
                    tracking-[0.15em]
                    text-slate-400
                  "
                >
                  Activité
                </p>

                <h3
                  className="
                    mt-1
                    text-lg
                    font-bold
                    text-slate-900
                  "
                >
                  Derniers relevés
                </h3>

              </div>


              <button
                type="button"
                onClick={() =>
                  navigate(
                    '/dashboard/agent/releves'
                  )
                }
                className="
                  inline-flex
                  items-center
                  gap-1
                  text-sm
                  font-bold
                  text-blue-600
                "
              >
                Tout voir
                <ArrowRight
                  size={16}
                />
              </button>

            </div>


            {loading ? (

              <div
                className="
                  px-5
                  py-12
                  text-center
                  text-sm
                  text-slate-500
                "
              >
                Chargement…
              </div>

            ) : data.relevesRecents.length ===
              0 ? (

              <div
                className="
                  px-5
                  py-12
                  text-center
                  text-sm
                  text-slate-500
                "
              >
                Aucun relevé disponible.
              </div>

            ) : (

              <div
                className="
                  divide-y
                  divide-slate-100
                "
              >

                {data.relevesRecents.map(
                  (
                    releve
                  ) => (

                    <div
                      key={
                        releve.id
                      }
                      className="
                        flex
                        items-center
                        gap-3
                        px-5
                        py-4
                      "
                    >

                      <TypeIcon
                        type={
                          releve.type_compteur
                        }
                      />


                      <div
                        className="
                          min-w-0
                          flex-1
                        "
                      >

                        <p
                          className="
                            truncate
                            text-sm
                            font-bold
                            text-slate-800
                          "
                        >
                          {
                            releve.numero_compteur
                          }
                        </p>


                        <p
                          className="
                            mt-0.5
                            truncate
                            text-xs
                            text-slate-400
                          "
                        >
                          {
                            releve.abonne_prenom ||
                            ''
                          }{' '}
                          {
                            releve.abonne_nom ||
                            ''
                          }
                          {' · '}
                          {
                            formatDate(
                              releve.date_releve
                            )
                          }
                        </p>

                      </div>


                      <div
                        className="
                          text-right
                        "
                      >

                        <p
                          className="
                            text-sm
                            font-black
                            text-slate-800
                          "
                        >
                          {
                            formatNumber(
                              releve.consommation ||
                              0
                            )
                          }
                        </p>


                        <p
                          className="
                            text-[11px]
                            text-slate-400
                          "
                        >
                          {
                            String(
                              releve.type_compteur ||
                              ''
                            ).toUpperCase() ===
                            'EAU'
                              ? 'm³'
                              : 'kWh'
                          }
                        </p>

                      </div>

                    </div>

                  )
                )}

              </div>

            )}

          </div>


          {/* ANOMALIES */}

          <div
            className="
              overflow-hidden
              rounded-3xl
              border
              border-slate-200
              bg-white
              shadow-sm
            "
          >

            <div
              className="
                flex
                items-center
                justify-between
                border-b
                border-slate-100
                px-5
                py-4
              "
            >

              <div>

                <p
                  className="
                    text-xs
                    font-bold
                    uppercase
                    tracking-[0.15em]
                    text-slate-400
                  "
                >
                  Vigilance
                </p>

                <h3
                  className="
                    mt-1
                    text-lg
                    font-bold
                    text-slate-900
                  "
                >
                  Anomalies récentes
                </h3>

              </div>


              <button
                type="button"
                onClick={() =>
                  navigate(
                    '/dashboard/agent/anomalies'
                  )
                }
                className="
                  inline-flex
                  items-center
                  gap-1
                  text-sm
                  font-bold
                  text-blue-600
                "
              >
                Tout voir

                <ArrowRight
                  size={16}
                />
              </button>

            </div>


            {data.anomaliesRecentes.length ===
              0 ? (

              <div
                className="
                  px-5
                  py-12
                  text-center
                  text-sm
                  text-slate-500
                "
              >
                Aucune anomalie détectée.
              </div>

            ) : (

              <div
                className="
                  divide-y
                  divide-slate-100
                "
              >

                {data.anomaliesRecentes.map(
                  (
                    anomalie
                  ) => (

                    <div
                      key={
                        anomalie.id
                      }
                      className="
                        px-5
                        py-4
                      "
                    >

                      <div
                        className="
                          flex
                          items-start
                          gap-3
                        "
                      >

                        <div
                          className="
                            rounded-xl
                            bg-red-50
                            p-2
                            text-red-600
                          "
                        >
                          <TriangleAlert
                            size={17}
                          />
                        </div>


                        <div
                          className="
                            min-w-0
                            flex-1
                          "
                        >

                          <div
                            className="
                              flex
                              flex-wrap
                              items-center
                              gap-2
                            "
                          >

                            <p
                              className="
                                text-sm
                                font-bold
                                text-slate-800
                              "
                            >
                              {
                                anomalie.numero_compteur
                              }
                            </p>

                            <NiveauBadge
                              niveau={
                                anomalie.niveau
                              }
                            />

                          </div>


                          <p
                            className="
                              mt-1
                              text-xs
                              text-slate-500
                            "
                          >
                            {
                              anomalie.type_anomalie ||
                              'Anomalie'
                            }
                            {' · '}
                            {
                              formatDate(
                                anomalie.date_detection
                              )
                            }
                          </p>

                        </div>


                        <p
                          className="
                            text-sm
                            font-black
                            text-red-600
                          "
                        >
                          {
                            Math.abs(
                              Number(
                                anomalie.variation ||
                                0
                              )
                            ).toFixed(
                              1
                            )
                          } %
                        </p>

                      </div>

                    </div>

                  )
                )}

              </div>

            )}

          </div>

        </section>


        {/* ACTIONS */}

        <section
          className="
            rounded-3xl
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

            <div
              className="
                rounded-2xl
                bg-blue-50
                p-3
                text-blue-600
              "
            >
              <Bell size={20} />
            </div>


            <div>

              <h3
                className="
                  font-bold
                  text-slate-900
                "
              >
                Actions rapides
              </h3>

              <p
                className="
                  text-sm
                  text-slate-500
                "
              >
                Accédez directement
                aux opérations principales.
              </p>

            </div>

          </div>


          <div
            className="
              mt-5
              grid
              gap-3
              sm:grid-cols-2
              xl:grid-cols-4
            "
          >

            <button
              type="button"
              onClick={() =>
                navigate(
                  '/dashboard/agent/releves'
                )
              }
              className="
                flex
                items-center
                justify-between
                rounded-2xl
                border
                border-slate-200
                p-4
                text-left
                hover:bg-blue-50
              "
            >

              <span
                className="
                  font-semibold
                  text-slate-800
                "
              >
                Saisir un relevé
              </span>

              <ClipboardList
                size={18}
                className="
                  text-blue-600
                "
              />

            </button>


            <button
              type="button"
              onClick={() =>
                navigate(
                  '/dashboard/agent/compteurs'
                )
              }
              className="
                flex
                items-center
                justify-between
                rounded-2xl
                border
                border-slate-200
                p-4
                text-left
                hover:bg-blue-50
              "
            >

              <span
                className="
                  font-semibold
                  text-slate-800
                "
              >
                Consulter les compteurs
              </span>

              <Gauge
                size={18}
                className="
                  text-blue-600
                "
              />

            </button>


            <button
              type="button"
              onClick={() =>
                navigate(
                  '/dashboard/agent/anomalies'
                )
              }
              className="
                flex
                items-center
                justify-between
                rounded-2xl
                border
                border-slate-200
                p-4
                text-left
                hover:bg-red-50
              "
            >

              <span
                className="
                  font-semibold
                  text-slate-800
                "
              >
                Vérifier les anomalies
              </span>

              <TriangleAlert
                size={18}
                className="
                  text-red-600
                "
              />

            </button>


            <button
              type="button"
              onClick={() =>
                navigate(
                  '/dashboard/agent/notifications'
                )
              }
              className="
                flex
                items-center
                justify-between
                rounded-2xl
                border
                border-slate-200
                p-4
                text-left
                hover:bg-amber-50
              "
            >

              <span
                className="
                  font-semibold
                  text-slate-800
                "
              >
                Voir les notifications
              </span>

              <Bell
                size={18}
                className="
                  text-amber-600
                "
              />

            </button>

          </div>

        </section>

      </div>

    </AgentLayout>

  );
}

export default AgentDashboard;