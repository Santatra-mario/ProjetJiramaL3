const pool = require('../config/db');

/* =========================================================
   UTILITAIRES
========================================================= */

/**
 * Vérifie qu'une valeur correspond réellement à une date
 * au format strict YYYY-MM-DD.
 */
function isValidDateString(value) {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const [year, month, day] = value
    .split('-')
    .map(Number);

  const date = new Date(
    Date.UTC(
      year,
      month - 1,
      day
    )
  );

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * Vérifie qu'un nombre est valide et >= 0.
 */
function isValidNonNegativeNumber(value) {
  if (
    value === null ||
    value === undefined ||
    (
      typeof value === 'string' &&
      value.trim() === ''
    )
  ) {
    return false;
  }

  const number = Number(value);

  return (
    Number.isFinite(number) &&
    number >= 0
  );
}

/**
 * Transforme une date PostgreSQL / Date JS / string
 * en YYYY-MM-DD.
 */
function formatDateOnly(value) {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    return value.slice(0, 10);
  }

  if (
    value instanceof Date &&
    !Number.isNaN(value.getTime())
  ) {
    return value
      .toISOString()
      .slice(0, 10);
  }

  return String(value).slice(0, 10);
}

/**
 * Arrondit un nombre à 2 décimales.
 */
function formatNumber(value) {
  return Number(
    Number(value).toFixed(2)
  );
}

/* =========================================================
   SELECT COMMUN
========================================================= */

/**
 * Cette requête reconstruit l'affichage de la période.
 *
 * IMPORTANT :
 * - pour les relevés suivants, la date précédente affichée
 *   vient de la chronologie réelle du compteur ;
 * - pour le premier relevé, on conserve date_ancien_releve.
 */
const releveSelect = `
  WITH ordered_releves AS (
    SELECT
      r.*,

      LAG(r.date_releve) OVER (
        PARTITION BY r.compteur_id
        ORDER BY
          r.date_releve ASC,
          r.id ASC
      ) AS date_releve_precedent_calculee,

      LAG(r.nouvel_index) OVER (
        PARTITION BY r.compteur_id
        ORDER BY
          r.date_releve ASC,
          r.id ASC
      ) AS nouvel_index_precedent_calcule
    FROM releves r
  )

  SELECT
    r.id,
    r.compteur_id,

    c.numero_compteur,
    c.type AS type_compteur,
    c.statut AS statut_compteur,
    c.date_installation,

    c.abonne_id,

    a.numero_abonne,
    a.nom AS abonne_nom,
    a.prenom AS abonne_prenom,
    a.adresse AS abonne_adresse,

    r.date_releve,

    CASE
      WHEN r.date_releve_precedent_calculee IS NOT NULL
        THEN r.date_releve_precedent_calculee

      WHEN r.date_ancien_releve IS NOT NULL
        THEN r.date_ancien_releve

      ELSE NULL
    END AS date_ancien_releve,

    CASE
      WHEN r.date_releve_precedent_calculee IS NOT NULL
        THEN r.date_releve_precedent_calculee

      WHEN r.date_ancien_releve IS NOT NULL
        THEN r.date_ancien_releve

      ELSE NULL
    END AS date_debut_periode,

    CASE
      WHEN r.date_releve_precedent_calculee IS NOT NULL
        THEN 'RELEVE_PRECEDENT'

      WHEN r.date_ancien_releve IS NOT NULL
        THEN 'RELEVE_ANTERIEUR'

      ELSE NULL
    END AS origine_periode,

    CASE
      WHEN r.date_releve_precedent_calculee IS NOT NULL
        THEN (
          r.date_releve -
          r.date_releve_precedent_calculee
        )

      WHEN r.date_ancien_releve IS NOT NULL
        THEN (
          r.date_releve -
          r.date_ancien_releve
        )

      ELSE NULL
    END AS nombre_jours,

    r.ancien_index,
    r.nouvel_index,
    r.consommation,

    CASE
      WHEN c.type = 'EAU'
        THEN 'm³'
      ELSE 'kWh'
    END AS unite,

    r.created_by,

    COALESCE(
      NULLIF(
        TRIM(
          CONCAT_WS(
            ' ',
            u.prenom,
            u.nom
          )
        ),
        ''
      ),
      'Utilisateur inconnu'
    ) AS saisie_par,

    r.created_at,
    r.updated_at

  FROM ordered_releves r

  INNER JOIN compteurs c
    ON c.id = r.compteur_id

  INNER JOIN abonnes a
    ON a.id = c.abonne_id

  LEFT JOIN users u
    ON u.id = r.created_by
`;

