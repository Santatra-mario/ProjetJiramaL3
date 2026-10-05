import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  useNavigate,
} from 'react-router-dom';

import {
  CalendarDays,
  Search,
  TriangleAlert,
  Droplets,
  Zap,
} from 'lucide-react';

import axiosClient
  from '../../api/axiosClient';

import AgentLayout
  from '../../components/admin/agent/AgentLayout';


function formatDate(
  value
) {

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

  return Number.isNaN(
    date.getTime()
  )
    ? '—'
    : date.toLocaleDateString(
        'fr-FR'
      );
}


function formatNumber(
  value
) {

  const number =
    Number(value);

  return Number.isFinite(
    number
  )
    ? number.toLocaleString(
        'fr-FR',
        {
          minimumFractionDigits:
            2,

          maximumFractionDigits:
            2,
        }
      )
    : '—';

}


function LevelBadge({
  value,
}) {

  const style = {

    CRITIQUE:
      'border-red-200 bg-red-50 text-red-700',

    SUSPECTE:
      'border-orange-200 bg-orange-50 text-orange-700',

    ATTENTION:
      'border-yellow-200 bg-yellow-50 text-yellow-700',

  };


  return (

    <span
      className={`
        rounded-full
        border
        px-2.5
        py-1
        text-[11px]
        font-bold
        ${
          style[value] ||
          'border-slate-200 bg-slate-50 text-slate-600'
        }
      `}
    >
      {
        value ||
        '—'
      }
    </span>

  );
}


function StatusBadge({
  value,
}) {

  return (

    <span
      className="
        rounded-full
        border
        border-slate-200
        bg-slate-50
        px-2.5
        py-1
        text-[11px]
        font-bold
        text-slate-600
      "
    >
      {
        value ||
        '—'
      }
    </span>

  );
}


