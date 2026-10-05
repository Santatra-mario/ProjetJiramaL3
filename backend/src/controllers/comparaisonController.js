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

  const params = [
    dateDebut,
    dateFin,
    type,
  ];


  let compteurCondition =
    '';


  /*
     Si un compteur précis est sélectionné
  */
  if (
    compteurId
  ) {

    params.push(
      Number(compteurId)
    );


    compteurCondition =
      `
        AND c.id = $${params.length}
      `;
  }


  const query = `

    SELECT

      COUNT(r.id)::int
        AS nombre_releves,

      COALESCE(
        SUM(r.consommation),
        0
      )
        AS total,

      COALESCE(
        AVG(r.consommation),
        0
      )
        AS moyenne,

      COALESCE(
        MIN(r.consommation),
        0
      )
        AS minimum,

      COALESCE(
        MAX(r.consommation),
        0
      )
        AS maximum

    FROM releves r

    INNER JOIN compteurs c
      ON c.id =
        r.compteur_id

    WHERE
      r.date_releve >=
        $1::date

      AND

      r.date_releve <
        (
          $2::date
          + INTERVAL '1 day'
        )

      AND

      UPPER(
        TRIM(c.type)
      ) = $3

      ${compteurCondition}

  `;


  const result =
    await pool.query(
      query,
      params
    );


  const row =
    result.rows[0] ||
    {};


  return {

    nombre_releves:
      Number(
        row.nombre_releves ||
        0
      ),

    total:
      round2(
        row.total
      ),

    moyenne:
      round2(
        row.moyenne
      ),

    minimum:
      round2(
        row.minimum
      ),

    maximum:
      round2(
        row.maximum
      ),

  };
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
       COMPARAISON
    ===================================================== */

    const difference =
      round2(
        periode2.total -
        periode1.total
      );


    let evolution =
      null;


    if (
      periode1.total !==
      0
    ) {

      evolution =
        round2(
          (
            difference /
            periode1.total
          ) *
          100
        );

    }


    let tendance =
      'STABLE';


    if (
      evolution !==
      null
    ) {

      if (
        evolution >
        0
      ) {

        tendance =
          'HAUSSE';

      } else if (
        evolution <
        0
      ) {

        tendance =
          'BAISSE';

      }

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
};