/* =========================================================
   GET TOUS LES RELEVÉS
========================================================= */

async function getAllReleves(
  req,
  res
) {
  try {
    const result =
      await pool.query(`
        ${releveSelect}

        ORDER BY
          r.date_releve DESC,
          r.id DESC
      `);

    return res.status(200).json({
      status: 'success',
      releves: result.rows,
    });
  } catch (error) {
    console.error(
      'Erreur getAllReleves :',
      error
    );

    return res.status(500).json({
      status: 'error',
      message:
        'Impossible de récupérer les relevés.',
    });
  }
}

/* =========================================================
   GET UN RELEVÉ
========================================================= */

async function getReleveById(
  req,
  res
) {
  const { id } =
    req.params;

  const releveId =
    Number(id);

  if (
    !Number.isInteger(
      releveId
    ) ||
    releveId <= 0
  ) {
    return res.status(400).json({
      status: 'error',
      message:
        'Identifiant de relevé invalide.',
    });
  }

  try {
    const result =
      await pool.query(
        `
          ${releveSelect}

          WHERE r.id = $1
        `,
        [releveId]
      );

    if (
      result.rows.length ===
      0
    ) {
      return res.status(404).json({
        status: 'error',
        message:
          'Relevé introuvable.',
      });
    }

    return res.status(200).json({
      status: 'success',
      releve:
        result.rows[0],
    });
  } catch (error) {
    console.error(
      'Erreur getReleveById :',
      error
    );

    return res.status(500).json({
      status: 'error',
      message:
        'Impossible de récupérer le relevé.',
    });
  }
}

/* =========================================================
   CRÉER UN RELEVÉ
========================================================= */

