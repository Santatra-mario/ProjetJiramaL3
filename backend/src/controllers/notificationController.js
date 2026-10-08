// ============================================================
// notificationController.js
// JIRAMA - Gestion des notifications
// ============================================================

const pool = require('../config/db');

const {
  synchronizeAnomalies,
} = require('./anomalieController');

// ============================================================
// CONSTANTES
// ============================================================

const ROLES_NOTIFICATION = [
  'ADMINISTRATEUR',
  'RESPONSABLE',
  'AGENT',
];

// ============================================================
// UTILITAIRE : NORMALISER UN EMAIL
// ============================================================

function normalizeEmail(email) {
  if (!email) {
    return null;
  }

  return String(email)
    .trim()
    .toLowerCase();
}

// ============================================================
// UTILITAIRE : IDENTITÉ DE L'UTILISATEUR CONNECTÉ
// ============================================================

async function currentNotificationIdentity(req) {
  try {
    const user = req.user || {};

    const userId =
      user.id ||
      user.userId ||
      user.user_id ||
      null;

    const email =
      normalizeEmail(
        user.email
      );

    const identifiant =
      user.identifiant
        ? String(user.identifiant).trim()
        : null;

    // --------------------------------------------------------
    // Recherche par ID si disponible
    // --------------------------------------------------------

    if (userId) {
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
        [userId]
      );

      if (result.rowCount > 0) {
        return result.rows[0];
      }
    }

    // --------------------------------------------------------
    // Recherche par email
    // --------------------------------------------------------

    if (email) {
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
        WHERE LOWER(email) = LOWER($1)
        LIMIT 1
        `,
        [email]
      );

      if (result.rowCount > 0) {
        return result.rows[0];
      }
    }

    // --------------------------------------------------------
    // Recherche par identifiant
    // --------------------------------------------------------

    if (identifiant) {
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
        WHERE LOWER(identifiant) = LOWER($1)
        LIMIT 1
        `,
        [identifiant]
      );

      if (result.rowCount > 0) {
        return result.rows[0];
      }
    }

    return null;

  } catch (error) {
    console.error(
      'Erreur récupération identité notification :',
      error
    );

    throw error;
  }
}

// ============================================================
// UTILITAIRE : RÉCUPÉRER UNE ANOMALIE AVEC SES INFORMATIONS
// ============================================================

async function getAnomalieDetails(anomalieId) {
  const result = await pool.query(
    `
    SELECT
      a.id,
      a.releve_id,
      a.type_anomalie,
      a.valeur_detectee,
      a.valeur_reference,
      a.seuil,
      a.date_detection,
      a.statut,
      a.commentaire,

      r.date_releve,
      r.ancien_index,
      r.nouvel_index,
      r.consommation,

      c.id AS compteur_id,
      c.numero_compteur,
      c.type AS type_compteur,
      c.statut AS statut_compteur,

      ab.id AS abonne_id,
      ab.numero_abonne,
      ab.nom AS nom_abonne,
      ab.prenom AS prenom_abonne,
      ab.adresse AS adresse_abonne

    FROM anomalies a

    INNER JOIN releves r
      ON r.id = a.releve_id

    INNER JOIN compteurs c
      ON c.id = r.compteur_id

    INNER JOIN abonnes ab
      ON ab.id = c.abonne_id

    WHERE a.id = $1

    LIMIT 1
    `,
    [anomalieId]
  );

  if (result.rowCount === 0) {
    return null;
  }

  return result.rows[0];
}

// ============================================================
// UTILITAIRE : CONSTRUIRE LE TITRE
// ============================================================

function buildNotificationSubject(anomalie) {
  const typeCompteur =
    String(
      anomalie.type_compteur || ''
    ).toUpperCase();

  const numeroCompteur =
    anomalie.numero_compteur ||
    'Compteur inconnu';

  if (typeCompteur === 'EAU') {
    return `Alerte consommation d'eau - ${numeroCompteur}`;
  }

  return `Alerte consommation électrique - ${numeroCompteur}`;
}

// ============================================================
// UTILITAIRE : CONSTRUIRE LE MESSAGE
// ============================================================

