const pool = require('../config/db');
const { logAudit } = require('../utils/auditLogger');
const { synchronizeAnomalies } = require('./anomalieController');
const { notifierMissionAssignee } = require('./controleController');
const { notifierMissionRealisee } = require('../services/missionNotificationService');
const { synchroniserNotificationSuiviReleve } = require('../services/consommationNotificationService');

const FUSEAU_JIRAMA = (() => {
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Antananarivo' });
    return 'Africa/Antananarivo';
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    return 'Indian/Antananarivo';
  }
})();

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

function dateDuJourJirama() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSEAU_JIRAMA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function dateFinMoisSuivant(date = dateDuJourJirama()) {
  const [year, month] = date.split('-').map(Number);
  const endDate = new Date(Date.UTC(year, month + 1, 0));
  return [
    endDate.getUTCFullYear(),
    String(endDate.getUTCMonth() + 1).padStart(2, '0'),
    String(endDate.getUTCDate()).padStart(2, '0'),
  ].join('-');
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
    /*
      Une colonne DATE est renvoyée par pg à minuit dans le fuseau du
      serveur. Passer par toISOString() la décalait d'un jour (minuit
      local → 21 h UTC la veille). On lit donc les composantes locales.
    */
    return [
      value.getFullYear(),
      String(value.getMonth() + 1).padStart(2, '0'),
      String(value.getDate()).padStart(2, '0'),
    ].join('-');
  }

  return String(value).slice(0, 10);
}

const MOIS_FRANCAIS = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
];

/**
 * Transforme une date (YYYY-MM-DD, Date JS ou timestamp PostgreSQL)
 * en date française longue : « 09 Novembre 2026 ».
 * Retourne null si la date est absente ou invalide.
 */
function formatDateFrancaiseLongue(value) {
  const iso = formatDateOnly(value);

  if (!iso || !isValidDateString(iso)) {
    return null;
  }

  const [year, month, day] = iso.split('-').map(Number);

  return `${String(day).padStart(2, '0')} ${MOIS_FRANCAIS[month - 1]} ${year}`;
}

function ajouterJoursCalendaires(value, nombre) {
  const date = new Date(`${formatDateOnly(value)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() + nombre);
  return date.toISOString().slice(0, 10);
}

function estDateMissionTerrain(dateValue, debutValue, finValue) {
  const date = formatDateOnly(dateValue);
  const debut = formatDateOnly(debutValue);
  const fin = formatDateOnly(finValue);
  if (!isValidDateString(date) || !isValidDateString(debut) || !isValidDateString(fin)) return false;
  if (date < debut || date > fin) return false;

  const offset = Math.round(
    (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${debut}T00:00:00Z`)) / 86400000
  );
  const jourDuCycle = offset % 3;
  if (offset < 1 || jourDuCycle === 0) return false;

  const jourFinalisation = offset - jourDuCycle + 2;
  const dateFinalisation = ajouterJoursCalendaires(debut, jourFinalisation);
  return Boolean(dateFinalisation) && dateFinalisation <= fin;
}

