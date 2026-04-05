const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticateJWT, requireAuth } = require('../middlewares/auth.middleware');

router.get('/me', authenticateJWT, authController.me);
router.post('/register/send-otp', authController.sendOtp);
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/face/register', authenticateJWT, requireAuth, authController.faceRegister);        
router.post('/face/login', authController.faceLogin);
router.post('/logout', authenticateJWT, authController.logout);


router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

module.exports = router;