const pool = require('../config/db');

/* =========================================================
   UTILITAIRES
========================================================= */

function isValidDate(value) {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const date =
    new Date(
      `${value}T00:00:00Z`
    );

  return !Number.isNaN(
    date.getTime()
  );
}


function normalizeType(value) {
  const type =
    String(
      value || 'TOUS'
    )
      .trim()
      .toUpperCase();

  if (type === 'EAU') {
    return 'EAU';
  }

  if (
    type === 'ELECTRICITE' ||
    type === 'ÉLECTRICITÉ'
  ) {
    return 'ELECTRICITE';
  }

  return 'TOUS';
}


function toNumber(value) {
  const number =
    Number(value);

  return Number.isFinite(
    number
  )
    ? number
    : 0;
}


function round2(value) {
  return Number(
    toNumber(value).toFixed(2)
  );
}


/* =========================================================
   CONSTRUCTION DES FILTRES
========================================================= */

function buildReleveFilters({
  dateDebut,
  dateFin,
  type,
}) {
  const conditions = [];
  const params = [];

  if (dateDebut) {

    params.push(
      dateDebut
    );

    conditions.push(
      `r.date_releve >= $${params.length}::date`
    );
  }


  if (dateFin) {

    params.push(
      dateFin
    );

    conditions.push(
      `r.date_releve < ($${params.length}::date + INTERVAL '1 day')`
    );
  }


  if (type !== 'TOUS') {

    params.push(
      type
    );

    conditions.push(
      `UPPER(TRIM(c.type)) = $${params.length}`
    );
  }


  return {
    conditions,
    params,
  };
}


function buildDateOnlyFilters({
  dateDebut,
  dateFin,
}) {
  const conditions = [];
  const params = [];


  if (dateDebut) {

    params.push(
      dateDebut
    );

    conditions.push(
      `r.date_releve >= $${params.length}::date`
    );
  }


  if (dateFin) {

    params.push(
      dateFin
    );

    conditions.push(
      `r.date_releve < ($${params.length}::date + INTERVAL '1 day')`
    );
  }


  return {
    conditions,
    params,
  };
}


function buildWhere(
  conditions
) {
  if (
    conditions.length === 0
  ) {
    return '';
  }

  return `
    WHERE ${conditions.join(
      '\n      AND '
    )}
  `;
}


/* =========================================================
   GET /api/graphiques
========================================================= */

