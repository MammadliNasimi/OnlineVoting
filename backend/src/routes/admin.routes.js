const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { authenticateJWT, requireAdmin } = require('../middlewares/auth.middleware');

router.use(authenticateJWT, requireAdmin);

router.get('/database', adminController.getDatabaseStats);

router.get('/users', adminController.getUsers);
router.delete('/users/:id', adminController.deleteUser);

router.get('/elections', adminController.getElections);
router.post('/elections', adminController.createElection);
router.delete('/elections/:id', adminController.deleteElection);

router.get('/email-domains', adminController.getEmailDomains);
router.post('/email-domains', adminController.addEmailDomain);
router.delete('/email-domains/:id', adminController.deleteEmailDomain);

router.get('/queue', adminController.getQueueJobs);
router.post('/queue/:id/retry', adminController.retryQueueJob);

router.get('/logs', adminController.getLogs);

module.exports = router;
