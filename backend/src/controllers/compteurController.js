const pool = require('../config/db');

/*
=========================================================
GET /api/compteurs
Lister les compteurs avec leur abonné
=========================================================
*/
async function getCompteurs(req, res) {
  try {
    const result = await pool.query(`
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
        c.created_at,
        c.updated_at
      FROM compteurs c
      INNER JOIN abonnes a
        ON a.id = c.abonne_id
      ORDER BY c.id DESC
    `);

    return res.status(200).json({
      status: 'success',
      compteurs: result.rows,
    });
  } catch (error) {
    console.error(
      'Erreur récupération compteurs :',
      error
    );

    return res.status(500).json({
      status: 'error',
      message:
        'Erreur serveur lors de la récupération des compteurs.',
    });
  }
}

/*
=========================================================
GET /api/compteurs/:id
=========================================================
*/
async function getCompteurById(req, res) {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({
      status: 'error',
      message: 'Identifiant compteur invalide.',
    });
  }

  try {
    const result = await pool.query(
      `
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
        c.created_at,
        c.updated_at
      FROM compteurs c
      INNER JOIN abonnes a
        ON a.id = c.abonne_id
      WHERE c.id = $1
      LIMIT 1
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Compteur introuvable.',
      });
    }

    return res.status(200).json({
      status: 'success',
      compteur: result.rows[0],
    });
  } catch (error) {
    console.error(
      'Erreur récupération compteur :',
      error
    );

    return res.status(500).json({
      status: 'error',
      message:
        'Erreur serveur lors de la récupération du compteur.',
    });
  }
}

/*
=========================================================
POST /api/compteurs
Créer un compteur
=========================================================
*/
async function createCompteur(req, res) {
  try {
    const {
      numero_compteur,
      type,
      date_installation,
      statut,
      abonne_id,
    } = req.body || {};

    if (
      !numero_compteur ||
      !type ||
      !abonne_id
    ) {
      return res.status(400).json({
        status: 'error',
        message:
          'Le numéro, le type et l’abonné sont obligatoires.',
      });
    }

    const numeroNettoye =
      String(numero_compteur).trim();

    const typeNettoye =
      String(type).trim().toUpperCase();

    const abonneId = Number(abonne_id);

    const statutNettoye =
      statut
        ? String(statut).trim().toUpperCase()
        : 'ACTIF';

    const typesAutorises = [
      'ELECTRICITE',
      'EAU',
    ];

    const statutsAutorises = [
      'ACTIF',
      'INACTIF',
      'A_VERIFIER',
    ];

    if (
      !typesAutorises.includes(typeNettoye)
    ) {
      return res.status(400).json({
        status: 'error',
        message:
          'Type de compteur invalide.',
      });
    }

    if (
      !statutsAutorises.includes(statutNettoye)
    ) {
      return res.status(400).json({
        status: 'error',
        message:
          'Statut de compteur invalide.',
      });
    }

    if (
      !Number.isInteger(abonneId) ||
      abonneId <= 0
    ) {
      return res.status(400).json({
        status: 'error',
        message: 'Abonné invalide.',
      });
    }

    // Vérifier que l'abonné existe
    const abonneResult = await pool.query(
      `
      SELECT id, statut
      FROM abonnes
      WHERE id = $1
      LIMIT 1
      `,
      [abonneId]
    );

    if (abonneResult.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Abonné introuvable.',
      });
    }

    if (
      abonneResult.rows[0].statut !== 'actif'
    ) {
      return res.status(400).json({
        status: 'error',
        message:
          'Impossible d’associer un compteur à un abonné inactif.',
      });
    }

    // Vérifier l'unicité
    const existing = await pool.query(
      `
      SELECT id
      FROM compteurs
      WHERE numero_compteur = $1
      LIMIT 1
      `,
      [numeroNettoye]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({
        status: 'error',
        message:
          'Ce numéro de compteur existe déjà.',
      });
    }

    const result = await pool.query(
      `
      INSERT INTO compteurs
      (
        numero_compteur,
        type,
        date_installation,
        statut,
        abonne_id
      )
      VALUES
      ($1, $2, $3, $4, $5)
      RETURNING
        id,
        numero_compteur,
        type,
        date_installation,
        statut,
        abonne_id,
        created_at
      `,
      [
        numeroNettoye,
        typeNettoye,
        date_installation || null,
        statutNettoye,
        abonneId,
      ]
    );

    return res.status(201).json({
      status: 'success',
      message:
        'Compteur créé avec succès.',
      compteur: result.rows[0],
    });
  } catch (error) {
    console.error(
      'Erreur création compteur :',
      error
    );

    if (error.code === '23505') {
      return res.status(409).json({
        status: 'error',
        message:
          'Ce numéro de compteur existe déjà.',
      });
    }

    return res.status(500).json({
      status: 'error',
      message:
        'Erreur serveur lors de la création du compteur.',
    });
  }
}

/*
=========================================================
PUT /api/compteurs/:id
Modifier un compteur
=========================================================
*/
async function updateCompteur(req, res) {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({
      status: 'error',
      message: 'Identifiant compteur invalide.',
    });
  }

  try {
    const {
      numero_compteur,
      type,
      date_installation,
      statut,
      abonne_id,
    } = req.body || {};

    if (
      !numero_compteur ||
      !type ||
      !abonne_id
    ) {
      return res.status(400).json({
        status: 'error',
        message:
          'Le numéro, le type et l’abonné sont obligatoires.',
      });
    }

    const numeroNettoye =
      String(numero_compteur).trim();

    const typeNettoye =
      String(type).trim().toUpperCase();

    const abonneId = Number(abonne_id);

    const statutNettoye =
      statut
        ? String(statut).trim().toUpperCase()
        : 'ACTIF';

    const typesAutorises = [
      'ELECTRICITE',
      'EAU',
    ];

    const statutsAutorises = [
      'ACTIF',
      'INACTIF',
      'A_VERIFIER',
    ];

    if (
      !typesAutorises.includes(typeNettoye)
    ) {
      return res.status(400).json({
        status: 'error',
        message:
          'Type de compteur invalide.',
      });
    }

    if (
      !statutsAutorises.includes(statutNettoye)
    ) {
      return res.status(400).json({
        status: 'error',
        message:
          'Statut de compteur invalide.',
      });
    }

    if (
      !Number.isInteger(abonneId) ||
      abonneId <= 0
    ) {
      return res.status(400).json({
        status: 'error',
        message: 'Abonné invalide.',
      });
    }

    const abonneResult = await pool.query(
      `
      SELECT id, statut
      FROM abonnes
      WHERE id = $1
      LIMIT 1
      `,
      [abonneId]
    );

    if (abonneResult.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Abonné introuvable.',
      });
    }

    if (
      abonneResult.rows[0].statut !== 'actif'
    ) {
      return res.status(400).json({
        status: 'error',
        message:
          'Impossible d’associer ce compteur à un abonné inactif.',
      });
    }

    const duplicate = await pool.query(
      `
      SELECT id
      FROM compteurs
      WHERE numero_compteur = $1
        AND id <> $2
      LIMIT 1
      `,
      [
        numeroNettoye,
        id,
      ]
    );

    if (duplicate.rows.length > 0) {
      return res.status(409).json({
        status: 'error',
        message:
          'Ce numéro de compteur est déjà utilisé.',
      });
    }

    const result = await pool.query(
      `
      UPDATE compteurs
      SET
        numero_compteur = $1,
        type = $2,
        date_installation = $3,
        statut = $4,
        abonne_id = $5,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING
        id,
        numero_compteur,
        type,
        date_installation,
        statut,
        abonne_id,
        updated_at
      `,
      [
        numeroNettoye,
        typeNettoye,
        date_installation || null,
        statutNettoye,
        abonneId,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Compteur introuvable.',
      });
    }

    return res.status(200).json({
      status: 'success',
      message:
        'Compteur modifié avec succès.',
      compteur: result.rows[0],
    });
  } catch (error) {
    console.error(
      'Erreur modification compteur :',
      error
    );

    return res.status(500).json({
      status: 'error',
      message:
        'Erreur serveur lors de la modification du compteur.',
    });
  }
}

/*
=========================================================
PATCH /api/compteurs/:id/statut
Activer / désactiver / mettre à vérifier
=========================================================
*/
async function updateCompteurStatus(req, res) {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({
      status: 'error',
      message: 'Identifiant compteur invalide.',
    });
  }

  try {
    const {
      statut,
    } = req.body || {};

    const statutNettoye =
      statut
        ? String(statut).trim().toUpperCase()
        : '';

    const statutsAutorises = [
      'ACTIF',
      'INACTIF',
      'A_VERIFIER',
    ];

    if (
      !statutsAutorises.includes(statutNettoye)
    ) {
      return res.status(400).json({
        status: 'error',
        message:
          'Statut invalide.',
      });
    }

    const result = await pool.query(
      `
      UPDATE compteurs
      SET
        statut = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING
        id,
        numero_compteur,
        type,
        date_installation,
        statut,
        abonne_id,
        updated_at
      `,
      [
        statutNettoye,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Compteur introuvable.',
      });
    }

    return res.status(200).json({
      status: 'success',
      message:
        'Statut du compteur modifié avec succès.',
      compteur: result.rows[0],
    });
  } catch (error) {
    console.error(
      'Erreur modification statut compteur :',
      error
    );

    return res.status(500).json({
      status: 'error',
      message:
        'Erreur serveur lors de la modification du statut.',
    });
  }
}

module.exports = {
  getCompteurs,
  getCompteurById,
  createCompteur,
  updateCompteur,
  updateCompteurStatus,
};