async function createReleve(
  req,
  res
) {
  const {
    compteur_id,
    date_ancien_releve,
    date_releve,
    ancien_index,
    nouvel_index,
  } = req.body || {};

  const compteurId =
    Number(
      compteur_id
    );

  const nouvelIndex =
    Number(
      nouvel_index
    );

  /* =======================================================
     VALIDATION DE BASE
  ======================================================= */

  if (
    !Number.isInteger(
      compteurId
    ) ||
    compteurId <= 0
  ) {
    return res.status(400).json({
      status: 'error',
      message:
        'Compteur invalide.',
    });
  }

  if (
    !isValidDateString(
      date_releve
    )
  ) {
    return res.status(400).json({
      status: 'error',
      message:
        'La date du relevé actuel est invalide.',
    });
  }

  if (
    !isValidNonNegativeNumber(
      nouvel_index
    )
  ) {
    return res.status(400).json({
      status: 'error',
      message:
        'Le nouvel index est invalide.',
    });
  }

  const client =
    await pool.connect();

  try {
    await client.query(
      'BEGIN'
    );

    /* =====================================================
       VÉRIFIER LE COMPTEUR
    ===================================================== */

    const compteurResult =
      await client.query(
        `
          SELECT
            c.id,
            c.numero_compteur,
            c.type,
            c.statut,
            c.date_installation,

            a.statut AS statut_abonne

          FROM compteurs c

          INNER JOIN abonnes a
            ON a.id = c.abonne_id

          WHERE c.id = $1

          FOR UPDATE
        `,
        [compteurId]
      );

    if (
      compteurResult.rows.length ===
      0
    ) {
      await client.query(
        'ROLLBACK'
      );

      return res.status(404).json({
        status: 'error',
        message:
          'Compteur introuvable.',
      });
    }

    const compteur =
      compteurResult.rows[0];

    const dateInstallation =
      formatDateOnly(
        compteur.date_installation
      );

    /* =====================================================
       COMPTEUR ACTIF
    ===================================================== */

    if (
      String(
        compteur.statut
      ).toUpperCase() ===
      'INACTIF'
    ) {
      await client.query(
        'ROLLBACK'
      );

      return res.status(400).json({
        status: 'error',
        message:
          'Impossible d’enregistrer un relevé sur un compteur inactif.',
      });
    }

    /* =====================================================
       ABONNÉ ACTIF
    ===================================================== */

    if (
      String(
        compteur.statut_abonne
      ).toLowerCase() !==
      'actif'
    ) {
      await client.query(
        'ROLLBACK'
      );

      return res.status(400).json({
        status: 'error',
        message:
          'Impossible d’enregistrer un relevé pour un abonné inactif.',
      });
    }

    /* =====================================================
       DATE DU RELEVÉ >= DATE INSTALLATION
    ===================================================== */

    if (
      dateInstallation &&
      date_releve <
        dateInstallation
    ) {
      await client.query(
        'ROLLBACK'
      );

      return res.status(400).json({
        status: 'error',
        message:
          'La date du relevé ne peut pas être antérieure à la date d’installation.',
      });
    }

    /* =====================================================
       CHERCHER LE DERNIER RELEVÉ
       
       IMPORTANT :
       pour un relevé suivant, on ne fait PAS confiance à
       ancien_index envoyé par le frontend.
       
       La vraie valeur est récupérée depuis PostgreSQL.
    ===================================================== */

    const previousResult =
      await client.query(
        `
          SELECT
            id,
            date_releve,
            nouvel_index

          FROM releves

          WHERE compteur_id = $1

          ORDER BY
            date_releve DESC,
            id DESC

          LIMIT 1

          FOR UPDATE
        `,
        [compteurId]
      );

    const previousReleve =
      previousResult.rows[0] ||
      null;

    let finalDateAncienReleve;
    let finalAncienIndex;

    /* =====================================================
       PREMIER RELEVÉ
    ===================================================== */

    if (
      !previousReleve
    ) {
      /* ---------------------------------------------------
         DATE PRÉCÉDENTE OBLIGATOIRE
      --------------------------------------------------- */

      if (
        !isValidDateString(
          date_ancien_releve
        )
      ) {
        await client.query(
          'ROLLBACK'
        );

        return res.status(400).json({
          status: 'error',
          message:
            'Pour le premier relevé, la date du relevé précédent est obligatoire.',
        });
      }

      /* ---------------------------------------------------
         ANCIEN INDEX OBLIGATOIRE
      --------------------------------------------------- */

      if (
        !isValidNonNegativeNumber(
          ancien_index
        )
      ) {
        await client.query(
          'ROLLBACK'
        );

        return res.status(400).json({
          status: 'error',
          message:
            'Pour le premier relevé, l’ancien index est obligatoire et doit être valide.',
        });
      }

      const ancienIndex =
        Number(
          ancien_index
        );

      /* ---------------------------------------------------
         DATE STRICTEMENT ANTÉRIEURE
      --------------------------------------------------- */

      if (
        date_ancien_releve >=
        date_releve
      ) {
        await client.query(
          'ROLLBACK'
        );

        return res.status(400).json({
          status: 'error',
          message:
            'La date du relevé précédent doit être strictement antérieure à la date du relevé actuel.',
        });
      }

      /* ---------------------------------------------------
         DATE DE RÉFÉRENCE >= INSTALLATION
      --------------------------------------------------- */

      if (
        dateInstallation &&
        date_ancien_releve <
          dateInstallation
      ) {
        await client.query(
          'ROLLBACK'
        );

        return res.status(400).json({
          status: 'error',
          message:
            'La date du relevé précédent ne peut pas être antérieure à la date d’installation.',
        });
      }

      /* ---------------------------------------------------
         INDEX CROISSANT
      --------------------------------------------------- */

      if (
        nouvelIndex <
        ancienIndex
      ) {
        await client.query(
          'ROLLBACK'
        );

        return res.status(400).json({
          status: 'error',
          message:
            'Le nouvel index doit être supérieur ou égal à l’ancien index réel.',
        });
      }

      finalDateAncienReleve =
        date_ancien_releve;

      finalAncienIndex =
        ancienIndex;
    }

    /* =====================================================
       RELEVÉ SUIVANT
    ===================================================== */

    else {
      const previousDate =
        formatDateOnly(
          previousReleve.date_releve
        );

      const previousIndex =
        Number(
          previousReleve.nouvel_index
        );

      /* ---------------------------------------------------
         VÉRIFIER L'INDEX EN BASE
      --------------------------------------------------- */

      if (
        !Number.isFinite(
          previousIndex
        ) ||
        previousIndex < 0
      ) {
        await client.query(
          'ROLLBACK'
        );

        return res.status(500).json({
          status: 'error',
          message:
            'Le dernier index enregistré pour ce compteur est incohérent.',
        });
      }

      finalDateAncienReleve =
        previousDate;

      finalAncienIndex =
        previousIndex;

      /* ---------------------------------------------------
         LA NOUVELLE DATE DOIT ÊTRE APRÈS L'ANCIENNE
      --------------------------------------------------- */

      if (
        date_releve <=
        previousDate
      ) {
        await client.query(
          'ROLLBACK'
        );

        return res.status(400).json({
          status: 'error',
          message:
            'La date du nouveau relevé doit être postérieure au relevé précédent.',
        });
      }

      /* ---------------------------------------------------
         RÈGLE MÉTIER PRINCIPALE
         
         Le nouvel index est comparé avec la vraie valeur
         récupérée depuis PostgreSQL.
      --------------------------------------------------- */

      if (
        nouvelIndex <
        finalAncienIndex
      ) {
        await client.query(
          'ROLLBACK'
        );

        return res.status(400).json({
          status: 'error',
          message:
            'Le nouvel index doit être supérieur ou égal au dernier index enregistré pour ce compteur.',
        });
      }
    }

    /* =====================================================
       VÉRIFIER LES DOUBLONS
    ===================================================== */

    const duplicateResult =
      await client.query(
        `
          SELECT
            id

          FROM releves

          WHERE compteur_id = $1
            AND date_releve = $2

          LIMIT 1
        `,
        [
          compteurId,
          date_releve,
        ]
      );

    if (
      duplicateResult.rows.length >
      0
    ) {
      await client.query(
        'ROLLBACK'
      );

      return res.status(409).json({
        status: 'error',
        message:
          'Un relevé existe déjà pour ce compteur à cette date.',
      });
    }

    /* =====================================================
       CALCUL CONSOMMATION
    ===================================================== */

    const consommation =
      formatNumber(
        nouvelIndex -
        finalAncienIndex
      );

    if (
      !Number.isFinite(
        consommation
      ) ||
      consommation < 0
    ) {
      await client.query(
        'ROLLBACK'
      );

      return res.status(400).json({
        status: 'error',
        message:
          'La consommation calculée est invalide.',
      });
    }

    /* =====================================================
       INSERTION
    ===================================================== */

    const insertResult =
      await client.query(
        `
          INSERT INTO releves (
            compteur_id,
            date_ancien_releve,
            date_releve,
            ancien_index,
            nouvel_index,
            consommation,
            created_by
          )

          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7
          )

          RETURNING id
        `,
        [
          compteurId,
          finalDateAncienReleve,
          date_releve,
          finalAncienIndex,
          nouvelIndex,
          consommation,
          req.user.id,
        ]
      );

    await client.query(
      'COMMIT'
    );

    return res.status(201).json({
      status: 'success',
      message:
        'Relevé enregistré avec succès.',
      releve_id:
        insertResult.rows[0].id,
    });
  } catch (error) {
    await client
      .query('ROLLBACK')
      .catch(() => {});

    console.error(
      'Erreur createReleve :',
      error
    );

    return res.status(500).json({
      status: 'error',
      message:
        'Impossible d’enregistrer le relevé.',
    });
  } finally {
    client.release();
  }
}

