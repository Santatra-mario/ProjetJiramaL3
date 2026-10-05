const pool = require('../config/db');

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
        telephone,
        statut,
        created_at,
        updated_at
      FROM abonnes
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
        telephone,
        statut,
        created_at,
        updated_at
      FROM abonnes
      WHERE id = $1
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
        telephone,
        statut
      )
      VALUES
      ($1, $2, $3, $4, $5, 'actif')
      RETURNING
        id,
        numero_abonne,
        nom,
        prenom,
        adresse,
        telephone,
        statut,
        created_at
      `,
      [
        numeroNettoye,
        nomNettoye,
        prenomNettoye,
        adresseNettoyee,
        telephoneNettoye,
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

    const result = await pool.query(
      `
      UPDATE abonnes
      SET
        numero_abonne = $1,
        nom = $2,
        prenom = $3,
        adresse = $4,
        telephone = $5,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
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
      [
        numeroNettoye,
        nomNettoye,
        prenomNettoye,
        adresseNettoyee,
        telephoneNettoye,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Abonné introuvable.',
      });
    }

    return res.status(200).json({
      status: 'success',
      message:
        'Abonné modifié avec succès.',
      abonne: result.rows[0],
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
    const existing = await pool.query(
      `
      SELECT id, statut
      FROM abonnes
      WHERE id = $1
      `,
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Abonné introuvable.',
      });
    }

    const nouveauStatut =
      existing.rows[0].statut === 'actif'
        ? 'inactif'
        : 'actif';

    const result = await pool.query(
      `
      UPDATE abonnes
      SET
        statut = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
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
      [
        nouveauStatut,
        id,
      ]
    );

    return res.status(200).json({
      status: 'success',
      message:
        nouveauStatut === 'actif'
          ? 'Abonné réactivé avec succès.'
          : 'Abonné désactivé avec succès.',
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

module.exports = {
  getAbonnes,
  getAbonneById,
  createAbonne,
  updateAbonne,
  updateAbonneStatus,
};