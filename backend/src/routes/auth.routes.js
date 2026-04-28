const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticateJWT, requireAuth } = require('../middlewares/auth.middleware');
const {
  loginLimiter,
  otpLimiter,
  otpHourlyLimiter,
  forgotPasswordLimiter,
  resetPasswordLimiter,
  registerLimiter,
  faceLoginLimiter
} = require('../middlewares/rateLimit.middleware');

router.get('/me', authenticateJWT, authController.me);
router.post('/register/send-otp', otpLimiter, otpHourlyLimiter, authController.sendOtp);
router.post('/register', registerLimiter, authController.register);
router.post('/login', loginLimiter, authController.login);
router.post('/face/register', authenticateJWT, requireAuth, authController.faceRegister);
router.post('/face/login', faceLoginLimiter, authController.faceLogin);
router.post('/logout', authenticateJWT, authController.logout);


router.post('/forgot-password', forgotPasswordLimiter, authController.forgotPassword);
router.post('/reset-password', resetPasswordLimiter, authController.resetPassword);

module.exports = router;
