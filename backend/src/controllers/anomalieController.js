const pool = require('../config/db');

/*
=========================================================
CONFIGURATION
=========================================================
*/

const NOMBRE_RELEVES_REFERENCE = 3;

const SEUIL_ANOMALIE = 50;
const SEUIL_SUSPECTE = 75;
const SEUIL_CRITIQUE = 100;

const STATUTS = [
  'NOUVELLE',
  'EN_COURS',
  'VERIFIEE',
  'RESOLUE',
];

/*
=========================================================
OUTILS
=========================================================
*/

function number(value, fallback = 0) {
  const n = Number(value);

  return Number.isFinite(n)
    ? n
    : fallback;
}

function round(value, decimals = 2) {
  const factor = 10 ** decimals;

  return Math.round(
    Number(value) * factor
  ) / factor;
}

function upper(value) {
  return String(value ?? '')
    .trim()
    .toUpperCase();
}

function niveauFromVariation(variation) {
  const abs = Math.abs(
    Number(variation) || 0
  );

  if (abs >= SEUIL_CRITIQUE) {
    return 'CRITIQUE';
  }

  if (abs >= SEUIL_SUSPECTE) {
    return 'SUSPECTE';
  }

  return 'ATTENTION';
}

function directionFromVariation(variation) {
  return Number(variation) >= 0
    ? 'HAUSSE'
    : 'BAISSE';
}

function typeFromVariation(variation) {
  return Number(variation) >= 0
    ? 'SURCONSOMMATION'
    : 'SOUS_CONSOMMATION';
}

function uniteFromType(type) {
  return upper(type) === 'EAU'
    ? 'm³'
    : 'kWh';
}

/*
=========================================================
VÉRIFICATION DE LA TABLE

IMPORTANT :
On NE crée PAS une nouvelle structure incompatible.

Votre table réelle est :

id
releve_id
type_anomalie
valeur_detectee
valeur_reference
seuil
date_detection
statut
commentaire
=========================================================
*/

