import {
  useMemo,
  useState,
} from 'react';


import {
  Search,
  Droplets,
  Zap,
  CheckCircle2,
  Clock3,
} from 'lucide-react';


function RecentReadings({

  readings = [],

  onViewAll,

}) {


  const [
    search,
    setSearch,
  ] = useState('');


  /* =======================================================
     RECHERCHE
  ======================================================= */

  const filteredReadings =
    useMemo(
      () => {

        const value =
          search
            .trim()
            .toLowerCase();


        if (!value) {
          return readings;
        }


        return readings.filter(
          (reading) =>

            [

              reading.compteur,

              reading.type,

              reading.abonne,

              reading.date,

              reading.consommation,

              reading.unite,

              reading.statut,

            ].some(
              (field) =>

                String(
                  field ?? ''
                )

                  .toLowerCase()

                  .includes(
                    value
                  )

            )
        );

      },

      [
        readings,
        search,
      ]
    );


  return (

    <section
      className="
        overflow-hidden
        rounded-2xl
        border
        border-slate-200
        bg-white
        shadow-sm
      "
    >

      {/* =================================================
          HEADER
      ================================================= */}

      <div
        className="
          flex
          flex-col
          justify-between
          gap-4
          border-b
          border-slate-200
          p-5
          sm:p-6
          lg:flex-row
          lg:items-center
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
            Derniers relevés
          </h2>


          <p
            className="
              mt-1
              text-xs
              text-slate-500
            "
          >
            Les cinq derniers relevés enregistrés
            dans la base.
          </p>

        </div>


        {/* RECHERCHE */}

        <div
          className="
            relative
            w-full
            lg:w-80
          "
        >

          <Search

            size={
              18
            }

            className="
              absolute
              left-3.5
              top-1/2
              -translate-y-1/2
              text-slate-400
            "

          />


          <input

            type="text"

            value={
              search
            }

            onChange={
              (e) =>
                setSearch(
                  e.target.value
                )
            }

            placeholder=
              "Rechercher un relevé..."

            className="
              w-full
              rounded-xl
              border
              border-slate-300
              bg-slate-50
              py-3
              pl-10
              pr-4
              text-sm
              outline-none
              transition
              placeholder:text-slate-400
              focus:border-blue-600
              focus:bg-white
              focus:ring-4
              focus:ring-blue-100
            "

          />

        </div>

      </div>


      {/* =================================================
          TABLEAU
      ================================================= */}

      <div
        className="
          overflow-x-auto
        "
      >

        <table
          className="
            min-w-[900px]
            w-full
          "
        >

          <thead
            className="
              bg-slate-50
            "
          >

            <tr>

              <th
                className="
                  px-5
                  py-4
                  text-left
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
                  text-left
                  text-xs
                  font-bold
                  uppercase
                  tracking-wide
                  text-slate-500
                "
              >
                Type
              </th>


              <th
                className="
                  px-5
                  py-4
                  text-left
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
                  text-left
                  text-xs
                  font-bold
                  uppercase
                  tracking-wide
                  text-slate-500
                "
              >
                Date
              </th>


              <th
                className="
                  px-5
                  py-4
                  text-left
                  text-xs
                  font-bold
                  uppercase
                  tracking-wide
                  text-slate-500
                "
              >
                Consommation
              </th>


              <th
                className="
                  px-5
                  py-4
                  text-left
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

            {
              filteredReadings.length >
              0

                ? (

                  filteredReadings.map(
                    (reading) => (

                      <tr

                        key={
                          reading.id
                        }

                        className="
                          transition
                          hover:bg-slate-50
                        "
                      >

                        {/* COMPTEUR */}

                        <td
                          className="
                            px-5
                            py-4
                            text-sm
                            font-semibold
                            text-slate-800
                          "
                        >
                          {
                            reading.compteur
                          }
                        </td>


                        {/* TYPE */}

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
                            "
                          >

                            {
                              reading.type ===
                              'Eau'

                                ? (

                                  <div
                                    className="
                                      rounded-lg
                                      bg-cyan-50
                                      p-2
                                    "
                                  >

                                    <Droplets

                                      size={
                                        15
                                      }

                                      className=
                                        "text-cyan-600"

                                    />

                                  </div>

                                )

                                : (

                                  <div
                                    className="
                                      rounded-lg
                                      bg-amber-50
                                      p-2
                                    "
                                  >

                                    <Zap

                                      size={
                                        15
                                      }

                                      className=
                                        "text-amber-600"

                                    />

                                  </div>

                                )
                            }


                            <span
                              className="
                                text-sm
                                text-slate-600
                              "
                            >
                              {
                                reading.type
                              }
                            </span>

                          </div>

                        </td>


                        {/* ABONNÉ */}

                        <td
                          className="
                            px-5
                            py-4
                            text-sm
                            text-slate-600
                          "
                        >
                          {
                            reading.abonne
                          }
                        </td>


                        {/* DATE */}

                        <td
                          className="
                            px-5
                            py-4
                            text-sm
                            text-slate-500
                          "
                        >
                          {
                            reading.date
                          }
                        </td>


                        {/* CONSOMMATION */}

                        <td
                          className="
                            px-5
                            py-4
                            text-sm
                            font-semibold
                            text-slate-800
                          "
                        >

                          {
                            Number(
                              reading.consommation ??
                              0
                            ).toLocaleString(
                              'fr-FR'
                            )
                          }

                          {' '}

                          {
                            reading.unite ||

                            (
                              reading.type ===
                              'Eau'

                                ? 'm³'

                                : 'kWh'
                            )
                          }

                        </td>


                        {/* STATUT */}

                        <td
                          className="
                            px-5
                            py-4
                          "
                        >

                          <StatusBadge
                            status={
                              reading.statut
                            }
                          />

                        </td>

                      </tr>

                    )
                  )

                )

                : (

                  <tr>

                    <td

                      colSpan="6"

                      className="
                        px-5
                        py-12
                        text-center
                        text-sm
                        text-slate-500
                      "
                    >

                      {
                        search

                          ? 'Aucun relevé ne correspond à la recherche.'

                          : 'Aucun relevé trouvé.'
                      }

                    </td>

                  </tr>

                )
            }

          </tbody>

        </table>

      </div>


      {/* =================================================
          PIED
      ================================================= */}

      <div
        className="
          flex
          flex-col
          justify-between
          gap-3
          border-t
          border-slate-200
          px-5
          py-4
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
          {
            filteredReadings.length
          }
          {' '}
          relevé(s) affiché(s)
        </p>


        <button

          type="button"

          onClick={
            onViewAll
          }

          className="
            text-xs
            font-semibold
            text-blue-600
            transition
            hover:text-blue-700
            hover:underline
          "
        >

          Voir tous les relevés →

        </button>

      </div>

    </section>
  );
}


/* =========================================================
   BADGE STATUT
========================================================= */

function StatusBadge({
  status,
}) {

  const isToCheck =
    status ===
    'À vérifier';


  const isRecorded =
    status ===
    'Enregistré';


  const className =
    isToCheck

      ? 'bg-amber-50 text-amber-700'

      : isRecorded

        ? 'bg-emerald-50 text-emerald-700'

        : 'bg-slate-100 text-slate-700';


  const Icon =
    isToCheck
      ? Clock3
      : CheckCircle2;


  return (

    <span
      className={`
        inline-flex
        items-center
        gap-1.5
        rounded-full
        px-3
        py-1.5
        text-xs
        font-semibold
        ${className}
      `}
    >

      <Icon
        size={
          13
        }
      />

      {
        status ||
        'Enregistré'
      }

    </span>
  );
}


export default RecentReadings;