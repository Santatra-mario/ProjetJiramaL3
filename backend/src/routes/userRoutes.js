const express = require('express');

const router = express.Router();

const {
  getUsers,
  getUserById,
  registerUser,
  updateUser,
  updateUserStatus,
  updateUserRole,
} = require('../controllers/userController');

const {
  verifyToken,
  checkRole,
} = require('../middlewares/authMiddleware');

/*
=========================================================
GESTION DES UTILISATEURS
Accessible uniquement à ADMINISTRATEUR
=========================================================
*/

// Liste
router.get(
  '/',
  verifyToken,
  checkRole('ADMINISTRATEUR'),
  getUsers
);

// Détail
router.get(
  '/:id',
  verifyToken,
  checkRole('ADMINISTRATEUR'),
  getUserById
);

// Création
router.post(
  '/register',
  verifyToken,
  checkRole('ADMINISTRATEUR'),
  registerUser
);

// Modification informations
router.put(
  '/:id',
  verifyToken,
  checkRole('ADMINISTRATEUR'),
  updateUser
);

// Activer / désactiver
router.patch(
  '/:id/statut',
  verifyToken,
  checkRole('ADMINISTRATEUR'),
  updateUserStatus
);

// Modifier rôle
router.patch(
  '/:id/role',
  verifyToken,
  checkRole('ADMINISTRATEUR'),
  updateUserRole
);

module.exports = router;