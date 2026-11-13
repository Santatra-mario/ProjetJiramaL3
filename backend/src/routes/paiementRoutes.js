const express = require('express');
const router = express.Router();

const {
  getPaiementsFacture,
  getPaiements,
  createPaiement,
  deletePaiement,
} = require('../controllers/paiementController');

const { verifyToken, checkRole } = require('../middlewares/authMiddleware');

const roles = [
  'ADMINISTRATEUR',
  'AGENT',
];

/* =========================================================
   LECTURE — somme des versements d'une facture
   Utilisée par la génération du PDF pour le
   « MONTANT DÉJÀ PAYÉ » et le « NET À PAYER ».
========================================================= */
router.get(
  '/facture',
  verifyToken,
  checkRole(
    'ADMINISTRATEUR',
    'AGENT',
    'RESPONSABLE'
  ),
  getPaiementsFacture
);

/* =========================================================
   LECTURE — détail des versements d'une facture
========================================================= */
router.get(
  '/',
  verifyToken,
  checkRole(...roles),
  getPaiements
);

/* =========================================================
   CRÉATION / SUPPRESSION — réservées à l'administrateur
========================================================= */
router.post(
  '/',
  verifyToken,
  checkRole('ADMINISTRATEUR'),
  createPaiement
);

router.delete(
  '/:id',
  verifyToken,
  checkRole('ADMINISTRATEUR'),
  deletePaiement
);

module.exports = router;
