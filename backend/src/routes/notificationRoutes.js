const express = require('express');
const router = express.Router();

const {
  getAllNotifications,
  getNotificationById,
  getNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
} = require('../controllers/notificationController');

const { verifyToken, checkRole } = require('../middlewares/authMiddleware');

const roles = [
  'ADMINISTRATEUR',
  'RESPONSABLE',
  'AGENT',
];

router.get('/', verifyToken, checkRole(...roles), getAllNotifications);
router.get('/count', verifyToken, checkRole(...roles), getNotificationCount);
router.patch('/lire-tout', verifyToken, checkRole(...roles), markAllNotificationsAsRead);
router.get('/:id', verifyToken, checkRole(...roles), getNotificationById);
router.patch('/:id/lue', verifyToken, checkRole(...roles), markNotificationAsRead);
router.delete('/:id', verifyToken, checkRole('ADMINISTRATEUR'), deleteNotification);

module.exports = router;