async function ensureAnomaliesTable() {
  const result = await pool.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'anomalies'
    ORDER BY ordinal_position
  `);

  const colonnes =
    result.rows.map(
      row => row.column_name
    );

  const obligatoires = [
    'id',
    'releve_id',
    'type_anomalie',
    'valeur_detectee',
    'valeur_reference',
    'seuil',
    'date_detection',
    'statut',
    'commentaire',
  ];

  const manquantes =
    obligatoires.filter(
      colonne =>
        !colonnes.includes(colonne)
    );

  if (manquantes.length > 0) {
    throw new Error(
      `Structure de la table anomalies incorrecte. ` +
      `Colonnes manquantes : ${manquantes.join(', ')}`
    );
  }

  /*
  ========================================================
  INDEX SANS AJOUTER DE COLONNES
  ========================================================
  */

  await pool.query(`
    CREATE INDEX IF NOT EXISTS
      idx_anomalies_releve_id
    ON anomalies(releve_id)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS
      idx_anomalies_statut
    ON anomalies(statut)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS
      idx_anomalies_date_detection
    ON anomalies(date_detection)
  `);
}


/*
=========================================================
DÉTECTION DES ANOMALIES

On compare chaque relevé avec la moyenne des
3 relevés précédents du même compteur.
=========================================================
*/

async function detectAnomalies() {
  const result = await pool.query(`
    WITH historique AS (
      SELECT
        r.id AS releve_id,
        r.compteur_id,
        r.date_releve,
        r.consommation,

        AVG(r.consommation) OVER (
          PARTITION BY r.compteur_id
          ORDER BY
            r.date_releve,
            r.id
          ROWS BETWEEN
            ${NOMBRE_RELEVES_REFERENCE}
            PRECEDING
            AND 1 PRECEDING
        ) AS consommation_reference,

        COUNT(r.consommation) OVER (
          PARTITION BY r.compteur_id
          ORDER BY
            r.date_releve,
            r.id
          ROWS BETWEEN
            ${NOMBRE_RELEVES_REFERENCE}
            PRECEDING
            AND 1 PRECEDING
        ) AS nombre_references

      FROM releves r
    )

    SELECT
      h.releve_id,
      h.compteur_id,
      h.date_releve,
      h.consommation,
      h.consommation_reference,
      h.nombre_references,

      c.numero_compteur,
      c.type AS type_compteur,
      c.statut AS statut_compteur,

      a.id AS abonne_id,
      a.numero_abonne,
      a.nom AS abonne_nom,
      a.prenom AS abonne_prenom,
      a.adresse AS abonne_adresse

    FROM historique h

    INNER JOIN compteurs c
      ON c.id = h.compteur_id

    INNER JOIN abonnes a
      ON a.id = c.abonne_id

    WHERE
      h.nombre_references >= $1

      AND h.consommation_reference > 0

      AND ABS(
        (
          (
            h.consommation -
            h.consommation_reference
          )
          /
          h.consommation_reference
        ) * 100
      ) >= $2

    ORDER BY
      h.date_releve DESC,
      h.releve_id DESC
  `, [
    NOMBRE_RELEVES_REFERENCE,
    SEUIL_ANOMALIE,
  ]);

  return result.rows.map(row => {
    const consommation =
      number(row.consommation);

    const reference =
      number(
        row.consommation_reference
      );

    const variation =
      reference > 0
        ? round(
            (
              (
                consommation -
                reference
              ) /
              reference
            ) * 100
          )
        : 0;

    const niveau =
      niveauFromVariation(
        variation
      );

    const direction =
      directionFromVariation(
        variation
      );

    const typeAnomalie =
      typeFromVariation(
        variation
      );

    const unite =
      uniteFromType(
        row.type_compteur
      );

    return {
      releve_id:
        row.releve_id,

      compteur_id:
        row.compteur_id,

      numero_compteur:
        row.numero_compteur,

      type_compteur:
        row.type_compteur,

      statut_compteur:
        row.statut_compteur,

      abonne_id:
        row.abonne_id,

      numero_abonne:
        row.numero_abonne,

      abonne_nom:
        row.abonne_nom,

      abonne_prenom:
        row.abonne_prenom,

      abonne_adresse:
        row.abonne_adresse,

      date_releve:
        row.date_releve,

      consommation,

      consommation_reference:
        reference,

      variation,

      niveau,

      direction,

      type_anomalie:
        typeAnomalie,

      unite,
    };
  });
}


/*
=========================================================
SYNCHRONISATION

IMPORTANT :
La table anomalies n'a PAS de compteur_id.

On enregistre seulement :
releve_id
type_anomalie
valeur_detectee
valeur_reference
seuil
date_detection
statut
=========================================================
*/

async function synchronizeAnomalies() {
  await ensureAnomaliesTable();

  const anomalies =
    await detectAnomalies();

  const client =
    await pool.connect();

  try {
    await client.query(
      'BEGIN'
    );

    for (const anomalie of anomalies) {

      /*
      -----------------------------------------------------
      Vérifier si une anomalie existe déjà
      -----------------------------------------------------
      */

      const existing =
        await client.query(
          `
          SELECT
            id,
            statut
          FROM anomalies
          WHERE releve_id = $1
          LIMIT 1
          `,
          [
            anomalie.releve_id,
          ]
        );

      if (
        existing.rows.length > 0
      ) {

        /*
        -----------------------------------------------
        Mise à jour
        -----------------------------------------------
        */

        await client.query(
          `
          UPDATE anomalies
          SET
            type_anomalie = $1,
            valeur_detectee = $2,
            valeur_reference = $3,
            seuil = $4,
            date_detection = $5

          WHERE releve_id = $6
          `,
          [
            anomalie.type_anomalie,

            anomalie.consommation,

            anomalie.consommation_reference,

            SEUIL_ANOMALIE,

            anomalie.date_releve ||
              new Date(),

            anomalie.releve_id,
          ]
        );

      } else {

        /*
        -----------------------------------------------
        Création
        -----------------------------------------------
        */

        await client.query(
          `
          INSERT INTO anomalies (
            releve_id,
            type_anomalie,
            valeur_detectee,
            valeur_reference,
            seuil,
            date_detection,
            statut,
            commentaire
          )

          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            'NOUVELLE',
            NULL
          )
          `,
          [
            anomalie.releve_id,

            anomalie.type_anomalie,

            anomalie.consommation,

            anomalie.consommation_reference,

            SEUIL_ANOMALIE,

            anomalie.date_releve ||
              new Date(),
          ]
        );
      }
    }

    await client.query(
      'COMMIT'
    );

    return anomalies;

  } catch (error) {

    await client.query(
      'ROLLBACK'
    );

    throw error;

  } finally {

    client.release();
  }
}


/*
=========================================================
GET /api/anomalies
=========================================================
*/

async function getAnomalies(req, res) {
  try {

    await synchronizeAnomalies();

    const {
      date_debut,
      date_fin,
      type,
      niveau,
      statut,
      recherche,
      limite = 500,
    } = req.query;

    const conditions = [];
    const params = [];

    /*
    -----------------------------------------------------
    DATE DÉBUT
    -----------------------------------------------------
    */

    if (date_debut) {

      params.push(
        date_debut
      );

      conditions.push(
        `r.date_releve >= $${params.length}::date`
      );
    }

    /*
    -----------------------------------------------------
    DATE FIN
    -----------------------------------------------------
    */

    if (date_fin) {

      params.push(
        date_fin
      );

      conditions.push(
        `r.date_releve <= $${params.length}::date`
      );
    }

    /*
    -----------------------------------------------------
    TYPE COMPTEUR
    -----------------------------------------------------
    */

    if (type) {

      params.push(
        upper(type)
      );

      conditions.push(
        `UPPER(c.type) = $${params.length}`
      );
    }

    /*
    -----------------------------------------------------
    STATUT
    -----------------------------------------------------
    */

    if (
      statut &&
      STATUTS.includes(
        upper(statut)
      )
    ) {

      params.push(
        upper(statut)
      );

      conditions.push(
        `an.statut = $${params.length}`
      );
    }

    /*
    -----------------------------------------------------
    RECHERCHE
    -----------------------------------------------------
    */

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
          c.numero_compteur ILIKE $${index}

          OR a.numero_abonne ILIKE $${index}

          OR a.nom ILIKE $${index}

          OR a.prenom ILIKE $${index}

          OR an.type_anomalie ILIKE $${index}
        )
      `);
    }

    /*
    -----------------------------------------------------
    NIVEAU
    -----------------------------------------------------
    */

    if (
      niveau &&
      [
        'ATTENTION',
        'SUSPECTE',
        'CRITIQUE',
      ].includes(
        upper(niveau)
      )
    ) {

      params.push(
        upper(niveau)
      );

      const index =
        params.length;

      conditions.push(`
        CASE

          WHEN ABS(
            (
              (
                an.valeur_detectee -
                an.valeur_reference
              )
              /
              NULLIF(
                an.valeur_reference,
                0
              )
            ) * 100
          ) >= ${SEUIL_CRITIQUE}
            THEN 'CRITIQUE'

          WHEN ABS(
            (
              (
                an.valeur_detectee -
                an.valeur_reference
              )
              /
              NULLIF(
                an.valeur_reference,
                0
              )
            ) * 100
          ) >= ${SEUIL_SUSPECTE}
            THEN 'SUSPECTE'

          ELSE 'ATTENTION'

        END = $${index}
      `);
    }

    /*
    -----------------------------------------------------
    WHERE
    -----------------------------------------------------
    */

    const where =
      conditions.length > 0
        ? `WHERE ${conditions.join(
            ' AND '
          )}`
        : '';

    /*
    -----------------------------------------------------
    LIMITE
    -----------------------------------------------------
    */

    let limiteNumber =
      Number(limite);

    if (
      !Number.isFinite(
        limiteNumber
      )
    ) {
      limiteNumber = 500;
    }

    limiteNumber =
      Math.min(
        Math.max(
          Math.floor(
            limiteNumber
          ),
          1
        ),
        1000
      );

    params.push(
      limiteNumber
    );

    /*
    -----------------------------------------------------
    REQUÊTE PRINCIPALE
    -----------------------------------------------------
    */

    const result =
      await pool.query(
        `
        SELECT

          an.id,

          an.releve_id,

          r.compteur_id,

          an.type_anomalie,

          an.valeur_detectee,

          an.valeur_reference,

          an.seuil,

          an.date_detection,

          an.statut,

          an.commentaire,

          r.date_releve,

          r.ancien_index,

          r.nouvel_index,

          r.consommation,

          c.numero_compteur,

          c.type AS type_compteur,

          c.statut AS statut_compteur,

          a.id AS abonne_id,

          a.numero_abonne,

          a.nom AS abonne_nom,

          a.prenom AS abonne_prenom,

          a.adresse AS abonne_adresse,

          ROUND(
            (
              (
                an.valeur_detectee -
                an.valeur_reference
              )
              /
              NULLIF(
                an.valeur_reference,
                0
              )
            ) * 100,
            2
          ) AS variation,

          CASE

            WHEN ABS(
              (
                (
                  an.valeur_detectee -
                  an.valeur_reference
                )
                /
                NULLIF(
                  an.valeur_reference,
                  0
                )
              ) * 100
            ) >= ${SEUIL_CRITIQUE}
              THEN 'CRITIQUE'

            WHEN ABS(
              (
                (
                  an.valeur_detectee -
                  an.valeur_reference
                )
                /
                NULLIF(
                  an.valeur_reference,
                  0
                )
              ) * 100
            ) >= ${SEUIL_SUSPECTE}
              THEN 'SUSPECTE'

            ELSE 'ATTENTION'

          END AS niveau,

          CASE

            WHEN
              an.valeur_detectee >=
              an.valeur_reference
              THEN 'HAUSSE'

            ELSE 'BAISSE'

          END AS direction,

          CASE

            WHEN
              an.valeur_detectee >=
              an.valeur_reference
              THEN 'SURCONSOMMATION'

            ELSE 'SOUS_CONSOMMATION'

          END AS nature_anomalie,

          CASE
            WHEN UPPER(c.type) = 'EAU'
              THEN 'm³'
            ELSE 'kWh'
          END AS unite

        FROM anomalies an

        INNER JOIN releves r
          ON r.id = an.releve_id

        INNER JOIN compteurs c
          ON c.id = r.compteur_id

        INNER JOIN abonnes a
          ON a.id = c.abonne_id

        ${where}

        ORDER BY
          an.date_detection DESC,
          an.id DESC

        LIMIT $${params.length}
        `,
        params
      );

    const anomalies =
      result.rows.map(row => ({
        ...row,

        valeur_detectee:
          number(
            row.valeur_detectee
          ),

        valeur_reference:
          number(
            row.valeur_reference
          ),

        seuil:
          number(row.seuil),

        variation:
          number(row.variation),

        consommation:
          number(
            row.consommation
          ),

        unite:
          row.unite ||
          uniteFromType(
            row.type_compteur
          ),

        abonne_nom_complet:
          `${row.abonne_prenom || ''} ${
            row.abonne_nom || ''
          }`.trim(),
      }));

    return res.status(200).json({

      status: 'success',

      anomalies,

      total:
        anomalies.length,

      seuils: {
        anomalie:
          SEUIL_ANOMALIE,

        suspecte:
          SEUIL_SUSPECTE,

        critique:
          SEUIL_CRITIQUE,

        releves_reference:
          NOMBRE_RELEVES_REFERENCE,
      },
    });

  } catch (error) {

    console.error(
      'Erreur getAnomalies :',
      error
    );

    return res.status(500).json({

      status: 'error',

      message:
        'Impossible de récupérer les anomalies.',

      detail:
        process.env.NODE_ENV ===
        'development'
          ? error.message
          : undefined,
    });
  }
}


