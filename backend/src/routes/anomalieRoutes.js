const express = require('express');

const router =
  express.Router();

const {
  getAnomalies,
  getAnomalieStats,
  analyserAnomalies,
  getAnomalieById,
  updateAnomalieStatut,
} = require(
  '../controllers/anomalieController'
);

const {
  verifyToken,
  checkRole,
} = require(
  '../middlewares/authMiddleware'
);


/*
=========================================================
RÔLES AUTORISÉS
=========================================================
*/

const rolesAutorises = [
  'ADMINISTRATEUR',
  'AGENT',
  'RESPONSABLE',
];


/*
=========================================================
POST /api/anomalies/analyser

Lancer manuellement l'analyse
=========================================================
*/

router.post(
  '/analyser',

  verifyToken,

  checkRole(
    ...rolesAutorises
  ),

  analyserAnomalies
);


/*
=========================================================
GET /api/anomalies/stats

IMPORTANT :
/stats doit être AVANT /:id
=========================================================
*/

router.get(
  '/stats',

  verifyToken,

  checkRole(
    ...rolesAutorises
  ),

  getAnomalieStats
);


/*
=========================================================
GET /api/anomalies

Liste des anomalies
=========================================================
*/

router.get(
  '/',

  verifyToken,

  checkRole(
    ...rolesAutorises
  ),

  getAnomalies
);


/*
=========================================================
GET /api/anomalies/:id

Détail
=========================================================
*/

router.get(
  '/:id',

  verifyToken,

  checkRole(
    ...rolesAutorises
  ),

  getAnomalieById
);


/*
=========================================================
PATCH /api/anomalies/:id/statut

Modifier le statut
=========================================================
*/

router.patch(
  '/:id/statut',

  verifyToken,

  // Seul l’Administrateur peut enregistrer une décision finale.
  checkRole('ADMINISTRATEUR'),

  updateAnomalieStatut
);


/*
=========================================================
EXPORT
=========================================================
*/

module.exports = router;