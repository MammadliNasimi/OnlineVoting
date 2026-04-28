const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { authenticateJWT, requireAdmin } = require('../middlewares/auth.middleware');

router.use(authenticateJWT, requireAdmin);

router.get('/database', adminController.getDatabaseStats);

router.get('/users', adminController.getUsers);
router.get('/users/:id/detail', adminController.getUserDetail);
router.put('/users/:id/role', adminController.updateUserRole);
router.post('/users/:id/lock', adminController.lockUser);
router.post('/users/:id/unlock', adminController.unlockUser);
router.post('/users/:id/reset-password', adminController.triggerPasswordReset);
router.delete('/users/:id', adminController.deleteUser);

// ===== Brute Force View =====
router.get('/auth-attempts', adminController.getAllAuthAttempts);
router.delete('/auth-attempts/user/:id', adminController.resetUserAuthAttempts);

router.get('/elections', adminController.getElections);
router.post('/elections', adminController.createElection);
router.delete('/elections/:id', adminController.deleteElection);

router.get('/email-domains', adminController.getEmailDomains);
router.post('/email-domains', adminController.addEmailDomain);
router.delete('/email-domains/:id', adminController.deleteEmailDomain);

router.get('/queue', adminController.getQueueJobs);
router.post('/queue/:id/retry', adminController.retryQueueJob);

router.get('/logs', adminController.getLogs);

// ===== Bulk Announcement =====
router.get('/elections/:id/eligible-voters', adminController.getEligibleVoterCount);
router.post('/elections/:id/announce', adminController.announceElection);

// ===== Admin Vote History =====
router.get('/votes', adminController.getAllVotes);

// ===== Analytics =====
router.get('/analytics/overview', adminController.getAnalyticsOverview);
router.get('/analytics/elections/:id', adminController.getElectionAnalytics);

module.exports = router;