/* =========================================================
   MODIFIER UN RELEVÉ
========================================================= */

/**
 * La modification reconstruit toute la chronologie du compteur.
 *
 * Exemple :
 *
 * 01/01 → 100
 * 31/01 → 150
 * 28/02 → 200
 * 31/03 → 250
 *
 * Si 28/02 devient index 220 :
 *
 * 01/01 → 100
 * 31/01 → 150
 * 28/02 → 220
 * 31/03 → 250
 *
 * Alors :
 *
 * 31/01 = 150 - 100 = 50
 * 28/02 = 220 - 150 = 70
 * 31/03 = 250 - 220 = 30
 */
async function updateReleve(
  req,
  res
) {
  const {
    id,
  } = req.params;

  const {
    date_ancien_releve,
    date_releve,
    ancien_index,
    nouvel_index,
  } = req.body || {};

  const releveId =
    Number(id);

  const nouvelIndex =
    Number(
      nouvel_index
    );

  /* =====================================================
     VALIDATION DE BASE
  ===================================================== */

  if (
    !Number.isInteger(
      releveId
    ) ||
    releveId <= 0
  ) {
    return res.status(400).json({
      status: 'error',
      message:
        'Identifiant de relevé invalide.',
    });
  }

  if (
    !isValidDateString(
      date_releve
    )
  ) {
    return res.status(400).json({
      status: 'error',
      message:
        'Date du relevé invalide.',
    });
  }

  if (
    !isValidNonNegativeNumber(
      nouvel_index
    )
  ) {
    return res.status(400).json({
      status: 'error',
      message:
        'Nouvel index invalide.',
    });
  }

  const client =
    await pool.connect();

  try {
    await client.query(
      'BEGIN'
    );

    /* =====================================================
       RÉCUPÉRER LE RELEVÉ À MODIFIER
    ===================================================== */

    const currentResult =
      await client.query(
        `
          SELECT
            r.*,

            c.date_installation,
            c.statut AS statut_compteur,

            a.statut AS statut_abonne

          FROM releves r

          INNER JOIN compteurs c
            ON c.id = r.compteur_id

          INNER JOIN abonnes a
            ON a.id = c.abonne_id

          WHERE r.id = $1

          FOR UPDATE
        `,
        [releveId]
      );

    if (
      currentResult.rows.length ===
      0
    ) {
      await client.query(
        'ROLLBACK'
      );

      return res.status(404).json({
        status: 'error',
        message:
          'Relevé introuvable.',
      });
    }

    const current =
      currentResult.rows[0];

    /* =====================================================
       COMPTEUR ACTIF
    ===================================================== */

    if (
      String(
        current.statut_compteur
      ).toUpperCase() ===
      'INACTIF'
    ) {
      await client.query(
        'ROLLBACK'
      );

      return res.status(400).json({
        status: 'error',
        message:
          'Impossible de modifier un relevé d’un compteur inactif.',
      });
    }

    /* =====================================================
       ABONNÉ ACTIF
    ===================================================== */

    if (
      String(
        current.statut_abonne
      ).toLowerCase() !==
      'actif'
    ) {
      await client.query(
        'ROLLBACK'
      );

      return res.status(400).json({
        status: 'error',
        message:
          'Impossible de modifier un relevé d’un abonné inactif.',
      });
    }

    const compteurId =
      Number(
        current.compteur_id
      );

    const dateInstallation =
      formatDateOnly(
        current.date_installation
      );

    /* =====================================================
       RÉCUPÉRER TOUT L'HISTORIQUE DU COMPTEUR
    ===================================================== */

    const historyResult =
      await client.query(
        `
          SELECT
            id,
            compteur_id,
            date_ancien_releve,
            date_releve,
            ancien_index,
            nouvel_index,
            consommation

          FROM releves

          WHERE compteur_id = $1

          ORDER BY
            date_releve ASC,
            id ASC

          FOR UPDATE
        `,
        [compteurId]
      );

    const history =
      historyResult.rows;

    if (
      history.length ===
      0
    ) {
      await client.query(
        'ROLLBACK'
      );

      return res.status(400).json({
        status: 'error',
        message:
          'L’historique du compteur est vide.',
      });
    }

    /* =====================================================
       CONSTRUIRE LA NOUVELLE CHRONOLOGIE
       
       On retire d'abord le relevé actuel.
       Ensuite on le réinsère avec sa nouvelle date/index.
       Puis on trie toute la chronologie.
    ===================================================== */

    const candidate = {
      ...current,

      id:
        releveId,

      compteur_id:
        compteurId,

      date_releve:
        date_releve,

      nouvel_index:
        nouvelIndex,
    };

    const proposedHistory =
      history
        .filter(
          (row) =>
            Number(
              row.id
            ) !==
            releveId
        )
        .map(
          (row) => ({
            ...row,

            date_releve:
              formatDateOnly(
                row.date_releve
              ),

            nouvel_index:
              Number(
                row.nouvel_index
              ),
          })
        );

    proposedHistory.push(
      candidate
    );

    proposedHistory.sort(
      (a, b) => {
        const dateA =
          formatDateOnly(
            a.date_releve
          );

        const dateB =
          formatDateOnly(
            b.date_releve
          );

        const dateCompare =
          dateA.localeCompare(
            dateB
          );

        if (
          dateCompare !==
          0
        ) {
          return dateCompare;
        }

        return (
          Number(a.id) -
          Number(b.id)
        );
      }
    );

    /* =====================================================
       DOUBLON DE DATE
    ===================================================== */

    for (
      let i = 1;
      i <
      proposedHistory.length;
      i += 1
    ) {
      const previous =
        proposedHistory[
          i - 1
        ];

      const currentRow =
        proposedHistory[i];

      const previousDate =
        formatDateOnly(
          previous.date_releve
        );

      const currentDate =
        formatDateOnly(
          currentRow.date_releve
        );

      if (
        currentDate ===
        previousDate
      ) {
        await client.query(
          'ROLLBACK'
        );

        return res.status(409).json({
          status: 'error',
          message:
            'Deux relevés du même compteur ne peuvent pas avoir la même date.',
        });
      }
    }

    /* =====================================================
       DÉTERMINER LE PREMIER RELEVÉ
    ===================================================== */

    const resultingFirst =
      proposedHistory[0];

    if (
      !resultingFirst
    ) {
      await client.query(
        'ROLLBACK'
      );

      return res.status(400).json({
        status: 'error',
        message:
          'Impossible de déterminer le premier relevé.',
      });
    }

    const resultingFirstId =
      Number(
        resultingFirst.id
      );

    let baselineDate;
    let baselineIndex;

    /* =====================================================
       CAS 1 :
       LE RELEVÉ MODIFIÉ RESTE LE PREMIER
       
       Dans ce cas, la date de référence et l'ancien index
       peuvent être modifiés par l'utilisateur.
    ===================================================== */

    if (
      resultingFirstId ===
      releveId
    ) {
      if (
        !isValidDateString(
          date_ancien_releve
        )
      ) {
        await client.query(
          'ROLLBACK'
        );

        return res.status(400).json({
          status: 'error',
          message:
            'Pour le premier relevé, la date du relevé précédent est obligatoire.',
        });
      }

      if (
        !isValidNonNegativeNumber(
          ancien_index
        )
      ) {
        await client.query(
          'ROLLBACK'
        );

        return res.status(400).json({
          status: 'error',
          message:
            'Pour le premier relevé, l’ancien index est obligatoire et doit être valide.',
        });
      }

      baselineDate =
        date_ancien_releve;

      baselineIndex =
        Number(
          ancien_index
        );
    }

    /* =====================================================
       CAS 2 :
       UN AUTRE RELEVÉ DEVIENT LE PREMIER
       
       Dans ce cas, sa propre référence historique devient
       la baseline du compteur.
    ===================================================== */

    else {
      baselineDate =
        formatDateOnly(
          resultingFirst
            .date_ancien_releve
        );

      baselineIndex =
        Number(
          resultingFirst
            .ancien_index
        );

      if (
        !isValidDateString(
          baselineDate
        ) ||
        !Number.isFinite(
          baselineIndex
        ) ||
        baselineIndex < 0
      ) {
        await client.query(
          'ROLLBACK'
        );

        return res.status(500).json({
          status: 'error',
          message:
            'Les données du premier relevé du compteur sont incohérentes.',
        });
      }
    }

    /* =====================================================
       BASELINE >= DATE INSTALLATION
    ===================================================== */

    if (
      dateInstallation &&
      baselineDate <
        dateInstallation
    ) {
      await client.query(
        'ROLLBACK'
      );

      return res.status(400).json({
        status: 'error',
        message:
          'La date du relevé précédent ne peut pas être antérieure à la date d’installation.',
      });
    }

    /* =====================================================
       CONSTRUIRE TOUTE LA CHAÎNE RECALCULÉE
    ===================================================== */

    let previousDate =
      baselineDate;

    let previousIndex =
      baselineIndex;

    const recalculatedRows =
      [];

    for (
      let i = 0;
      i <
      proposedHistory.length;
      i += 1
    ) {
      const row =
        proposedHistory[i];

      const rowDate =
        formatDateOnly(
          row.date_releve
        );

      const rowNewIndex =
        Number(
          row.nouvel_index
        );

      /* ---------------------------------------------------
         DATE VALIDE
      --------------------------------------------------- */

      if (
        !isValidDateString(
          rowDate
        )
      ) {
        await client.query(
          'ROLLBACK'
        );

        return res.status(400).json({
          status: 'error',
          message:
            'Une date de relevé est invalide.',
        });
      }

      /* ---------------------------------------------------
         INDEX VALIDE
      --------------------------------------------------- */

      if (
        !Number.isFinite(
          rowNewIndex
        ) ||
        rowNewIndex < 0
      ) {
        await client.query(
          'ROLLBACK'
        );

        return res.status(400).json({
          status: 'error',
          message:
            'Un nouvel index du compteur est invalide.',
        });
      }

      /* ---------------------------------------------------
         DATE DU RELEVÉ >= DATE DE RÉFÉRENCE
      --------------------------------------------------- */

      if (
        rowDate <
        baselineDate
      ) {
        await client.query(
          'ROLLBACK'
        );

        return res.status(400).json({
          status: 'error',
          message:
            'Un relevé ne peut pas être antérieur à la date du relevé de référence.',
        });
      }

      /* ---------------------------------------------------
         LE PREMIER RELEVÉ DOIT ÊTRE APRÈS LA BASELINE
      --------------------------------------------------- */

      if (
        i === 0 &&
        rowDate <=
          baselineDate
      ) {
        await client.query(
          'ROLLBACK'
        );

        return res.status(400).json({
          status: 'error',
          message:
            'La date du premier relevé doit être strictement postérieure à la date du relevé de référence.',
        });
      }

      /* ---------------------------------------------------
         CHRONOLOGIE STRICTEMENT CROISSANTE
      --------------------------------------------------- */

      if (
        i > 0 &&
        rowDate <=
          previousDate
      ) {
        await client.query(
          'ROLLBACK'
        );

        return res.status(400).json({
          status: 'error',
          message:
            'Les dates des relevés doivent être strictement croissantes.',
        });
      }

      /* ---------------------------------------------------
         INDEX CROISSANT
      --------------------------------------------------- */

      if (
        rowNewIndex <
        previousIndex
      ) {
        await client.query(
          'ROLLBACK'
        );

        return res.status(400).json({
          status: 'error',
          message:
            'Le nouvel index doit être supérieur ou égal à l’index du relevé précédent.',
        });
      }

      /* ---------------------------------------------------
         CONSOMMATION
      --------------------------------------------------- */

      const consommation =
        formatNumber(
          rowNewIndex -
          previousIndex
        );

      if (
        !Number.isFinite(
          consommation
        ) ||
        consommation < 0
      ) {
        await client.query(
          'ROLLBACK'
        );

        return res.status(400).json({
          status: 'error',
          message:
            'La consommation calculée est invalide.',
        });
      }

      recalculatedRows.push({
        id:
          Number(
            row.id
          ),

        date_releve:
          rowDate,

        date_ancien_releve:
          previousDate,

        ancien_index:
          previousIndex,

        nouvel_index:
          rowNewIndex,

        consommation,
      });

      /* ---------------------------------------------------
         PASSER À LA LIGNE SUIVANTE
      --------------------------------------------------- */

      previousDate =
        rowDate;

      previousIndex =
        rowNewIndex;
    }

    /* =====================================================
       APPLIQUER LES VALEURS RECALCULÉES
    ===================================================== */

    for (
      const row of
      recalculatedRows
    ) {
      await client.query(
        `
          UPDATE releves

          SET
            date_ancien_releve = $1,
            date_releve = $2,
            ancien_index = $3,
            nouvel_index = $4,
            consommation = $5,
            updated_at = CURRENT_TIMESTAMP

          WHERE id = $6
        `,
        [
          row.date_ancien_releve,
          row.date_releve,
          row.ancien_index,
          row.nouvel_index,
          row.consommation,
          row.id,
        ]
      );
    }

    /* =====================================================
       COMMIT
    ===================================================== */

    await client.query(
      'COMMIT'
    );

    return res.status(200).json({
      status: 'success',
      message:
        'Relevé modifié avec succès.',
    });
  } catch (error) {
    await client
      .query('ROLLBACK')
      .catch(() => {});

    console.error(
      'Erreur updateReleve :',
      error
    );

    return res.status(500).json({
      status: 'error',
      message:
        'Impossible de modifier le relevé.',
    });
  } finally {
    client.release();
  }
}

