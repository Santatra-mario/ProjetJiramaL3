const express =
  require('express');


const router =
  express.Router();


const {
  getComparaison,
  getDatesDisponibles,
} =
  require(
    '../controllers/comparaisonController'
  );


const {
  verifyToken,
  checkRole,
} =
  require(
    '../middlewares/authMiddleware'
  );


/* =========================================================
   COMPARAISON DES CONSOMMATIONS
========================================================= */

// Liste des dates réellement présentes dans la base pour le type/compteur choisi.
router.get(
  '/dates-disponibles',
  verifyToken,
  checkRole('ADMINISTRATEUR', 'RESPONSABLE'),
  getDatesDisponibles
);

router.get(

  '/',

  verifyToken,

  checkRole(

    'ADMINISTRATEUR',

    'RESPONSABLE'

  ),

  getComparaison

);


module.exports =
  router;