function buildNotificationMessage(anomalie) {
  const typeCompteur =
    String(
      anomalie.type_compteur || ''
    ).toUpperCase();

  const unite =
    typeCompteur === 'EAU'
      ? 'm³'
      : 'kWh';

  const numeroCompteur =
    anomalie.numero_compteur ||
    'Non renseigné';

  const nomAbonne =
    [
      anomalie.nom_abonne,
      anomalie.prenom_abonne,
    ]
      .filter(Boolean)
      .join(' ') ||
    'Abonné non renseigné';

  const consommation =
    Number(
      anomalie.valeur_detectee ??
      anomalie.consommation ??
      0
    );

  const reference =
    Number(
      anomalie.valeur_reference ?? 0
    );

  const seuil =
    Number(
      anomalie.seuil ?? 0
    );

  let message =
    `Une consommation potentiellement anormale ` +
    `a été détectée pour le compteur ${numeroCompteur}.`;

  message +=
    ` Abonné : ${nomAbonne}.`;

  message +=
    ` Consommation détectée : ${consommation.toLocaleString(
      'fr-FR',
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    )} ${unite}.`;

  if (reference > 0) {
    message +=
      ` Valeur de référence : ${reference.toLocaleString(
        'fr-FR',
        {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }
      )} ${unite}.`;
  }

  if (seuil > 0) {
    message +=
      ` Seuil de détection : ${seuil.toLocaleString(
        'fr-FR',
        {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }
      )} %.`;
  }

  if (anomalie.type_anomalie) {
    message +=
      ` Type : ${anomalie.type_anomalie}.`;
  }

  return message;
}

// ============================================================
// CRÉER UNE NOTIFICATION POUR UNE ANOMALIE
//
// Cette fonction crée une notification pour chaque
// ADMINISTRATEUR et RESPONSABLE actif.
//
// La vérification se fait par :
//     anomalie_id + destinataire
//
// Donc une anomalie peut avoir :
//
//     anomalie 5 -> admin@jirama.mg
//     anomalie 5 -> responsable@jirama.mg
//
// mais pas deux fois :
//
//     anomalie 5 -> admin@jirama.mg
//     anomalie 5 -> admin@jirama.mg
// ============================================================

async function createNotificationFromAnomaly(
  anomalieId
) {
  try {
    if (!anomalieId) {
      return {
        created: 0,
        message: 'ID anomalie manquant.',
      };
    }

    // --------------------------------------------------------
    // Récupérer l'anomalie
    // --------------------------------------------------------

    const anomalie =
      await getAnomalieDetails(
        anomalieId
      );

    if (!anomalie) {
      console.warn(
        `Anomalie ${anomalieId} introuvable.`
      );

      return {
        created: 0,
        message: 'Anomalie introuvable.',
      };
    }

    // --------------------------------------------------------
    // Ne pas créer de notification pour une anomalie résolue
    // --------------------------------------------------------

    const statutAnomalie =
      String(
        anomalie.statut || ''
      )
        .trim()
        .toUpperCase();

    if (
      statutAnomalie === 'RESOLUE'
    ) {
      return {
        created: 0,
        message:
          'Anomalie déjà résolue.',
      };
    }

    // --------------------------------------------------------
    // Récupérer ADMINISTRATEUR + RESPONSABLE + AGENT actifs
    // --------------------------------------------------------

    const usersResult =
      await pool.query(
        `
        SELECT
          id,
          nom,
          prenom,
          identifiant,
          email,
          role
        FROM users
        WHERE
          LOWER(TRIM(statut)) = 'actif'
          AND UPPER(TRIM(role)) = ANY($1::text[])
          AND email IS NOT NULL
          AND TRIM(email) <> ''
        ORDER BY role, id
        `,
        [ROLES_NOTIFICATION]
      );

    if (
      usersResult.rowCount === 0
    ) {
      console.warn(
        'Aucun administrateur, responsable ou agent actif trouvé pour les notifications.'
      );

      return {
        created: 0,
        message:
          'Aucun destinataire actif.',
      };
    }

    const sujet =
      buildNotificationSubject(
        anomalie
      );

    const message =
      buildNotificationMessage(
        anomalie
      );

    let createdCount = 0;

    // --------------------------------------------------------
    // Créer une notification par destinataire
    // --------------------------------------------------------

    for (
      const user
      of usersResult.rows
    ) {
      const destinataire =
        normalizeEmail(
          user.email
        );

      if (!destinataire) {
        continue;
      }

      // ------------------------------------------------------
      // Vérifier si cette notification existe déjà
      // pour ce destinataire
      // ------------------------------------------------------

      const existing =
        await pool.query(
          `
          SELECT id
          FROM notifications
          WHERE anomalie_id = $1
            AND LOWER(TRIM(destinataire))
                = LOWER(TRIM($2))
          LIMIT 1
          `,
          [
            anomalieId,
            destinataire,
          ]
        );

      if (
        existing.rowCount > 0
      ) {
        continue;
      }

      // ------------------------------------------------------
      // Insérer la notification
      // ------------------------------------------------------

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
          $1,
          $2,
          $3,
          $4,
          NULL,
          'EN_ATTENTE',
          $5
        )
        `,
        [
          'ANOMALIE',
          destinataire,
          sujet,
          message,
          anomalieId,
        ]
      );

      createdCount++;

      console.log(
        `Notification créée pour ${destinataire} ` +
        `(anomalie #${anomalieId})`
      );
    }

    return {
      created: createdCount,
      anomalieId,
      message:
        `${createdCount} notification(s) créée(s).`,
    };

  } catch (error) {
    console.error(
      'Erreur création notification anomalie :',
      error
    );

    throw error;
  }
}

