const express = require('express');

const router = express.Router();

const {
  getAbonnes,
  getAbonneById,
  createAbonne,
  updateAbonne,
  updateAbonneStatus,
} = require('../controllers/abonneController');

const {
  verifyToken,
  checkRole,
} = require('../middlewares/authMiddleware');

/*
=========================================================
GESTION DES ABONNÉS
=========================================================
*/

// Consulter tous les abonnés
router.get(
  '/',
  verifyToken,
  checkRole(
    'ADMINISTRATEUR',
    'AGENT',
    'RESPONSABLE'
  ),
  getAbonnes
);

// Consulter un abonné
router.get(
  '/:id',
  verifyToken,
  checkRole(
    'ADMINISTRATEUR',
    'AGENT',
    'RESPONSABLE'
  ),
  getAbonneById
);

// Créer un abonné
// Seul l'administrateur crée les abonnés.
router.post(
  '/',
  verifyToken,
  checkRole('ADMINISTRATEUR'),
  createAbonne
);

// Modifier un abonné
router.put(
  '/:id',
  verifyToken,
  checkRole('ADMINISTRATEUR'),
  updateAbonne
);

// Activer / désactiver
router.patch(
  '/:id/statut',
  verifyToken,
  checkRole('ADMINISTRATEUR'),
  updateAbonneStatus
);

module.exports = router;