/*
=========================================================
GET /api/anomalies/stats
=========================================================

C'est cette fonction qui corrige directement :

"Impossible de récupérer les statistiques des anomalies."
=========================================================
*/

async function getAnomalieStats(req, res) {
  try {

    /*
    -----------------------------------------------------
    Vérification de la vraie table
    -----------------------------------------------------
    */

    await ensureAnomaliesTable();

    /*
    -----------------------------------------------------
    TOTAL
    -----------------------------------------------------
    */

    const totalResult =
      await pool.query(`
        SELECT
          COUNT(*)::integer AS total

        FROM anomalies
      `);

    /*
    -----------------------------------------------------
    PAR NIVEAU

    Le niveau est calculé.
    Il n'est PAS une colonne SQL.
    -----------------------------------------------------
    */

    const niveauResult =
      await pool.query(`
        SELECT

          CASE

            WHEN ABS(
              (
                (
                  valeur_detectee -
                  valeur_reference
                )
                /
                NULLIF(
                  valeur_reference,
                  0
                )
              ) * 100
            ) >= ${SEUIL_CRITIQUE}
              THEN 'CRITIQUE'

            WHEN ABS(
              (
                (
                  valeur_detectee -
                  valeur_reference
                )
                /
                NULLIF(
                  valeur_reference,
                  0
                )
              ) * 100
            ) >= ${SEUIL_SUSPECTE}
              THEN 'SUSPECTE'

            ELSE 'ATTENTION'

          END AS niveau,

          COUNT(*)::integer AS total

        FROM anomalies

        GROUP BY 1

        ORDER BY 1
      `);

    /*
    -----------------------------------------------------
    PAR STATUT
    -----------------------------------------------------
    */

    const statutResult =
      await pool.query(`
        SELECT

          statut,

          COUNT(*)::integer AS total

        FROM anomalies

        GROUP BY statut

        ORDER BY statut
      `);

    /*
    -----------------------------------------------------
    PAR TYPE D'ANOMALIE
    -----------------------------------------------------
    */

    const typeAnomalieResult =
      await pool.query(`
        SELECT

          type_anomalie,

          COUNT(*)::integer AS total

        FROM anomalies

        GROUP BY type_anomalie

        ORDER BY total DESC
      `);

    /*
    -----------------------------------------------------
    PAR TYPE DE COMPTEUR
    -----------------------------------------------------
    */

    const typeCompteurResult =
      await pool.query(`
        SELECT

          UPPER(c.type) AS type,

          COUNT(*)::integer AS total

        FROM anomalies an

        INNER JOIN releves r
          ON r.id = an.releve_id

        INNER JOIN compteurs c
          ON c.id = r.compteur_id

        GROUP BY
          UPPER(c.type)

        ORDER BY total DESC
      `);

    /*
    -----------------------------------------------------
    PAR MOIS
    -----------------------------------------------------
    */

    const moisResult =
      await pool.query(`
        SELECT

          TO_CHAR(
            date_detection,
            'YYYY-MM'
          ) AS mois,

          COUNT(*)::integer AS total

        FROM anomalies

        GROUP BY
          TO_CHAR(
            date_detection,
            'YYYY-MM'
          )

        ORDER BY mois
      `);

    /*
    -----------------------------------------------------
    DERNIÈRES ANOMALIES
    -----------------------------------------------------
    */

    const recentesResult =
      await pool.query(`
        SELECT

          an.id,

          an.releve_id,

          an.type_anomalie,

          an.valeur_detectee,

          an.valeur_reference,

          an.seuil,

          an.statut,

          an.commentaire,

          an.date_detection,

          r.date_releve,

          r.compteur_id,

          c.numero_compteur,

          c.type AS type_compteur,

          a.numero_abonne,

          a.nom AS abonne_nom,

          a.prenom AS abonne_prenom,

          ROUND(
            (
              (
                an.valeur_detectee -
                an.valeur_reference
              )
              /
              NULLIF(
                an.valeur_reference,
                0
              )
            ) * 100,
            2
          ) AS variation,

          CASE

            WHEN ABS(
              (
                (
                  an.valeur_detectee -
                  an.valeur_reference
                )
                /
                NULLIF(
                  an.valeur_reference,
                  0
                )
              ) * 100
            ) >= ${SEUIL_CRITIQUE}
              THEN 'CRITIQUE'

            WHEN ABS(
              (
                (
                  an.valeur_detectee -
                  an.valeur_reference
                )
                /
                NULLIF(
                  an.valeur_reference,
                  0
                )
              ) * 100
            ) >= ${SEUIL_SUSPECTE}
              THEN 'SUSPECTE'

            ELSE 'ATTENTION'

          END AS niveau,

          CASE

            WHEN
              an.valeur_detectee >=
              an.valeur_reference
              THEN 'HAUSSE'

            ELSE 'BAISSE'

          END AS direction

        FROM anomalies an

        INNER JOIN releves r
          ON r.id = an.releve_id

        INNER JOIN compteurs c
          ON c.id = r.compteur_id

        INNER JOIN abonnes a
          ON a.id = c.abonne_id

        ORDER BY
          an.date_detection DESC,
          an.id DESC

        LIMIT 10
      `);

    /*
    -----------------------------------------------------
    CONSTRUIRE LES RÉSULTATS
    -----------------------------------------------------
    */

    const parNiveau = {
      ATTENTION: 0,
      SUSPECTE: 0,
      CRITIQUE: 0,
    };

    niveauResult.rows.forEach(row => {

      const niveau =
        upper(row.niveau);

      if (
        Object.prototype.hasOwnProperty.call(
          parNiveau,
          niveau
        )
      ) {
        parNiveau[niveau] =
          number(row.total);
      }
    });

    const parStatut = {
      NOUVELLE: 0,
      EN_COURS: 0,
      VERIFIEE: 0,
      RESOLUE: 0,
    };

    statutResult.rows.forEach(row => {

      const statut =
        upper(row.statut);

      if (
        Object.prototype.hasOwnProperty.call(
          parStatut,
          statut
        )
      ) {
        parStatut[statut] =
          number(row.total);
      }
    });

    const parTypeCompteur = {};

    typeCompteurResult.rows.forEach(
      row => {

        parTypeCompteur[
          upper(row.type)
        ] = number(row.total);
      }
    );

    const parTypeAnomalie = {};

    typeAnomalieResult.rows.forEach(
      row => {

        parTypeAnomalie[
          row.type_anomalie
        ] = number(row.total);
      }
    );

    const parMois =
      moisResult.rows.map(row => ({
        mois:
          row.mois,

        total:
          number(row.total),
      }));

    /*
    -----------------------------------------------------
    RÉPONSE
    -----------------------------------------------------
    */

    return res.status(200).json({

      status: 'success',

      total:
        number(
          totalResult.rows[0]?.total
        ),

      parNiveau,

      parStatut,

      parTypeCompteur,

      parTypeAnomalie,

      parMois,

      recentes:
        recentesResult.rows.map(row => ({

          ...row,

          valeur_detectee:
            number(
              row.valeur_detectee
            ),

          valeur_reference:
            number(
              row.valeur_reference
            ),

          seuil:
            number(row.seuil),

          variation:
            number(row.variation),

          unite:
            uniteFromType(
              row.type_compteur
            ),

          abonne_nom_complet:
            `${row.abonne_prenom || ''} ${
              row.abonne_nom || ''
            }`.trim(),
        })),

      seuils: {

        anomalie:
          SEUIL_ANOMALIE,

        suspecte:
          SEUIL_SUSPECTE,

        critique:
          SEUIL_CRITIQUE,

        releves_reference:
          NOMBRE_RELEVES_REFERENCE,
      },
    });

  } catch (error) {

    /*
    =====================================================
    LOG COMPLET
    =====================================================
    */

    console.error(
      '=========================================='
    );

    console.error(
      'ERREUR getAnomalieStats'
    );

    console.error(
      'message :',
      error.message
    );

    console.error(
      'code :',
      error.code
    );

    console.error(
      'detail :',
      error.detail
    );

    console.error(
      'hint :',
      error.hint
    );

    console.error(
      '=========================================='
    );

    return res.status(500).json({

      status: 'error',

      message:
        'Impossible de récupérer les statistiques des anomalies.',

      detail:
        process.env.NODE_ENV ===
        'development'
          ? error.message
          : undefined,

      code:
        process.env.NODE_ENV ===
        'development'
          ? error.code
          : undefined,
    });
  }
}


