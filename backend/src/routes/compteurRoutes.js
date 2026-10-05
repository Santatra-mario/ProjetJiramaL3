const express = require('express');

const router = express.Router();

const {
  getCompteurs,
  getCompteurById,
  createCompteur,
  updateCompteur,
  updateCompteurStatus,
} = require('../controllers/compteurController');

const {
  verifyToken,
  checkRole,
} = require('../middlewares/authMiddleware');

/*
=========================================================
CONSULTATION
=========================================================
*/

router.get(
  '/',
  verifyToken,
  checkRole(
    'ADMINISTRATEUR',
    'AGENT',
    'RESPONSABLE'
  ),
  getCompteurs
);

router.get(
  '/:id',
  verifyToken,
  checkRole(
    'ADMINISTRATEUR',
    'AGENT',
    'RESPONSABLE'
  ),
  getCompteurById
);

/*
=========================================================
CRÉATION / MODIFICATION
Seul ADMINISTRATEUR
=========================================================
*/

router.post(
  '/',
  verifyToken,
  checkRole('ADMINISTRATEUR'),
  createCompteur
);

router.put(
  '/:id',
  verifyToken,
  checkRole('ADMINISTRATEUR'),
  updateCompteur
);

router.patch(
  '/:id/statut',
  verifyToken,
  checkRole('ADMINISTRATEUR'),
  updateCompteurStatus
);

module.exports = router;