async function getGraphiques(
  req,
  res
) {
  try {

    const dateDebut =
      req.query.dateDebut
        ? String(
            req.query.dateDebut
          ).trim()
        : '';


    const dateFin =
      req.query.dateFin
        ? String(
            req.query.dateFin
          ).trim()
        : '';


    const type =
      normalizeType(
        req.query.type
      );


    /* =====================================================
       VALIDATION DES DATES
    ===================================================== */

    if (
      dateDebut &&
      !isValidDate(
        dateDebut
      )
    ) {

      return res.status(
        400
      ).json({

        status:
          'error',

        message:
          'La date de début est invalide. Format attendu : YYYY-MM-DD.',

      });
    }


    if (
      dateFin &&
      !isValidDate(
        dateFin
      )
    ) {

      return res.status(
        400
      ).json({

        status:
          'error',

        message:
          'La date de fin est invalide. Format attendu : YYYY-MM-DD.',

      });
    }


    if (
      dateDebut &&
      dateFin &&
      dateDebut > dateFin
    ) {

      return res.status(
        400
      ).json({

        status:
          'error',

        message:
          'La date de début doit être antérieure ou égale à la date de fin.',

      });
    }


    /* =====================================================
       FILTRES PRINCIPAUX
    ===================================================== */

    const filters =
      buildReleveFilters({

        dateDebut,

        dateFin,

        type,

      });


    const where =
      buildWhere(
        filters.conditions
      );


    /* =====================================================
       1. RÉSUMÉ PAR TYPE
    ===================================================== */

    const summaryResult =
      await pool.query(

        `
          SELECT

            UPPER(
              TRIM(c.type)
            ) AS type,


            COUNT(
              r.id
            ) AS nombre_releves,


            COUNT(
              DISTINCT r.compteur_id
            ) AS nombre_compteurs,


            COUNT(
              DISTINCT c.abonne_id
            ) AS nombre_abonnes,


            COALESCE(
              SUM(
                r.consommation
              ),
              0
            ) AS total,


            COALESCE(
              AVG(
                r.consommation
              ),
              0
            ) AS moyenne,


            COALESCE(
              MAX(
                r.consommation
              ),
              0
            ) AS maximum,


            COALESCE(
              MIN(
                r.consommation
              ),
              0
            ) AS minimum


          FROM releves r


          INNER JOIN compteurs c

            ON c.id =
               r.compteur_id


          ${where}


          GROUP BY
            UPPER(
              TRIM(c.type)
            )


          ORDER BY
            UPPER(
              TRIM(c.type)
            ) ASC
        `,

        filters.params
      );


    /* =====================================================
       2. ÉVOLUTION MENSUELLE DES CONSOMMATIONS
    ===================================================== */

    const evolutionResult =
      await pool.query(

        `
          SELECT

            TO_CHAR(
              DATE_TRUNC(
                'month',
                r.date_releve
              ),
              'YYYY-MM'
            ) AS mois,


            /* EAU */

            COALESCE(

              SUM(

                CASE

                  WHEN UPPER(
                    TRIM(c.type)
                  ) = 'EAU'

                  THEN r.consommation

                  ELSE 0

                END

              ),

              0

            ) AS eau,


            /* ELECTRICITE */

            COALESCE(

              SUM(

                CASE

                  WHEN UPPER(
                    TRIM(c.type)
                  ) = 'ELECTRICITE'

                  THEN r.consommation

                  ELSE 0

                END

              ),

              0

            ) AS electricite,


            /* MOYENNE EAU */

            COALESCE(

              AVG(

                CASE

                  WHEN UPPER(
                    TRIM(c.type)
                  ) = 'EAU'

                  THEN r.consommation

                END

              ),

              0

            ) AS moyenne_eau,


            /* MOYENNE ELECTRICITE */

            COALESCE(

              AVG(

                CASE

                  WHEN UPPER(
                    TRIM(c.type)
                  ) = 'ELECTRICITE'

                  THEN r.consommation

                END

              ),

              0

            ) AS moyenne_electricite,


            /* NOMBRE RELEVES EAU */

            COUNT(

              CASE

                WHEN UPPER(
                  TRIM(c.type)
                ) = 'EAU'

                THEN r.id

              END

            ) AS releves_eau,


            /* NOMBRE RELEVES ELECTRICITE */

            COUNT(

              CASE

                WHEN UPPER(
                  TRIM(c.type)
                ) = 'ELECTRICITE'

                THEN r.id

              END

            ) AS releves_electricite


          FROM releves r


          INNER JOIN compteurs c

            ON c.id =
               r.compteur_id


          ${where}


          GROUP BY
            DATE_TRUNC(
              'month',
              r.date_releve
            )


          ORDER BY
            DATE_TRUNC(
              'month',
              r.date_releve
            ) ASC
        `,

        filters.params
      );


    /* =====================================================
       3. RÉPARTITION DU NOMBRE DE RELEVÉS
    ===================================================== */

    const repartitionFilters =
      buildDateOnlyFilters({

        dateDebut,

        dateFin,

      });


    const repartitionWhere =
      buildWhere(
        repartitionFilters.conditions
      );


    const repartitionResult =
      await pool.query(

        `
          SELECT

            UPPER(
              TRIM(c.type)
            ) AS type,


            COUNT(
              r.id
            ) AS nombre_releves


          FROM releves r


          INNER JOIN compteurs c

            ON c.id =
               r.compteur_id


          ${repartitionWhere}


          GROUP BY
            UPPER(
              TRIM(c.type)
            )


          ORDER BY
            nombre_releves DESC
        `,

        repartitionFilters.params
      );


    /* =====================================================
       4. STATISTIQUES GLOBALES
    ===================================================== */

    const globalResult =
      await pool.query(

        `
          SELECT

            COUNT(
              r.id
            ) AS nombre_releves,


            COUNT(
              DISTINCT r.compteur_id
            ) AS nombre_compteurs,


            COUNT(
              DISTINCT c.abonne_id
            ) AS nombre_abonnes


          FROM releves r


          INNER JOIN compteurs c

            ON c.id =
               r.compteur_id


          ${where}
        `,

        filters.params
      );


    /* =====================================================
       5. TOP 5 COMPTEURS EAU
    ===================================================== */

    const waterFilters =
      buildReleveFilters({

        dateDebut,

        dateFin,

        type:
          'EAU',

      });


    const waterWhere =
      buildWhere(
        waterFilters.conditions
      );


    const topWaterResult =
      await pool.query(

        `
          SELECT

            c.id,

            c.numero_compteur,


            TRIM(
              CONCAT_WS(
                ' ',
                a.nom,
                a.prenom
              )
            ) AS abonne,


            COUNT(
              r.id
            ) AS nombre_releves,


            COALESCE(
              SUM(
                r.consommation
              ),
              0
            ) AS total_consommation,


            COALESCE(
              AVG(
                r.consommation
              ),
              0
            ) AS moyenne_consommation


          FROM releves r


          INNER JOIN compteurs c

            ON c.id =
               r.compteur_id


          INNER JOIN abonnes a

            ON a.id =
               c.abonne_id


          ${waterWhere}


          GROUP BY

            c.id,

            c.numero_compteur,

            a.nom,

            a.prenom


          ORDER BY

            total_consommation DESC


          LIMIT 5
        `,

        waterFilters.params
      );


    /* =====================================================
       6. TOP 5 COMPTEURS ELECTRICITE
    ===================================================== */

    const electricityFilters =
      buildReleveFilters({

        dateDebut,

        dateFin,

        type:
          'ELECTRICITE',

      });


    const electricityWhere =
      buildWhere(
        electricityFilters.conditions
      );


    const topElectricityResult =
      await pool.query(

        `
          SELECT

            c.id,

            c.numero_compteur,


            TRIM(
              CONCAT_WS(
                ' ',
                a.nom,
                a.prenom
              )
            ) AS abonne,


            COUNT(
              r.id
            ) AS nombre_releves,


            COALESCE(
              SUM(
                r.consommation
              ),
              0
            ) AS total_consommation,


            COALESCE(
              AVG(
                r.consommation
              ),
              0
            ) AS moyenne_consommation


          FROM releves r


          INNER JOIN compteurs c

            ON c.id =
               r.compteur_id


          INNER JOIN abonnes a

            ON a.id =
               c.abonne_id


          ${electricityWhere}


          GROUP BY

            c.id,

            c.numero_compteur,

            a.nom,

            a.prenom


          ORDER BY

            total_consommation DESC


          LIMIT 5
        `,

        electricityFilters.params
      );


    /* =====================================================
       7. ÉVOLUTION DU NOMBRE DE RELEVÉS
    ===================================================== */

    const readingsEvolutionResult =
      await pool.query(

        `
          SELECT

            TO_CHAR(
              DATE_TRUNC(
                'month',
                r.date_releve
              ),
              'YYYY-MM'
            ) AS mois,


            COUNT(
              r.id
            ) AS nombre_releves


          FROM releves r


          INNER JOIN compteurs c

            ON c.id =
               r.compteur_id


          ${where}


          GROUP BY
            DATE_TRUNC(
              'month',
              r.date_releve
            )


          ORDER BY
            DATE_TRUNC(
              'month',
              r.date_releve
            ) ASC
        `,

        filters.params
      );


    /* =====================================================
       8. STRUCTURE PAR TYPE
    ===================================================== */

    const parType = {

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


    summaryResult.rows.forEach(
      (item) => {

        const key =
          normalizeType(
            item.type
          );


        if (
          key !== 'EAU' &&
          key !==
            'ELECTRICITE'
        ) {
          return;
        }


        parType[key] = {

          nombreReleves:
            toNumber(
              item.nombre_releves
            ),

          nombreCompteurs:
            toNumber(
              item.nombre_compteurs
            ),

          nombreAbonnes:
            toNumber(
              item.nombre_abonnes
            ),

          total:
            round2(
              item.total
            ),

          moyenne:
            round2(
              item.moyenne
            ),

          maximum:
            round2(
              item.maximum
            ),

          minimum:
            round2(
              item.minimum
            ),

          unite:
            key === 'EAU'
              ? 'm³'
              : 'kWh',

        };
      }
    );


    /* =====================================================
       9. ÉVOLUTION
    ===================================================== */

    const evolution =
      evolutionResult.rows.map(
        (item) => ({

          mois:
            item.mois,

          eau:
            round2(
              item.eau
            ),

          electricite:
            round2(
              item.electricite
            ),

          moyenneEau:
            round2(
              item.moyenne_eau
            ),

          moyenneElectricite:
            round2(
              item.moyenne_electricite
            ),

          relevesEau:
            toNumber(
              item.releves_eau
            ),

          relevesElectricite:
            toNumber(
              item.releves_electricite
            ),

        })
      );


    /* =====================================================
       10. RÉPARTITION
    ===================================================== */

    const repartition =
      repartitionResult.rows.map(
        (item) => {

          const normalized =
            normalizeType(
              item.type
            );


          return {

            type:
              normalized,

            label:
              normalized ===
              'EAU'

                ? 'Eau'

                : normalized ===
                    'ELECTRICITE'

                  ? 'Électricité'

                  : item.type,

            nombreReleves:
              toNumber(
                item.nombre_releves
              ),

          };
        }
      );


    /* =====================================================
       11. TOP EAU
    ===================================================== */

    const topCompteursEau =
      topWaterResult.rows.map(
        (item) => ({

          id:
            toNumber(
              item.id
            ),

          compteur:
            item.numero_compteur,

          abonne:
            item.abonne,

          nombreReleves:
            toNumber(
              item.nombre_releves
            ),

          total:
            round2(
              item.total_consommation
            ),

          moyenne:
            round2(
              item.moyenne_consommation
            ),

          unite:
            'm³',

        })
      );


    /* =====================================================
       12. TOP ELECTRICITÉ
    ===================================================== */

    const topCompteursElectricite =
      topElectricityResult.rows.map(
        (item) => ({

          id:
            toNumber(
              item.id
            ),

          compteur:
            item.numero_compteur,

          abonne:
            item.abonne,

          nombreReleves:
            toNumber(
              item.nombre_releves
            ),

          total:
            round2(
              item.total_consommation
            ),

          moyenne:
            round2(
              item.moyenne_consommation
            ),

          unite:
            'kWh',

        })
      );


    /* =====================================================
       13. ÉVOLUTION DES RELEVÉS
    ===================================================== */

    const evolutionReleves =
      readingsEvolutionResult.rows.map(
        (item) => ({

          mois:
            item.mois,

          nombreReleves:
            toNumber(
              item.nombre_releves
            ),

        })
      );


    /* =====================================================
       14. GLOBAL
    ===================================================== */

    const global =
      globalResult.rows[0] ||
      {};


    /* =====================================================
       15. RÉPONSE
    ===================================================== */

    return res.status(
      200
    ).json({

      status:
        'success',


      periode: {

        dateDebut:
          dateDebut ||
          null,

        dateFin:
          dateFin ||
          null,

        type,

        libelleType:
          type === 'EAU'
            ? 'Eau'
            : type ===
                'ELECTRICITE'
              ? 'Électricité'
              : 'Eau + Électricité',

      },


      global: {

        nombreReleves:
          toNumber(
            global.nombre_releves
          ),

        nombreCompteurs:
          toNumber(
            global.nombre_compteurs
          ),

        nombreAbonnes:
          toNumber(
            global.nombre_abonnes
          ),

      },


      parType,


      evolution,


      evolutionReleves,


      repartition,


      topCompteursEau,


      topCompteursElectricite,

    });


  } catch (error) {

    console.error(
      'Erreur getGraphiques :',
      error
    );


    return res.status(
      500
    ).json({

      status:
        'error',

      message:
        'Impossible de récupérer les données des graphiques.',

    });
  }
}


module.exports = {
  getGraphiques,
};