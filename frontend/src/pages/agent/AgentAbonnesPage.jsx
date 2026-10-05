import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  useNavigate,
} from 'react-router-dom';

import {
  Phone,
  Search,
  UserRound,
  Gauge,
  CalendarDays,
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


function StatusBadge({
  value,
}) {

  const active =
    String(value || '')
      .toLowerCase() ===
    'actif';


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


function AgentAbonnesPage() {

  const navigate =
    useNavigate();


  const [
    abonnes,
    setAbonnes,
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


  async function loadAbonnes() {

    try {

      setLoading(true);

      setError('');


      const response =
        await axiosClient.get(
          '/agent/abonnes'
        );


      if (
        response.data?.status !==
        'success'
      ) {

        throw new Error(
          response.data?.message ||
          'Impossible de charger les abonnés.'
        );

      }


      setAbonnes(
        response.data?.data ||
        []
      );

    } catch (
      requestError
    ) {

      console.error(
        'Erreur abonnés Agent :',
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
        'Erreur lors du chargement des abonnés.'
      );

    } finally {

      setLoading(false);

    }

  }


  useEffect(() => {

    loadAbonnes();

  }, []);


  const filteredAbonnes =
    useMemo(() => {

      const query =
        search
          .trim()
          .toLowerCase();


      if (!query) {
        return abonnes;
      }


      return abonnes.filter(
        (
          item
        ) => {

          const text =
            [
              item.numero_abonne,
              item.nom,
              item.prenom,
              item.adresse,
              item.telephone,
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
      abonnes,
      search,
    ]);


  return (

    <AgentLayout
      title="Abonnés"
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
                Abonnés
              </h2>

              <p
                className="
                  mt-2
                  text-sm
                  text-slate-500
                "
              >
                Consultez les informations
                nécessaires avant la saisie
                du relevé.
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
                  Rechercher un abonné…
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
                filteredAbonnes.length
              } abonné(s)
            </p>

          </div>


          <div
            className="
              overflow-x-auto
            "
          >

            <table
              className="
                min-w-[950px]
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
                    Contact
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
                    Adresse
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
                    Compteurs
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
                      colSpan="6"
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

                ) : filteredAbonnes.length ===
                  0 ? (

                  <tr>

                    <td
                      colSpan="6"
                      className="
                        px-5
                        py-14
                        text-center
                        text-sm
                        text-slate-500
                      "
                    >
                      Aucun abonné trouvé.
                    </td>

                  </tr>

                ) : (

                  filteredAbonnes.map(
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
                              className="
                                rounded-xl
                                bg-blue-50
                                p-2.5
                                text-blue-600
                              "
                            >
                              <UserRound
                                size={18}
                              />
                            </div>


                            <div>

                              <p
                                className="
                                  font-bold
                                  text-slate-800
                                "
                              >
                                {
                                  `${
                                    item.prenom ||
                                    ''
                                  } ${
                                    item.nom ||
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

                            </div>

                          </div>

                        </td>


                        <td
                          className="
                            px-5
                            py-4
                          "
                        >

                          {item.telephone ? (

                            <div
                              className="
                                flex
                                items-center
                                gap-2
                                text-sm
                                font-semibold
                                text-slate-700
                              "
                            >

                              <Phone
                                size={16}
                                className="
                                  text-slate-400
                                "
                              />

                              {
                                item.telephone
                              }

                            </div>

                          ) : (

                            <span
                              className="
                                text-sm
                                text-slate-400
                              "
                            >
                              Non renseigné
                            </span>

                          )}

                        </td>


                        <td
                          className="
                            px-5
                            py-4
                            text-sm
                            text-slate-600
                          "
                        >
                          {
                            item.adresse ||
                            'Adresse non renseignée'
                          }
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
                              font-bold
                              text-slate-700
                            "
                          >

                            <Gauge
                              size={16}
                              className="
                                text-slate-400
                              "
                            />

                            {
                              item.nombre_compteurs ||
                              0
                            }

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
                                item.dernier_releve
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

export default AgentAbonnesPage;