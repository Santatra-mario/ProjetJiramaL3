const express = require('express');

const router =
  express.Router();


const {
  getStatistiques,
} = require(
  '../controllers/statistiquesController'
);


const {
  verifyToken,
  checkRole,
} = require(
  '../middlewares/authMiddleware'
);


/* =========================================================
   STATISTIQUES
========================================================= */

router.get(

  '/',

  verifyToken,

  checkRole(

    'ADMINISTRATEUR',

    'RESPONSABLE'

  ),

  getStatistiques

);


module.exports =
  router;