/*
=========================================================
POST /api/anomalies/analyser
=========================================================
*/

async function analyserAnomalies(req, res) {
  try {

    const anomalies =
      await synchronizeAnomalies();

    return res.status(200).json({

      status: 'success',

      message:
        'Analyse des consommations terminée.',

      totalDetectees:
        anomalies.length,

      seuil:
        SEUIL_ANOMALIE,

      relevesReference:
        NOMBRE_RELEVES_REFERENCE,

      anomalies,
    });

  } catch (error) {

    console.error(
      'Erreur analyserAnomalies :',
      error
    );

    return res.status(500).json({

      status: 'error',

      message:
        'Impossible d’analyser les consommations.',

      detail:
        process.env.NODE_ENV ===
        'development'
          ? error.message
          : undefined,
    });
  }
}


/*
=========================================================
GET /api/anomalies/:id
=========================================================
*/

async function getAnomalieById(req, res) {

  const id =
    Number(req.params.id);

  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {
    return res.status(400).json({

      status: 'error',

      message:
        'Identifiant d’anomalie invalide.',
    });
  }

  try {

    await ensureAnomaliesTable();

    const result =
      await pool.query(
        `
        SELECT

          an.id,

          an.releve_id,

          r.compteur_id,

          an.type_anomalie,

          an.valeur_detectee,

          an.valeur_reference,

          an.seuil,

          an.date_detection,

          an.statut,

          an.commentaire,

          r.date_releve,

          r.ancien_index,

          r.nouvel_index,

          r.consommation,

          c.numero_compteur,

          c.type AS type_compteur,

          c.statut AS statut_compteur,

          a.id AS abonne_id,

          a.numero_abonne,

          a.nom AS abonne_nom,

          a.prenom AS abonne_prenom,

          a.adresse AS abonne_adresse,

          ROUND(
            (
              (
                an.valeur_detectee -
                an.valeur_reference
              )
              /
              NULLIF(
                an.valeur_reference,
                0
              )
            ) * 100,
            2
          ) AS variation,

          CASE

            WHEN ABS(
              (
                (
                  an.valeur_detectee -
                  an.valeur_reference
                )
                /
                NULLIF(
                  an.valeur_reference,
                  0
                )
              ) * 100
            ) >= ${SEUIL_CRITIQUE}
              THEN 'CRITIQUE'

            WHEN ABS(
              (
                (
                  an.valeur_detectee -
                  an.valeur_reference
                )
                /
                NULLIF(
                  an.valeur_reference,
                  0
                )
              ) * 100
            ) >= ${SEUIL_SUSPECTE}
              THEN 'SUSPECTE'

            ELSE 'ATTENTION'

          END AS niveau,

          CASE

            WHEN
              an.valeur_detectee >=
              an.valeur_reference
              THEN 'HAUSSE'

            ELSE 'BAISSE'

          END AS direction

        FROM anomalies an

        INNER JOIN releves r
          ON r.id = an.releve_id

        INNER JOIN compteurs c
          ON c.id = r.compteur_id

        INNER JOIN abonnes a
          ON a.id = c.abonne_id

        WHERE an.id = $1

        LIMIT 1
        `,
        [id]
      );

    if (
      result.rows.length === 0
    ) {

      return res.status(404).json({

        status: 'error',

        message:
          'Anomalie introuvable.',
      });
    }

    const row =
      result.rows[0];

    return res.status(200).json({

      status: 'success',

      anomalie: {

        ...row,

        valeur_detectee:
          number(
            row.valeur_detectee
          ),

        valeur_reference:
          number(
            row.valeur_reference
          ),

        seuil:
          number(row.seuil),

        variation:
          number(row.variation),

        consommation:
          number(
            row.consommation
          ),

        unite:
          uniteFromType(
            row.type_compteur
          ),

        abonne_nom_complet:
          `${row.abonne_prenom || ''} ${
            row.abonne_nom || ''
          }`.trim(),
      },
    });

  } catch (error) {

    console.error(
      'Erreur getAnomalieById :',
      error
    );

    return res.status(500).json({

      status: 'error',

      message:
        'Impossible de récupérer le détail de l’anomalie.',

      detail:
        process.env.NODE_ENV ===
        'development'
          ? error.message
          : undefined,
    });
  }
}


