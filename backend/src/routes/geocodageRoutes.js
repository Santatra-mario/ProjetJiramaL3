const express = require('express');

const router = express.Router();

const { rechercherAdresse } = require('../controllers/geocodageController');

const {
  verifyToken,
  checkRole,
} = require('../middlewares/authMiddleware');

/* La recherche d'adresse sert à la fiche abonné (Administrateur)
   et pourra servir au Responsable. Aucun autre rôle n'y accède. */
router.get(
  '/recherche',
  verifyToken,
  checkRole('ADMINISTRATEUR', 'RESPONSABLE'),
  rechercherAdresse
);

module.exports = router;
