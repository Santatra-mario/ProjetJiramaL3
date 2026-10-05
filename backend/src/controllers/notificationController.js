const pool = require('../config/db');

function sendServerError(res, error, logMessage) {
  console.error(logMessage, error);
  return res.status(500).json({
    status: 'error',
    message: 'Une erreur interne est survenue.',
  });
}

async function getAllNotifications(req, res) {
  try {
    const result = await pool.query(`
      SELECT
        n.id, n.type, n.destinataire, n.sujet, n.message,
        n.date_envoi, n.statut, n.anomalie_id, n.created_at,
        a.type_anomalie, a.valeur_detectee, a.valeur_reference,
        a.seuil, a.date_detection, a.statut AS anomalie_statut,
        r.id AS releve_id, r.date_releve, r.ancien_index, r.nouvel_index, r.consommation,
        c.id AS compteur_id, c.numero_compteur, c.type AS type_compteur,
        ab.id AS abonne_id, ab.numero_abonne, ab.nom AS abonne_nom, ab.prenom AS abonne_prenom
      FROM notifications n
      LEFT JOIN anomalies a ON a.id = n.anomalie_id
      LEFT JOIN releves r ON r.id = a.releve_id
      LEFT JOIN compteurs c ON c.id = r.compteur_id
      LEFT JOIN abonnes ab ON ab.id = c.abonne_id
      ORDER BY n.created_at DESC, n.id DESC
    `);
    return res.status(200).json({ status: 'success', data: result.rows, count: result.rowCount });
  } catch (error) {
    return sendServerError(res, error, 'Erreur récupération notifications :');
  }
}

async function getNotificationById(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ status: 'error', message: 'Identifiant invalide.' });
    }
    const result = await pool.query(`
      SELECT n.id, n.type, n.destinataire, n.sujet, n.message,
             n.date_envoi, n.statut, n.anomalie_id, n.created_at,
             a.type_anomalie, a.valeur_detectee, a.valeur_reference, a.seuil,
             a.date_detection, a.statut AS anomalie_statut,
             r.id AS releve_id, r.date_releve, r.ancien_index, r.nouvel_index, r.consommation,
             c.id AS compteur_id, c.numero_compteur, c.type AS type_compteur,
             ab.id AS abonne_id, ab.numero_abonne, ab.nom AS abonne_nom,
             ab.prenom AS abonne_prenom, ab.adresse AS abonne_adresse,
             ab.telephone AS abonne_telephone
      FROM notifications n
      LEFT JOIN anomalies a ON a.id = n.anomalie_id
      LEFT JOIN releves r ON r.id = a.releve_id
      LEFT JOIN compteurs c ON c.id = r.compteur_id
      LEFT JOIN abonnes ab ON ab.id = c.abonne_id
      WHERE n.id = $1
      LIMIT 1
    `, [id]);
    if (!result.rowCount) {
      return res.status(404).json({ status: 'error', message: 'Notification introuvable.' });
    }
    return res.status(200).json({ status: 'success', data: result.rows[0] });
  } catch (error) {
    return sendServerError(res, error, 'Erreur récupération notification :');
  }
}

async function getNotificationCount(req, res) {
  try {
    const result = await pool.query(`
      SELECT COUNT(*)::int AS total
      FROM notifications
      WHERE statut = 'EN_ATTENTE'
    `);
    return res.status(200).json({
      status: 'success',
      data: { total: Number(result.rows[0]?.total || 0) },
    });
  } catch (error) {
    return sendServerError(res, error, 'Erreur comptage notifications :');
  }
}

async function markNotificationAsRead(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ status: 'error', message: 'Identifiant invalide.' });
    }
    const result = await pool.query(`
      UPDATE notifications
      SET statut = 'ENVOYE', date_envoi = COALESCE(date_envoi, CURRENT_TIMESTAMP)
      WHERE id = $1
      RETURNING *
    `, [id]);
    if (!result.rowCount) {
      return res.status(404).json({ status: 'error', message: 'Notification introuvable.' });
    }
    return res.status(200).json({ status: 'success', message: 'Notification marquée comme traitée.', data: result.rows[0] });
  } catch (error) {
    return sendServerError(res, error, 'Erreur mise à jour notification :');
  }
}