// ============================================================
// SYNCHRONISER LES NOTIFICATIONS ADMIN / RESPONSABLE
//
// Cette fonction est importante pour ton problème actuel.
//
// Elle permet de créer les notifications même si le relevé
// a été enregistré avant que l'Admin ouvre la page.
//
// Exemple :
//
// relevé existant
//       ↓
// anomalie existante
//       ↓
// Admin ouvre Notifications
//       ↓
// notification Admin créée
// ============================================================

async function synchronizeAdminNotifications() {
  try {
    // --------------------------------------------------------
    // Synchroniser les anomalies
    // --------------------------------------------------------

    await synchronizeAnomalies();

    // --------------------------------------------------------
    // Récupérer les anomalies actives
    // --------------------------------------------------------

    const anomaliesResult =
      await pool.query(
        `
        SELECT id
        FROM anomalies
        WHERE
          UPPER(TRIM(statut))
          IN ('NOUVELLE', 'EN_COURS')
        ORDER BY
          date_detection DESC,
          id DESC
        LIMIT 100
        `
      );

    if (
      anomaliesResult.rowCount === 0
    ) {
      return {
        anomalies: 0,
        notifications: 0,
      };
    }

    let totalCreated = 0;

    // --------------------------------------------------------
    // Créer les notifications
    // --------------------------------------------------------

    for (
      const anomalie
      of anomaliesResult.rows
    ) {
      try {
        const result =
          await createNotificationFromAnomaly(
            anomalie.id
          );

        totalCreated +=
          Number(
            result?.created || 0
          );

      } catch (error) {
        console.error(
          `Erreur notification anomalie ${anomalie.id} :`,
          error
        );
      }
    }

    return {
      anomalies:
        anomaliesResult.rowCount,
      notifications:
        totalCreated,
    };

  } catch (error) {
    console.error(
      'Erreur synchronisation notifications Admin/Responsable :',
      error
    );

    // Important :
    // On ne bloque pas la page des notifications si
    // la synchronisation rencontre une erreur.
    return {
      anomalies: 0,
      notifications: 0,
      error: true,
    };
  }
}

// ============================================================
// NOTIFICATION POUR UN RELEVÉ PRÉCIS
//
// Appelée depuis releveController.js après création/modification
// d'un relevé.
//
// Exemple :
//
// await notifyAnomalyForReleve(releveId);
// ============================================================

