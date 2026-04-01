const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { requireAuth } = require('../middlewares/auth.middleware');

router.get('/me', authController.me);
router.post('/register/send-otp', authController.sendOtp);
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/face/register', requireAuth, authController.faceRegister);
router.post('/face/login', authController.faceLogin);
router.post('/logout', authController.logout);

module.exports = router;
