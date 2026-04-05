const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { authenticateJWT, requireAdmin } = require('../middlewares/auth.middleware');

router.use(authenticateJWT);

router.get('/database', requireAdmin, adminController.getDatabaseStats);
router.get('/users', requireAdmin, adminController.getUsers);
router.get('/elections', requireAdmin, adminController.getElections);
router.post('/elections', requireAdmin, adminController.createElection);
router.delete('/elections/:id', requireAdmin, adminController.deleteElection);
router.get('/email-domains', requireAdmin, adminController.getEmailDomains);
router.post('/email-domains', requireAdmin, adminController.addEmailDomain);
router.delete('/email-domains/:id', requireAdmin, adminController.deleteEmailDomain);
router.get('/queue', requireAdmin, adminController.getQueueJobs);
router.post('/queue/:id/retry', requireAdmin, adminController.retryQueueJob);router.get('/logs', requireAdmin, adminController.getLogs);router.post('/users', requireAdmin, adminController.createUser);
router.put('/users/:id', requireAdmin, adminController.updateUser);
router.delete('/users/:id', requireAdmin, adminController.deleteUser);
router.delete('/sessions/:id', requireAdmin, adminController.deleteSession);
router.delete('/votes/:id', requireAdmin, adminController.deleteVote);
router.delete('/vote-status/:id', requireAdmin, adminController.deleteVoteStatus);

module.exports = router;