async function markAllNotificationsAsRead(req, res) {
  try {
    const result = await pool.query(`
      UPDATE notifications
      SET statut = 'ENVOYE', date_envoi = COALESCE(date_envoi, CURRENT_TIMESTAMP)
      WHERE statut = 'EN_ATTENTE'
    `);
    return res.status(200).json({
      status: 'success',
      message: 'Toutes les notifications en attente ont été traitées.',
      count: result.rowCount,
    });
  } catch (error) {
    return sendServerError(res, error, 'Erreur traitement notifications :');
  }
}

async function deleteNotification(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ status: 'error', message: 'Identifiant invalide.' });
    }
    const result = await pool.query(`DELETE FROM notifications WHERE id = $1 RETURNING id`, [id]);
    if (!result.rowCount) {
      return res.status(404).json({ status: 'error', message: 'Notification introuvable.' });
    }
    return res.status(200).json({ status: 'success', message: 'Notification supprimée.', data: { id: result.rows[0].id } });
  } catch (error) {
    return sendServerError(res, error, 'Erreur suppression notification :');
  }
}

async function createNotificationFromAnomaly(anomalieId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const anomalyResult = await client.query(`
      SELECT a.id, a.valeur_detectee, a.valeur_reference, a.seuil,
             c.numero_compteur, c.type AS type_compteur,
             ab.nom AS abonne_nom, ab.prenom AS abonne_prenom
      FROM anomalies a
      INNER JOIN releves r ON r.id = a.releve_id
      INNER JOIN compteurs c ON c.id = r.compteur_id
      INNER JOIN abonnes ab ON ab.id = c.abonne_id
      WHERE a.id = $1
      LIMIT 1
    `, [anomalieId]);
    if (!anomalyResult.rowCount) throw new Error('Anomalie introuvable.');

    const anomalie = anomalyResult.rows[0];
    const existing = await client.query(`SELECT id FROM notifications WHERE anomalie_id = $1 LIMIT 1`, [anomalie.id]);
    if (existing.rowCount) {
      await client.query('COMMIT');
      return existing.rows[0];
    }

    const unite = String(anomalie.type_compteur || '').toUpperCase() === 'EAU' ? 'm³' : 'kWh';
    const nomAbonne = [anomalie.abonne_prenom, anomalie.abonne_nom].filter(Boolean).join(' ');
    const sujet = 'Consommation potentiellement anormale';
    const message =
      `Une consommation potentiellement anormale a été détectée pour le compteur ${anomalie.numero_compteur}. ` +
      `Consommation : ${anomalie.valeur_detectee} ${unite}. ` +
      `Référence : ${anomalie.valeur_reference ?? 'non disponible'} ${unite}. ` +
      `Seuil appliqué : ${anomalie.seuil ?? 'non renseigné'} %. ` +
      `Abonné : ${nomAbonne || 'non renseigné'}.`;

    const admins = await client.query(`
      SELECT email FROM users
      WHERE UPPER(TRIM(role)) = 'ADMINISTRATEUR'
        AND LOWER(TRIM(statut)) = 'actif'
        AND email IS NOT NULL
    `);

    let created = null;
    if (!admins.rowCount) {
      const result = await client.query(`
        INSERT INTO notifications (type, destinataire, sujet, message, date_envoi, statut, anomalie_id)
        VALUES ('ALERTE_ANOMALIE', 'ADMINISTRATEUR', $1, $2, NULL, 'EN_ATTENTE', $3)
        RETURNING *
      `, [sujet, message, anomalie.id]);
      created = result.rows[0];
    } else {
      for (const admin of admins.rows) {
        const result = await client.query(`
          INSERT INTO notifications (type, destinataire, sujet, message, date_envoi, statut, anomalie_id)
          VALUES ('ALERTE_ANOMALIE', $1, $2, $3, NULL, 'EN_ATTENTE', $4)
          RETURNING *
        `, [admin.email, sujet, message, anomalie.id]);
        created = result.rows[0];
      }
    }

    await client.query('COMMIT');
    return created;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  getAllNotifications,
  getNotificationById,
  getNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  createNotificationFromAnomaly,
};
