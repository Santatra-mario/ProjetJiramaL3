const express = require('express');
const router = express.Router();

const { login } = require('../controllers/authController');
const { registerUser } = require('../controllers/userController');

// Connexion (public)
router.post('/login', login);

// Inscription publique (sans token)
// registerUser n'accepte que les rôles AGENT et RESPONSABLE
// (ADMINISTRATEUR est refusé par ROLES_AUTORISES)
router.post('/register', registerUser);

module.exports = router;
