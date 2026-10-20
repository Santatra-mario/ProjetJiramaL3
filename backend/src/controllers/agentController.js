const pool = require('../config/db');
const {
  synchronizeAnomalies,
} = require('./anomalieController');

/* =========================================================
   ANOMALIES ENRICHIES

   La table réelle "anomalies" ne contient PAS :
   compteur_id, niveau, direction, valeur, variation, description.

   On reconstruit ces champs via la jointure avec "releves"
   (même logique que anomalieController.js).
   Seuils : SUSPECTE >= 75 %, CRITIQUE >= 100 %.
========================================================= */

const ANOMALIES_SQL = `(
  SELECT
    x.id,
    x.releve_id,
    r.compteur_id,
    r.created_by AS created_by,
    x.type_anomalie,
    x.valeur_detectee AS valeur,
    x.valeur_reference,
    x.seuil,
    x.statut,
    x.commentaire,
    NULL::text AS description,
    x.date_detection,
    ROUND(
      (
        (x.valeur_detectee - x.valeur_reference)
        / NULLIF(x.valeur_reference, 0)
      ) * 100,
      2
    ) AS variation,
    CASE
      WHEN ABS(
        (
          (x.valeur_detectee - x.valeur_reference)
          / NULLIF(x.valeur_reference, 0)
        ) * 100
      ) >= 100 THEN 'CRITIQUE'
      WHEN ABS(
        (
          (x.valeur_detectee - x.valeur_reference)
          / NULLIF(x.valeur_reference, 0)
        ) * 100
      ) >= 75 THEN 'SUSPECTE'
      ELSE 'ATTENTION'
    END AS niveau,
    CASE
      WHEN x.valeur_detectee >= x.valeur_reference
        THEN 'HAUSSE'
      ELSE 'BAISSE'
    END AS direction
  FROM anomalies x
  INNER JOIN releves r
    ON r.id = x.releve_id
)`;

/* =========================================================
   OUTILS
========================================================= */

const U = (value) =>
  String(value || '')
    .trim()
    .toUpperCase();

const N = (
  value,
  fallback = 0
) =>
  Number.isFinite(Number(value))
    ? Number(value)
    : fallback;

const getUnit = (type) =>
  U(type) === 'EAU'
    ? 'm³'
    : 'kWh';


function serverError(
  res,
  error,
  logMessage
) {

  console.error(
    logMessage,
    error
  );

  return res.status(500).json({

    status: 'error',

    message:
      'Une erreur interne est survenue.',

    detail:
      process.env.NODE_ENV ===
      'development'
        ? error.message
        : undefined,

  });
}


/* =========================================================
   UTILISATEUR AGENT COURANT

   Le JWT contient actuellement id + role.
   On relit donc l'email depuis PostgreSQL.
========================================================= */

async function currentAgentEmail(
  req
) {

  const id =
    Number(
      req.user?.id
    );

  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {
    return '';
  }

  const result =
    await pool.query(
      `
        SELECT
          email

        FROM users

        WHERE id = $1

          AND UPPER(
            TRIM(role)
          ) = 'AGENT'

        LIMIT 1
      `,
      [id]
    );

  return String(
    result.rows[0]?.email || ''
  )
    .trim()
    .toLowerCase();
}


/* =========================================================
   TABLE NOTIFICATIONS

   Création/migration douce.
========================================================= */

