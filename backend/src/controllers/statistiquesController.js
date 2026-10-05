const pool = require('../config/db');


/* =========================================================
   UTILITAIRES
========================================================= */

/*
   Vérifie le format YYYY-MM-DD
*/
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


/*
   Normalise le type
*/
function normalizeType(value) {

  const type =
    String(
      value || 'TOUS'
    )
      .trim()
      .toUpperCase();


  if (
    type === 'EAU'
  ) {
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


/*
   Conversion sécurisée en nombre
*/
function toNumber(value) {

  const number =
    Number(value);


  return Number.isFinite(
    number
  )
    ? number
    : 0;
}


/*
   Arrondi à deux décimales
*/
function round2(value) {

  return Number(
    toNumber(
      value
    ).toFixed(2)
  );
}


/* =========================================================
   CONSTRUCTION DES FILTRES
========================================================= */

function buildFilters({
  dateDebut,
  dateFin,
  type,
}) {

  const conditions = [];

  const params = [];


  /*
    Date début
  */
  if (dateDebut) {

    params.push(
      dateDebut
    );


    conditions.push(
      `r.date_releve >= $${params.length}::date`
    );
  }


  /*
    Date fin
  */
  if (dateFin) {

    params.push(
      dateFin
    );


    conditions.push(
      `r.date_releve < ($${params.length}::date + INTERVAL '1 day')`
    );
  }


  /*
    Type
  */
  if (
    type !== 'TOUS'
  ) {

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


/*
   Construction du WHERE
*/
function buildWhere(
  conditions
) {

  if (
    conditions.length === 0
  ) {

    return '';
  }


  return `
    WHERE
      ${conditions.join(
        `
        AND
        `
      )}
  `;
}


/* =========================================================
   GET /api/statistiques
========================================================= */

async function getStatistiques(
  req,
  res
) {

  try {

    /*
    -------------------------------------------------------
    RÉCUPÉRATION DES PARAMÈTRES
    -------------------------------------------------------
    */

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


    /*
    -------------------------------------------------------
    VALIDATION DATE DÉBUT
    -------------------------------------------------------
    */

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


    /*
    -------------------------------------------------------
    VALIDATION DATE FIN
    -------------------------------------------------------
    */

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


    /*
    -------------------------------------------------------
    VALIDATION ORDRE DATES
    -------------------------------------------------------
    */

    if (
      dateDebut &&
      dateFin &&
      dateDebut >
        dateFin
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


    /*
    -------------------------------------------------------
    FILTRES PRINCIPAUX
    -------------------------------------------------------
    */

    const filters =
      buildFilters({

        dateDebut,

        dateFin,

        type,

      });


    const where =
      buildWhere(
        filters.conditions
      );


    /* =====================================================
       1. STATISTIQUES PRINCIPALES
    ===================================================== */

    const summaryResult =
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
            ) AS nombre_abonnes,


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
            ) AS consommation_moyenne,


            COALESCE(
              MAX(
                r.consommation
              ),
              0
            ) AS consommation_maximale,


            COALESCE(
              MIN(
                r.consommation
              ),
              0
            ) AS consommation_minimale,


            MIN(
              r.date_releve
            ) AS date_premier_releve,


            MAX(
              r.date_releve
            ) AS date_dernier_releve


          FROM releves r


          INNER JOIN compteurs c

            ON c.id =
               r.compteur_id


          ${where}
        `,

        filters.params
      );


    /* =====================================================
       2. STATISTIQUES PAR TYPE
    ===================================================== */

    const byTypeConditions = [];

    const byTypeParams = [];


    /*
       Dates seulement
       car nous voulons toujours
       Eau ET Electricité ici.
    */

    if (
      dateDebut
    ) {

      byTypeParams.push(
        dateDebut
      );


      byTypeConditions.push(
        `r.date_releve >= $${byTypeParams.length}::date`
      );
    }


    if (
      dateFin
    ) {

      byTypeParams.push(
        dateFin
      );


      byTypeConditions.push(
        `r.date_releve < ($${byTypeParams.length}::date + INTERVAL '1 day')`
      );
    }


    const byTypeWhere =
      buildWhere(
        byTypeConditions
      );


    const byTypeResult =
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


          ${byTypeWhere}


          GROUP BY

            UPPER(
              TRIM(c.type)
            )


          ORDER BY

            UPPER(
              TRIM(c.type)
            ) ASC
        `,

        byTypeParams
      );


    /* =====================================================
       3. ÉVOLUTION MENSUELLE
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


            /* ---------------------------------------------
               EAU
            --------------------------------------------- */

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


            /* ---------------------------------------------
               ELECTRICITE
            --------------------------------------------- */

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


            /* ---------------------------------------------
               MOYENNE EAU
            --------------------------------------------- */

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


            /* ---------------------------------------------
               MOYENNE ELECTRICITE
            --------------------------------------------- */

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


            /* ---------------------------------------------
               NOMBRE RELEVÉS EAU
            --------------------------------------------- */

            COUNT(

              CASE

                WHEN UPPER(
                  TRIM(c.type)
                ) = 'EAU'

                THEN r.id

              END

            ) AS releves_eau,


            /* ---------------------------------------------
               NOMBRE RELEVÉS ELECTRICITE
            --------------------------------------------- */

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
       4. COMPARAISON PÉRIODE PRÉCÉDENTE
    ===================================================== */

    let comparaison = {

      disponible:
        false,

      totalPrecedent:
        0,

      variationPourcentage:
        0,

      tendance:
        'stable',

    };


    /*
      La comparaison est calculée seulement
      lorsqu'un type précis et une période
      sont sélectionnés.
    */

    if (

      dateDebut &&

      dateFin &&

      type !== 'TOUS'

    ) {

      const debut =
        new Date(
          `${dateDebut}T00:00:00Z`
        );


      const fin =
        new Date(
          `${dateFin}T00:00:00Z`
        );


      const nombreJours =

        Math.floor(

          (
            fin.getTime() -
            debut.getTime()
          )

          /

          (
            1000 *
            60 *
            60 *
            24
          )

        ) + 1;


      const finPrecedente =
        new Date(

          debut.getTime() -

          24 *
          60 *
          60 *
          1000

        );


      const debutPrecedent =
        new Date(

          finPrecedente.getTime() -

          (
            nombreJours -
            1
          )

          *

          24 *
          60 *
          60 *
          1000

        );


      const debutPrecedentStr =
        debutPrecedent
          .toISOString()
          .slice(
            0,
            10
          );


      const finPrecedentStr =
        finPrecedente
          .toISOString()
          .slice(
            0,
            10
          );


      const previousResult =
        await pool.query(

          `
            SELECT

              COALESCE(
                SUM(
                  r.consommation
                ),
                0
              ) AS total_precedent


            FROM releves r


            INNER JOIN compteurs c

              ON c.id =
                 r.compteur_id


            WHERE

              r.date_releve >=
                $1::date


              AND r.date_releve <
                (
                  $2::date
                  +
                  INTERVAL '1 day'
                )


              AND UPPER(
                TRIM(c.type)
              ) = $3
          `,

          [

            debutPrecedentStr,

            finPrecedentStr,

            type,

          ]
        );


      const totalActuel =
        toNumber(

          summaryResult
            .rows[0]
            ?.total_consommation

        );


      const totalPrecedent =
        toNumber(

          previousResult
            .rows[0]
            ?.total_precedent

        );


      comparaison.disponible =
        true;


      comparaison.totalPrecedent =
        round2(
          totalPrecedent
        );


      /*
      ---------------------------------------------
      CALCUL VARIATION
      ---------------------------------------------
      */

      if (
        totalPrecedent > 0
      ) {

        const variation =

          (
            (
              totalActuel -
              totalPrecedent
            )

            /

            totalPrecedent

          ) *

          100;


        comparaison.variationPourcentage =
          round2(
            variation
          );


        if (
          variation > 0.01
        ) {

          comparaison.tendance =
            'hausse';

        } else if (
          variation < -0.01
        ) {

          comparaison.tendance =
            'baisse';

        } else {

          comparaison.tendance =
            'stable';
        }
      }
    }


    /* =====================================================
       5. STRUCTURE EAU / ELECTRICITÉ
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


    /*
      Remplissage avec PostgreSQL
    */

    byTypeResult.rows.forEach(
      (item) => {

        const key =
          normalizeType(
            item.type
          );


        if (
          key !== 'EAU' &&
          key !== 'ELECTRICITE'
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
       6. ÉVOLUTION
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
       7. STATISTIQUES GÉNÉRALES
    ===================================================== */

    const row =
      summaryResult
        .rows[0] || {};


    const statistiques = {

      nombreReleves:
        toNumber(
          row.nombre_releves
        ),

      nombreCompteurs:
        toNumber(
          row.nombre_compteurs
        ),

      nombreAbonnes:
        toNumber(
          row.nombre_abonnes
        ),

      totalConsommation:
        round2(
          row.total_consommation
        ),

      consommationMoyenne:
        round2(
          row.consommation_moyenne
        ),

      consommationMaximale:
        round2(
          row.consommation_maximale
        ),

      consommationMinimale:
        round2(
          row.consommation_minimale
        ),

      datePremierReleve:
        row.date_premier_releve ||
        null,

      dateDernierReleve:
        row.date_dernier_releve ||
        null,

    };


    /* =====================================================
       8. RÉPONSE
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


      statistiques,


      parType,


      comparaison,


      evolution,

    });


  } catch (error) {

    console.error(

      'Erreur getStatistiques :',

      error

    );


    return res.status(
      500
    ).json({

      status:
        'error',

      message:
        'Impossible de récupérer les statistiques.',

    });
  }
}


module.exports = {
  getStatistiques,
};