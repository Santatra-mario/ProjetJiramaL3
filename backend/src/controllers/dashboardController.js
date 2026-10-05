const pool = require('../config/db');

/* =========================================================
   UTILITAIRES
========================================================= */

function toNumber(value) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : 0;
}

function round2(value) {
  return Number(
    toNumber(value).toFixed(2)
  );
}

/* =========================================================
   GET /api/dashboard

   Tableau de bord administrateur alimenté
   directement par PostgreSQL.
========================================================= */

async function getDashboard(req, res) {
  try {

    /* =====================================================
       1. KPI GÉNÉRAUX
    ===================================================== */

    const statsResult =
      await pool.query(`
        SELECT

          /* ---------------------------------------------
             ABONNÉS
          --------------------------------------------- */

          (
            SELECT COUNT(*)
            FROM abonnes
          ) AS abonnes,

          (
            SELECT COUNT(*)
            FROM abonnes
            WHERE LOWER(TRIM(statut)) = 'actif'
          ) AS abonnes_actifs,


          /* ---------------------------------------------
             COMPTEURS
          --------------------------------------------- */

          (
            SELECT COUNT(*)
            FROM compteurs
          ) AS compteurs,

          (
            SELECT COUNT(*)
            FROM compteurs
            WHERE UPPER(TRIM(statut)) = 'ACTIF'
          ) AS compteurs_actifs,


          /* ---------------------------------------------
             RELEVÉS
          --------------------------------------------- */

          (
            SELECT COUNT(*)
            FROM releves
          ) AS releves,

          (
            SELECT COUNT(*)
            FROM releves
            WHERE date_releve >=
              DATE_TRUNC(
                'month',
                CURRENT_DATE
              )

            AND date_releve <
              DATE_TRUNC(
                'month',
                CURRENT_DATE
              )
              + INTERVAL '1 month'
          ) AS releves_mois,


          /* ---------------------------------------------
             CONSOMMATION EAU DU MOIS
          --------------------------------------------- */

          (
            SELECT
              COALESCE(
                SUM(r.consommation),
                0
              )

            FROM releves r

            INNER JOIN compteurs c
              ON c.id = r.compteur_id

            WHERE
              r.date_releve >=
                DATE_TRUNC(
                  'month',
                  CURRENT_DATE
                )

              AND r.date_releve <
                DATE_TRUNC(
                  'month',
                  CURRENT_DATE
                )
                + INTERVAL '1 month'

              AND UPPER(
                TRIM(c.type)
              ) = 'EAU'
          ) AS consommation_eau_mois,


          /* ---------------------------------------------
             CONSOMMATION ÉLECTRICITÉ DU MOIS
          --------------------------------------------- */

          (
            SELECT
              COALESCE(
                SUM(r.consommation),
                0
              )

            FROM releves r

            INNER JOIN compteurs c
              ON c.id = r.compteur_id

            WHERE
              r.date_releve >=
                DATE_TRUNC(
                  'month',
                  CURRENT_DATE
                )

              AND r.date_releve <
                DATE_TRUNC(
                  'month',
                  CURRENT_DATE
                )
                + INTERVAL '1 month'

              AND UPPER(
                TRIM(c.type)
              ) = 'ELECTRICITE'
          ) AS consommation_electricite_mois
      `);


    /* =====================================================
       2. ÉVOLUTION SUR LES 12 DERNIERS MOIS
    ===================================================== */

    const evolutionResult =
      await pool.query(`
        WITH mois AS (

          SELECT
            generate_series(
              DATE_TRUNC(
                'month',
                CURRENT_DATE
              ) - INTERVAL '11 months',

              DATE_TRUNC(
                'month',
                CURRENT_DATE
              ),

              INTERVAL '1 month'
            ) AS debut_mois
        )

        SELECT

          TO_CHAR(
            m.debut_mois,
            'YYYY-MM'
          ) AS mois,


          /* ---------------------------------------------
             EAU
          --------------------------------------------- */

          ROUND(
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
            )::numeric,

            2
          ) AS eau,


          /* ---------------------------------------------
             ÉLECTRICITÉ
          --------------------------------------------- */

          ROUND(
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
            )::numeric,

            2
          ) AS electricite


        FROM mois m


        LEFT JOIN releves r

          ON r.date_releve >=
            m.debut_mois

          AND r.date_releve <
            m.debut_mois
            + INTERVAL '1 month'


        LEFT JOIN compteurs c

          ON c.id =
            r.compteur_id


        GROUP BY
          m.debut_mois


        ORDER BY
          m.debut_mois ASC
      `);


    /* =====================================================
       3. DERNIERS RELEVÉS
    ===================================================== */

    const derniersRelevesResult =
      await pool.query(`
        WITH ordered_releves AS (

          SELECT

            r.id,
            r.compteur_id,
            r.date_releve,
            r.consommation,


            /* -------------------------------------------
               MOYENNE DES 3 RELEVÉS PRÉCÉDENTS
            ------------------------------------------- */

            AVG(
              r.consommation
            ) OVER (

              PARTITION BY
                r.compteur_id

              ORDER BY
                r.date_releve,
                r.id

              ROWS BETWEEN
                3 PRECEDING
                AND 1 PRECEDING
            ) AS moyenne_precedente

          FROM releves r
        )


        SELECT

          r.id,


          /* -------------------------------------------
             COMPTEUR
          ------------------------------------------- */

          c.numero_compteur
            AS compteur,


          /* -------------------------------------------
             TYPE
          ------------------------------------------- */

          CASE

            WHEN UPPER(
              TRIM(c.type)
            ) = 'EAU'

            THEN 'Eau'


            WHEN UPPER(
              TRIM(c.type)
            ) = 'ELECTRICITE'

            THEN 'Électricité'


            ELSE c.type

          END AS type,


          /* -------------------------------------------
             ABONNÉ
          ------------------------------------------- */

          TRIM(
            CONCAT_WS(
              ' ',
              a.nom,
              a.prenom
            )
          ) AS abonne,


          /* -------------------------------------------
             DATE
          ------------------------------------------- */

          TO_CHAR(
            r.date_releve,
            'DD/MM/YYYY'
          ) AS date,


          /* -------------------------------------------
             CONSOMMATION
          ------------------------------------------- */

          ROUND(
            r.consommation::numeric,
            2
          ) AS consommation,


          /* -------------------------------------------
             UNITÉ
          ------------------------------------------- */

          CASE

            WHEN UPPER(
              TRIM(c.type)
            ) = 'EAU'

            THEN 'm³'

            ELSE 'kWh'

          END AS unite,


          /* -------------------------------------------
             STATUT
          ------------------------------------------- */

          CASE

            WHEN
              r.moyenne_precedente IS NOT NULL

              AND r.consommation >
                (
                  r.moyenne_precedente
                  * 1.5
                )

            THEN 'À vérifier'


            ELSE 'Enregistré'

          END AS statut


        FROM ordered_releves r


        INNER JOIN compteurs c

          ON c.id =
            r.compteur_id


        INNER JOIN abonnes a

          ON a.id =
            c.abonne_id


        ORDER BY
          r.date_releve DESC,
          r.id DESC


        LIMIT 5
      `);


    /* =====================================================
       4. ANOMALIES

       Règle actuelle :

       consommation actuelle
       >
       moyenne des 3 relevés précédents × 1.5
    ===================================================== */

    const anomaliesResult =
      await pool.query(`
        WITH releves_ordonnes AS (

          SELECT

            r.*,


            /* -------------------------------------------
               MOYENNE DES 3 RELEVÉS PRÉCÉDENTS
            ------------------------------------------- */

            AVG(
              r.consommation
            ) OVER (

              PARTITION BY
                r.compteur_id

              ORDER BY
                r.date_releve,
                r.id

              ROWS BETWEEN
                3 PRECEDING
                AND 1 PRECEDING

            ) AS moyenne_precedente,


            /* -------------------------------------------
               NOMBRE DE RELEVÉS PRÉCÉDENTS
            ------------------------------------------- */

            COUNT(*) OVER (

              PARTITION BY
                r.compteur_id

              ORDER BY
                r.date_releve,
                r.id

              ROWS BETWEEN
                3 PRECEDING
                AND 1 PRECEDING

            ) AS nombre_precedents,


            /* -------------------------------------------
               DERNIER RELEVÉ DU COMPTEUR
            ------------------------------------------- */

            ROW_NUMBER() OVER (

              PARTITION BY
                r.compteur_id

              ORDER BY
                r.date_releve DESC,
                r.id DESC

            ) AS rang

          FROM releves r
        )


        SELECT


          r.id,


          /* -------------------------------------------
             COMPTEUR
          ------------------------------------------- */

          c.numero_compteur
            AS compteur,


          /* -------------------------------------------
             TYPE ANOMALIE
          ------------------------------------------- */

          CASE

            WHEN UPPER(
              TRIM(c.type)
            ) = 'EAU'

            THEN
              'Surconsommation d''eau'


            WHEN UPPER(
              TRIM(c.type)
            ) = 'ELECTRICITE'

            THEN
              'Surconsommation d''électricité'


            ELSE
              'Variation inhabituelle'

          END AS type,


          /* -------------------------------------------
             VALEUR
          ------------------------------------------- */

          ROUND(
            r.consommation::numeric,
            2
          ) AS valeur,


          /* -------------------------------------------
             RÉFÉRENCE
          ------------------------------------------- */

          ROUND(
            r.moyenne_precedente::numeric,
            2
          ) AS reference,


          /* -------------------------------------------
             UNITÉ
          ------------------------------------------- */

          CASE

            WHEN UPPER(
              TRIM(c.type)
            ) = 'EAU'

            THEN 'm³'

            ELSE 'kWh'

          END AS unite,


          /* -------------------------------------------
             DATE
          ------------------------------------------- */

          TO_CHAR(
            r.date_releve,
            'DD/MM/YYYY'
          ) AS date,


          /* -------------------------------------------
             STATUT
          ------------------------------------------- */

          'NOUVELLE'
            AS statut


        FROM releves_ordonnes r


        INNER JOIN compteurs c

          ON c.id =
            r.compteur_id


        WHERE

          r.rang = 1

          AND r.nombre_precedents >= 3

          AND r.moyenne_precedente
            IS NOT NULL

          AND r.moyenne_precedente > 0

          AND r.consommation >
            (
              r.moyenne_precedente
              * 1.5
            )


        ORDER BY
          r.date_releve DESC,
          r.id DESC


        LIMIT 5
      `);


    /* =====================================================
       5. STATISTIQUES
    ===================================================== */

    const row =
      statsResult.rows[0] || {};


    const stats = {

      abonnes:
        toNumber(
          row.abonnes
        ),

      abonnesActifs:
        toNumber(
          row.abonnes_actifs
        ),


      compteurs:
        toNumber(
          row.compteurs
        ),

      compteursActifs:
        toNumber(
          row.compteurs_actifs
        ),


      releves:
        toNumber(
          row.releves
        ),

      relevesMois:
        toNumber(
          row.releves_mois
        ),


      anomalies:
        anomaliesResult.rows.length,

      anomaliesNouvelles:
        anomaliesResult.rows.length,


      consommationEauMois:
        round2(
          row.consommation_eau_mois
        ),

      consommationElectriciteMois:
        round2(
          row.consommation_electricite_mois
        ),
    };


    /* =====================================================
       6. NORMALISATION ÉVOLUTION
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

        })
      );


    /* =====================================================
       7. NORMALISATION DERNIERS RELEVÉS
    ===================================================== */

    const derniersReleves =
      derniersRelevesResult.rows.map(
        (item) => ({

          id:
            toNumber(
              item.id
            ),

          compteur:
            item.compteur,

          type:
            item.type,

          abonne:
            item.abonne,

          date:
            item.date,

          consommation:
            round2(
              item.consommation
            ),

          unite:
            item.unite,

          statut:
            item.statut,

        })
      );


    /* =====================================================
       8. NORMALISATION ANOMALIES
    ===================================================== */

    const anomaliesRecentes =
      anomaliesResult.rows.map(
        (item) => ({

          id:
            toNumber(
              item.id
            ),

          compteur:
            item.compteur,

          type:
            item.type,

          valeur:
            round2(
              item.valeur
            ),

          reference:
            round2(
              item.reference
            ),

          unite:
            item.unite,

          date:
            item.date,

          statut:
            item.statut,

        })
      );


    /* =====================================================
       9. NOTIFICATIONS DU DASHBOARD
    ===================================================== */

    const notificationsResult =
      await pool.query(`
        SELECT
          n.id,
          n.type,
          n.sujet AS titre,
          n.message,
          n.statut,
          n.created_at AS date,
          n.anomalie_id,
          c.numero_compteur AS compteur,
          a.type_anomalie AS anomalie,
          a.valeur_detectee AS valeur,
          a.valeur_reference AS reference,
          CASE
            WHEN UPPER(TRIM(c.type)) = 'EAU' THEN 'm³'
            ELSE 'kWh'
          END AS unite
        FROM notifications n
        LEFT JOIN anomalies a ON a.id = n.anomalie_id
        LEFT JOIN releves r ON r.id = a.releve_id
        LEFT JOIN compteurs c ON c.id = r.compteur_id
        ORDER BY n.created_at DESC, n.id DESC
        LIMIT 5
      `);

    const notifications =
      notificationsResult.rows.map((item) => ({
        id: toNumber(item.id),
        type: item.type,
        titre: item.titre,
        compteur: item.compteur || '—',
        anomalie: item.anomalie || 'Alerte',
        valeur: round2(item.valeur),
        reference: round2(item.reference),
        unite: item.unite || '',
        date: item.date,
        statut: item.statut,
        message: item.message,
      }));

    const notificationsCountResult =
      await pool.query(`
        SELECT COUNT(*) AS total
        FROM notifications
        WHERE statut = 'EN_ATTENTE'
      `);

    const notificationsCount =
      toNumber(notificationsCountResult.rows[0]?.total);

    /* =====================================================
       10. RÉPONSE
    ===================================================== */

    return res.status(200).json({

      status:
        'success',

      stats,

      evolution,

      derniersReleves,

      anomaliesRecentes,

      notifications,

      notificationsCount,

    });


  } catch (error) {

    console.error(
      'Erreur getDashboard :',
      error
    );


    return res.status(500).json({

      status:
        'error',

      message:
        'Impossible de récupérer les données du tableau de bord.',

    });
  }
}


module.exports = {
  getDashboard,
};