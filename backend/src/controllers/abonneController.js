const pool = require('../config/db');

const CHAMPS_ADRESSE = ['region', 'fokontany', 'rue', 'repere'];

/* Texte de localisation : null si vide, undefined si le champ n'est pas
   transmis lors d'une modification partielle (la valeur en base est
   alors conservée). Aucune coordonnée n'est jamais déduite du texte. */
function texteLocalisation(body, key, maxLength, partial) {
  if (!Object.prototype.hasOwnProperty.call(body, key)) return partial ? undefined : null;
  const value = body[key];
  if (value === null || value === undefined) return null;
  return String(value).trim().slice(0, maxLength) || null;
}

function lireChampsLocalisation(body = {}, partial = false) {
  const owns = (key) => Object.prototype.hasOwnProperty.call(body, key);
  const quartier = owns('quartier') ? String(body.quartier || '').trim() || null : (partial ? undefined : null);
  const commune = owns('commune') ? String(body.commune || '').trim() || null : (partial ? undefined : null);
  const region = texteLocalisation(body, 'region', 120, partial);
  const fokontany = texteLocalisation(body, 'fokontany', 160, partial);
  const rue = texteLocalisation(body, 'rue', 200, partial);
  const repere = texteLocalisation(body, 'repere', 200, partial);
  const champsTexte = { quartier, commune, region, fokontany, rue, repere };
  const latitudeBrute = owns('latitude') ? body.latitude : undefined;
  const longitudeBrute = owns('longitude') ? body.longitude : undefined;
  const latVide = latitudeBrute === undefined || latitudeBrute === null || String(latitudeBrute).trim() === '';
  const lonVide = longitudeBrute === undefined || longitudeBrute === null || String(longitudeBrute).trim() === '';

  if (partial && latitudeBrute === undefined && longitudeBrute === undefined) {
    return { ...champsTexte, latitude: undefined, longitude: undefined };
  }
  if (latVide !== lonVide) return { error: 'Renseignez la latitude et la longitude ensemble.' };
  if (latVide) return { ...champsTexte, latitude: null, longitude: null };

  const latitude = Number(latitudeBrute);
  const longitude = Number(longitudeBrute);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return { error: 'Les coordonnées GPS doivent être valides (latitude −90 à 90, longitude −180 à 180).' };
  }
  return { ...champsTexte, latitude, longitude };
}

/* =========================================================
   GET /api/abonnes
========================================================= */
async function getAbonnes(req, res) {
  try {
    const result = await pool.query(`
      SELECT
        id,
        numero_abonne,
        nom,
        prenom,
        adresse,
        quartier,
        commune,
        region,
        fokontany,
        rue,
        repere,
        latitude,
        longitude,
        telephone,
        statut,
        created_at,
        updated_at
      FROM abonnes
      WHERE LOWER(TRIM(statut)) <> 'supprime'
      ORDER BY id DESC
    `);

    return res.status(200).json({
      status: 'success',
      abonnes: result.rows,
    });
  } catch (error) {
    console.error(
      'Erreur récupération abonnés :',
      error
    );

    return res.status(500).json({
      status: 'error',
      message:
        'Erreur serveur lors de la récupération des abonnés.',
    });
  }
}

