const express = require('express');

const router =
  express.Router();

const {
  getDashboard,
} = require(
  '../controllers/dashboardController'
);

const {
  verifyToken,
  checkRole,
} = require(
  '../middlewares/authMiddleware'
);


/* =========================================================
   DASHBOARD ADMINISTRATEUR
========================================================= */

router.get(
  '/',
  verifyToken,
  checkRole(
    'ADMINISTRATEUR'
  ),
  getDashboard
);


module.exports = router;