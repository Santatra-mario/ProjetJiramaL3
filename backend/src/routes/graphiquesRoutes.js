const express = require('express');

const router =
  express.Router();


const {
  getGraphiques,
} = require(
  '../controllers/graphiquesController'
);


const {
  verifyToken,
  checkRole,
} = require(
  '../middlewares/authMiddleware'
);


/* =========================================================
   GRAPHIQUES AVANCÉS
========================================================= */

router.get(

  '/',

  verifyToken,

  checkRole(
    'ADMINISTRATEUR',
    'RESPONSABLE'
  ),

  getGraphiques

);


module.exports =
  router;