/* =========================================================
   GET /api/abonnes/:id
========================================================= */
async function getAbonneById(req, res) {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({
      status: 'error',
      message: 'Identifiant abonné invalide.',
    });
  }

  try {
    const result = await pool.query(
      `
      SELECT
        id,
        numero_abonne,
        nom,
        prenom,
        adresse,
        quartier,
        commune,
        region,
        fokontany,
        rue,
        repere,
        latitude,
        longitude,
        telephone,
        statut,
        created_at,
        updated_at
      FROM abonnes
      WHERE id = $1
        AND LOWER(TRIM(statut)) <> 'supprime'
      LIMIT 1
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Abonné introuvable.',
      });
    }

    return res.status(200).json({
      status: 'success',
      abonne: result.rows[0],
    });
  } catch (error) {
    console.error(
      'Erreur récupération abonné :',
      error
    );

    return res.status(500).json({
      status: 'error',
      message:
        'Erreur serveur lors de la récupération de l’abonné.',
    });
  }
}

/* =========================================================
   POST /api/abonnes
========================================================= */
async function createAbonne(req, res) {
  try {
    const {
      numero_abonne,
      nom,
      prenom,
      adresse,
      quartier,
      commune,
      region,
      fokontany,
      rue,
      repere,
      latitude,
      longitude,
      telephone,
    } = req.body || {};

    if (!numero_abonne || !nom) {
      return res.status(400).json({
        status: 'error',
        message:
          'Le numéro abonné et le nom sont obligatoires.',
      });
    }

    const numeroNettoye =
      String(numero_abonne).trim();

    const nomNettoye =
      String(nom).trim();

    const prenomNettoye =
      prenom ? String(prenom).trim() : null;

    const adresseNettoyee =
      adresse ? String(adresse).trim() : null;

    const telephoneNettoye =
      telephone ? String(telephone).trim() : null;

    const localisation = lireChampsLocalisation({ quartier, commune, region, fokontany, rue, repere, latitude, longitude });
    if (localisation.error) return res.status(400).json({ status: 'error', message: localisation.error });

    if (numeroNettoye.length < 2) {
      return res.status(400).json({
        status: 'error',
        message:
          'Le numéro abonné est invalide.',
      });
    }

    if (nomNettoye.length < 2) {
      return res.status(400).json({
        status: 'error',
        message:
          'Le nom doit contenir au moins 2 caractères.',
      });
    }

    const existing = await pool.query(
      `
      SELECT id
      FROM abonnes
      WHERE numero_abonne = $1
      LIMIT 1
      `,
      [numeroNettoye]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({
        status: 'error',
        message:
          'Ce numéro d’abonné existe déjà.',
      });
    }

    const result = await pool.query(
      `
      INSERT INTO abonnes
      (
        numero_abonne,
        nom,
        prenom,
        adresse,
        quartier,
        commune,
        region,
        fokontany,
        rue,
        repere,
        latitude,
        longitude,
        telephone,
        statut
      )
      VALUES
      ($1, $2, $3, $4, $5, $6, $10, $11, $12, $13, $7, $8, $9, 'actif')
      RETURNING
        id,
        numero_abonne,
        nom,
        prenom,
        adresse,
        quartier,
        commune,
        region,
        fokontany,
        rue,
        repere,
        latitude,
        longitude,
        telephone,
        statut,
        created_at
      `,
      [
        numeroNettoye,
        nomNettoye,
        prenomNettoye,
        adresseNettoyee,
        localisation.quartier,
        localisation.commune,
        localisation.latitude,
        localisation.longitude,
        telephoneNettoye,
        localisation.region,
        localisation.fokontany,
        localisation.rue,
        localisation.repere,
      ]
    );

    return res.status(201).json({
      status: 'success',
      message: 'Abonné créé avec succès.',
      abonne: result.rows[0],
    });
  } catch (error) {
    console.error(
      'Erreur création abonné :',
      error
    );

    if (error.code === '23505') {
      return res.status(409).json({
        status: 'error',
        message:
          'Ce numéro d’abonné existe déjà.',
      });
    }

    return res.status(500).json({
      status: 'error',
      message:
        'Erreur serveur lors de la création de l’abonné.',
    });
  }
}

/* =========================================================
   PUT /api/abonnes/:id
========================================================= */
async function updateAbonne(req, res) {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({
      status: 'error',
      message: 'Identifiant abonné invalide.',
    });
  }

  try {
    const {
      numero_abonne,
      nom,
      prenom,
      adresse,
      quartier,
      commune,
      region,
      fokontany,
      rue,
      repere,
      latitude,
      longitude,
      telephone,
    } = req.body || {};

    if (!numero_abonne || !nom) {
      return res.status(400).json({
        status: 'error',
        message:
          'Le numéro abonné et le nom sont obligatoires.',
      });
    }

    const numeroNettoye =
      String(numero_abonne).trim();

    const nomNettoye =
      String(nom).trim();

    const prenomNettoye =
      prenom ? String(prenom).trim() : null;

    const adresseNettoyee =
      adresse ? String(adresse).trim() : null;

    const telephoneNettoye =
      telephone ? String(telephone).trim() : null;

    const localisation = lireChampsLocalisation(req.body || {}, true);
    if (localisation.error) return res.status(400).json({ status: 'error', message: localisation.error });
    const localisationTransmise = {
      quartier: Object.prototype.hasOwnProperty.call(req.body || {}, 'quartier'),
      commune: Object.prototype.hasOwnProperty.call(req.body || {}, 'commune'),
      region: Object.prototype.hasOwnProperty.call(req.body || {}, 'region'),
      fokontany: Object.prototype.hasOwnProperty.call(req.body || {}, 'fokontany'),
      rue: Object.prototype.hasOwnProperty.call(req.body || {}, 'rue'),
      repere: Object.prototype.hasOwnProperty.call(req.body || {}, 'repere'),
      latitude: Object.prototype.hasOwnProperty.call(req.body || {}, 'latitude'),
      longitude: Object.prototype.hasOwnProperty.call(req.body || {}, 'longitude'),
    };

    const existing = await pool.query(
      `
      SELECT id
      FROM abonnes
      WHERE numero_abonne = $1
        AND id <> $2
      LIMIT 1
      `,
      [
        numeroNettoye,
        id,
      ]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({
        status: 'error',
        message:
          'Ce numéro d’abonné est déjà utilisé.',
      });
    }

    const adresseAvantResult = await pool.query(
      `SELECT adresse, quartier, commune, region, fokontany, rue, repere, latitude, longitude
       FROM abonnes WHERE id = $1 LIMIT 1`,
      [id]
    );
    const adresseAvant = adresseAvantResult.rows[0];

    const result = await pool.query(
      `
      UPDATE abonnes
      SET
        numero_abonne = $1,
        nom = $2,
        prenom = $3,
        adresse = $4,
        telephone = $5,
        quartier = CASE WHEN $7 THEN $8 ELSE quartier END,
        commune = CASE WHEN $9 THEN $10 ELSE commune END,
        latitude = CASE WHEN $11 THEN $12 ELSE latitude END,
        longitude = CASE WHEN $13 THEN $14 ELSE longitude END,
        region = CASE WHEN $15 THEN $16 ELSE region END,
        fokontany = CASE WHEN $17 THEN $18 ELSE fokontany END,
        rue = CASE WHEN $19 THEN $20 ELSE rue END,
        repere = CASE WHEN $21 THEN $22 ELSE repere END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
        AND LOWER(TRIM(statut)) <> 'supprime'
      RETURNING
        id,
        numero_abonne,
        nom,
        prenom,
        adresse,
        quartier,
        commune,
        region,
        fokontany,
        rue,
        repere,
        latitude,
        longitude,
        telephone,
        statut,
        updated_at
      `,
      [
        numeroNettoye,
        nomNettoye,
        prenomNettoye,
        adresseNettoyee,
        telephoneNettoye,
        id,
        localisationTransmise.quartier,
        localisation.quartier,
        localisationTransmise.commune,
        localisation.commune,
        localisationTransmise.latitude,
        localisation.latitude,
        localisationTransmise.longitude,
        localisation.longitude,
        localisationTransmise.region,
        localisation.region,
        localisationTransmise.fokontany,
        localisation.fokontany,
        localisationTransmise.rue,
        localisation.rue,
        localisationTransmise.repere,
        localisation.repere,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Abonné introuvable.',
      });
    }

    const abonneModifie = result.rows[0];
    const normaliserLocalisation = (value) => value === null || value === undefined ? '' : String(value).trim();
    const adresseChangee = ['adresse', 'quartier', 'commune', ...CHAMPS_ADRESSE, 'latitude', 'longitude'].some(
      (field) => normaliserLocalisation(adresseAvant?.[field]) !== normaliserLocalisation(abonneModifie[field])
    );
    if (adresseChangee) {
      try {
        await pool.query(
          `INSERT INTO notifications
             (type, destinataire, sujet, message, date_envoi, statut, evenement_cle)
           SELECT 'MISSION_CONTROLE', u.email, 'Adresse du contrôle modifiée',
             CONCAT('L’adresse du compteur ', c.numero_compteur, ' a été mise à jour : ',
               COALESCE(NULLIF(TRIM(a.adresse), ''), 'Adresse incomplète'),
               ' · ', COALESCE(NULLIF(TRIM(a.quartier), ''), 'Quartier non renseigné')),
             CURRENT_TIMESTAMP, 'EN_ATTENTE', $2::text || ':' || mc.id::text
           FROM missions_controle mc
           INNER JOIN campagnes_controle cc ON cc.id = mc.campagne_id
           INNER JOIN users u ON u.id = mc.agent_id
           INNER JOIN compteurs c ON c.id = mc.compteur_id
           INNER JOIN abonnes a ON a.id = mc.abonne_id
           WHERE mc.abonne_id = $1 AND cc.statut = 'PUBLIEE'
             AND mc.statut IN ('PLANIFIEE', 'EN_COURS', 'A_REPROGRAMMER')
             AND LOWER(TRIM(u.statut)) = 'actif'
             AND COALESCE(TRIM(u.email), '') <> ''
             AND NOT EXISTS (
               SELECT 1 FROM notifications n
               WHERE LOWER(TRIM(n.destinataire)) = LOWER(TRIM(u.email))
                 AND n.evenement_cle = $2::text || ':' || mc.id::text
             )`,
          [id, `abonne:${id}:adresse:${Date.now()}`]
        );
      } catch (notificationError) {
        console.error('Notification de changement d’adresse indisponible :', notificationError.message || notificationError);
      }
    }

    return res.status(200).json({
      status: 'success',
      message:
        'Abonné modifié avec succès.',
      abonne: abonneModifie,
    });
  } catch (error) {
    console.error(
      'Erreur modification abonné :',
      error
    );

    return res.status(500).json({
      status: 'error',
      message:
        'Erreur serveur lors de la modification de l’abonné.',
    });
  }
}

/* =========================================================
   PATCH /api/abonnes/:id/statut
========================================================= */
async function updateAbonneStatus(req, res) {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({
      status: 'error',
      message: 'Identifiant abonné invalide.',
    });
  }

  try {
    const result = await pool.query(
      `
      UPDATE abonnes
      SET
        statut = CASE
          WHEN LOWER(TRIM(statut)) = 'actif' THEN 'inactif'
          ELSE 'actif'
        END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
        AND LOWER(TRIM(statut)) <> 'supprime'
      RETURNING
        id,
        numero_abonne,
        nom,
        prenom,
        adresse,
        telephone,
        statut,
        updated_at
      `,
      [id]
    );

    if (result.rows.length === 0) {
      const existing = await pool.query(
        `SELECT LOWER(TRIM(statut)) AS statut FROM abonnes WHERE id = $1`,
        [id]
      );

      if (existing.rows[0]?.statut === 'supprime') {
        return res.status(409).json({
          status: 'error',
          message: 'Cet abonné a été supprimé définitivement et ne peut pas être réactivé.',
        });
      }

      return res.status(404).json({
        status: 'error',
        message: 'Abonné introuvable.',
      });
    }

    const nouveauStatut = String(result.rows[0].statut || '').trim().toLowerCase();

    return res.status(200).json({
      status: 'success',
      message:
        nouveauStatut === 'actif'
          ? 'Abonné réactivé avec succès. Ses compteurs retrouvent leur visibilité selon leur propre statut.'
          : 'Abonné désactivé avec succès. Ses compteurs sont conservés et retirés des listes actives.',
      abonne: result.rows[0],
    });
  } catch (error) {
    console.error(
      'Erreur modification statut abonné :',
      error
    );

    return res.status(500).json({
      status: 'error',
      message:
        'Erreur serveur lors de la modification du statut.',
    });
  }
}

/* =========================================================
   DELETE /api/abonnes/:id
  Suppression définitive des données propres à l'abonné.
========================================================= */
async function deleteAbonne(req, res) {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({
      status: 'error',
      message: 'Identifiant abonné invalide.',
    });
  }

  let client;
  let transactionOuverte = false;

  try {
    client = await pool.connect();
    await client.query('BEGIN');
    transactionOuverte = true;

    const abonneResult = await client.query(
      `SELECT id, numero_abonne, nom, prenom, statut
       FROM abonnes
       WHERE id = $1
       FOR UPDATE`,
      [id]
    );

    if (abonneResult.rows.length === 0) {
      await client.query('ROLLBACK');
      transactionOuverte = false;
      return res.status(404).json({
        status: 'error',
        message: 'Abonné introuvable.',
      });
    }

    const abonne = abonneResult.rows[0];
    const missionTable = await client.query("SELECT to_regclass('public.missions_controle') AS relation");
    const filtreMissions = missionTable.rows[0]?.relation
      ? `OR EXISTS (
           SELECT 1
           FROM public.missions_controle mc
           WHERE mc.abonne_id = $1
             AND n.evenement_cle LIKE 'mission:v2:' || mc.id::text || ':%'
         )`
      : '';

    const notificationsSupprimees = await client.query(
      `DELETE FROM public.notifications n
       WHERE n.anomalie_id IN (
           SELECT a.id
           FROM public.anomalies a
           INNER JOIN public.releves r ON r.id = a.releve_id
           INNER JOIN public.compteurs c ON c.id = r.compteur_id
           WHERE c.abonne_id = $1
         )
         OR n.releve_id IN (
           SELECT r.id
           FROM public.releves r
           INNER JOIN public.compteurs c ON c.id = r.compteur_id
           WHERE c.abonne_id = $1
         )
         ${filtreMissions}
         OR n.evenement_cle LIKE 'abonne:' || $1::text || ':%'`,
      [id]
    );

    let masquagesNotificationsSupprimes = 0;
    const masquagesTable = await client.query("SELECT to_regclass('public.notification_suppressions') AS relation");
    if (masquagesTable.rows[0]?.relation) {
      const masquages = await client.query(
        `DELETE FROM public.notification_suppressions
         WHERE anomalie_id IN (
           SELECT a.id
           FROM public.anomalies a
           INNER JOIN public.releves r ON r.id = a.releve_id
           INNER JOIN public.compteurs c ON c.id = r.compteur_id
           WHERE c.abonne_id = $1
         )`,
        [id]
      );
      masquagesNotificationsSupprimes = masquages.rowCount || 0;
    }

    let missionsSupprimees = 0;
    if (missionTable.rows[0]?.relation) {
      const missions = await client.query(
        'DELETE FROM public.missions_controle WHERE abonne_id = $1',
        [id]
      );
      missionsSupprimees = missions.rowCount || 0;
    }

    const anomaliesSupprimees = await client.query(
      `DELETE FROM public.anomalies a
       USING public.releves r, public.compteurs c
       WHERE a.releve_id = r.id
         AND r.compteur_id = c.id
         AND c.abonne_id = $1`,
      [id]
    );

    const relevesSupprimes = await client.query(
      `DELETE FROM public.releves r
       USING public.compteurs c
       WHERE r.compteur_id = c.id
         AND c.abonne_id = $1`,
      [id]
    );

    let paiementsSupprimes = 0;
    const paiementsTable = await client.query("SELECT to_regclass('public.paiements') AS relation");
    if (paiementsTable.rows[0]?.relation) {
      const paiements = await client.query(
        'DELETE FROM public.paiements WHERE abonne_id = $1',
        [id]
      );
      paiementsSupprimes = paiements.rowCount || 0;
    }

    const compteursSupprimes = await client.query(
      'DELETE FROM public.compteurs WHERE abonne_id = $1',
      [id]
    );

    const suppressionResult = await client.query(
      `DELETE FROM public.abonnes
       WHERE id = $1
       RETURNING id, numero_abonne, nom, prenom`,
      [id]
    );

    if (suppressionResult.rowCount !== 1) {
      throw new Error('La suppression de l’abonné n’a pas supprimé une ligne.');
    }

    await client.query('COMMIT');
    transactionOuverte = false;

    return res.status(200).json({
      status: 'success',
      deleted: true,
      message: 'L’abonné et ses données opérationnelles associées ont été supprimés avec succès.',
      abonne: suppressionResult.rows[0],
      donneesSupprimees: {
        notifications: notificationsSupprimees.rowCount || 0,
        masquagesNotifications: masquagesNotificationsSupprimes,
        missions: missionsSupprimees,
        anomalies: anomaliesSupprimees.rowCount || 0,
        releves: relevesSupprimes.rowCount || 0,
        paiements: paiementsSupprimes,
        compteurs: compteursSupprimes.rowCount || 0,
      },
    });
  } catch (error) {
    if (client && transactionOuverte) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Erreur annulation suppression abonné :', rollbackError);
      }
    }

    console.error('Erreur suppression abonné :', error);
    return res.status(500).json({
      status: 'error',
      message: error.code === '23503'
        ? 'Une relation ou une règle de conservation empêche la suppression complète. Aucune donnée n’a été supprimée.'
        : 'Erreur serveur lors de la suppression de l’abonné. Aucune donnée n’a été supprimée.',
    });
  } finally {
    if (client) client.release();
  }
}

module.exports = {
  getAbonnes,
  getAbonneById,
  createAbonne,
  updateAbonne,
  updateAbonneStatus,
  deleteAbonne,
};
