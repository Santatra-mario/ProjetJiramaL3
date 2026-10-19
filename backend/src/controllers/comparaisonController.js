const pool = require('../config/db');


/* =========================================================
   UTILITAIRES
========================================================= */

function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
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


/*
   Normalisation du type de compteur
*/
function normalizeType(value) {

  const type =
    String(
      value || ''
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


  return null;
}


/* =========================================================
   STATISTIQUES D'UNE PÉRIODE
========================================================= */

async function getStatsPeriode({
  dateDebut,
  dateFin,
  type,
  compteurId,
}) {
  const params = [dateDebut, dateFin, type];
  let compteurCondition = '';

  if (compteurId) {
    params.push(Number(compteurId));
    compteurCondition = `AND c.id = $${params.length}`;
  }

  /*
   * La consommation d'une période est calculée à partir des index du compteur,
   * pas en additionnant les lignes dont la date tombe dans la période.
   * Pour chaque compteur : index de fin retenu - index de départ retenu.
   * Les dates des lectures réellement utilisées sont renvoyées à l'interface.
   */
  const query = `
    SELECT
      c.id AS compteur_id,
      c.numero_compteur,
      c.abonne_id,
      a.numero_abonne,
      TRIM(CONCAT_WS(' ', a.prenom, a.nom)) AS abonne,

      COALESCE((
        SELECT COUNT(*)::int
        FROM releves rp
        WHERE rp.compteur_id = c.id
          AND rp.date_releve::date >= $1::date
          AND rp.date_releve::date <= $2::date
      ), 0) AS nombre_releves,

      debut.index_value AS index_debut,
      debut.index_date AS date_index_debut,
      debut.origine AS origine_index_debut,

      fin.index_value AS index_fin,
      fin.index_date AS date_index_fin,
      fin.origine AS origine_index_fin

    FROM compteurs c
    LEFT JOIN abonnes a ON a.id = c.abonne_id

    LEFT JOIN LATERAL (
      SELECT candidat.index_value, TO_CHAR(candidat.index_date, 'YYYY-MM-DD') AS index_date, candidat.origine
      FROM (
        SELECT
          r.nouvel_index::numeric AS index_value,
          r.date_releve::date AS index_date,
          'Nouvel index du relevé'::text AS origine,
          0::int AS priorite,
          r.id::bigint AS releve_id
        FROM releves r
        WHERE r.compteur_id = c.id
          AND r.date_releve::date <= $1::date
          AND r.nouvel_index IS NOT NULL

        UNION ALL

        SELECT
          r.ancien_index::numeric AS index_value,
          r.date_ancien_releve::date AS index_date,
          'Ancien index du relevé suivant'::text AS origine,
          1::int AS priorite,
          r.id::bigint AS releve_id
        FROM releves r
        WHERE r.compteur_id = c.id
          AND r.date_releve::date > $1::date
          AND r.date_ancien_releve IS NOT NULL
          AND r.date_ancien_releve::date <= $1::date
          AND r.ancien_index IS NOT NULL
      ) AS candidat
      ORDER BY candidat.index_date DESC NULLS LAST,
               candidat.priorite ASC,
               candidat.releve_id DESC
      LIMIT 1
    ) AS debut ON TRUE

    LEFT JOIN LATERAL (
      SELECT candidat.index_value, TO_CHAR(candidat.index_date, 'YYYY-MM-DD') AS index_date, candidat.origine
      FROM (
        SELECT
          r.nouvel_index::numeric AS index_value,
          r.date_releve::date AS index_date,
          'Nouvel index du relevé'::text AS origine,
          0::int AS priorite,
          r.id::bigint AS releve_id
        FROM releves r
        WHERE r.compteur_id = c.id
          AND r.date_releve::date <= $2::date
          AND r.nouvel_index IS NOT NULL

        UNION ALL

        SELECT
          r.ancien_index::numeric AS index_value,
          r.date_ancien_releve::date AS index_date,
          'Ancien index du relevé suivant'::text AS origine,
          1::int AS priorite,
          r.id::bigint AS releve_id
        FROM releves r
        WHERE r.compteur_id = c.id
          AND r.date_releve::date > $2::date
          AND r.date_ancien_releve IS NOT NULL
          AND r.date_ancien_releve::date <= $2::date
          AND r.ancien_index IS NOT NULL
      ) AS candidat
      ORDER BY candidat.index_date DESC NULLS LAST,
               candidat.priorite ASC,
               candidat.releve_id DESC
      LIMIT 1
    ) AS fin ON TRUE

    WHERE UPPER(TRIM(c.type)) IN ($3, CASE WHEN $3 = 'ELECTRICITE' THEN 'ÉLECTRICITÉ' ELSE $3 END)
      ${compteurCondition}

    ORDER BY c.numero_compteur ASC, c.id ASC
  `;

  const result = await pool.query(query, params);

  const detailsComplets = result.rows.map((row) => {
    const valeurIndexDebut = row.index_debut === null || row.index_debut === undefined
      ? null
      : Number(row.index_debut);
    const valeurIndexFin = row.index_fin === null || row.index_fin === undefined
      ? null
      : Number(row.index_fin);
    const indexDebut = Number.isFinite(valeurIndexDebut) ? valeurIndexDebut : null;
    const indexFin = Number.isFinite(valeurIndexFin) ? valeurIndexFin : null;
    const dateIndexDebut = row.date_index_debut
      ? String(row.date_index_debut).slice(0, 10)
      : null;
    const dateIndexFin = row.date_index_fin
      ? String(row.date_index_fin).slice(0, 10)
      : null;
    const nombreReleves = Number(row.nombre_releves || 0);

    let consommationCalculee = null;
    let statutCalcul = 'INDEX_MANQUANT';
    let messageCalcul = 'Index de départ ou de fin indisponible pour cette période.';

    if (indexDebut !== null && indexFin !== null) {
      if (!dateIndexDebut || !dateIndexFin) {
        statutCalcul = 'DATE_INDEX_MANQUANTE';
        messageCalcul = 'La date d’une des lectures utilisées n’est pas disponible.';
      } else if (dateIndexFin <= dateIndexDebut) {
        statutCalcul = 'LECTURE_INSUFFISANTE';
        messageCalcul = 'Deux lectures datées et distinctes sont nécessaires pour calculer la consommation.';
      } else if (indexFin < indexDebut) {
        statutCalcul = 'INDEX_INCOHERENT';
        messageCalcul = 'L’index de fin est inférieur à l’index de départ. Vérification nécessaire.';
      } else {
        consommationCalculee = round2(indexFin - indexDebut);
        statutCalcul = 'CALCULABLE';
        messageCalcul = 'Consommation calculée par différence entre les deux index retenus.';
      }
    }

    return {
      compteur_id: Number(row.compteur_id),
      numero_compteur: row.numero_compteur || null,
      numero_abonne: row.numero_abonne || null,
      abonne: row.abonne || null,
      nombre_releves: nombreReleves,
      index_debut: indexDebut,
      date_index_debut: dateIndexDebut,
      origine_index_debut: row.origine_index_debut || null,
      index_fin: indexFin,
      date_index_fin: dateIndexFin,
      origine_index_fin: row.origine_index_fin || null,
      consommation_calculee: consommationCalculee,
      statut_calcul: statutCalcul,
      message_calcul: messageCalcul,
    };
  });

  // Évite de présenter tous les compteurs de la base lorsque l'utilisateur
  // compare tous les compteurs : seuls ceux liés à la période sont détaillés.
  const detailsIndices = detailsComplets.filter((ligne) =>
    Boolean(compteurId) || ligne.nombre_releves > 0
  );

  const calculables = detailsIndices.filter(
    (ligne) => ligne.consommation_calculee !== null
  );
  const valeurs = calculables.map((ligne) => ligne.consommation_calculee);
  const total = valeurs.length > 0
    ? round2(valeurs.reduce((somme, valeur) => somme + valeur, 0))
    : null;

  return {
    nombre_releves: detailsIndices.reduce(
      (somme, ligne) => somme + ligne.nombre_releves,
      0
    ),
    total,
    moyenne: valeurs.length > 0
      ? round2(valeurs.reduce((somme, valeur) => somme + valeur, 0) / valeurs.length)
      : null,
    minimum: valeurs.length > 0 ? round2(Math.min(...valeurs)) : null,
    maximum: valeurs.length > 0 ? round2(Math.max(...valeurs)) : null,
    nombre_compteurs_calcules: calculables.length,
    nombre_compteurs_non_calculables: detailsIndices.length - calculables.length,
    details_indices: detailsIndices,
    methode_calcul: 'DIFFERENCE_INDEX',
  };
}


/* =========================================================
   GET /api/comparaison/dates-disponibles
   Renvoie uniquement les dates réelles présentes dans PostgreSQL.
   Les dates de nouvel_index et d'ancien_index sont toutes deux prises
   en compte, car chacune peut constituer une borne réelle de comparaison.
========================================================= */

async function getDatesDisponibles(req, res) {
  try {
    const type = normalizeType(req.query.type);
    const compteurIdRaw = String(req.query.compteurId || '').trim();

    if (!type) {
      return res.status(400).json({
        status: 'error',
        message: 'Le type doit être EAU ou ELECTRICITE.',
      });
    }

    let compteurId = null;

    if (compteurIdRaw) {
      if (!/^\d+$/.test(compteurIdRaw) || Number(compteurIdRaw) <= 0) {
        return res.status(400).json({
          status: 'error',
          message: 'Le compteur sélectionné est invalide.',
        });
      }

      compteurId = Number(compteurIdRaw);
      const compteurResult = await pool.query(
        'SELECT id, type FROM compteurs WHERE id = $1',
        [compteurId]
      );

      if (compteurResult.rowCount === 0) {
        return res.status(404).json({
          status: 'error',
          message: 'Compteur introuvable.',
        });
      }

      if (normalizeType(compteurResult.rows[0].type) !== type) {
        return res.status(400).json({
          status: 'error',
          message: 'Le compteur sélectionné ne correspond pas au type choisi.',
        });
      }
    }

    const result = await pool.query(
      `
        WITH dates_reelles AS (
          SELECT
            r.compteur_id,
            r.date_releve::date AS date_lecture
          FROM releves r
          INNER JOIN compteurs c ON c.id = r.compteur_id
          WHERE UPPER(TRIM(c.type)) IN ($1, CASE WHEN $1 = 'ELECTRICITE' THEN 'ÉLECTRICITÉ' ELSE $1 END)
            AND r.date_releve IS NOT NULL
            AND r.nouvel_index IS NOT NULL
            AND ($2::integer IS NULL OR c.id = $2::integer)

          UNION

          SELECT
            r.compteur_id,
            r.date_ancien_releve::date AS date_lecture
          FROM releves r
          INNER JOIN compteurs c ON c.id = r.compteur_id
          WHERE UPPER(TRIM(c.type)) IN ($1, CASE WHEN $1 = 'ELECTRICITE' THEN 'ÉLECTRICITÉ' ELSE $1 END)
            AND r.date_ancien_releve IS NOT NULL
            AND r.ancien_index IS NOT NULL
            AND ($2::integer IS NULL OR c.id = $2::integer)
        )
        SELECT
          TO_CHAR(date_lecture, 'YYYY-MM-DD') AS date,
          COUNT(DISTINCT compteur_id)::int AS nombre_compteurs,
          COUNT(*)::int AS nombre_lectures
        FROM dates_reelles
        WHERE date_lecture IS NOT NULL
        GROUP BY date_lecture
        ORDER BY date_lecture ASC
      `,
      [type, compteurId]
    );

    const dates = result.rows.map((row) => row.date);

    return res.status(200).json({
      status: 'success',
      data: {
        type,
        compteurId,
        nombreDates: dates.length,
        premiereDate: dates[0] || null,
        derniereDate: dates[dates.length - 1] || null,
        dates,
        details: result.rows,
      },
    });
  } catch (error) {
    console.error('Erreur chargement dates de comparaison :', error);
    return res.status(500).json({
      status: 'error',
      message: 'Impossible de charger les dates de relevés depuis la base de données.',
    });
  }
}

/* =========================================================
   GET /api/comparaison
========================================================= */

async function getComparaison(
  req,
  res
) {

  try {

    /*
    -------------------------------------------------------
       PARAMÈTRES
    -------------------------------------------------------
    */

    const dateDebut1 =
      String(
        req.query.dateDebut1 ||
        ''
      ).trim();


    const dateFin1 =
      String(
        req.query.dateFin1 ||
        ''
      ).trim();


    const dateDebut2 =
      String(
        req.query.dateDebut2 ||
        ''
      ).trim();


    const dateFin2 =
      String(
        req.query.dateFin2 ||
        ''
      ).trim();


    const type =
      normalizeType(
        req.query.type
      );


    const compteurIdRaw =
      String(
        req.query.compteurId ||
        ''
      ).trim();


    /* =====================================================
       VALIDATION DES DATES
    ===================================================== */

    if (
      !dateDebut1 ||
      !dateFin1 ||
      !dateDebut2 ||
      !dateFin2
    ) {

      return res.status(
        400
      ).json({

        status:
          'error',

        message:
          'Les quatre dates des deux périodes sont obligatoires.',

      });

    }


    const dates = [

      [
        'dateDebut1',
        dateDebut1,
      ],

      [
        'dateFin1',
        dateFin1,
      ],

      [
        'dateDebut2',
        dateDebut2,
      ],

      [
        'dateFin2',
        dateFin2,
      ],

    ];


    for (
      const [
        label,
        value,
      ]
      of dates
    ) {

      if (
        !isValidDate(
          value
        )
      ) {

        return res.status(
          400
        ).json({

          status:
            'error',

          message:
            `La date ${label} est invalide. Format attendu : YYYY-MM-DD.`,

        });

      }

    }


    /* =====================================================
       VALIDATION DES PÉRIODES
    ===================================================== */

    if (
      dateDebut1 >
      dateFin1
    ) {

      return res.status(
        400
      ).json({

        status:
          'error',

        message:
          'La période 1 est invalide : la date de début doit être antérieure ou égale à la date de fin.',

      });

    }


    if (
      dateDebut2 >
      dateFin2
    ) {

      return res.status(
        400
      ).json({

        status:
          'error',

        message:
          'La période 2 est invalide : la date de début doit être antérieure ou égale à la date de fin.',

      });

    }


    /* =====================================================
       VALIDATION DU CHEVAUCHEMENT
    ===================================================== */

    if (dateFin1 >= dateDebut2) {
      return res.status(400).json({
        status: 'error',
        message: 'Les périodes ne doivent pas se chevaucher : la période 1 doit se terminer avant le début de la période 2.',
      });
    }


    /* =====================================================
       VALIDATION TYPE
    ===================================================== */

    if (
      !type
    ) {

      return res.status(
        400
      ).json({

        status:
          'error',

        message:
          'Le type doit être EAU ou ELECTRICITE.',

      });

    }


    /* =====================================================
       VALIDATION COMPTEUR
    ===================================================== */

    let compteurId =
      null;


    let compteur =
      null;


    if (
      compteurIdRaw
    ) {

      if (
        !/^\d+$/.test(
          compteurIdRaw
        ) ||
        Number(
          compteurIdRaw
        ) <= 0
      ) {

        return res.status(
          400
        ).json({

          status:
            'error',

          message:
            'Le compteur sélectionné est invalide.',

        });

      }


      compteurId =
        Number(
          compteurIdRaw
        );


      const compteurResult =
        await pool.query(

          `
            SELECT
              id,
              numero_compteur,
              type

            FROM compteurs

            WHERE id = $1
          `,

          [
            compteurId,
          ]

        );


      if (
        compteurResult.rowCount === 0
      ) {

        return res.status(
          404
        ).json({

          status:
            'error',

          message:
            'Compteur introuvable.',

        });

      }


      compteur =
        compteurResult.rows[0];


      const compteurType =
        normalizeType(
          compteur.type
        );


      if (
        compteurType !==
        type
      ) {

        return res.status(
          400
        ).json({

          status:
            'error',

          message:
            'Le compteur sélectionné ne correspond pas au type choisi.',

        });

      }

    }


    /* =====================================================
       CALCUL DES DEUX PÉRIODES
    ===================================================== */

    const [

      periode1,

      periode2,

    ] =

      await Promise.all([

        getStatsPeriode({

          dateDebut:
            dateDebut1,

          dateFin:
            dateFin1,

          type,

          compteurId,

        }),

        getStatsPeriode({

          dateDebut:
            dateDebut2,

          dateFin:
            dateFin2,

          type,

          compteurId,

        }),

      ]);


    /* =====================================================
       PÉRIMÈTRE COMMUN POUR UNE COMPARAISON FIABLE
    ===================================================== */

    // Lorsque plusieurs compteurs sont sélectionnés, les deux totaux doivent
    // porter sur les mêmes compteurs. Un compteur sans deux index exploitables
    // sur l’une des périodes est exclu des deux totaux, jamais transformé en 0.
    const idsCalculables1 = new Set(
      (periode1.details_indices || [])
        .filter((ligne) => ligne.statut_calcul === 'CALCULABLE')
        .map((ligne) => ligne.compteur_id)
    );
    const idsCalculables2 = new Set(
      (periode2.details_indices || [])
        .filter((ligne) => ligne.statut_calcul === 'CALCULABLE')
        .map((ligne) => ligne.compteur_id)
    );
    const idsComparables = new Set(
      [...idsCalculables1].filter((id) => idsCalculables2.has(id))
    );

    function appliquerPerimetreCommun(periode) {
      periode.details_indices = (periode.details_indices || []).map((ligne) => {
        const contribue =
          ligne.statut_calcul === 'CALCULABLE' &&
          idsComparables.has(ligne.compteur_id);

        return {
          ...ligne,
          contribue_comparaison: contribue,
          message_calcul: contribue
            ? ligne.message_calcul
            : ligne.statut_calcul === 'CALCULABLE'
              ? 'Les index sont disponibles pour cette période, mais ce compteur ne dispose pas de deux index exploitables dans l’autre période. Il est exclu des deux totaux pour garantir une comparaison équitable.'
              : ligne.message_calcul,
        };
      });

      const lignesIncluses = periode.details_indices.filter(
        (ligne) => ligne.contribue_comparaison
      );
      const valeurs = lignesIncluses.map(
        (ligne) => ligne.consommation_calculee
      );
      const somme = valeurs.reduce((total, valeur) => total + valeur, 0);

      periode.total = valeurs.length > 0 ? round2(somme) : null;
      periode.moyenne = valeurs.length > 0
        ? round2(somme / valeurs.length)
        : null;
      periode.minimum = valeurs.length > 0 ? round2(Math.min(...valeurs)) : null;
      periode.maximum = valeurs.length > 0 ? round2(Math.max(...valeurs)) : null;
      periode.nombre_compteurs_calcules = valeurs.length;
      periode.nombre_compteurs_non_calculables = periode.details_indices.filter(
        (ligne) => ligne.statut_calcul !== 'CALCULABLE'
      ).length;
      periode.nombre_compteurs_exclus = periode.details_indices.filter(
        (ligne) => ligne.statut_calcul === 'CALCULABLE' && !ligne.contribue_comparaison
      ).length;
      periode.nombre_compteurs_comparables = idsComparables.size;
    }

    appliquerPerimetreCommun(periode1);
    appliquerPerimetreCommun(periode2);

    /* =====================================================
       COMPARAISON
    ===================================================== */

    const difference =
      periode1.total !== null && periode2.total !== null
        ? round2(periode2.total - periode1.total)
        : null;

    let evolution = null;

    if (
      difference !== null &&
      periode1.total !== 0
    ) {
      evolution = round2((difference / periode1.total) * 100);
    }


    // La tendance peut être déterminée avec l'écart absolu même lorsque le
    // pourcentage est non calculable (par exemple si la période de référence vaut 0).
    let tendance = 'NON_CALCULABLE';

    if (difference !== null) {
      tendance = difference > 0
        ? 'HAUSSE'
        : difference < 0
          ? 'BAISSE'
          : 'STABLE';
    }


    /* =====================================================
       RÉPONSE
    ===================================================== */

    return res.status(
      200
    ).json({

      status:
        'success',

      data: {

        type,

        unite:
          type ===
          'ELECTRICITE'
            ? 'kWh'
            : 'm³',

        compteur,

        periode1: {

          dateDebut:
            dateDebut1,

          dateFin:
            dateFin1,

          ...periode1,

        },

        periode2: {

          dateDebut:
            dateDebut2,

          dateFin:
            dateFin2,

          ...periode2,

        },

        comparaison: {

          difference,

          evolution,

          tendance,

        },

      },

    });

  } catch (
    error
  ) {

    console.error(
      'Erreur comparaison consommations :',
      error
    );


    return res.status(
      500
    ).json({

      status:
        'error',

      message:
        'Erreur interne lors de la comparaison des consommations.',

    });

  }

}


module.exports = {
  getComparaison,
  getDatesDisponibles,
};