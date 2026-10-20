const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { logAudit } = require('../utils/auditLogger');

async function login(req, res) {
  try {
    // ==================================================
    // RÉCUPÉRATION DES DONNÉES
    // ==================================================
    const identifiant = String(
      req.body?.identifiant || ''
    ).trim();

    const motDePasse = String(
      req.body?.mot_de_passe || ''
    );

    // ==================================================
    // VALIDATION
    // ==================================================
    if (!identifiant || !motDePasse) {
      return res.status(400).json({
        status: 'error',
        message:
          'Identifiant et mot de passe requis.',
      });
    }

    // ==================================================
    // RECHERCHE UTILISATEUR
    // Identifiant OU e-mail
    // Insensible aux majuscules/minuscules
    // ==================================================
    const result = await pool.query(
      `
      SELECT
        id,
        nom,
        prenom,
        identifiant,
        email,
        mot_de_passe,
        role,
        statut
      FROM users
      WHERE LOWER(TRIM(identifiant))
            = LOWER(TRIM($1))
         OR LOWER(TRIM(email))
            = LOWER(TRIM($1))
      LIMIT 1
      `,
      [identifiant]
    );

    // ==================================================
    // UTILISATEUR INTROUVABLE
    // ==================================================
    if (result.rows.length === 0) {
      return res.status(401).json({
        status: 'error',
        message:
          'Identifiant ou mot de passe incorrect.',
      });
    }

    const user = result.rows[0];

    // ==================================================
    // STATUT
    // ==================================================
    const statut = String(
      user.statut || ''
    )
      .trim()
      .toLowerCase();

    if (statut !== 'actif') {
      return res.status(403).json({
        status: 'error',
        message:
          'Votre compte est désactivé.',
      });
    }

    // ==================================================
    // RÔLE
    // ==================================================
    const role = String(
      user.role || ''
    )
      .trim()
      .toUpperCase();

    const rolesAutorises = [
      'ADMINISTRATEUR',
      'AGENT',
      'RESPONSABLE',
    ];

    if (!rolesAutorises.includes(role)) {
      return res.status(403).json({
        status: 'error',
        message:
          'Rôle utilisateur invalide.',
      });
    }

    // ==================================================
    // VÉRIFIER LE HASH
    // ==================================================
    if (
      !user.mot_de_passe ||
      typeof user.mot_de_passe !== 'string'
    ) {
      console.error(
        `Hash absent pour : ${user.identifiant}`
      );

      return res.status(500).json({
        status: 'error',
        message:
          'Le compte utilisateur est mal configuré.',
      });
    }

    // ==================================================
    // COMPARER LE MOT DE PASSE
    // ==================================================
    const motDePasseValide =
      await bcrypt.compare(
        motDePasse,
        user.mot_de_passe
      );

    if (!motDePasseValide) {
      return res.status(401).json({
        status: 'error',
        message:
          'Identifiant ou mot de passe incorrect.',
      });
    }

    // ==================================================
    // JWT SECRET
    // ==================================================
    if (!process.env.JWT_SECRET) {
      console.error(
        'JWT_SECRET absent du fichier .env'
      );

      return res.status(500).json({
        status: 'error',
        message:
          'Erreur de configuration du serveur.',
      });
    }

    // ==================================================
    // CRÉATION JWT
    // ==================================================
    const token = jwt.sign(
      {
        id: user.id,
        role: role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn:
          process.env.JWT_EXPIRES_IN || '1d',
      }
    );

    // Journaliser la connexion réussie sans jamais enregistrer le mot de passe.
    await logAudit({
      actorId: user.id,
      actorRole: role,
      action: 'CONNEXION_REUSSIE',
      resourceType: 'session',
      resourceId: user.id,
      details: { methode: 'identifiant_ou_email' },
    });

    // ==================================================
    // RÉPONSE
    // ==================================================
    return res.status(200).json({
      status: 'success',
      message: 'Connexion réussie.',
      token,

      user: {
        id: user.id,
        nom: user.nom,
        prenom: user.prenom,
        identifiant: user.identifiant,
        email: user.email,
        role: role,
        statut: user.statut,
      },
    });

  } catch (error) {
    console.error(
      'Erreur lors de la connexion :',
      error
    );

    return res.status(500).json({
      status: 'error',
      message:
        'Erreur interne du serveur lors de la connexion.',
    });
  }
}

module.exports = {
  login,
};