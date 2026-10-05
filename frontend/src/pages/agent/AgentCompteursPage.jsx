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
  ClipboardList,
  Droplets,
  Search,
  UserRound,
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
          maximumFractionDigits:
            2,
        }
      )
    : '—';
}


function StatusBadge({
  value,
}) {

  const active =
    String(value || '')
      .toUpperCase() ===
    'ACTIF';


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
          active
            ? `
              border-emerald-200
              bg-emerald-50
              text-emerald-700
            `
            : `
              border-slate-200
              bg-slate-50
              text-slate-500
            `
        }
      `}
    >
      {value || '—'}
    </span>

  );
}


function AgentCompteursPage() {

  const navigate =
    useNavigate();


  const [
    compteurs,
    setCompteurs,
  ] =
    useState([]);


  const [
    search,
    setSearch,
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


  async function loadCompteurs() {

    try {

      setLoading(true);

      setError('');


      const response =
        await axiosClient.get(
          '/agent/compteurs'
        );


      if (
        response.data?.status !==
        'success'
      ) {

        throw new Error(
          response.data?.message ||
          'Impossible de charger les compteurs.'
        );

      }


      setCompteurs(
        response.data?.data ||
        []
      );

    } catch (
      requestError
    ) {

      console.error(
        'Erreur compteurs Agent :',
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
        'Erreur lors du chargement des compteurs.'
      );

    } finally {

      setLoading(false);

    }

  }


  useEffect(() => {

    loadCompteurs();

  }, []);


  const filteredCompteurs =
    useMemo(() => {

      const query =
        search
          .trim()
          .toLowerCase();


      if (!query) {
        return compteurs;
      }


      return compteurs.filter(
        (
          item
        ) => {

          const text =
            [
              item.numero_compteur,
              item.type,
              item.numero_abonne,
              item.abonne_nom,
              item.abonne_prenom,
              item.abonne_adresse,
            ]
              .filter(Boolean)
              .join(' ')
              .toLowerCase();


          return text.includes(
            query
          );

        }
      );

    }, [
      compteurs,
      search,
    ]);


  return (

    <AgentLayout
      title="Compteurs"
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
              justify-between
              gap-5
              lg:flex-row
              lg:items-center
            "
          >

            <div>

              <p
                className="
                  text-xs
                  font-bold
                  uppercase
                  tracking-[0.16em]
                  text-blue-600
                "
              >
                Consultation
              </p>

              <h2
                className="
                  mt-1
                  text-2xl
                  font-black
                  text-slate-900
                "
              >
                Compteurs disponibles
              </h2>

              <p
                className="
                  mt-2
                  text-sm
                  text-slate-500
                "
              >
                Consultez les compteurs
                et accédez directement
                à la saisie d’un relevé.
              </p>

            </div>


            <div
              className="
                relative
                w-full
                max-w-md
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
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="
                  Rechercher un compteur,
                  un abonné…
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
              border-b
              border-slate-100
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
                filteredCompteurs.length
              } compteur(s)
            </p>

          </div>


          <div
            className="
              overflow-x-auto
            "
          >

            <table
              className="
                min-w-[980px]
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

                  <th
                    className="
                      px-5
                      py-4
                      text-xs
                      font-bold
                      uppercase
                      tracking-wide
                      text-slate-500
                    "
                  >
                    Compteur
                  </th>

                  <th
                    className="
                      px-5
                      py-4
                      text-xs
                      font-bold
                      uppercase
                      tracking-wide
                      text-slate-500
                    "
                  >
                    Abonné
                  </th>

                  <th
                    className="
                      px-5
                      py-4
                      text-xs
                      font-bold
                      uppercase
                      tracking-wide
                      text-slate-500
                    "
                  >
                    Installation
                  </th>

                  <th
                    className="
                      px-5
                      py-4
                      text-xs
                      font-bold
                      uppercase
                      tracking-wide
                      text-slate-500
                    "
                  >
                    Dernier relevé
                  </th>

                  <th
                    className="
                      px-5
                      py-4
                      text-xs
                      font-bold
                      uppercase
                      tracking-wide
                      text-slate-500
                    "
                  >
                    Index
                  </th>

                  <th
                    className="
                      px-5
                      py-4
                      text-xs
                      font-bold
                      uppercase
                      tracking-wide
                      text-slate-500
                    "
                  >
                    Statut
                  </th>

                  <th
                    className="
                      px-5
                      py-4
                      text-right
                      text-xs
                      font-bold
                      uppercase
                      tracking-wide
                      text-slate-500
                    "
                  >
                    Action
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

                ) : filteredCompteurs.length ===
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
                      Aucun compteur trouvé.
                    </td>

                  </tr>

                ) : (

                  filteredCompteurs.map(
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
                                    item.type ||
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

                              {String(
                                item.type ||
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
                                )}

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
                                    item.type ||
                                    ''
                                  ).toUpperCase() ===
                                  'EAU'
                                    ? 'Eau · m³'
                                    : 'Électricité · kWh'
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

                          <div
                            className="
                              flex
                              items-start
                              gap-2
                            "
                          >

                            <UserRound
                              size={16}
                              className="
                                mt-0.5
                                text-slate-400
                              "
                            />


                            <div>

                              <p
                                className="
                                  text-sm
                                  font-semibold
                                  text-slate-700
                                "
                              >
                                {
                                  `${
                                    item.abonne_prenom ||
                                    ''
                                  } ${
                                    item.abonne_nom ||
                                    ''
                                  }`.trim()
                                ||
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


                              <p
                                className="
                                  mt-1
                                  text-xs
                                  text-slate-400
                                "
                              >
                                {
                                  item.abonne_adresse ||
                                  'Adresse non renseignée'
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
                              size={16}
                              className="
                                text-slate-400
                              "
                            />

                            {
                              formatDate(
                                item.date_installation
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

                          <p
                            className="
                              text-sm
                              font-semibold
                              text-slate-700
                            "
                          >
                            {
                              formatDate(
                                item.dernier_releve
                              )
                            }
                          </p>


                          <p
                            className="
                              mt-1
                              text-xs
                              text-slate-400
                            "
                          >
                            Dernière consommation :
                            {' '}
                            {
                              formatNumber(
                                item.derniere_consommation
                              )
                            }
                          </p>

                        </td>


                        <td
                          className="
                            px-5
                            py-4
                          "
                        >

                          <span
                            className="
                              font-black
                              text-slate-800
                            "
                          >
                            {
                              formatNumber(
                                item.dernier_index
                              )
                            }
                          </span>

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


                        <td
                          className="
                            px-5
                            py-4
                            text-right
                          "
                        >

                          <button
                            type="button"
                            onClick={() =>
                              navigate(
                                `/dashboard/agent/releves?compteur=${item.id}`
                              )
                            }
                            className="
                              inline-flex
                              items-center
                              gap-2
                              rounded-xl
                              bg-blue-600
                              px-3.5
                              py-2.5
                              text-xs
                              font-bold
                              text-white
                              hover:bg-blue-700
                            "
                          >

                            <ClipboardList
                              size={15}
                            />

                            Relever

                          </button>

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

export default AgentCompteursPage;