/*
=========================================================
PATCH /api/anomalies/:id/statut
=========================================================
*/

async function updateAnomalieStatut(
  req,
  res
) {

  const id =
    Number(req.params.id);

  const statut =
    upper(
      req.body?.statut
    );

  const commentaire =
    req.body?.commentaire !==
    undefined
      ? String(
          req.body.commentaire
        ).trim()
      : null;

  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {

    return res.status(400).json({

      status: 'error',

      message:
        'Identifiant d’anomalie invalide.',
    });
  }

  if (
    !STATUTS.includes(
      statut
    )
  ) {

    return res.status(400).json({

      status: 'error',

      message:
        `Statut invalide. Valeurs autorisées : ${STATUTS.join(', ')}.`,
    });
  }

  try {

    await ensureAnomaliesTable();

    const result =
      await pool.query(
        `
        UPDATE anomalies

        SET
          statut = $1,
          commentaire = $2

        WHERE id = $3

        RETURNING
          id,
          releve_id,
          type_anomalie,
          valeur_detectee,
          valeur_reference,
          seuil,
          date_detection,
          statut,
          commentaire
        `,
        [
          statut,
          commentaire,
          id,
        ]
      );

    if (
      result.rows.length === 0
    ) {

      return res.status(404).json({

        status: 'error',

        message:
          'Anomalie introuvable.',
      });
    }

    return res.status(200).json({

      status: 'success',

      message:
        'Statut de l’anomalie mis à jour.',

      anomalie:
        result.rows[0],
    });

  } catch (error) {

    console.error(
      'Erreur updateAnomalieStatut :',
      error
    );

    return res.status(500).json({

      status: 'error',

      message:
        'Impossible de mettre à jour le statut.',

      detail:
        process.env.NODE_ENV ===
        'development'
          ? error.message
          : undefined,
    });
  }
}


/*
=========================================================
EXPORT
=========================================================
*/

module.exports = {

  getAnomalies,

  getAnomalieStats,

  analyserAnomalies,

  getAnomalieById,

  updateAnomalieStatut,

  synchronizeAnomalies,

};