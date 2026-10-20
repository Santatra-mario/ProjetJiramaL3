const pool = require('../config/db');

const ROLES_NOTIFICATION = [
  'RESPONSABLE',
];

const ANOMALIES_SQL = `
  (
    SELECT
      x.id,
      x.releve_id,
      r.compteur_id,
      r.date_releve,
      r.consommation,
      x.type_anomalie,
      x.valeur_detectee AS valeur,
      x.valeur_reference,
      x.seuil,
      x.date_detection,
      x.statut,
      x.commentaire,

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
  )
`;

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function round2(value) {
  return Number(toNumber(value).toFixed(2));
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizeType(value) {
  const type = String(value || '').trim().toUpperCase();
  if (type === 'EAU') return 'EAU';
  if (type === 'ELECTRICITE' || type === 'ÉLECTRICITÉ') {
    return 'ELECTRICITE';
  }
  return 'TOUS';
}

function unitForType(type) {
  return String(type || '').trim().toUpperCase() === 'EAU'
    ? 'm³'
    : 'kWh';
}

async function getCurrentUser(req) {
  const id = Number(req.user?.id);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  const result = await pool.query(
    `
      SELECT
        id,
        nom,
        prenom,
        identifiant,
        email,
        role,
        statut
      FROM users
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function ensureNotificationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      type VARCHAR(50) NOT NULL DEFAULT 'INFORMATION',
      destinataire VARCHAR(255) NOT NULL,
      sujet VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      date_envoi TIMESTAMP NULL,
      statut VARCHAR(20) NOT NULL DEFAULT 'EN_ATTENTE',
      anomalie_id INTEGER NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_notifications_destinataire
    ON notifications(destinataire)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_notifications_anomalie
    ON notifications(anomalie_id)
  `);

  await pool.query(`
    ALTER TABLE notifications
    ADD COLUMN IF NOT EXISTS masquee_le TIMESTAMP NULL
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_notifications_visibles
    ON notifications (LOWER(TRIM(destinataire)))
    WHERE masquee_le IS NULL
  `);
}

function buildNotificationSubject(row) {
  const type = String(row.type_compteur || '').toUpperCase();
  return type === 'EAU'
    ? `Alerte consommation d'eau - ${row.numero_compteur || 'Compteur'}`
    : `Alerte consommation électrique - ${row.numero_compteur || 'Compteur'}`;
}

function buildNotificationMessage(row) {
  const unite = unitForType(row.type_compteur);
  const valeur = toNumber(row.valeur);
  const reference = toNumber(row.valeur_reference);
  const variation = Math.abs(toNumber(row.variation));
  const abonne = [row.prenom, row.nom].filter(Boolean).join(' ') || 'Abonné non renseigné';
  const niveau = row.niveau || 'ATTENTION';

  return [
    `Niveau : ${niveau}.`,
    `Compteur : ${row.numero_compteur || 'Non renseigné'}.`,
    `Abonné : ${abonne}.`,
    `Consommation détectée : ${valeur.toFixed(2)} ${unite}.`,
    `Référence : ${reference.toFixed(2)} ${unite}.`,
    `Variation : ${variation.toFixed(2)} %.`,
    `Type : ${row.type_anomalie || 'Anomalie de consommation'}.`,
  ].join(' ');
}

async function synchronizeNotificationsForAnomalies() {
  await ensureNotificationsTable();

  const anomalies = await pool.query(`
    SELECT
      a.id,
      a.type_anomalie,
      a.valeur,
      a.valeur_reference,
      a.variation,
      a.niveau,
      a.statut,
      c.numero_compteur,
      c.type AS type_compteur,
      ab.nom,
      ab.prenom
    FROM ${ANOMALIES_SQL} a
    INNER JOIN compteurs c
      ON c.id = a.compteur_id
    INNER JOIN abonnes ab
      ON ab.id = c.abonne_id
    WHERE UPPER(TRIM(a.statut)) IN ('NOUVELLE', 'EN_COURS')
    ORDER BY a.date_detection DESC, a.id DESC
    LIMIT 200
  `);

  if (anomalies.rowCount === 0) {
    return { anomalies: 0, notifications: 0 };
  }

  const users = await pool.query(
    `
      SELECT
        u.id,
        u.email,
        u.role,
        COALESCE(s.notif_anomalies, TRUE) AS notif_anomalies
      FROM users u
      LEFT JOIN user_settings s ON s.user_id = u.id
      WHERE LOWER(TRIM(u.statut)) = 'actif'
        AND UPPER(TRIM(u.role)) = ANY($1::text[])
        AND u.email IS NOT NULL
        AND TRIM(u.email) <> ''
      ORDER BY u.role, u.id
    `,
    [ROLES_NOTIFICATION]
  );

  let created = 0;

  for (const anomalie of anomalies.rows) {
    const sujet = buildNotificationSubject(anomalie);
    const message = buildNotificationMessage(anomalie);

    for (const user of users.rows) {
      const email = normalizeEmail(user.email);
      if (!email || user.notif_anomalies === false) continue;

      const existing = await pool.query(
        `
          SELECT id
          FROM notifications
          WHERE anomalie_id = $1
            AND LOWER(TRIM(destinataire)) = $2
          LIMIT 1
        `,
        [anomalie.id, email]
      );

      if (existing.rowCount > 0) continue;

      await pool.query(
        `
          INSERT INTO notifications (
            type,
            destinataire,
            sujet,
            message,
            date_envoi,
            statut,
            anomalie_id
          )
          VALUES (
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
        [email, sujet, message, anomalie.id]
      );

      created += 1;
    }
  }

  return {
    anomalies: anomalies.rowCount,
    notifications: created,
  };
}

async function getResponsableDashboard(req, res) {
  try {
    const user = await getCurrentUser(req);

    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'Utilisateur responsable introuvable.',
      });
    }

    if (
      String(user.role || '').trim().toUpperCase() !== 'RESPONSABLE' ||
      String(user.statut || '').trim().toLowerCase() !== 'actif'
    ) {
      return res.status(403).json({
        status: 'error',
        message: 'Accès réservé à un responsable actif.',
      });
    }

    try {
      const { synchronizeAnomalies } = require('./anomalieController');
      await synchronizeAnomalies();
    } catch (syncError) {
      console.error('Synchronisation anomalies Responsable :', syncError);
      // Le dashboard continue à afficher les données déjà présentes.
    }

    try {
      await synchronizeNotificationsForAnomalies();
    } catch (notificationError) {
      console.error('Synchronisation notifications Responsable :', notificationError);
      // Le dashboard reste utilisable même si la table notifications n'est pas encore prête.
    }

    const email = normalizeEmail(user.email);

    const [
      kpi,
      evolution,
      anomalySummary,
      anomaliesRecent,
      notifications,
      agents,
    ] = await Promise.all([
      pool.query(`
        SELECT
          (SELECT COUNT(*)::int FROM abonnes) AS abonnes,
          (SELECT COUNT(*)::int FROM compteurs) AS compteurs,
          (SELECT COUNT(*)::int FROM compteurs WHERE UPPER(TRIM(statut)) = 'ACTIF') AS compteurs_actifs,
          (SELECT COUNT(*)::int FROM releves WHERE date_releve >= DATE_TRUNC('month', CURRENT_DATE) AND date_releve < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month') AS releves_mois,

          (
            SELECT COALESCE(SUM(r.consommation), 0)
            FROM releves r
            INNER JOIN compteurs c ON c.id = r.compteur_id
            WHERE UPPER(TRIM(c.type)) = 'EAU'
              AND r.date_releve >= DATE_TRUNC('month', CURRENT_DATE)
              AND r.date_releve < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
          ) AS consommation_eau_mois,

          (
            SELECT COALESCE(SUM(r.consommation), 0)
            FROM releves r
            INNER JOIN compteurs c ON c.id = r.compteur_id
            WHERE UPPER(TRIM(c.type)) IN ('ELECTRICITE', 'ÉLECTRICITÉ')
              AND r.date_releve >= DATE_TRUNC('month', CURRENT_DATE)
              AND r.date_releve < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
          ) AS consommation_electricite_mois,

          (
            SELECT COUNT(*)::int
            FROM ${ANOMALIES_SQL} a
            WHERE UPPER(TRIM(a.statut)) IN ('NOUVELLE', 'EN_COURS')
          ) AS anomalies_actives,

          (
            SELECT COUNT(*)::int
            FROM notifications n
            WHERE LOWER(TRIM(n.destinataire)) = $1
              AND n.masquee_le IS NULL
              AND UPPER(TRIM(n.statut)) = 'EN_ATTENTE'
          ) AS notifications_non_lues
      `, [email]),

      pool.query(`
        SELECT
          TO_CHAR(mois, 'Mon') AS mois_court,
          TO_CHAR(mois, 'YYYY-MM') AS periode,
          COALESCE(SUM(CASE WHEN UPPER(TRIM(c.type)) = 'EAU' THEN r.consommation ELSE 0 END), 0) AS eau,
          COALESCE(SUM(CASE WHEN UPPER(TRIM(c.type)) IN ('ELECTRICITE', 'ÉLECTRICITÉ') THEN r.consommation ELSE 0 END), 0) AS electricite
        FROM generate_series(
          DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '11 months',
          DATE_TRUNC('month', CURRENT_DATE),
          INTERVAL '1 month'
        ) mois
        LEFT JOIN releves r
          ON r.date_releve >= mois
         AND r.date_releve < mois + INTERVAL '1 month'
        LEFT JOIN compteurs c
          ON c.id = r.compteur_id
        GROUP BY mois
        ORDER BY mois
      `),

      pool.query(`
        SELECT
          niveau,
          COUNT(*)::int AS total
        FROM ${ANOMALIES_SQL}
        WHERE UPPER(TRIM(statut)) IN ('NOUVELLE', 'EN_COURS')
        GROUP BY niveau
        ORDER BY
          CASE niveau
            WHEN 'CRITIQUE' THEN 1
            WHEN 'SUSPECTE' THEN 2
            ELSE 3
          END
      `),

      pool.query(`
        SELECT
          a.id,
          a.releve_id,
          a.date_detection,
          a.type_anomalie,
          a.valeur,
          a.valeur_reference,
          a.variation,
          a.niveau,
          a.direction,
          a.statut,
          c.id AS compteur_id,
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
        WHERE UPPER(TRIM(a.statut)) IN ('NOUVELLE', 'EN_COURS')
        ORDER BY
          CASE a.niveau
            WHEN 'CRITIQUE' THEN 1
            WHEN 'SUSPECTE' THEN 2
            ELSE 3
          END,
          a.date_detection DESC,
          a.id DESC
        LIMIT 8
      `),

      pool.query(
        `
          SELECT
            id,
            type,
            sujet,
            message,
            statut,
            date_envoi,
            anomalie_id,
            created_at
          FROM notifications
          WHERE LOWER(TRIM(destinataire)) = $1
            AND masquee_le IS NULL
          ORDER BY created_at DESC, id DESC
          LIMIT 8
        `,
        [email]
      ),

      pool.query(`
        SELECT COUNT(*)::int AS total
        FROM users
        WHERE LOWER(TRIM(statut)) = 'actif'
          AND UPPER(TRIM(role)) = 'AGENT'
      `),
    ]);

    const row = kpi.rows[0] || {};

    return res.status(200).json({
      status: 'success',
      user: {
        id: user.id,
        nom: user.nom,
        prenom: user.prenom,
        email: user.email,
        role: user.role,
      },
      stats: {
        abonnes: toNumber(row.abonnes),
        compteurs: toNumber(row.compteurs),
        compteursActifs: toNumber(row.compteurs_actifs),
        relevesMois: toNumber(row.releves_mois),
        consommationEauMois: round2(row.consommation_eau_mois),
        consommationElectriciteMois: round2(row.consommation_electricite_mois),
        anomaliesActives: toNumber(row.anomalies_actives),
        notificationsNonLues: toNumber(row.notifications_non_lues),
        agentsActifs: toNumber(agents.rows[0]?.total),
      },
      evolution: evolution.rows.map((item) => ({
        periode: item.periode,
        mois: item.mois_court,
        eau: round2(item.eau),
        electricite: round2(item.electricite),
      })),
      anomaliesParNiveau: anomalySummary.rows.map((item) => ({
        niveau: item.niveau,
        total: toNumber(item.total),
      })),
      anomaliesRecentes: anomaliesRecent.rows.map((item) => ({
        ...item,
        valeur: round2(item.valeur),
        valeur_reference: round2(item.valeur_reference),
        variation: round2(item.variation),
        unite: unitForType(item.type_compteur),
      })),
      notificationsRecentes: notifications.rows,
    });
  } catch (error) {
    console.error('Erreur dashboard Responsable :', error);
    return res.status(500).json({
      status: 'error',
      message: 'Impossible de charger le dashboard Responsable.',
      detail:
        process.env.NODE_ENV === 'development'
          ? error.message
          : undefined,
    });
  }
}

async function getResponsableNotifications(req, res) {
  try {
    await synchronizeNotificationsForAnomalies();

    const user = await getCurrentUser(req);
    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'Utilisateur introuvable.',
      });
    }

    const email = normalizeEmail(user.email);

    const result = await pool.query(
      `
        SELECT
          n.id,
          n.type,
          n.sujet,
          n.message,
          n.statut,
          n.date_envoi,
          n.anomalie_id,
          n.created_at,
          a.statut AS statut_anomalie,
          a.commentaire AS motif_administrateur
        FROM notifications n
        LEFT JOIN anomalies a
          ON a.id = n.anomalie_id
        WHERE LOWER(TRIM(n.destinataire)) = $1
          AND n.masquee_le IS NULL
        ORDER BY n.created_at DESC, n.id DESC
      `,
      [email]
    );

    return res.status(200).json({
      status: 'success',
      data: result.rows,
      notifications: result.rows,
    });
  } catch (error) {
    console.error('Erreur notifications Responsable :', error);
    return res.status(500).json({
      status: 'error',
      message: 'Impossible de récupérer les notifications Responsable.',
    });
  }
}

async function getResponsableNotificationCount(req, res) {
  try {
    await ensureNotificationsTable();
    const user = await getCurrentUser(req);

    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'Utilisateur introuvable.',
      });
    }

    const result = await pool.query(
      `
        SELECT COUNT(*)::int AS total
        FROM notifications
        WHERE LOWER(TRIM(destinataire)) = $1
          AND masquee_le IS NULL
          AND UPPER(TRIM(statut)) = 'EN_ATTENTE'
      `,
      [normalizeEmail(user.email)]
    );

    return res.status(200).json({
      status: 'success',
      count: toNumber(result.rows[0]?.total),
    });
  } catch (error) {
    console.error('Erreur compteur notifications Responsable :', error);
    return res.status(500).json({
      status: 'error',
      message: 'Impossible de récupérer le compteur des notifications.',
    });
  }
}

async function markResponsableNotificationAsRead(req, res) {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({
      status: 'error',
      message: 'Identifiant de notification invalide.',
    });
  }

  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'Utilisateur introuvable.',
      });
    }

    const result = await pool.query(
      `
        UPDATE notifications
        SET
          statut = 'ENVOYE',
          date_envoi = CURRENT_TIMESTAMP
        WHERE id = $1
          AND LOWER(TRIM(destinataire)) = $2
          AND masquee_le IS NULL
        RETURNING id, statut, date_envoi
      `,
      [id, normalizeEmail(user.email)]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Notification introuvable.',
      });
    }

    return res.status(200).json({
      status: 'success',
      message: 'Notification marquée comme lue.',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Erreur lecture notification Responsable :', error);
    return res.status(500).json({
      status: 'error',
      message: 'Impossible de marquer la notification comme lue.',
    });
  }
}

async function markAllResponsableNotificationsAsRead(req, res) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'Utilisateur introuvable.',
      });
    }

    const result = await pool.query(
      `
        UPDATE notifications
        SET
          statut = 'ENVOYE',
          date_envoi = CURRENT_TIMESTAMP
        WHERE LOWER(TRIM(destinataire)) = $1
          AND masquee_le IS NULL
          AND UPPER(TRIM(statut)) = 'EN_ATTENTE'
      `,
      [normalizeEmail(user.email)]
    );

    return res.status(200).json({
      status: 'success',
      message: 'Toutes les notifications ont été marquées comme lues.',
      count: result.rowCount,
    });
  } catch (error) {
    console.error('Erreur lecture globale Responsable :', error);
    return res.status(500).json({
      status: 'error',
      message: 'Impossible de traiter les notifications.',
    });
  }
}

async function getResponsableAnomalies(req, res) {
  try {
    const result = await pool.query(`
      SELECT
        a.id,
        a.releve_id,
        a.date_detection,
        a.type_anomalie,
        a.valeur,
        a.valeur_reference,
        a.variation,
        a.niveau,
        a.direction,
        a.statut,
        a.commentaire,
        c.id AS compteur_id,
        c.numero_compteur,
        c.type AS type_compteur,
        ab.numero_abonne,
        ab.nom AS abonne_nom,
        ab.prenom AS abonne_prenom
      FROM ${ANOMALIES_SQL} a
      INNER JOIN compteurs c ON c.id = a.compteur_id
      INNER JOIN abonnes ab ON ab.id = c.abonne_id
      ORDER BY a.date_detection DESC, a.id DESC
      LIMIT 200
    `);

    return res.status(200).json({
      status: 'success',
      data: result.rows.map((row) => ({
        ...row,
        valeur: round2(row.valeur),
        valeur_reference: round2(row.valeur_reference),
        variation: round2(row.variation),
        unite: unitForType(row.type_compteur),
      })),
    });
  } catch (error) {
    console.error('Erreur anomalies Responsable :', error);
    return res.status(500).json({
      status: 'error',
      message: 'Impossible de récupérer les anomalies.',
    });
  }
}

module.exports = {
  getResponsableDashboard,
  getResponsableNotifications,
  getResponsableNotificationCount,
  markResponsableNotificationAsRead,
  markAllResponsableNotificationsAsRead,
  getResponsableAnomalies,
  synchronizeNotificationsForAnomalies,
};
