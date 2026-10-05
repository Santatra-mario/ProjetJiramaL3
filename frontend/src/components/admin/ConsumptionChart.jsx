import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';


import {
  TrendingUp,
} from 'lucide-react';


function ConsumptionChart({

  data = [],

  title =
    'Évolution des consommations',

  description =
    "Suivi mensuel de l'eau et de l'électricité",

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

      {/* =================================================
          HEADER
      ================================================= */}

      <div
        className="
          mb-6
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
            {
              title
            }
          </h2>


          <p
            className="
              mt-1
              text-xs
              text-slate-500
            "
          >
            {
              description
            }
          </p>

        </div>


        <div
          className="
            rounded-xl
            bg-blue-50
            p-2.5
          "
        >

          <TrendingUp

            size={
              20
            }

            className=
              "text-blue-600"

          />

        </div>

      </div>


      {/* =================================================
          GRAPHIQUE
      ================================================= */}

      <div
        className="
          h-[320px]
          w-full
        "
      >

        {
          data.length === 0

            ? (

              <div
                className="
                  flex
                  h-full
                  items-center
                  justify-center
                  text-sm
                  text-slate-400
                "
              >
                Aucune donnée disponible.
              </div>

            )

            : (

              <ResponsiveContainer
                width="100%"
                height="100%"
              >

                <LineChart

                  data={
                    data
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

                  {/* GRILLE */}

                  <CartesianGrid

                    strokeDasharray=
                      "3 3"

                    stroke=
                      "#e2e8f0"

                  />


                  {/* AXE X */}

                  <XAxis

                    dataKey=
                      "mois"

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


                  {/* AXE Y */}

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


                  {/* TOOLTIP */}

                  <Tooltip

                    formatter={
                      (
                        value,
                        name
                      ) => [

                        `${Number(
                          value
                        ).toLocaleString(
                          'fr-FR'
                        )} ${
                          name === 'Eau'
                            ? 'm³'
                            : 'kWh'
                        }`,

                        name,

                      ]
                    }

                  />


                  {/* LÉGENDE */}

                  <Legend />


                  {/* EAU */}

                  <Line

                    type="monotone"

                    dataKey="eau"

                    name="Eau"

                    stroke="#0891b2"

                    strokeWidth={
                      3
                    }

                    dot={{
                      r: 4,
                    }}

                    activeDot={{
                      r: 6,
                    }}

                  />


                  {/* ÉLECTRICITÉ */}

                  <Line

                    type="monotone"

                    dataKey=
                      "electricite"

                    name="Électricité"

                    stroke="#f59e0b"

                    strokeWidth={
                      3
                    }

                    dot={{
                      r: 4,
                    }}

                    activeDot={{
                      r: 6,
                    }}

                  />

                </LineChart>

              </ResponsiveContainer>

            )
        }

      </div>

    </section>
  );
}


export default ConsumptionChart;