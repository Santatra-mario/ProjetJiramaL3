const express = require('express');

const router =
  express.Router();


const {

  getAgentDashboard,

  getAgentCompteurs,

  getAgentAbonnes,

  getAgentReleves,

  getAgentRelevesByCompteur,

  getAgentAnomalies,

  getAgentNotifications,

  getAgentNotificationCount,

  markAgentNotificationAsRead,

  markAllAgentNotificationsAsRead,

} = require(
  '../controllers/agentController'
);


const {

  createReleve,

  updateReleve,

} = require(
  '../controllers/releveController'
);


const {

  verifyToken,

  checkRole,

} = require(
  '../middlewares/authMiddleware'
);


/* =========================================================
   DASHBOARD
========================================================= */

router.get(
  '/dashboard',

  verifyToken,

  checkRole(
    'AGENT'
  ),

  getAgentDashboard
);


/* =========================================================
   COMPTEURS
========================================================= */

router.get(
  '/compteurs',

  verifyToken,

  checkRole(
    'AGENT'
  ),

  getAgentCompteurs
);


/* =========================================================
   ABONNÉS
========================================================= */

router.get(
  '/abonnes',

  verifyToken,

  checkRole(
    'AGENT'
  ),

  getAgentAbonnes
);


/* =========================================================
   RELEVÉS
========================================================= */

router.get(
  '/releves',

  verifyToken,

  checkRole(
    'AGENT'
  ),

  getAgentReleves
);


router.get(
  '/releves/compteur/:compteurId',

  verifyToken,

  checkRole(
    'AGENT'
  ),

  getAgentRelevesByCompteur
);


router.post(
  '/releves',

  verifyToken,

  checkRole(
    'AGENT'
  ),

  createReleve
);


router.put(
  '/releves/:id',

  verifyToken,

  checkRole(
    'AGENT'
  ),

  updateReleve
);


/* =========================================================
   ANOMALIES
========================================================= */

router.get(
  '/anomalies',

  verifyToken,

  checkRole(
    'AGENT'
  ),

  getAgentAnomalies
);


/* =========================================================
   NOTIFICATIONS
========================================================= */

router.get(
  '/notifications/count',

  verifyToken,

  checkRole(
    'AGENT'
  ),

  getAgentNotificationCount
);


router.get(
  '/notifications',

  verifyToken,

  checkRole(
    'AGENT'
  ),

  getAgentNotifications
);


router.patch(
  '/notifications/lire-tout',

  verifyToken,

  checkRole(
    'AGENT'
  ),

  markAllAgentNotificationsAsRead
);


router.patch(
  '/notifications/:id/lue',

  verifyToken,

  checkRole(
    'AGENT'
  ),

  markAgentNotificationAsRead
);


module.exports = router;