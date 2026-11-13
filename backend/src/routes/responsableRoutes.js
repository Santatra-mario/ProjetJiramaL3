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
  getAgentsControle,
  getCiblesControle,
  getCampagnesControle,
  creerCampagneControle,
  modifierDatesCampagneControle,
  enregistrerAffectationsControle,
  ajouterMissionsControle,
  publierCampagneControle,
  cloturerCampagneControle,
  modifierMissionControle,
  enregistrerLocalisationAbonneControle,
} = require('../controllers/controleController');

const {
  verifyToken,
  checkRole,
} = require('../middlewares/authMiddleware');

const responsableOnly = [
  verifyToken,
  checkRole('RESPONSABLE'),
];

router.get('/dashboard', ...responsableOnly, getResponsableDashboard);
router.get('/controles/agents', ...responsableOnly, getAgentsControle);
router.get('/controles/cibles', ...responsableOnly, getCiblesControle);
router.get('/controles/campagnes', ...responsableOnly, getCampagnesControle);
router.post('/controles/campagnes', ...responsableOnly, creerCampagneControle);
router.patch('/controles/campagnes/:id/dates', ...responsableOnly, modifierDatesCampagneControle);
router.put('/controles/campagnes/:id/affectations', ...responsableOnly, enregistrerAffectationsControle);
router.post('/controles/campagnes/:id/missions', ...responsableOnly, ajouterMissionsControle);
router.patch('/controles/campagnes/:id/publier', ...responsableOnly, publierCampagneControle);
router.patch('/controles/campagnes/:id/cloturer', ...responsableOnly, cloturerCampagneControle);
router.patch('/controles/missions/:id', ...responsableOnly, modifierMissionControle);
router.patch('/controles/abonnes/:id/localisation', ...responsableOnly, enregistrerLocalisationAbonneControle);
router.get('/anomalies', ...responsableOnly, getResponsableAnomalies);
router.get('/notifications', ...responsableOnly, getResponsableNotifications);
router.get('/notifications/count', ...responsableOnly, getResponsableNotificationCount);
router.patch('/notifications/lire-tout', ...responsableOnly, markAllResponsableNotificationsAsRead);
router.patch('/notifications/:id/lue', ...responsableOnly, markResponsableNotificationAsRead);

module.exports = router;