async function notifyAnomalyForReleve(
  releveId
) {
  try {
    if (!releveId) {
      return {
        created: 0,
        message:
          'ID relevé manquant.',
      };
    }

    // --------------------------------------------------------
    // Chercher l'anomalie correspondant au relevé
    // --------------------------------------------------------

    const result =
      await pool.query(
        `
        SELECT id
        FROM anomalies
        WHERE releve_id = $1
        LIMIT 1
        `,
        [releveId]
      );

    if (
      result.rowCount === 0
    ) {
      return {
        created: 0,
        message:
          'Aucune anomalie pour ce relevé.',
      };
    }

    // --------------------------------------------------------
    // Créer les notifications
    // --------------------------------------------------------

    return await createNotificationFromAnomaly(
      result.rows[0].id
    );

  } catch (error) {
    console.error(
      `Erreur notification pour le relevé ${releveId} :`,
      error
    );

    throw error;
  }
}

// ============================================================
// GET : TOUTES LES NOTIFICATIONS DE L'UTILISATEUR CONNECTÉ
//
// GET /api/notifications
// ============================================================

async function getAllNotifications(
  req,
  res
) {
  try {

    // --------------------------------------------------------
    // IMPORTANT :
    // synchroniser avant de lire les notifications
    // --------------------------------------------------------

    await synchronizeAdminNotifications();

    // --------------------------------------------------------
    // Identifier l'utilisateur
    // --------------------------------------------------------

    const identity =
      await currentNotificationIdentity(
        req
      );

    if (!identity) {
      return res.status(401).json({
        status: 'error',
        message:
          'Utilisateur introuvable.',
      });
    }

    const email =
      normalizeEmail(
        identity.email
      );

    if (!email) {
      return res.status(400).json({
        status: 'error',
        message:
          'Adresse email utilisateur manquante.',
      });
    }

    // --------------------------------------------------------
    // Récupérer les notifications personnelles
    // --------------------------------------------------------

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
          a.valeur_detectee,
          a.valeur_reference,
          a.seuil,
          a.date_detection,
          a.statut AS anomalie_statut,

          r.date_releve,
          r.consommation,

          c.numero_compteur,
          c.type AS type_compteur,

          ab.numero_abonne,
          ab.nom AS nom_abonne,
          ab.prenom AS prenom_abonne

        FROM notifications n

        LEFT JOIN anomalies a
          ON a.id = n.anomalie_id

        LEFT JOIN releves r
          ON r.id = a.releve_id

        LEFT JOIN compteurs c
          ON c.id = r.compteur_id

        LEFT JOIN abonnes ab
          ON ab.id = c.abonne_id

        WHERE LOWER(TRIM(n.destinataire))
              = LOWER(TRIM($1))

        ORDER BY
          CASE
            WHEN UPPER(TRIM(n.statut))
                 = 'EN_ATTENTE'
            THEN 0
            ELSE 1
          END,
          COALESCE(
            n.created_at,
            n.date_envoi
          ) DESC NULLS LAST,
          n.id DESC
        `,
        [email]
      );

    // --------------------------------------------------------
    // Compter
    // --------------------------------------------------------

    const total =
      result.rowCount;

    const enAttente =
      result.rows.filter(
        (notification) =>
          String(
            notification.statut || ''
          )
            .trim()
            .toUpperCase()
            === 'EN_ATTENTE'
      ).length;

    const traitees =
      result.rows.filter(
        (notification) =>
          String(
            notification.statut || ''
          )
            .trim()
            .toUpperCase()
            === 'ENVOYE'
      ).length;

    const alertesAnomalie =
      result.rows.filter(
        (notification) =>
          notification.anomalie_id
      ).length;

    return res.status(200).json({
      status: 'success',

      notifications:
        result.rows,

      total,

      count: total,

      enAttente,

      traitees,

      alertesAnomalie,

      unreadCount:
        enAttente,
    });

  } catch (error) {
    console.error(
      'Erreur récupération notifications :',
      error
    );

    return res.status(500).json({
      status: 'error',
      message:
        'Impossible de récupérer les notifications.',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : undefined,
    });
  }
}

// ============================================================
// GET : UNE NOTIFICATION
//
// GET /api/notifications/:id
// ============================================================

async function getNotificationById(
  req,
  res
) {
  try {

    const notificationId =
      Number(req.params.id);

    if (
      !Number.isInteger(
        notificationId
      ) ||
      notificationId <= 0
    ) {
      return res.status(400).json({
        status: 'error',
        message:
          'Identifiant de notification invalide.',
      });
    }

    const identity =
      await currentNotificationIdentity(
        req
      );

    if (!identity) {
      return res.status(401).json({
        status: 'error',
        message:
          'Utilisateur introuvable.',
      });
    }

    const email =
      normalizeEmail(
        identity.email
      );

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
          a.valeur_detectee,
          a.valeur_reference,
          a.seuil,
          a.date_detection,
          a.statut AS anomalie_statut,

          r.date_releve,
          r.consommation,

          c.numero_compteur,
          c.type AS type_compteur,

          ab.numero_abonne,
          ab.nom AS nom_abonne,
          ab.prenom AS prenom_abonne

        FROM notifications n

        LEFT JOIN anomalies a
          ON a.id = n.anomalie_id

        LEFT JOIN releves r
          ON r.id = a.releve_id

        LEFT JOIN compteurs c
          ON c.id = r.compteur_id

        LEFT JOIN abonnes ab
          ON ab.id = c.abonne_id

        WHERE n.id = $1
          AND LOWER(TRIM(n.destinataire))
              = LOWER(TRIM($2))

        LIMIT 1
        `,
        [
          notificationId,
          email,
        ]
      );

    if (
      result.rowCount === 0
    ) {
      return res.status(404).json({
        status: 'error',
        message:
          'Notification introuvable.',
      });
    }

    return res.status(200).json({
      status: 'success',
      notification:
        result.rows[0],
    });

  } catch (error) {
    console.error(
      'Erreur récupération notification :',
      error
    );

    return res.status(500).json({
      status: 'error',
      message:
        'Impossible de récupérer la notification.',
    });
  }
}

