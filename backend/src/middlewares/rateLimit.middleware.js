const rateLimit = require('express-rate-limit');

// Express'in 'trust proxy' ayari Render/Vercel arkasinda zaten 1 olarak ayarli;
// rate-limit boylelikle X-Forwarded-For'u dogru okur. Eger proxy yoksa istemci IP'si
// dogrudan kullanilir. Default keyGenerator IPv6'yi /64 prefix ile dogru subnet'e
// yerlestirir, custom keyGenerator yazmaktan kaciniyoruz.

const standardOptions = {
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req, res, _next, options) => {
    res.status(options.statusCode || 429).json({
      message: options.message?.message || options.message || 'Cok fazla istek. Lutfen biraz sonra tekrar deneyin.'
    });
  }
};

// Login: 5 dakikada en fazla 10 deneme (IP bazli).
const loginLimiter = rateLimit({
  ...standardOptions,
  windowMs: 5 * 60 * 1000,
  max: 10,
  message: { message: 'Cok fazla giris denemesi. Lutfen 5 dakika sonra tekrar deneyin.' }
});

// OTP gonderimi: 1 dakikada 1, 1 saatte 5. Spam'a karsi en sıkı limit.
const otpLimiter = rateLimit({
  ...standardOptions,
  windowMs: 60 * 1000,
  max: 1,
  message: { message: 'OTP istegi cok sik. Lutfen 1 dakika bekleyin.' }
});

const otpHourlyLimiter = rateLimit({
  ...standardOptions,
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { message: 'Saatte en fazla 5 OTP istegi yapabilirsiniz.' }
});

// Sifre sifirlama: 15 dakikada 3 istek.
const forgotPasswordLimiter = rateLimit({
  ...standardOptions,
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: { message: 'Cok fazla sifre sifirlama istegi. 15 dakika sonra tekrar deneyin.' }
});

// Reset password (OTP girisi): 15 dakikada 10 deneme.
const resetPasswordLimiter = rateLimit({
  ...standardOptions,
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: 'Cok fazla sifre sifirlama denemesi.' }
});

// Kayit: 1 saat icinde 5 hesap olusturma.
const registerLimiter = rateLimit({
  ...standardOptions,
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { message: 'Cok fazla kayit denemesi. Lutfen 1 saat sonra tekrar deneyin.' }
});

// Yuz girisi: 5 dakikada 10 deneme.
const faceLoginLimiter = rateLimit({
  ...standardOptions,
  windowMs: 5 * 60 * 1000,
  max: 10,
  message: { message: 'Cok fazla yuz girisi denemesi. 5 dakika sonra tekrar deneyin.' }
});

module.exports = {
  loginLimiter,
  otpLimiter,
  otpHourlyLimiter,
  forgotPasswordLimiter,
  resetPasswordLimiter,
  registerLimiter,
  faceLoginLimiter
};
