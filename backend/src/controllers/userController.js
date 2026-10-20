const bcrypt = require('bcrypt');
const pool = require('../config/db');
const { logAudit } = require('../utils/auditLogger');

const ROLES_AUTORISES = [
  'AGENT',
  'RESPONSABLE',
];

/* =========================================================
   UTILITAIRE : récupérer un utilisateur sans mot de passe
========================================================= */
const userSelect = `
  SELECT
    id,
    nom,
    prenom,
    identifiant,
    email,
    role,
    statut,
    created_at,
    updated_at
  FROM users
`;

/* =========================================================
   GET /api/users
   Liste des utilisateurs
========================================================= */
async function getUsers(req, res) {
  try {
    const result = await pool.query(`
      ${userSelect}
      ORDER BY id DESC
    `);

    return res.status(200).json({
      status: 'success',
      users: result.rows,
    });
  } catch (error) {
    console.error(
      'Erreur récupération utilisateurs :',
      error
    );

    return res.status(500).json({
      status: 'error',
      message:
        'Erreur serveur lors de la récupération des utilisateurs.',
    });
  }
}

/* =========================================================
   GET /api/users/:id
   Un utilisateur
========================================================= */
async function getUserById(req, res) {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({
      status: 'error',
      message: 'Identifiant utilisateur invalide.',
    });
  }

  try {
    const result = await pool.query(
      `
      ${userSelect}
      WHERE id = $1
      LIMIT 1
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Utilisateur introuvable.',
      });
    }

    return res.status(200).json({
      status: 'success',
      user: result.rows[0],
    });
  } catch (error) {
    console.error(
      'Erreur récupération utilisateur :',
      error
    );

    return res.status(500).json({
      status: 'error',
      message:
        'Erreur serveur lors de la récupération de l’utilisateur.',
    });
  }
}

/* =========================================================
   POST /api/users/register
   Création utilisateur
========================================================= */
async function registerUser(req, res) {
  try {
    const {
      nom,
      prenom,
      identifiant,
      email,
      mot_de_passe,
      role,
    } = req.body || {};

    if (
      !nom ||
      !prenom ||
      !identifiant ||
      !email ||
      !mot_de_passe ||
      !role
    ) {
      return res.status(400).json({
        status: 'error',
        message:
          'Tous les champs sont obligatoires.',
      });
    }

    const nomNettoye = String(nom).trim();
    const prenomNettoye = String(prenom).trim();
    const identifiantNettoye =
      String(identifiant).trim();
    const emailNettoye =
      String(email).trim().toLowerCase();
    const motDePasse =
      String(mot_de_passe);
    const roleNettoye =
      String(role).trim().toUpperCase();

    if (
      nomNettoye.length < 2 ||
      prenomNettoye.length < 2
    ) {
      return res.status(400).json({
        status: 'error',
        message:
          'Le nom et le prénom doivent contenir au moins 2 caractères.',
      });
    }

    if (identifiantNettoye.length < 3) {
      return res.status(400).json({
        status: 'error',
        message:
          'L’identifiant doit contenir au moins 3 caractères.',
      });
    }

    if (motDePasse.length < 8) {
      return res.status(400).json({
        status: 'error',
        message:
          'Le mot de passe doit contenir au moins 8 caractères.',
      });
    }

    const emailValide =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        emailNettoye
      );

    if (!emailValide) {
      return res.status(400).json({
        status: 'error',
        message: 'Adresse e-mail invalide.',
      });
    }

    if (
      !ROLES_AUTORISES.includes(roleNettoye)
    ) {
      return res.status(400).json({
        status: 'error',
        message:
          'Rôle invalide. Les rôles autorisés sont AGENT et RESPONSABLE.',
      });
    }

    const existingUser =
      await pool.query(
        `
        SELECT id
        FROM users
        WHERE LOWER(TRIM(identifiant))
              = LOWER(TRIM($1))
           OR LOWER(TRIM(email))
              = LOWER(TRIM($2))
        LIMIT 1
        `,
        [
          identifiantNettoye,
          emailNettoye,
        ]
      );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        status: 'error',
        message:
          'Cet identifiant ou cette adresse e-mail existe déjà.',
      });
    }

    const hash =
      await bcrypt.hash(
        motDePasse,
        10
      );

    const result =
      await pool.query(
        `
        INSERT INTO users
        (
          nom,
          prenom,
          identifiant,
          email,
          mot_de_passe,
          role,
          statut
        )
        VALUES
        ($1, $2, $3, $4, $5, $6, 'actif')
        RETURNING
          id,
          nom,
          prenom,
          identifiant,
          email,
          role,
          statut,
          created_at
        `,
        [
          nomNettoye,
          prenomNettoye,
          identifiantNettoye,
          emailNettoye,
          hash,
          roleNettoye,
        ]
      );

    await logAudit({ actorId: req.user?.id, actorRole: req.user?.role, action: 'UTILISATEUR_CREE', resourceType: 'user', resourceId: result.rows[0]?.id, details: { role: roleNettoye } });

    return res.status(201).json({
      status: 'success',
      message: 'Utilisateur créé avec succès.',
      user: result.rows[0],
    });

  } catch (error) {
    console.error(
      'Erreur création utilisateur :',
      error
    );

    if (error.code === '23505') {
      return res.status(409).json({
        status: 'error',
        message:
          'Cet identifiant ou cette adresse e-mail existe déjà.',
      });
    }

    return res.status(500).json({
      status: 'error',
      message:
        'Erreur serveur lors de la création du compte.',
    });
  }
}

/* =========================================================
   PUT /api/users/:id
   Modifier utilisateur
========================================================= */
async function updateUser(req, res) {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({
      status: 'error',
      message: 'Identifiant utilisateur invalide.',
    });
  }

  try {
    const {
      nom,
      prenom,
      identifiant,
      email,
    } = req.body || {};

    if (
      !nom ||
      !prenom ||
      !identifiant ||
      !email
    ) {
      return res.status(400).json({
        status: 'error',
        message:
          'Nom, prénom, identifiant et e-mail sont obligatoires.',
      });
    }

    const nomNettoye = String(nom).trim();
    const prenomNettoye = String(prenom).trim();
    const identifiantNettoye =
      String(identifiant).trim();
    const emailNettoye =
      String(email).trim().toLowerCase();

    const existingUser =
      await pool.query(
        `
        SELECT id
        FROM users
        WHERE
          (
            LOWER(TRIM(identifiant))
            = LOWER(TRIM($1))
            OR LOWER(TRIM(email))
            = LOWER(TRIM($2))
          )
          AND id <> $3
        LIMIT 1
        `,
        [
          identifiantNettoye,
          emailNettoye,
          id,
        ]
      );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        status: 'error',
        message:
          'Cet identifiant ou cette adresse e-mail est déjà utilisé.',
      });
    }

    const result = await pool.query(
      `
      UPDATE users
      SET
        nom = $1,
        prenom = $2,
        identifiant = $3,
        email = $4,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING
        id,
        nom,
        prenom,
        identifiant,
        email,
        role,
        statut,
        created_at,
        updated_at
      `,
      [
        nomNettoye,
        prenomNettoye,
        identifiantNettoye,
        emailNettoye,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Utilisateur introuvable.',
      });
    }

    await logAudit({ actorId: req.user?.id, actorRole: req.user?.role, action: 'UTILISATEUR_MODIFIE', resourceType: 'user', resourceId: id, details: { champs: ['nom', 'prenom', 'identifiant', 'email'] } });

    return res.status(200).json({
      status: 'success',
      message:
        'Utilisateur modifié avec succès.',
      user: result.rows[0],
    });

  } catch (error) {
    console.error(
      'Erreur modification utilisateur :',
      error
    );

    return res.status(500).json({
      status: 'error',
      message:
        'Erreur serveur lors de la modification.',
    });
  }
}

/* =========================================================
   PATCH /api/users/:id/statut
   Activer / désactiver
========================================================= */
async function updateUserStatus(req, res) {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({
      status: 'error',
      message: 'Identifiant utilisateur invalide.',
    });
  }

  try {
    const userResult = await pool.query(
      `
      SELECT
        id,
        role,
        statut
      FROM users
      WHERE id = $1
      `,
      [id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Utilisateur introuvable.',
      });
    }

    const user = userResult.rows[0];

    // Empêche l'administrateur de désactiver
    // son propre compte connecté.
    if (
      req.user &&
      Number(req.user.id) === id
    ) {
      return res.status(400).json({
        status: 'error',
        message:
          'Vous ne pouvez pas désactiver votre propre compte.',
      });
    }

    const nouveauStatut =
      user.statut === 'actif'
        ? 'inactif'
        : 'actif';

    const result = await pool.query(
      `
      UPDATE users
      SET
        statut = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING
        id,
        nom,
        prenom,
        identifiant,
        email,
        role,
        statut,
        updated_at
      `,
      [
        nouveauStatut,
        id,
      ]
    );

    await logAudit({ actorId: req.user?.id, actorRole: req.user?.role, action: 'STATUT_UTILISATEUR_MODIFIE', resourceType: 'user', resourceId: id, details: { statut: nouveauStatut } });

    return res.status(200).json({
      status: 'success',
      message:
        nouveauStatut === 'actif'
          ? 'Utilisateur réactivé avec succès.'
          : 'Utilisateur désactivé avec succès.',
      user: result.rows[0],
    });

  } catch (error) {
    console.error(
      'Erreur modification statut :',
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
   PATCH /api/users/:id/role
   Modifier rôle
========================================================= */
async function updateUserRole(req, res) {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({
      status: 'error',
      message: 'Identifiant utilisateur invalide.',
    });
  }

  try {
    const role =
      String(req.body?.role || '')
        .trim()
        .toUpperCase();

    if (
      !ROLES_AUTORISES.includes(role)
    ) {
      return res.status(400).json({
        status: 'error',
        message:
          'Rôle invalide. Utilisez AGENT ou RESPONSABLE.',
      });
    }

    const result = await pool.query(
      `
      UPDATE users
      SET
        role = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING
        id,
        nom,
        prenom,
        identifiant,
        email,
        role,
        statut,
        updated_at
      `,
      [role, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Utilisateur introuvable.',
      });
    }

    await logAudit({ actorId: req.user?.id, actorRole: req.user?.role, action: 'ROLE_UTILISATEUR_MODIFIE', resourceType: 'user', resourceId: id, details: { nouveau_role: role } });

    return res.status(200).json({
      status: 'success',
      message: 'Rôle modifié avec succès.',
      user: result.rows[0],
    });

  } catch (error) {
    console.error(
      'Erreur modification rôle :',
      error
    );

    return res.status(500).json({
      status: 'error',
      message:
        'Erreur serveur lors de la modification du rôle.',
    });
  }
}

module.exports = {
  getUsers,
  getUserById,
  registerUser,
  updateUser,
  updateUserStatus,
  updateUserRole,
};