async function creerMissionPeriodiqueSuivante(client, mission) {
  if (!mission?.suivi_periodique || !mission.responsable_id || !mission.campagne_id) return null;
  const datePrevue = ajouterJoursCalendaires(mission.date_prevue, 3);
  if (!datePrevue) return null;
  const dateDebutCampagne = formatDateOnly(mission.date_debut);
  const dateFinCampagne = formatDateOnly(mission.date_fin);
  const decalage = Math.round(
    (Date.parse(`${datePrevue}T00:00:00Z`) - Date.parse(`${dateDebutCampagne}T00:00:00Z`)) / 86400000
  );
  if (
    !isValidDateString(dateDebutCampagne) ||
    !isValidDateString(dateFinCampagne) ||
    datePrevue > dateFinCampagne ||
    decalage < 1 ||
    decalage % 3 === 0 ||
    ajouterJoursCalendaires(dateDebutCampagne, decalage + (2 - (decalage % 3))) > dateFinCampagne
  ) return { created: false, outsideCampaign: true };

  await client.query('SELECT id FROM compteurs WHERE id = $1 FOR UPDATE', [mission.compteur_id]);
  const childExists = await client.query(
    `SELECT id FROM missions_controle
     WHERE mission_parent_id = $1 OR (compteur_id = $2 AND date_prevue = $3 AND statut <> 'ANNULEE')
     LIMIT 1 FOR UPDATE`,
    [mission.id, mission.compteur_id, datePrevue]
  );
  if (childExists.rowCount) return { created: false, existing: true };

  const agentResult = await client.query(
    `SELECT id, email FROM users
     WHERE id = $1 AND UPPER(TRIM(role)) = 'AGENT' AND LOWER(TRIM(statut)) = 'actif'`,
    [mission.agent_id]
  );
  if (!agentResult.rowCount) return { created: false, agentUnavailable: true };

  const campaignResult = await client.query(
    `SELECT id, statut FROM campagnes_controle WHERE id = $1 FOR UPDATE`,
    [mission.campagne_id]
  );
  const campagne = campaignResult.rows[0];
  if (!campagne || campagne.statut !== 'PUBLIEE') return null;

  const created = await client.query(
    `INSERT INTO missions_controle
       (campagne_id, abonne_id, compteur_id, agent_id, date_prevue, date_limite,
        statut, nouvelle_visite, suivi_periodique, mission_parent_id, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $5, 'PLANIFIEE', true, true, $6, $7, $7)
     RETURNING id`,
    [mission.campagne_id, mission.abonne_id, mission.compteur_id, mission.agent_id,
      datePrevue, mission.id, mission.responsable_id]
  );
  const missionSuivanteId = created.rows[0]?.id;
  if (missionSuivanteId) {
    await notifierMissionAssignee(
      client,
      missionSuivanteId,
      `mission:v2:${missionSuivanteId}:periodique:${mission.id}:${mission.agent_id}`
    );
  }
  return { created: true, missionId: missionSuivanteId, published: true };
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
 * - pour les relevés suivants, la date précédente vient de la chronologie ;
 * - pour le premier relevé, la date de référence enregistrée est conservée.
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
    r.type_releve,
    r.observation,

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
          r.date_releve - r.date_releve_precedent_calculee
        )

      WHEN r.date_ancien_releve IS NOT NULL
        THEN (
          r.date_releve - r.date_ancien_releve
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

  WHERE LOWER(TRIM(a.statut)) <> 'supprime'
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

          AND r.id = $1
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
    date_releve: dateReleveDemandee,
    ancien_index,
    nouvel_index,
    mission_id,
    date_visite_reelle,
    observation,
  } = req.body || {};

  let compteurId =
    Number(
      compteur_id
    );

  const missionId = mission_id === undefined || mission_id === null || mission_id === ''
    ? null
    : Number(mission_id);

  const nouvelIndex =
    Number(
      nouvel_index
    );
  const agentPeutCorrigerDatePrecedente =
    String(req.user?.role || '').trim().toUpperCase() === 'AGENT';

  // La date Agent est déterminée ci-dessous depuis la mission, jamais
  // depuis une valeur de date fournie par le navigateur.
  let date_releve = agentPeutCorrigerDatePrecedente
    ? null
    : dateReleveDemandee;

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

  if (!agentPeutCorrigerDatePrecedente && !isValidDateString(date_releve)) {
    return res.status(400).json({
      status: 'error',
      message:
        'La date du relevé actuel est invalide.',
    });
  }

  const dateMaxReleve = dateDuJourJirama();
  if (!agentPeutCorrigerDatePrecedente && date_releve > dateMaxReleve) {
    return res.status(400).json({
      status: 'error',
      message: 'La date du relevé actuel ne peut pas dépasser la fin du mois prochain.',
    });
  }

  if (missionId !== null && (!Number.isInteger(missionId) || missionId <= 0)) {
    return res.status(400).json({ status: 'error', message: 'Identifiant de mission invalide.' });
  }
  if (
    missionId !== null &&
    (!isValidDateString(date_visite_reelle) || date_visite_reelle > dateDuJourJirama())
  ) {
    return res.status(400).json({
      status: 'error',
      message: 'La date réelle de visite doit être valide et ne peut pas être future.',
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

    let missionControle = null;
    const dateVisiteReelle = missionId === null ? null : date_visite_reelle;
    if (missionId !== null) {
      const missionResult = await client.query(
          `SELECT mc.id, mc.campagne_id, mc.abonne_id, mc.compteur_id, mc.agent_id,
            mc.date_prevue::text AS date_prevue,
            cc.date_debut::text AS date_debut,
            cc.date_fin::text AS date_fin,
           mc.statut, mc.releve_id, mc.suivi_periodique, mc.date_visite_reelle,
           cc.created_by AS responsable_id, a.statut AS statut_abonne,
           mr.date_releve::text AS releve_date
         FROM missions_controle mc
         INNER JOIN campagnes_controle cc ON cc.id = mc.campagne_id
         INNER JOIN abonnes a ON a.id = mc.abonne_id
         LEFT JOIN releves mr ON mr.id = mc.releve_id
         WHERE mc.id = $1 AND mc.agent_id = $2 AND cc.statut = 'PUBLIEE'
           AND mc.statut <> 'ANNULEE' AND LOWER(TRIM(a.statut)) = 'actif'
         FOR UPDATE OF mc`,
        [missionId, req.user.id]
      );
      missionControle = missionResult.rows[0] || null;
      if (!missionControle) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          status: 'error',
          message: 'Mission introuvable dans les contrôles attribués à votre compte.',
        });
      }
      if (missionControle.releve_id || missionControle.statut === 'TERMINEE') {
        await client.query('ROLLBACK');

        const dateReleveMission = formatDateFrancaiseLongue(missionControle.releve_date);

        return res.status(409).json({
          status: 'error',
          message: dateReleveMission
            ? `Cette mission possède déjà un relevé enregistré le ${dateReleveMission}.`
            : 'Cette mission possède déjà un relevé enregistré. La date de ce relevé est indisponible.',
        });
      }
      if (!['PLANIFIEE', 'EN_COURS'].includes(missionControle.statut)) {
        await client.query('ROLLBACK');
        return res.status(409).json({ status: 'error', message: 'Cette mission n’est pas ouverte à la saisie.' });
      }
      if (compteur_id && Number(compteur_id) !== Number(missionControle.compteur_id)) {
        await client.query('ROLLBACK');
        return res.status(403).json({ status: 'error', message: 'Le compteur ne correspond pas à la mission attribuée.' });
      }
      compteurId = Number(missionControle.compteur_id);
    }

    if (agentPeutCorrigerDatePrecedente) {
      if (missionControle) {
        const dateMission = formatDateOnly(missionControle.date_prevue);
        if (!estDateMissionTerrain(dateMission, missionControle.date_debut, missionControle.date_fin)) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            status: 'error',
            message: 'Aucune date de descente valide n’est disponible pour cette mission dans le calendrier de la campagne.',
          });
        }
        date_releve = dateMission;
      } else {
        date_releve = dateDuJourJirama();
      }

      if (!isValidDateString(date_releve)) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          status: 'error',
          message: 'La date réelle du relevé est indisponible. Aucune date ne peut être inventée.',
        });
      }
      if (date_releve > dateDuJourJirama()) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          status: 'error',
          message: 'La date de la mission est future. Le relevé ne peut pas être enregistré avant la journée planifiée.',
        });
      }
      if (date_releve > dateFinMoisSuivant()) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          status: 'error',
          message: 'La date du relevé actuel ne peut pas dépasser la fin du mois prochain.',
        });
      }
    }

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

    let typeReleve = 'PERIODIQUE';

    if (!previousReleve) {
      const roleUtilisateur = String(req.user?.role || '').trim().toUpperCase();

      // Pour un Agent qui relève un nouveau compteur sans historique,
      // la saisie est un index initial : aucune ancienne date/index ni
      // consommation par différence ne doit être fabriquée.
      if (roleUtilisateur === 'AGENT') {
        typeReleve = 'INITIAL';
        finalDateAncienReleve = null;
        finalAncienIndex = null;
      } else {
        // Conserver le parcours historique du Responsable lorsqu'il
        // dispose réellement d'un index de référence d'installation.
        if (!isValidDateString(date_ancien_releve)) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            status: 'error',
            message: 'Saisissez la date réelle du relevé de référence vérifié.',
          });
        }

        if (dateInstallation && date_ancien_releve < dateInstallation) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            status: 'error',
            message: 'La date du relevé de référence ne peut pas être antérieure à la date d’installation du compteur.',
          });
        }

        if (date_ancien_releve >= date_releve) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            status: 'error',
            message: 'La date de référence doit être antérieure à la date du relevé actuel.',
          });
        }

        if (!isValidNonNegativeNumber(ancien_index)) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            status: 'error',
            message: 'Saisissez un ancien index réel provenant du relevé d’installation vérifié.',
          });
        }

        finalDateAncienReleve = date_ancien_releve;
        finalAncienIndex = Number(ancien_index);

        if (nouvelIndex < finalAncienIndex) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            status: 'error',
            message: 'Le nouvel index doit être supérieur ou égal à l’index de référence vérifié.',
          });
        }
      }
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

      const dateReferenceDemandee = !agentPeutCorrigerDatePrecedente || date_ancien_releve === undefined
        ? previousDate
        : date_ancien_releve;

      if (!isValidDateString(dateReferenceDemandee)) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          status: 'error',
          message: 'La date du relevé précédent est invalide.',
        });
      }

      if (dateInstallation && dateReferenceDemandee < dateInstallation) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          status: 'error',
          message: 'La date du relevé précédent ne peut pas être antérieure à la date d’installation.',
        });
      }

      if (dateReferenceDemandee >= date_releve) {
        await client.query('ROLLBACK');

        const dateReferenceLongue = formatDateFrancaiseLongue(dateReferenceDemandee);

        return res.status(400).json({
          status: 'error',
          message: dateReferenceLongue
            ? `La date du relevé précédent (${dateReferenceLongue}) doit être antérieure à la date du relevé actuel.`
            : 'La date du relevé précédent doit être antérieure à la date du relevé actuel.',
        });
      }

      if (dateReferenceDemandee > previousDate) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          status: 'error',
          message: 'La date du relevé précédent ne peut pas être postérieure au dernier relevé valide de ce compteur.',
        });
      }

      finalDateAncienReleve = dateReferenceDemandee;

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

        const datePrecedentLongue = formatDateFrancaiseLongue(previousDate);

        return res.status(400).json({
          status: 'error',
          message: datePrecedentLongue
            ? `La date du nouveau relevé doit être postérieure au dernier relevé enregistré le ${datePrecedentLongue}.`
            : 'La date du nouveau relevé doit être postérieure au relevé précédent.',
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

      const dateDoublonLongue = formatDateFrancaiseLongue(date_releve);

      return res.status(409).json({
        status: 'error',
        message: dateDoublonLongue
          ? `Cette date possède déjà un relevé enregistré pour ce compteur (${dateDoublonLongue}). Veuillez choisir une date autorisée.`
          : 'Cette date possède déjà un relevé enregistré pour ce compteur. Veuillez choisir une date autorisée.',
      });
    }

    /* =====================================================
       CALCUL CONSOMMATION
    ===================================================== */

    const consommation = typeReleve === 'INITIAL'
      ? null
      : formatNumber(nouvelIndex - finalAncienIndex);

    if (
      typeReleve !== 'INITIAL' &&
      (!Number.isFinite(consommation) || consommation < 0)
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
            created_by,
            type_releve,
            observation
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
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
          typeReleve,
          typeof observation === 'string' ? observation.trim().slice(0, 2000) || null : null,
        ]
      );

    if (missionControle) {
      const missionUpdate = await client.query(
        `UPDATE missions_controle
         SET releve_id = $1, statut = 'TERMINEE',
             resultat_visite = 'RELEVE_ENREGISTRE',
             date_visite_reelle = $4::date,
             updated_by = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3
         RETURNING date_visite_reelle::text AS date_visite_reelle`,
        [insertResult.rows[0].id, req.user.id, missionId, dateVisiteReelle]
      );
      /* Notification opérationnelle de mission : contrôle réellement
         réalisé, relevé transmis, destinataires Responsable + Administrateur.
         Dédupliquée par mission et par relevé transmis. */
      await notifierMissionRealisee(client, missionId, {
        releveId: insertResult.rows[0].id,
      });
      await creerMissionPeriodiqueSuivante(client, {
        ...missionControle,
        date_visite_reelle: missionUpdate.rows[0]?.date_visite_reelle || dateDuJourJirama(),
      });
    }

    await client.query(
      'COMMIT'
    );

    await logAudit({ actorId: req.user?.id, actorRole: req.user?.role, action: 'RELEVE_CREE', resourceType: 'releve', resourceId: insertResult.rows[0].id, details: { compteur_id: compteurId, type_releve: typeReleve, consommation, mission_id: missionId } });

    if (typeReleve !== 'INITIAL') {
      try {
        await synchronizeAnomalies();
      } catch (analysisError) {
        console.error(
          'Erreur synchronisation des anomalies après création du relevé :',
          analysisError
        );
      }

      try {
        await synchroniserNotificationSuiviReleve(insertResult.rows[0].id);
      } catch (notificationError) {
        console.error(
          'Erreur notification de suivi après création du relevé :',
          notificationError
        );
      }
    }

    return res.status(201).json({
      status: 'success',
      message: typeReleve === 'INITIAL'
        ? 'Premier relevé enregistré avec succès. L’index initial est disponible comme référence pour les prochains relevés.'
        : 'Relevé enregistré avec succès.',
      type_releve: typeReleve,
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
    date_releve: dateReleveDemandee,
    ancien_index,
    nouvel_index,
  } = req.body || {};
  let date_releve = dateReleveDemandee;

  const releveId =
    Number(id);

  const nouvelIndex =
    Number(
      nouvel_index
    );
  const agentPeutCorrigerDatePrecedente =
    String(req.user?.role || '').trim().toUpperCase() === 'AGENT';

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

  const dateMaxReleve = agentPeutCorrigerDatePrecedente
    ? dateFinMoisSuivant()
    : dateDuJourJirama();
  if (date_releve > dateMaxReleve) {
    return res.status(400).json({
      status: 'error',
      message: 'La date du relevé actuel ne peut pas dépasser la fin du mois prochain.',
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

    if (Number(current.created_by) !== Number(req.user?.id)) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        status: 'error',
        message: 'Vous ne pouvez corriger que les relevés enregistrés par votre compte Agent.',
      });
    }

    if (agentPeutCorrigerDatePrecedente) {
      const dateReleveEnregistree = formatDateOnly(current.date_releve);
      if (date_releve !== dateReleveEnregistree) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          status: 'error',
          message: 'La date du relevé actuel est conservée et ne peut pas être modifiée lors d’une correction.',
        });
      }
      date_releve = dateReleveEnregistree;
    }

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
            consommation,
            type_releve,
            observation

          FROM releves

          WHERE compteur_id = $1

          ORDER BY
            date_releve ASC,
            id ASC

          FOR UPDATE
        `,
        [compteurId]
      );

    const history = historyResult.rows;

    if (history.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        status: 'error',
        message: 'L’historique du compteur est vide.',
      });
    }

    // Un index initial n'a ni ancien index ni consommation. Sa correction
    // conserve cette règle et recalcule uniquement les relevés périodiques
    // qui le suivent dans la chronologie du même compteur.
    if (String(current.type_releve || '').toUpperCase() === 'INITIAL') {
      const sortedHistory = [...history].sort((a, b) =>
        formatDateOnly(a.date_releve).localeCompare(formatDateOnly(b.date_releve)) || Number(a.id) - Number(b.id)
      );
      if (Number(sortedHistory[0]?.id) !== releveId) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          status: 'error',
          message: 'Le relevé initial ne peut pas être déplacé après un relevé périodique.',
        });
      }
      if (dateInstallation && date_releve < dateInstallation) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          status: 'error',
          message: 'La date du premier relevé ne peut pas être antérieure à la date d’installation du compteur.',
        });
      }
      if (sortedHistory.slice(1).some((row) => formatDateOnly(row.date_releve) === date_releve)) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          status: 'error',
          message: 'Un autre relevé existe déjà à cette date pour ce compteur.',
        });
      }
      const nextPeriodic = sortedHistory[1] || null;
      if (nextPeriodic && date_releve >= formatDateOnly(nextPeriodic.date_releve)) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          status: 'error',
          message: 'La date du relevé initial doit rester antérieure au premier relevé périodique.',
        });
      }

      await client.query(
        `UPDATE releves
         SET date_releve = $1,
             ancien_index = NULL,
             date_ancien_releve = NULL,
             nouvel_index = $2,
             consommation = NULL,
             observation = $3,
             type_releve = 'INITIAL',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [date_releve, nouvelIndex, typeof req.body?.observation === 'string' ? req.body.observation.trim().slice(0, 2000) || null : current.observation || null, releveId]
      );

      let previousDate = date_releve;
      let previousIndex = nouvelIndex;
      const updatedPeriodicIds = [];
      for (const row of sortedHistory.slice(1)) {
        const rowDate = formatDateOnly(row.date_releve);
        const rowIndex = Number(row.nouvel_index);
        if (!isValidDateString(rowDate) || rowDate <= previousDate) {
          await client.query('ROLLBACK');
          return res.status(409).json({ status: 'error', message: 'Les dates des relevés périodiques doivent rester strictement postérieures au relevé initial.' });
        }
        if (!Number.isFinite(rowIndex) || rowIndex < previousIndex) {
          await client.query('ROLLBACK');
          return res.status(409).json({ status: 'error', message: 'La correction de l’index initial rendrait un relevé périodique incohérent. Vérifiez les index concernés.' });
        }
        const nextConsumption = formatNumber(rowIndex - previousIndex);
        await client.query(
          `UPDATE releves
           SET date_ancien_releve = $1,
               ancien_index = $2,
               consommation = $3,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $4`,
          [previousDate, previousIndex, nextConsumption, row.id]
        );
        updatedPeriodicIds.push(Number(row.id));
        previousDate = rowDate;
        previousIndex = rowIndex;
      }

      await client.query('COMMIT');
      await logAudit({
        actorId: req.user?.id,
        actorRole: req.user?.role,
        action: 'RELEVE_INITIAL_MODIFIE',
        resourceType: 'releve',
        resourceId: releveId,
        details: { compteur_id: compteurId, date_releve, nouvel_index: nouvelIndex, releves_recalcules: updatedPeriodicIds },
      });
      try {
        await synchronizeAnomalies();
      } catch (analysisError) {
        console.error('Erreur synchronisation des anomalies après correction du relevé initial :', analysisError);
      }
      for (const updatedId of updatedPeriodicIds) {
        try {
          await synchroniserNotificationSuiviReleve(updatedId);
        } catch (notificationError) {
          console.error(`Erreur notification après correction du relevé initial #${updatedId} :`, notificationError);
        }
      }
      return res.status(200).json({ status: 'success', message: 'Index initial corrigé. Les relevés périodiques suivants ont été recalculés.', type_releve: 'INITIAL' });
    }

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
       
       Dans ce cas, l'Agent peut corriger la date de référence.
       L'ancien index reste celui enregistré en base.
    ===================================================== */

    if (
      resultingFirstId ===
      releveId
    ) {
      const dateReferenceEnregistree = formatDateOnly(current.date_ancien_releve);
      const indexReferenceEnregistre = Number(current.ancien_index);
      const dateReferenceDemandee = date_ancien_releve === undefined
        ? dateReferenceEnregistree
        : date_ancien_releve;
      const indexReferenceDemande = ancien_index === undefined
        ? indexReferenceEnregistre
        : Number(ancien_index);

      if (!isValidDateString(dateReferenceDemandee) || !Number.isFinite(indexReferenceEnregistre)) {
        await client.query(
          'ROLLBACK'
        );

        return res.status(400).json({
          status: 'error',
          message:
            'La date de référence du premier relevé est invalide ou son index de référence est incohérent.',
        });
      }

      if (
        (!agentPeutCorrigerDatePrecedente && dateReferenceDemandee !== dateReferenceEnregistree) ||
        indexReferenceDemande !== indexReferenceEnregistre
      ) {
        await client.query(
          'ROLLBACK'
        );

        return res.status(403).json({
          status: 'error',
          message:
            'L’index de référence du premier relevé reste en lecture seule. Seule sa date peut être corrigée ici.',
        });
      }

      baselineDate = agentPeutCorrigerDatePrecedente
        ? dateReferenceDemandee
        : dateReferenceEnregistree;
      baselineIndex = indexReferenceEnregistre;
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

      const estLigneModifiee = Number(row.id) === releveId;
      const dateReferenceLigne = agentPeutCorrigerDatePrecedente && estLigneModifiee
        ? (date_ancien_releve !== undefined
          ? date_ancien_releve
          : formatDateOnly(current.date_ancien_releve) || previousDate)
        : previousDate;

      if (!isValidDateString(dateReferenceLigne)) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          status: 'error',
          message: 'La date du relevé précédent est invalide.',
        });
      }

      if (dateInstallation && dateReferenceLigne < dateInstallation) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          status: 'error',
          message: 'La date du relevé précédent ne peut pas être antérieure à la date d’installation.',
        });
      }

      if (dateReferenceLigne > previousDate) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          status: 'error',
          message: 'La date du relevé précédent ne peut pas être postérieure au dernier relevé valide de ce compteur.',
        });
      }

      if (dateReferenceLigne >= rowDate) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          status: 'error',
          message: 'La date du relevé précédent doit être antérieure à la date du relevé actuel.',
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
          dateReferenceLigne,

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

    // Identifier les relevés dont les données ou la consommation changent.
    // Une modification de relevé ancien peut modifier les consommations suivantes.
    const historiqueOriginalParId = new Map(
      history.map((row) => [Number(row.id), {
        date_releve: formatDateOnly(row.date_releve),
        date_ancien_releve: formatDateOnly(row.date_ancien_releve),
        ancien_index: Number(row.ancien_index),
        nouvel_index: Number(row.nouvel_index),
        consommation: Number(row.consommation),
      }])
    );

    const relevesAReNotifier = recalculatedRows
      .filter((row) => {
        const original = historiqueOriginalParId.get(Number(row.id));
        if (!original) return true;
        return (
          original.date_releve !== row.date_releve ||
          original.date_ancien_releve !== row.date_ancien_releve ||
          original.ancien_index !== Number(row.ancien_index) ||
          original.nouvel_index !== Number(row.nouvel_index) ||
          Math.abs(original.consommation - Number(row.consommation)) > 0.0001
        );
      })
      .map((row) => Number(row.id));

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

    await logAudit({
      actorId: req.user?.id,
      actorRole: req.user?.role,
      action: 'RELEVE_MODIFIE',
      resourceType: 'releve',
      resourceId: releveId,
      details: {
        date_releve_avant: formatDateOnly(current.date_releve),
        date_releve_apres: date_releve,
        releves_recalcules: relevesAReNotifier,
      },
    });

    try {
      await synchronizeAnomalies();
    } catch (analysisError) {
      console.error(
        'Erreur synchronisation des anomalies après modification du relevé :',
        analysisError
      );
    }

    for (const releveConcerneId of relevesAReNotifier) {
      try {
        await synchroniserNotificationSuiviReleve(releveConcerneId);
      } catch (notificationError) {
        console.error(
          `Erreur notification de suivi après modification du relevé #${releveConcerneId} :`,
          notificationError
        );
      }
    }

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

    await logAudit({ actorId: req.user?.id, actorRole: req.user?.role, action: 'RELEVE_SUPPRIME', resourceType: 'releve', resourceId: releveId, details: {} });

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

          AND r.compteur_id = $1

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

module.exports = {
  getAllReleves,
  getReleveById,
  createReleve,
  updateReleve,
  deleteReleve,
  getRelevesByCompteur,
};