/* =========================================================
   SUPPRIMER UN RELEVÉ
========================================================= */

async function deleteReleve(
  req,
  res
) {
  const { id } =
    req.params;

  const releveId =
    Number(id);

  if (
    !Number.isInteger(
      releveId
    ) ||
    releveId <= 0
  ) {
    return res.status(400).json({
      status: 'error',
      message:
        'Identifiant de relevé invalide.',
    });
  }

  const client =
    await pool.connect();

  try {
    await client.query(
      'BEGIN'
    );

    /* =====================================================
       RÉCUPÉRER LE RELEVÉ
    ===================================================== */

    const result =
      await client.query(
        `
          SELECT
            id,
            compteur_id,
            date_releve

          FROM releves

          WHERE id = $1

          FOR UPDATE
        `,
        [releveId]
      );

    if (
      result.rows.length ===
      0
    ) {
      await client.query(
        'ROLLBACK'
      );

      return res.status(404).json({
        status: 'error',
        message:
          'Relevé introuvable.',
      });
    }

    const releve =
      result.rows[0];

    /* =====================================================
       TROUVER LE DERNIER RELEVÉ DU COMPTEUR
    ===================================================== */

    const lastResult =
      await client.query(
        `
          SELECT
            id,
            date_releve

          FROM releves

          WHERE compteur_id = $1

          ORDER BY
            date_releve DESC,
            id DESC

          LIMIT 1

          FOR UPDATE
        `,
        [
          releve.compteur_id,
        ]
      );

    /* =====================================================
       SEUL LE DERNIER RELEVÉ PEUT ÊTRE SUPPRIMÉ
    ===================================================== */

    if (
      lastResult.rows.length ===
      0 ||
      Number(
        lastResult.rows[0].id
      ) !==
        releveId
    ) {
      await client.query(
        'ROLLBACK'
      );

      return res.status(400).json({
        status: 'error',
        message:
          'Seul le dernier relevé du compteur peut être supprimé.',
      });
    }

    /* =====================================================
       SUPPRESSION
    ===================================================== */

    await client.query(
      `
        DELETE FROM releves
        WHERE id = $1
      `,
      [releveId]
    );

    await client.query(
      'COMMIT'
    );

    return res.status(200).json({
      status: 'success',
      message:
        'Relevé supprimé avec succès.',
    });
  } catch (error) {
    await client
      .query('ROLLBACK')
      .catch(() => {});

    console.error(
      'Erreur deleteReleve :',
      error
    );

    return res.status(500).json({
      status: 'error',
      message:
        'Impossible de supprimer le relevé.',
    });
  } finally {
    client.release();
  }
}

/* =========================================================
   HISTORIQUE PAR COMPTEUR
========================================================= */

async function getRelevesByCompteur(
  req,
  res
) {
  const {
    compteurId,
  } = req.params;

  const numericCompteurId =
    Number(
      compteurId
    );

  if (
    !Number.isInteger(
      numericCompteurId
    ) ||
    numericCompteurId <= 0
  ) {
    return res.status(400).json({
      status: 'error',
      message:
        'Identifiant de compteur invalide.',
    });
  }

  try {
    const result =
      await pool.query(
        `
          ${releveSelect}

          WHERE r.compteur_id = $1

          ORDER BY
            r.date_releve DESC,
            r.id DESC
        `,
        [
          numericCompteurId,
        ]
      );

    return res.status(200).json({
      status: 'success',
      releves:
        result.rows,
    });
  } catch (error) {
    console.error(
      'Erreur getRelevesByCompteur :',
      error
    );

    return res.status(500).json({
      status: 'error',
      message:
        'Impossible de récupérer l’historique du compteur.',
    });
  }
}

/* =========================================================
   EXPORT
========================================================= */

module.exports = {
  getAllReleves,
  getReleveById,
  createReleve,
  updateReleve,
  deleteReleve,
  getRelevesByCompteur,
};