function AgentAnomaliesPage() {

  const navigate =
    useNavigate();


  const [
    anomalies,
    setAnomalies,
  ] =
    useState([]);


  const [
    search,
    setSearch,
  ] =
    useState('');


  const [
    type,
    setType,
  ] =
    useState('');


  const [
    niveau,
    setNiveau,
  ] =
    useState('');


  const [
    statut,
    setStatut,
  ] =
    useState('');


  const [
    loading,
    setLoading,
  ] =
    useState(true);


  const [
    error,
    setError,
  ] =
    useState('');


  async function loadAnomalies() {

    try {

      setLoading(
        true
      );

      setError('');


      const response =
        await axiosClient.get(
          '/agent/anomalies',
          {
            params: {

              recherche:
                search ||
                undefined,

              type:
                type ||
                undefined,

              niveau:
                niveau ||
                undefined,

              statut:
                statut ||
                undefined,

            },
          }
        );


      if (
        response.data?.status !==
        'success'
      ) {

        throw new Error(
          response.data?.message ||
          'Impossible de charger les anomalies.'
        );

      }


      setAnomalies(
        response.data?.data ||
        []
      );

    } catch (
      requestError
    ) {

      console.error(
        'Erreur anomalies Agent :',
        requestError
      );


      if (
        requestError.response?.status ===
          401 ||
        requestError.response?.status ===
          403
      ) {

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
        'Erreur lors du chargement des anomalies.'
      );

    } finally {

      setLoading(
        false
      );

    }

  }


  useEffect(
    () => {

      const timer =
        setTimeout(
          () => {
            loadAnomalies();
          },
          250
        );


      return () =>
        clearTimeout(
          timer
        );

    },
    [
      search,
      type,
      niveau,
      statut,
    ]
  );


  const totalNouvelles =
    useMemo(
      () =>
        anomalies.filter(
          (
            item
          ) =>
            item.statut ===
            'NOUVELLE'
        ).length,

      [anomalies]
    );


  return (

    <AgentLayout
      title="Anomalies"
    >

      <div
        className="
          space-y-6
        "
      >

        <section
          className="
            rounded-3xl
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
              flex-col
              gap-5
            "
          >

            <div>

              <p
                className="
                  text-xs
                  font-bold
                  uppercase
                  tracking-[0.16em]
                  text-red-600
                "
              >
                Surveillance
              </p>

              <h2
                className="
                  mt-1
                  text-2xl
                  font-black
                  text-slate-900
                "
              >
                Anomalies de consommation
              </h2>

              <p
                className="
                  mt-2
                  text-sm
                  text-slate-500
                "
              >
                Consultez les consommations
                détectées comme inhabituelles.
              </p>

            </div>


            <div
              className="
                grid
                gap-3
                md:grid-cols-4
              "
            >

              <div
                className="
                  relative
                  md:col-span-2
                "
              >

                <Search
                  size={18}
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
                  value={search}
                  onChange={(
                    event
                  ) =>
                    setSearch(
                      event.target.value
                    )
                  }
                  placeholder="
                    Compteur, abonné, type…
                  "
                  className="
                    w-full
                    rounded-2xl
                    border
                    border-slate-300
                    bg-slate-50
                    py-3
                    pl-10
                    pr-4
                    text-sm
                    outline-none
                    focus:border-blue-500
                    focus:bg-white
                  "
                />

              </div>


              <select
                value={type}
                onChange={(
                  event
                ) =>
                  setType(
                    event.target.value
                  )
                }
                className="
                  rounded-2xl
                  border
                  border-slate-300
                  bg-slate-50
                  px-4
                  py-3
                  text-sm
                  outline-none
                  focus:border-blue-500
                  focus:bg-white
                "
              >

                <option value="">
                  Tous les types
                </option>

                <option value="EAU">
                  Eau
                </option>

                <option value="ELECTRICITE">
                  Électricité
                </option>

              </select>


              <select
                value={niveau}
                onChange={(
                  event
                ) =>
                  setNiveau(
                    event.target.value
                  )
                }
                className="
                  rounded-2xl
                  border
                  border-slate-300
                  bg-slate-50
                  px-4
                  py-3
                  text-sm
                  outline-none
                  focus:border-blue-500
                "
              >

                <option value="">
                  Tous les niveaux
                </option>

                <option value="ATTENTION">
                  Attention
                </option>

                <option value="SUSPECTE">
                  Suspecte
                </option>

                <option value="CRITIQUE">
                  Critique
                </option>

              </select>

            </div>


            <div
              className="
                flex
                flex-wrap
                items-center
                gap-3
              "
            >

              <select
                value={statut}
                onChange={(
                  event
                ) =>
                  setStatut(
                    event.target.value
                  )
                }
                className="
                  rounded-xl
                  border
                  border-slate-300
                  bg-white
                  px-4
                  py-2.5
                  text-sm
                  outline-none
                  focus:border-blue-500
                "
              >

                <option value="">
                  Tous les statuts
                </option>

                <option value="NOUVELLE">
                  Nouvelle
                </option>

                <option value="EN_COURS">
                  En cours
                </option>

                <option value="VERIFIEE">
                  Vérifiée
                </option>

                <option value="RESOLUE">
                  Résolue
                </option>

              </select>


              <div
                className="
                  rounded-xl
                  bg-red-50
                  px-3
                  py-2
                  text-xs
                  font-bold
                  text-red-700
                "
              >
                {
                  totalNouvelles
                } nouvelle(s)
              </div>


              <div
                className="
                  rounded-xl
                  bg-slate-100
                  px-3
                  py-2
                  text-xs
                  font-bold
                  text-slate-600
                "
              >
                {
                  anomalies.length
                } résultat(s)
              </div>

            </div>

          </div>

        </section>


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


        <section
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
              overflow-x-auto
            "
          >

            <table
              className="
                min-w-[1200px]
                w-full
                text-left
              "
            >

              <thead
                className="
                  bg-slate-50
                "
              >

                <tr
                  className="
                    border-b
                    border-slate-100
                  "
                >

                  <th className="
                    px-5 py-4 text-xs font-bold uppercase tracking-wide text-slate-500
                  ">
                    Compteur
                  </th>

                  <th className="
                    px-5 py-4 text-xs font-bold uppercase tracking-wide text-slate-500
                  ">
                    Abonné
                  </th>

                  <th className="
                    px-5 py-4 text-xs font-bold uppercase tracking-wide text-slate-500
                  ">
                    Anomalie
                  </th>

                  <th className="
                    px-5 py-4 text-xs font-bold uppercase tracking-wide text-slate-500
                  ">
                    Consommation
                  </th>

                  <th className="
                    px-5 py-4 text-xs font-bold uppercase tracking-wide text-slate-500
                  ">
                    Variation
                  </th>

                  <th className="
                    px-5 py-4 text-xs font-bold uppercase tracking-wide text-slate-500
                  ">
                    Date
                  </th>

                  <th className="
                    px-5 py-4 text-xs font-bold uppercase tracking-wide text-slate-500
                  ">
                    Statut
                  </th>

                </tr>

              </thead>


              <tbody
                className="
                  divide-y
                  divide-slate-100
                "
              >

                {loading ? (

                  <tr>

                    <td
                      colSpan="7"
                      className="
                        px-5
                        py-14
                        text-center
                        text-sm
                        text-slate-500
                      "
                    >
                      Chargement…
                    </td>

                  </tr>

                ) : anomalies.length ===
                  0 ? (

                  <tr>

                    <td
                      colSpan="7"
                      className="
                        px-5
                        py-14
                        text-center
                        text-sm
                        text-slate-500
                      "
                    >
                      Aucune anomalie
                      correspondant aux filtres.
                    </td>

                  </tr>

                ) : (

                  anomalies.map(
                    (
                      item
                    ) => (

                      <tr
                        key={
                          item.id
                        }
                        className="
                          hover:bg-slate-50
                        "
                      >

                        <td
                          className="
                            px-5
                            py-4
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
                              className={`
                                rounded-xl
                                p-2.5
                                ${
                                  String(
                                    item.type_compteur ||
                                    ''
                                  ).toUpperCase() ===
                                  'EAU'
                                    ? `
                                      bg-cyan-50
                                      text-cyan-600
                                    `
                                    : `
                                      bg-amber-50
                                      text-amber-600
                                    `
                                }
                              `}
                            >

                              {
                                String(
                                  item.type_compteur ||
                                  ''
                                ).toUpperCase() ===
                                'EAU'
                                  ? (
                                    <Droplets
                                      size={18}
                                    />
                                  )
                                  : (
                                    <Zap
                                      size={18}
                                    />
                                  )
                              }

                            </div>


                            <div>

                              <p
                                className="
                                  font-bold
                                  text-slate-800
                                "
                              >
                                {
                                  item.numero_compteur
                                }
                              </p>

                              <p
                                className="
                                  text-xs
                                  text-slate-400
                                "
                              >
                                {
                                  String(
                                    item.type_compteur ||
                                    ''
                                  ).toUpperCase() ===
                                  'EAU'
                                    ? 'Eau'
                                    : 'Électricité'
                                }
                              </p>

                            </div>

                          </div>

                        </td>


                        <td
                          className="
                            px-5
                            py-4
                          "
                        >

                          <p
                            className="
                              text-sm
                              font-semibold
                              text-slate-700
                            "
                          >
                            {
                              item.abonne_nom_complet ||
                              '—'
                            }
                          </p>

                          <p
                            className="
                              text-xs
                              text-slate-400
                            "
                          >
                            {
                              item.numero_abonne ||
                              '—'
                            }
                          </p>

                        </td>


                        <td
                          className="
                            px-5
                            py-4
                          "
                        >

                          <div
                            className="
                              space-y-2
                            "
                          >

                            <div
                              className="
                                flex
                                items-center
                                gap-2
                              "
                            >

                              <TriangleAlert
                                size={16}
                                className="
                                  text-red-500
                                "
                              />

                              <span
                                className="
                                  text-sm
                                  font-bold
                                  text-slate-800
                                "
                              >
                                {
                                  item.type_anomalie ||
                                  '—'
                                }
                              </span>

                            </div>


                            <LevelBadge
                              value={
                                item.niveau
                              }
                            />

                          </div>

                        </td>


                        <td
                          className="
                            px-5
                            py-4
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
                                item.valeur
                              )
                            }
                            {' '}
                            {
                              item.unite ||
                              ''
                            }
                          </p>


                          <p
                            className="
                              mt-1
                              text-xs
                              text-slate-400
                            "
                          >
                            Référence :
                            {' '}
                            {
                              formatNumber(
                                item.valeur_reference
                              )
                            }
                            {' '}
                            {
                              item.unite ||
                              ''
                            }
                          </p>

                        </td>


                        <td
                          className="
                            px-5
                            py-4
                          "
                        >

                          <p
                            className={`
                              text-sm
                              font-black
                              ${
                                Number(
                                  item.variation
                                ) >= 0
                                  ? 'text-red-600'
                                  : 'text-blue-600'
                              }
                            `}
                          >

                            {
                              Number(
                                item.variation
                              ) >= 0
                                ? '+'
                                : ''
                            }

                            {
                              formatNumber(
                                item.variation
                              )
                            }
                            %

                          </p>


                          <p
                            className="
                              mt-1
                              text-xs
                              text-slate-400
                            "
                          >
                            {
                              item.direction ||
                              '—'
                            }
                          </p>

                        </td>


                        <td
                          className="
                            px-5
                            py-4
                          "
                        >

                          <div
                            className="
                              flex
                              items-center
                              gap-2
                              text-sm
                              text-slate-600
                            "
                          >

                            <CalendarDays
                              size={15}
                              className="
                                text-slate-400
                              "
                            />

                            {
                              formatDate(
                                item.date_detection ||
                                item.date_releve
                              )
                            }

                          </div>

                        </td>


                        <td
                          className="
                            px-5
                            py-4
                          "
                        >

                          <StatusBadge
                            value={
                              item.statut
                            }
                          />

                        </td>

                      </tr>

                    )
                  )

                )}

              </tbody>

            </table>

          </div>

        </section>

      </div>

    </AgentLayout>

  );
}

export default AgentAnomaliesPage;