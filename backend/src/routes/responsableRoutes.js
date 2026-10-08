const express = require('express');

const router = express.Router();

const {
  getResponsableDashboard,
  getResponsableNotifications,
  getResponsableNotificationCount,
  markResponsableNotificationAsRead,
  markAllResponsableNotificationsAsRead,
  getResponsableAnomalies,
} = require('../controllers/responsableController');

const {
  verifyToken,
  checkRole,
} = require('../middlewares/authMiddleware');

const responsableOnly = [
  verifyToken,
  checkRole('RESPONSABLE'),
];

router.get('/dashboard', ...responsableOnly, getResponsableDashboard);
router.get('/anomalies', ...responsableOnly, getResponsableAnomalies);
router.get('/notifications', ...responsableOnly, getResponsableNotifications);
router.get('/notifications/count', ...responsableOnly, getResponsableNotificationCount);
router.patch('/notifications/lire-tout', ...responsableOnly, markAllResponsableNotificationsAsRead);
router.patch('/notifications/:id/lue', ...responsableOnly, markResponsableNotificationAsRead);

module.exports = router;