// ============================================================
// GET : NOMBRE DE NOTIFICATIONS NON TRAITÉES
//
// GET /api/notifications/count
// ============================================================

async function getNotificationCount(
  req,
  res
) {
  try {

    // --------------------------------------------------------
    // Synchroniser avant de compter
    // --------------------------------------------------------

    await synchronizeAdminNotifications();

    const identity =
      await currentNotificationIdentity(
        req
      );

    if (!identity) {
      return res.status(401).json({
        status: 'error',
        message:
          'Utilisateur introuvable.',
      });
    }

    const email =
      normalizeEmail(
        identity.email
      );

    const result =
      await pool.query(
        `
        SELECT
          COUNT(*)::INTEGER AS total,
          COUNT(*) FILTER (
            WHERE UPPER(TRIM(statut))
                  = 'EN_ATTENTE'
          )::INTEGER AS non_lues,
          COUNT(*) FILTER (
            WHERE UPPER(TRIM(statut))
                  = 'ENVOYE'
          )::INTEGER AS traitees
        FROM notifications
        WHERE LOWER(TRIM(destinataire))
              = LOWER(TRIM($1))
        `,
        [email]
      );

    const data =
      result.rows[0] || {
        total: 0,
        non_lues: 0,
        traitees: 0,
      };

    return res.status(200).json({
      status: 'success',

      count:
        Number(
          data.non_lues || 0
        ),

      unreadCount:
        Number(
          data.non_lues || 0
        ),

      total:
        Number(
          data.total || 0
        ),

      non_lues:
        Number(
          data.non_lues || 0
        ),

      traitees:
        Number(
          data.traitees || 0
        ),
    });

  } catch (error) {
    console.error(
      'Erreur compteur notifications :',
      error
    );

    return res.status(500).json({
      status: 'error',
      message:
        'Impossible de récupérer le nombre de notifications.',
    });
  }
}

// ============================================================
// PATCH : MARQUER UNE NOTIFICATION COMME TRAITÉE
//
// PATCH /api/notifications/:id/lue
// ============================================================

