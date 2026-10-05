const express = require('express');

const router = express.Router();

const {
  getAllReleves,
  getReleveById,
  createReleve,
  updateReleve,
  deleteReleve,
  getRelevesByCompteur,
} = require('../controllers/releveController');

const {
  verifyToken,
  checkRole,
} = require('../middlewares/authMiddleware');

/*
=========================================================
LECTURE
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
  getAllReleves
);

/*
IMPORTANT :
Cette route doit être AVANT /:id
*/
router.get(
  '/compteur/:compteurId',
  verifyToken,
  checkRole(
    'ADMINISTRATEUR',
    'AGENT',
    'RESPONSABLE'
  ),
  getRelevesByCompteur
);

router.get(
  '/:id',
  verifyToken,
  checkRole(
    'ADMINISTRATEUR',
    'AGENT',
    'RESPONSABLE'
  ),
  getReleveById
);

/*
=========================================================
CRÉATION
=========================================================
*/

router.post(
  '/',
  verifyToken,
  checkRole(
    'ADMINISTRATEUR',
    'AGENT'
  ),
  createReleve
);

/*
=========================================================
MODIFICATION
=========================================================
*/

router.put(
  '/:id',
  verifyToken,
  checkRole(
    'ADMINISTRATEUR',
    'AGENT'
  ),
  updateReleve
);

/*
=========================================================
SUPPRESSION
=========================================================
*/

router.delete(
  '/:id',
  verifyToken,
  checkRole(
    'ADMINISTRATEUR'
  ),
  deleteReleve
);

module.exports = router;