async function ensureNotificationsTableImpl() {

  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (

      id SERIAL PRIMARY KEY,

      type VARCHAR(50)
        NOT NULL
        DEFAULT 'INFORMATION',

      destinataire VARCHAR(255)
        NOT NULL,

      sujet VARCHAR(255)
        NOT NULL,

      message TEXT
        NOT NULL,

      date_envoi TIMESTAMP NULL,

      statut VARCHAR(20)
        NOT NULL
        DEFAULT 'EN_ATTENTE',

      anomalie_id INTEGER NULL
        REFERENCES anomalies(id)
        ON DELETE CASCADE,

      created_at TIMESTAMP
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP
    )
  `);


  const migrations = [

    `
      ALTER TABLE notifications
      ADD COLUMN IF NOT EXISTS
      type VARCHAR(50)
      DEFAULT 'INFORMATION'
    `,

    `
      ALTER TABLE notifications
      ADD COLUMN IF NOT EXISTS
      destinataire VARCHAR(255)
    `,

    `
      ALTER TABLE notifications
      ADD COLUMN IF NOT EXISTS
      sujet VARCHAR(255)
    `,

    `
      ALTER TABLE notifications
      ADD COLUMN IF NOT EXISTS
      message TEXT
    `,

    `
      ALTER TABLE notifications
      ADD COLUMN IF NOT EXISTS
      date_envoi TIMESTAMP NULL
    `,

    `
      ALTER TABLE notifications
      ADD COLUMN IF NOT EXISTS
      statut VARCHAR(20)
      DEFAULT 'EN_ATTENTE'
    `,

    `
      ALTER TABLE notifications
      ADD COLUMN IF NOT EXISTS
      anomalie_id INTEGER
    `,

    `
      ALTER TABLE notifications
      ADD COLUMN IF NOT EXISTS
      created_at TIMESTAMP
      DEFAULT CURRENT_TIMESTAMP
    `,

    `
      ALTER TABLE notifications
      ADD COLUMN IF NOT EXISTS
      masquee_le TIMESTAMP NULL
    `,

  ];


  for (
    const sql of migrations
  ) {

    await pool.query(
      sql
    );
  }


  await pool.query(`
    CREATE INDEX IF NOT EXISTS
    idx_notifications_destinataire
    ON notifications(destinataire)
  `);


  await pool.query(`
    CREATE INDEX IF NOT EXISTS
    idx_notifications_statut
    ON notifications(statut)
  `);


  await pool.query(`
    CREATE INDEX IF NOT EXISTS
    idx_notifications_anomalie
    ON notifications(anomalie_id)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS
    idx_notifications_visibles
    ON notifications (LOWER(TRIM(destinataire)))
    WHERE masquee_le IS NULL
  `);
}


let notificationsTablePromise = null;

// Exécutée une seule fois : évite l'erreur
// "pg_class_relname_nsp_index" quand plusieurs requêtes
// arrivent en parallèle (CREATE INDEX IF NOT EXISTS concurrents).
function ensureNotificationsTable() {

  if (!notificationsTablePromise) {

    notificationsTablePromise =
      ensureNotificationsTableImpl()
        .catch((error) => {
          notificationsTablePromise = null;
          throw error;
        });
  }

  return notificationsTablePromise;
}


/* =========================================================
   GÉNÉRATION NOTIFICATIONS AGENT
========================================================= */

async function generateAgentNotifications() {

  try {

    await synchronizeAnomalies();

  } catch (error) {

    console.error(
      'Synchronisation anomalies Agent :',
      error
    );

  }


  await ensureNotificationsTable();


  const agents =
    await pool.query(`
      SELECT
        u.id,
        u.email,
        COALESCE(s.notif_anomalies, TRUE) AS notif_anomalies

      FROM users u
      LEFT JOIN user_settings s ON s.user_id = u.id

      WHERE UPPER(
        TRIM(u.role)
      ) = 'AGENT'

      AND LOWER(
        TRIM(u.statut)
      ) = 'actif'

      AND u.email IS NOT NULL

      AND TRIM(u.email) <> ''
    `);


  if (
    !agents.rowCount
  ) {
    return;
  }


  const anomalies =
    await pool.query(`
      SELECT

        a.id,

        a.created_by,

        a.type_anomalie,

        a.niveau,

        a.direction,

        a.valeur,

        a.valeur_reference,

        a.variation,

        c.numero_compteur,

        c.type AS type_compteur,

        ab.numero_abonne,

        ab.nom AS abonne_nom,

        ab.prenom AS abonne_prenom

      FROM ${ANOMALIES_SQL} a

      INNER JOIN compteurs c
        ON c.id = a.compteur_id

      INNER JOIN abonnes ab
        ON ab.id = c.abonne_id

      WHERE a.statut IN (
        'NOUVELLE',
        'EN_COURS'
      )

      AND a.date_detection >=
        CURRENT_TIMESTAMP -
        INTERVAL '30 days'

      ORDER BY
        a.date_detection DESC,
        a.id DESC

      LIMIT 100
    `);


  for (
    const agent of agents.rows
  ) {
    if (agent.notif_anomalies === false) continue;

    const email =
      String(
        agent.email
      )
        .trim()
        .toLowerCase();


    for (
      const anomalie of
      anomalies.rows
    ) {

      // Une alerte de relevé doit être adressée à son auteur,
      // pas à tous les Agents de l’application.
      if (
        !anomalie.created_by ||
        Number(agent.id) !== Number(anomalie.created_by)
      ) {
        continue;
      }

      const existing =
        await pool.query(
          `
            SELECT
              id

            FROM notifications

            WHERE anomalie_id = $1

            AND LOWER(
              TRIM(destinataire)
            ) = $2

            LIMIT 1
          `,
          [
            anomalie.id,
            email,
          ]
        );


      if (
        existing.rowCount
      ) {
        continue;
      }


      const nomAbonne =
        [
          anomalie.abonne_prenom,
          anomalie.abonne_nom,
        ]
          .filter(Boolean)
          .join(' ')
        ||
        anomalie.numero_abonne
        ||
        'non renseigné';


      const direction =
        U(
          anomalie.direction
        ) === 'BAISSE'
          ? 'baisse'
          : 'hausse';


      const unite =
        getUnit(
          anomalie.type_compteur
        );


      const valeur =
        N(
          anomalie.valeur
        );


      const reference =
        N(
          anomalie.valeur_reference
        );


      const variation =
        Math.abs(
          N(
            anomalie.variation
          )
        );


      await pool.query(
        `
          INSERT INTO notifications
          (
            type,
            destinataire,
            sujet,
            message,
            date_envoi,
            statut,
            anomalie_id
          )

          VALUES
          (
            'ALERTE_ANOMALIE',
            $1,
            $2,
            $3,
            NULL,
            'EN_ATTENTE',
            $4
          )
          ON CONFLICT DO NOTHING
        `,
        [
          email,

          `${
            anomalie.niveau ||
            'ATTENTION'
          } — anomalie de consommation`,

          `Une ${direction} inhabituelle ` +
          `a été détectée sur le compteur ` +
          `${anomalie.numero_compteur}. ` +

          `Consommation : ` +
          `${valeur.toFixed(2)} ${unite}. ` +

          `Référence : ` +
          `${reference.toFixed(2)} ${unite}. ` +

          `Variation : ` +
          `${variation.toFixed(1)} %. ` +

          `Abonné : ${nomAbonne}.`,

          anomalie.id,
        ]
      );

    }
  }
}


/* =========================================================
   DASHBOARD AGENT
========================================================= */

async function getAgentDashboard(
  req,
  res
) {

  try {

    await generateAgentNotifications();


    const email =
      await currentAgentEmail(
        req
      );


    const [
      compteurs,
      compteursActifs,
      abonnes,
      relevesMois,
      anomalies,
      notifications,
      relevesRecents,
      anomaliesRecentes,
    ] = await Promise.all([


      pool.query(`
        SELECT
          COUNT(*)::int AS total
        FROM compteurs
      `),


      pool.query(`
        SELECT
          COUNT(*)::int AS total

        FROM compteurs

        WHERE UPPER(
          TRIM(statut)
        ) = 'ACTIF'
      `),


      pool.query(`
        SELECT
          COUNT(*)::int AS total

        FROM abonnes
      `),


      pool.query(`
        SELECT
          COUNT(*)::int AS total

        FROM releves

        WHERE date_releve >=
          date_trunc(
            'month',
            CURRENT_DATE
          )

        AND date_releve <
          date_trunc(
            'month',
            CURRENT_DATE
          )
          +
          INTERVAL '1 month'
      `),


      pool.query(`
        SELECT
          COUNT(*)::int AS total

        FROM anomalies

        WHERE statut IN (
          'NOUVELLE',
          'EN_COURS'
        )
      `),


      pool.query(
        `
          SELECT
            COUNT(*)::int AS total

          FROM notifications

          WHERE statut =
            'EN_ATTENTE'

          AND masquee_le IS NULL

          AND LOWER(
            TRIM(destinataire)
          ) = $1
        `,
        [email]
      ),


      pool.query(`
        SELECT

          r.id,

          r.date_releve,

          r.nouvel_index,

          r.consommation,

          c.id AS compteur_id,

          c.numero_compteur,

          c.type AS type_compteur,

          a.numero_abonne,

          a.nom AS abonne_nom,

          a.prenom AS abonne_prenom

        FROM releves r

        INNER JOIN compteurs c
          ON c.id = r.compteur_id

        INNER JOIN abonnes a
          ON a.id = c.abonne_id

        ORDER BY
          r.date_releve DESC,
          r.id DESC

        LIMIT 6
      `),


      pool.query(`
        SELECT

          an.id,

          an.type_anomalie,

          an.niveau,

          an.direction,

          an.valeur,

          an.valeur_reference,

          an.variation,

          an.statut,

          an.date_detection,

          c.numero_compteur,

          c.type AS type_compteur

        FROM ${ANOMALIES_SQL} an

        INNER JOIN compteurs c
          ON c.id = an.compteur_id

        ORDER BY

          CASE an.niveau
            WHEN 'CRITIQUE' THEN 1
            WHEN 'SUSPECTE' THEN 2
            ELSE 3
          END,

          an.date_detection DESC,
          an.id DESC

        LIMIT 5
      `),

    ]);


    return res.json({

      status:
        'success',

      stats: {

        compteurs:
          N(
            compteurs.rows[0]?.total
          ),

        compteursActifs:
          N(
            compteursActifs.rows[0]?.total
          ),

        abonnes:
          N(
            abonnes.rows[0]?.total
          ),

        relevesMois:
          N(
            relevesMois.rows[0]?.total
          ),

        anomalies:
          N(
            anomalies.rows[0]?.total
          ),

        notifications:
          N(
            notifications.rows[0]?.total
          ),

      },


      relevesRecents:
        relevesRecents.rows,


      anomaliesRecentes:
        anomaliesRecentes.rows.map(
          (row) => ({

            ...row,

            valeur:
              N(
                row.valeur
              ),

            valeur_reference:
              N(
                row.valeur_reference
              ),

            variation:
              N(
                row.variation
              ),

            unite:
              getUnit(
                row.type_compteur
              ),

          })
        ),

    });

  } catch (error) {

    return serverError(
      res,
      error,
      'Erreur dashboard Agent :'
    );

  }
}


/* =========================================================
   COMPTEURS AGENT
========================================================= */

async function getAgentCompteurs(
  req,
  res
) {

  try {

    const result =
      await pool.query(`
        SELECT

          c.id,

          c.numero_compteur,

          c.type,

          c.date_installation,

          c.statut,

          c.abonne_id,

          a.numero_abonne,

          a.nom AS abonne_nom,

          a.prenom AS abonne_prenom,

          a.adresse AS abonne_adresse,

          a.telephone AS abonne_telephone,

          l.date_releve AS dernier_releve,

          l.nouvel_index AS dernier_index,

          l.consommation AS derniere_consommation

        FROM compteurs c

        INNER JOIN abonnes a
          ON a.id = c.abonne_id

        LEFT JOIN LATERAL
        (
          SELECT

            date_releve,

            nouvel_index,

            consommation

          FROM releves

          WHERE compteur_id = c.id

          ORDER BY
            date_releve DESC,
            id DESC

          LIMIT 1

        ) l ON TRUE

        ORDER BY
          c.id DESC
      `);


    return res.json({

      status:
        'success',

      data:
        result.rows,

      total:
        result.rowCount,

    });

  } catch (error) {

    return serverError(
      res,
      error,
      'Erreur compteurs Agent :'
    );

  }
}


/* =========================================================
   ABONNÉS AGENT
========================================================= */

async function getAgentAbonnes(
  req,
  res
) {

  try {

    const result =
      await pool.query(`
        SELECT

          a.id,

          a.numero_abonne,

          a.nom,

          a.prenom,

          a.adresse,

          a.telephone,

          a.statut,

          COUNT(c.id)::int
            AS nombre_compteurs,

          MAX(l.date_releve)
            AS dernier_releve

        FROM abonnes a

        LEFT JOIN compteurs c
          ON c.abonne_id = a.id

        LEFT JOIN LATERAL
        (
          SELECT
            date_releve

          FROM releves

          WHERE compteur_id = c.id

          ORDER BY
            date_releve DESC,
            id DESC

          LIMIT 1

        ) l ON TRUE

        GROUP BY

          a.id,

          a.numero_abonne,

          a.nom,

          a.prenom,

          a.adresse,

          a.telephone,

          a.statut

        ORDER BY
          a.id DESC
      `);


    return res.json({

      status:
        'success',

      data:
        result.rows,

      total:
        result.rowCount,

    });

  } catch (error) {

    return serverError(
      res,
      error,
      'Erreur abonnés Agent :'
    );

  }
}


/* =========================================================
   TOUS LES RELEVÉS AGENT
========================================================= */

async function getAgentReleves(
  req,
  res
) {

  try {

    const result =
      await pool.query(`
        SELECT

          r.id,

          r.compteur_id,

          c.numero_compteur,

          c.type AS type_compteur,

          c.statut AS statut_compteur,

          c.date_installation,

          a.numero_abonne,

          a.nom AS abonne_nom,

          a.prenom AS abonne_prenom,

          r.date_releve,

          r.date_ancien_releve,

          r.ancien_index,

          r.nouvel_index,

          r.consommation,

          CASE

            WHEN c.type = 'EAU'
              THEN 'm³'

            ELSE 'kWh'

          END AS unite,

          r.created_by,

          r.created_at,

          r.updated_at

        FROM releves r

        INNER JOIN compteurs c
          ON c.id = r.compteur_id

        INNER JOIN abonnes a
          ON a.id = c.abonne_id

        ORDER BY

          r.date_releve DESC,

          r.id DESC

        LIMIT 300
      `);


    return res.json({

      status:
        'success',

      data:
        result.rows,

      total:
        result.rowCount,

    });

  } catch (error) {

    return serverError(
      res,
      error,
      'Erreur relevés Agent :'
    );

  }
}


/* =========================================================
   HISTORIQUE PAR COMPTEUR
========================================================= */

async function getAgentRelevesByCompteur(
  req,
  res
) {

  const compteurId =
    Number(
      req.params.compteurId
    );


  if (
    !Number.isInteger(
      compteurId
    ) ||
    compteurId <= 0
  ) {

    return res.status(400).json({

      status:
        'error',

      message:
        'Identifiant de compteur invalide.',

    });

  }


  try {

    const result =
      await pool.query(
        `
          SELECT

            r.id,

            r.compteur_id,

            c.numero_compteur,

            c.type AS type_compteur,

            c.date_installation,

            a.numero_abonne,

            a.nom AS abonne_nom,

            a.prenom AS abonne_prenom,

            r.date_releve,

            r.date_ancien_releve,

            r.ancien_index,

            r.nouvel_index,

            r.consommation,

            CASE

              WHEN c.type = 'EAU'
                THEN 'm³'

              ELSE 'kWh'

            END AS unite,

            r.created_by,

            r.created_at,

            r.updated_at

          FROM releves r

          INNER JOIN compteurs c
            ON c.id = r.compteur_id

          INNER JOIN abonnes a
            ON a.id = c.abonne_id

          WHERE r.compteur_id = $1

          ORDER BY

            r.date_releve DESC,

            r.id DESC
        `,
        [compteurId]
      );


    return res.json({

      status:
        'success',

      data:
        result.rows,

      total:
        result.rowCount,

    });

  } catch (error) {

    return serverError(
      res,
      error,
      'Erreur historique Agent :'
    );

  }
}


/* =========================================================
   ANOMALIES AGENT
========================================================= */

async function getAgentAnomalies(
  req,
  res
) {

  try {

    try {

      await synchronizeAnomalies();

    } catch (error) {

      console.error(
        'Synchronisation anomalies Agent :',
        error
      );

    }


    const {
      recherche,
      type,
      niveau,
      statut,
    } =
      req.query || {};


    const params = [];
    const conditions = [];


    if (
      [
        'EAU',
        'ELECTRICITE',
      ].includes(
        U(type)
      )
    ) {

      params.push(
        U(type)
      );

      conditions.push(
        `UPPER(c.type) = $${params.length}`
      );
    }


    if (
      [
        'ATTENTION',
        'SUSPECTE',
        'CRITIQUE',
      ].includes(
        U(niveau)
      )
    ) {

      params.push(
        U(niveau)
      );

      conditions.push(
        `an.niveau = $${params.length}`
      );
    }


    if (
      [
        'NOUVELLE',
        'EN_COURS',
        'VERIFIEE',
        'RESOLUE',
      ].includes(
        U(statut)
      )
    ) {

      params.push(
        U(statut)
      );

      conditions.push(
        `an.statut = $${params.length}`
      );
    }


    if (
      recherche &&
      String(recherche).trim()
    ) {

      params.push(
        `%${String(
          recherche
        ).trim()}%`
      );

      const index =
        params.length;


      conditions.push(`
        (
          c.numero_compteur
            ILIKE $${index}

          OR COALESCE(
            a.numero_abonne,
            ''
          )
            ILIKE $${index}

          OR COALESCE(
            a.nom,
            ''
          )
            ILIKE $${index}

          OR COALESCE(
            a.prenom,
            ''
          )
            ILIKE $${index}

          OR COALESCE(
            an.type_anomalie,
            ''
          )
            ILIKE $${index}
        )
      `);

    }


    const limit =
      Math.min(
        Math.max(
          Number(
            req.query?.limite
          ) || 200,
          1
        ),
        500
      );


    params.push(
      limit
    );


    const where =
      conditions.length
        ? `WHERE ${conditions.join(
            ' AND '
          )}`
        : '';


    const result =
      await pool.query(
        `
          SELECT

            an.id,

            an.releve_id,

            an.compteur_id,

            an.type_anomalie,

            an.niveau,

            an.direction,

            an.valeur,

            an.valeur_reference,

            an.variation,

            an.statut,

            an.description,

            an.commentaire,

            an.date_detection,

            r.date_releve,

            r.ancien_index,

            r.nouvel_index,

            c.numero_compteur,

            c.type AS type_compteur,

            a.numero_abonne,

            a.nom AS abonne_nom,

            a.prenom AS abonne_prenom,

            a.adresse AS abonne_adresse

          FROM ${ANOMALIES_SQL} an

          INNER JOIN releves r
            ON r.id = an.releve_id

          INNER JOIN compteurs c
            ON c.id = an.compteur_id

          INNER JOIN abonnes a
            ON a.id = c.abonne_id

          ${where}

          ORDER BY

            CASE an.niveau

              WHEN 'CRITIQUE'
                THEN 1

              WHEN 'SUSPECTE'
                THEN 2

              WHEN 'ATTENTION'
                THEN 3

              ELSE 4

            END,

            an.date_detection DESC,

            an.id DESC

          LIMIT $${params.length}
        `,
        params
      );


    const data =
      result.rows.map(
        (row) => ({

          ...row,

          valeur:
            N(
              row.valeur
            ),

          valeur_reference:
            N(
              row.valeur_reference
            ),

          variation:
            N(
              row.variation
            ),

          unite:
            getUnit(
              row.type_compteur
            ),

          abonne_nom_complet:
            `${
              row.abonne_prenom ||
              ''
            } ${
              row.abonne_nom ||
              ''
            }`.trim(),

        })
      );


    return res.json({

      status:
        'success',

      data,

      total:
        result.rowCount,

    });

  } catch (error) {

    return serverError(
      res,
      error,
      'Erreur anomalies Agent :'
    );

  }
}


/* =========================================================
   NOTIFICATIONS AGENT
========================================================= */

async function getAgentNotifications(
  req,
  res
) {

  try {

    await generateAgentNotifications();


    const email =
      await currentAgentEmail(
        req
      );


    if (!email) {

      return res.json({

        status:
          'success',

        data: [],

        unreadCount:
          0,

        total:
          0,

      });

    }


    const result =
      await pool.query(
        `
          SELECT

            n.id,

            n.type,

            n.destinataire,

            n.sujet,

            n.message,

            n.date_envoi,

            n.statut,

            n.anomalie_id,

            n.created_at,

            a.type_anomalie,

            a.statut AS statut_anomalie,

            a.commentaire AS motif_administrateur,

            a.niveau,

            a.direction,

            a.valeur,

            a.valeur_reference,

            a.variation,

            a.date_detection,

            c.numero_compteur,

            c.type AS type_compteur,

            ab.numero_abonne,

            ab.nom AS abonne_nom,

            ab.prenom AS abonne_prenom

          FROM notifications n

          LEFT JOIN ${ANOMALIES_SQL} a
            ON a.id = n.anomalie_id

          LEFT JOIN compteurs c
            ON c.id = a.compteur_id

          LEFT JOIN abonnes ab
            ON ab.id = c.abonne_id

          WHERE LOWER(TRIM(n.destinataire)) = $1
            AND n.masquee_le IS NULL

          ORDER BY

            CASE

              WHEN n.statut =
                'EN_ATTENTE'
                THEN 0

              ELSE 1

            END,

            n.created_at DESC,

            n.id DESC

          LIMIT 200
        `,
        [email]
      );


    const data =
      result.rows.map(
        (row) => ({

          ...row,

          valeur:
            row.valeur === null
              ? null
              : N(
                  row.valeur
                ),

          valeur_reference:
            row.valeur_reference === null
              ? null
              : N(
                  row.valeur_reference
                ),

          variation:
            row.variation === null
              ? null
              : N(
                  row.variation
                ),

          unite:
            getUnit(
              row.type_compteur
            ),

        })
      );


    return res.json({

      status:
        'success',

      data,

      unreadCount:
        data.filter(
          (item) =>
            item.statut ===
            'EN_ATTENTE'
        ).length,

      total:
        data.length,

    });

  } catch (error) {

    return serverError(
      res,
      error,
      'Erreur notifications Agent :'
    );

  }
}


/* =========================================================
   COMPTEUR NOTIFICATIONS
========================================================= */

async function getAgentNotificationCount(
  req,
  res
) {

  try {

    await generateAgentNotifications();


    const email =
      await currentAgentEmail(
        req
      );


    if (!email) {

      return res.json({

        status:
          'success',

        total:
          0,

      });

    }


    const result =
      await pool.query(
        `
          SELECT
            COUNT(*)::int AS total

          FROM notifications

          WHERE statut = 'EN_ATTENTE'
            AND masquee_le IS NULL
            AND LOWER(TRIM(destinataire)) = $1
        `,
        [email]
      );


    return res.json({

      status:
        'success',

      total:
        N(
          result.rows[0]?.total
        ),

    });

  } catch (error) {

    return serverError(
      res,
      error,
      'Erreur compteur notifications Agent :'
    );

  }
}


/* =========================================================
   MARQUER UNE NOTIFICATION LUE
========================================================= */

async function markAgentNotificationAsRead(
  req,
  res
) {

  const id =
    Number(
      req.params.id
    );


  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {

    return res.status(400).json({

      status:
        'error',

      message:
        'Identifiant de notification invalide.',

    });

  }


  try {

    const email =
      await currentAgentEmail(
        req
      );


    const result =
      await pool.query(
        `
          UPDATE notifications

          SET

            statut = 'ENVOYE',

            date_envoi =
              COALESCE(
                date_envoi,
                CURRENT_TIMESTAMP
              )

          WHERE id = $1
            AND LOWER(TRIM(destinataire)) = $2
            AND masquee_le IS NULL

          RETURNING *
        `,
        [
          id,
          email,
        ]
      );


    if (
      !result.rowCount
    ) {

      return res.status(404).json({

        status:
          'error',

        message:
          'Notification introuvable ou non accessible.',

      });

    }


    return res.json({

      status:
        'success',

      message:
        'Notification marquée comme lue.',

      data:
        result.rows[0],

    });

  } catch (error) {

    return serverError(
      res,
      error,
      'Erreur lecture notification Agent :'
    );

  }
}


/* =========================================================
   MARQUER TOUTES LES NOTIFICATIONS LUES
========================================================= */

async function markAllAgentNotificationsAsRead(
  req,
  res
) {

  try {

    const email =
      await currentAgentEmail(
        req
      );


    const result =
      await pool.query(
        `
          UPDATE notifications

          SET

            statut = 'ENVOYE',

            date_envoi =
              COALESCE(
                date_envoi,
                CURRENT_TIMESTAMP
              )

          WHERE statut = 'EN_ATTENTE'
            AND masquee_le IS NULL
            AND LOWER(TRIM(destinataire)) = $1
        `,
        [email]
      );


    return res.json({

      status:
        'success',

      message:
        'Toutes les notifications ont été marquées comme lues.',

      count:
        result.rowCount,

    });

  } catch (error) {

    return serverError(
      res,
      error,
      'Erreur lecture globale notifications Agent :'
    );

  }
}


/* =========================================================
   EXPORT
========================================================= */

module.exports = {

  getAgentDashboard,

  getAgentCompteurs,

  getAgentAbonnes,

  getAgentReleves,

  getAgentRelevesByCompteur,

  getAgentAnomalies,

  getAgentNotifications,

  getAgentNotificationCount,

  markAgentNotificationAsRead,

  markAllAgentNotificationsAsRead,

  generateAgentNotifications,

  ensureNotificationsTable,

};