async function markNotificationAsRead(
  req,
  res
) {
  try {

    const notificationId =
      Number(req.params.id);

    if (
      !Number.isInteger(
        notificationId
      ) ||
      notificationId <= 0
    ) {
      return res.status(400).json({
        status: 'error',
        message:
          'Identifiant de notification invalide.',
      });
    }

    const identity =
      await currentNotificationIdentity(
        req
      );

    if (!identity) {
      return res.status(401).json({
        status: 'error',
        message:
          'Utilisateur introuvable.',
      });
    }

    const email =
      normalizeEmail(
        identity.email
      );

    // --------------------------------------------------------
    // Mettre à jour uniquement la notification
    // appartenant à l'utilisateur connecté
    // --------------------------------------------------------

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
          AND LOWER(TRIM(destinataire))
              = LOWER(TRIM($2))

        RETURNING
          id,
          type,
          destinataire,
          sujet,
          message,
          date_envoi,
          statut,
          anomalie_id,
          created_at
        `,
        [
          notificationId,
          email,
        ]
      );

    if (
      result.rowCount === 0
    ) {
      return res.status(404).json({
        status: 'error',
        message:
          'Notification introuvable ou non autorisée.',
      });
    }

    return res.status(200).json({
      status: 'success',
      message:
        'Notification traitée avec succès.',
      notification:
        result.rows[0],
    });

  } catch (error) {
    console.error(
      'Erreur marquage notification :',
      error
    );

    return res.status(500).json({
      status: 'error',
      message:
        'Impossible de traiter la notification.',
    });
  }
}

// ============================================================
// PATCH : MARQUER TOUTES LES NOTIFICATIONS COMME TRAITÉES
//
// PATCH /api/notifications/lire-tout
// ============================================================

async function markAllNotificationsAsRead(
  req,
  res
) {
  try {

    const identity =
      await currentNotificationIdentity(
        req
      );

    if (!identity) {
      return res.status(401).json({
        status: 'error',
        message:
          'Utilisateur introuvable.',
      });
    }

    const email =
      normalizeEmail(
        identity.email
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

        WHERE LOWER(TRIM(destinataire))
              = LOWER(TRIM($1))
          AND UPPER(TRIM(statut))
              = 'EN_ATTENTE'

        RETURNING id
        `,
        [email]
      );

    return res.status(200).json({
      status: 'success',

      message:
        result.rowCount > 0
          ? `${result.rowCount} notification(s) traitée(s).`
          : 'Aucune notification en attente.',

      updated:
        result.rowCount,
    });

  } catch (error) {
    console.error(
      'Erreur traitement de toutes les notifications :',
      error
    );

    return res.status(500).json({
      status: 'error',
      message:
        'Impossible de traiter toutes les notifications.',
    });
  }
}

// ============================================================
// DELETE : SUPPRIMER UNE NOTIFICATION
//
// DELETE /api/notifications/:id
//
// Réservé à l'ADMINISTRATEUR.
// ============================================================

async function deleteNotification(
  req,
  res
) {
  try {

    const identity =
      await currentNotificationIdentity(
        req
      );

    if (!identity) {
      return res.status(401).json({
        status: 'error',
        message:
          'Utilisateur introuvable.',
      });
    }

    const role =
      String(
        identity.role || ''
      )
        .trim()
        .toUpperCase();

    if (
      role !== 'ADMINISTRATEUR'
    ) {
      return res.status(403).json({
        status: 'error',
        message:
          'Seul un administrateur peut supprimer une notification.',
      });
    }

    const notificationId =
      Number(req.params.id);

    if (
      !Number.isInteger(
        notificationId
      ) ||
      notificationId <= 0
    ) {
      return res.status(400).json({
        status: 'error',
        message:
          'Identifiant de notification invalide.',
      });
    }

    const result =
      await pool.query(
        `
        DELETE FROM notifications
        WHERE id = $1
        RETURNING id
        `,
        [notificationId]
      );

    if (
      result.rowCount === 0
    ) {
      return res.status(404).json({
        status: 'error',
        message:
          'Notification introuvable.',
      });
    }

    return res.status(200).json({
      status: 'success',
      message:
        'Notification supprimée avec succès.',
      deletedId:
        result.rows[0].id,
    });

  } catch (error) {
    console.error(
      'Erreur suppression notification :',
      error
    );

    return res.status(500).json({
      status: 'error',
      message:
        'Impossible de supprimer la notification.',
    });
  }
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  getAllNotifications,
  getNotificationById,
  getNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,

  createNotificationFromAnomaly,
  notifyAnomalyForReleve,

  synchronizeAdminNotifications,
};