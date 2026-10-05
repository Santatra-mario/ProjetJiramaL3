const express =
  require('express');


const router =
  express.Router();


const {
  getComparaison,
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