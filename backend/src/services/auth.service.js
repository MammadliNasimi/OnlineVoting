const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const db = require('../config/database-sqlite');
const state = require('../config/state');
const {
  hashEmail,
  isValidFaceDescriptor,
  euclideanDistance,
  isValidStudentId,
  extractStudentIdFromEmail,
  isAkdenizStudentEmail,
  isValidAkdenizStudentIdFormat,
  validateUserIdentityMapping,
  createSessionForUser,
  createMailTransporter
} = require('../utils/helpers');
const { registrationOtp, passwordResetOtp } = require('./emailTemplates');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is required. Set JWT_SECRET in environment variables.');
}

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_LOCK_MINUTES = 15;
const FACE_LOGIN_MAX_ATTEMPTS = 5;
const FACE_LOGIN_LOCK_MINUTES = 15;
const FACE_THRESHOLD_DEFAULT = 0.48;
const SHOULD_LOG_OTP = process.env.DEBUG_OTP === 'true' && process.env.NODE_ENV !== 'production';
const FROM_FALLBACK = '"SSI Voting" <noreply@voting.local>';
const SMTP_FROM = process.env.SMTP_FROM || process.env.SNTP_FROM || FROM_FALLBACK;

const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();
const hashOtp = (otp, email) => crypto.createHash('sha256').update(otp + email.toLowerCase()).digest('hex');

const normalizeEmail = (email) => (email || '').toString().trim().toLowerCase();
const normalizeName = (name) => (name || '').toString().trim().toLowerCase();

async function dispatchOtpEmail(email, otpEmail) {
  const transporter = createMailTransporter();
  if (!transporter) return { sent: false, error: 'No SMTP transporter configured' };

  try {
    await transporter.sendMail({
      from: SMTP_FROM,
      to: email,
      ...otpEmail
    });
    return { sent: true };
  } catch (error) {
    return { sent: false, error: error.message };
  }
}

function ensureNotLocked(identifier, kind) {
  const lock = db.isAuthLocked(identifier, kind);
  if (lock.locked) {
    const seconds = Math.ceil((lock.retryAfterMs || 0) / 1000);
    const minutes = Math.max(1, Math.ceil(seconds / 60));
    const err = new Error(`Çok fazla başarısız deneme. Lütfen ${minutes} dakika sonra tekrar deneyin.`);
    err.locked = true;
    err.retryAfterMs = lock.retryAfterMs;
    throw err;
  }
}

// Adminin manuel olarak koyduğu hesap kilidini kontrol et.
function ensureNotManuallyLocked(user) {
  if (!user || !user.locked_until) return;
  const until = new Date(user.locked_until);
  if (isNaN(until.getTime()) || until <= new Date()) return;
  const minutesLeft = Math.max(1, Math.ceil((until.getTime() - Date.now()) / 60000));
  const reason = user.lock_reason ? ` Neden: ${user.lock_reason}` : '';
  const err = new Error(`Bu hesap yönetici tarafından kilitlenmiştir. Kilit ${minutesLeft} dakika sonra sona erer.${reason}`);
  err.locked = true;
  err.adminLock = true;
  throw err;
}

class AuthService {
  async sendOtp(email) {
    if (!email || !email.includes('@')) {
      throw new Error('Geçerli bir e-posta adresi giriniz');
    }
    const normalized = normalizeEmail(email);

    if (!db.isEmailDomainAllowed(normalized)) {
      throw new Error(`Bu e-posta domaini izin listesinde yok. Lütfen admin ile iletişime geçin. (${normalized.split('@')[1]})`);
    }

    // Bir e-posta adresinden saatte en fazla 5 OTP istegi (rate-limit middleware'i IP'yi
    // sinirliyor, burada da hesap-bazli ek kalkan olarak auth_attempts'ten yararlanalim).
    ensureNotLocked(normalized, 'otp_request');

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();
    db.createEmailVerification(normalized, hashEmail(normalized), hashOtp(otp, normalized), expiresAt);

    const { sent, error } = await dispatchOtpEmail(normalized, registrationOtp(otp));
    const isProduction = process.env.NODE_ENV === 'production';
    const devMode = !sent && !isProduction;

    if (sent) {
      console.log(`📧 Register OTP sent to: ${normalized}`);
    } else {
      console.error('Register OTP email error:', error);
    }

    if (SHOULD_LOG_OTP || devMode) {
      console.log(`🔑 Register OTP for ${normalized}: ${otp}`);
    }

    if (isProduction && !sent) {
      throw new Error('Şu anda doğrulama e-postası gönderilemiyor. Lütfen daha sonra tekrar deneyin veya yöneticiye başvurun.');
    }

    return {
      success: true,
      message: sent ? `Doğrulama kodu ${normalized} adresine gönderildi` : `[DEV] OTP: ${otp}`,
      devOtp: devMode ? otp : undefined,
      expiresIn: OTP_TTL_MS / 1000
    };
  }

  async register({ password, studentId, email, otp, faceDescriptor, firstName, lastName, name }) {
    if (!name || !password) throw new Error('İsim ve şifre zorunludur');
    if (!state.useDatabase) throw new Error('Database not available');

    const existingUser = await db.findUserByName(name);
    if (existingUser) throw new Error('Bu kullanıcı adı zaten kayıtlı');

    const normalizedEmail = normalizeEmail(email);
    const requiresStudentFormat = isAkdenizStudentEmail(normalizedEmail);
    const mappedStudentId = (studentId && String(studentId).trim())
      || (requiresStudentFormat ? extractStudentIdFromEmail(normalizedEmail) : null);

    if (requiresStudentFormat && !isValidAkdenizStudentIdFormat(mappedStudentId)) {
      throw new Error('Öğrenci numarası formatı geçersiz. Beklenen format: YYYY0808XXX (ör: 20190808081)');
    }
    if (!requiresStudentFormat && mappedStudentId && !isValidStudentId(mappedStudentId)) {
      throw new Error('Öğrenci numarası geçersiz');
    }

    if (normalizedEmail) {
      if (!db.isEmailDomainAllowed(normalizedEmail)) {
        throw new Error('E-posta adresi için izin verilen bir domain kullanılmalıdır');
      }
      if (!otp) throw new Error('E-posta doğrulama kodu (OTP) gereklidir');

      // OTP brute-force koruması: aktif OTP kaydını çek, denemesi 5'i bulduysa iptal et.
      const active = db.getActiveEmailVerification(normalizedEmail);
      if (!active) {
        throw new Error('Geçersiz veya süresi dolmuş OTP kodu');
      }
      if ((active.attempts || 0) >= OTP_MAX_ATTEMPTS) {
        db.invalidateEmailVerification(active.id);
        throw new Error('Bu OTP için çok fazla yanlış deneme yapıldı. Yeni bir kod isteyin.');
      }

      const record = db.getEmailVerification(normalizedEmail, hashOtp(otp, normalizedEmail));
      if (!record) {
        db.incrementEmailVerificationAttempts(active.id);
        const remaining = OTP_MAX_ATTEMPTS - ((active.attempts || 0) + 1);
        if (remaining <= 0) {
          db.invalidateEmailVerification(active.id);
          throw new Error('OTP yanlış denemeleri aşıldı. Yeni bir kod isteyin.');
        }
        throw new Error(`Geçersiz OTP kodu. Kalan deneme: ${remaining}`);
      }
      db.markEmailVerificationUsed(record.id);
    }

    if (faceDescriptor !== undefined && !isValidFaceDescriptor(faceDescriptor)) {
      throw new Error('Geçersiz yüz verisi');
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const createdUser = await db.createUser(
      name,
      hashedPassword,
      'user',
      mappedStudentId,
      normalizedEmail || null,
      firstName || '',
      lastName || ''
    );
    if (faceDescriptor && createdUser?.id) {
      db.setUserFaceProfile(createdUser.id, faceDescriptor);
    }
    console.log(`✅ User registered: ${name}${normalizedEmail ? ' (' + normalizedEmail + ')' : ''}`);
    return { message: 'Kayıt başarılı' };
  }

  async me(user, sessionIdHeader) {
    if (!user) throw new Error('Unauthorized');
    const fullUser = await db.findUserByName(user.name);
    return {
      user: {
        ...user,
        email: fullUser?.email,
        student_id: fullUser?.student_id
      },
      sessionId: user.sessionId || sessionIdHeader
    };
  }

  async login(name, password) {
    if (!state.useDatabase) throw new Error('Database not available');
    if (!name || !password) throw new Error('Invalid credentials');

    const lockKey = normalizeName(name);
    ensureNotLocked(lockKey, 'login');

    const user = await db.findUserByName(name);
    const passwordOk = user && bcrypt.compareSync(password, user.password);
    if (!user || !passwordOk) {
      const result = db.recordAuthFailure(lockKey, 'login', LOGIN_MAX_ATTEMPTS, LOGIN_LOCK_MINUTES);
      if (result.lockedUntil) {
        throw new Error(`Çok fazla başarısız giriş. Hesap ${LOGIN_LOCK_MINUTES} dakika kilitlendi.`);
      }
      throw new Error('Invalid credentials');
    }

    // Manuel hesap kilidi kontrolü (admin tarafından uygulanan).
    ensureNotManuallyLocked(user);

    const mappingCheck = validateUserIdentityMapping(user);
    if (!mappingCheck.ok) throw new Error(`Forbidden: ${mappingCheck.message}`);

    db.resetAuthAttempts(lockKey, 'login');

    const response = await createSessionForUser(user);
    const token = jwt.sign(
      {
        id: user.id,
        role: user.role,
        email: user.email,
        name: user.name,
        sessionId: response.sessionId
      },
      JWT_SECRET,
      { expiresIn: '8h' }
    );
    return { response, token };
  }

  async faceRegister(user, descriptor) {
    if (!state.useDatabase) throw new Error('Database not available');
    if (!user) throw new Error('Unauthorized');
    if (!isValidFaceDescriptor(descriptor)) throw new Error('Invalid face descriptor');
    db.setUserFaceProfile(user.id, descriptor);
    return { success: true, message: 'Face profile saved' };
  }

  async faceLogin(name, descriptor) {
    if (!state.useDatabase) throw new Error('Database not available');
    if (!name || !isValidFaceDescriptor(descriptor)) {
      throw new Error('Name and valid face descriptor are required');
    }

    const lockKey = normalizeName(name);
    ensureNotLocked(lockKey, 'face_login');

    const user = await db.findUserByName(name);
    if (!user) {
      db.recordAuthFailure(lockKey, 'face_login', FACE_LOGIN_MAX_ATTEMPTS, FACE_LOGIN_LOCK_MINUTES);
      throw new Error('Face login failed');
    }

    // Manuel hesap kilidi kontrolü.
    ensureNotManuallyLocked(user);

    const mappingCheck = validateUserIdentityMapping(user);
    if (!mappingCheck.ok) throw new Error(`Forbidden: ${mappingCheck.message}`);

    const faceProfile = db.getUserFaceProfile(user.id);
    if (!faceProfile) {
      db.recordAuthFailure(lockKey, 'face_login', FACE_LOGIN_MAX_ATTEMPTS, FACE_LOGIN_LOCK_MINUTES);
      throw new Error('No face profile found for this user');
    }

    const distance = euclideanDistance(descriptor, faceProfile.descriptor);
    const threshold = parseFloat(process.env.FACE_LOGIN_THRESHOLD || FACE_THRESHOLD_DEFAULT);
    if (!Number.isFinite(distance) || distance > threshold) {
      const result = db.recordAuthFailure(lockKey, 'face_login', FACE_LOGIN_MAX_ATTEMPTS, FACE_LOGIN_LOCK_MINUTES);
      if (result.lockedUntil) {
        throw new Error(`Çok fazla başarısız yüz girişi. Hesap ${FACE_LOGIN_LOCK_MINUTES} dakika kilitlendi.`);
      }
      throw new Error('Face verification failed');
    }

    db.resetAuthAttempts(lockKey, 'face_login');

    const response = await createSessionForUser(user);
    return { response, distance, threshold };
  }

  async forgotPassword(email) {
    if (!email) throw new Error('E-posta adresi giriniz.');
    const normalized = normalizeEmail(email);

    // Kullanici enumeration'i engellemek icin: kullanici bulunsa da bulunmasa da
    // ayni generic mesaj donuyoruz; ancak gerçek kullanıcılara mail atıyoruz.
    const user = db.findUserByEmailCaseInsensitive(normalized);
    const genericResponse = { message: 'Eğer bu e-posta sistemde kayıtlıysa sıfırlama kodu gönderilmiştir.' };

    if (!user) {
      // Saldirgan tespitini zorlastirmak icin yine de auth_attempts'e dokun.
      db.recordAuthFailure(normalized, 'forgot_password_unknown', 50, 60);
      return genericResponse;
    }

    // Hesap basina rate limit: 15 dk icinde >3 istek varsa kibarca reddet (DoS / mail bombasi).
    const recent = db.countRecentPasswordResets(normalized, 15);
    if (recent >= 3) {
      console.warn(`[forgot-password] Too many recent resets for ${normalized}: ${recent}`);
      return genericResponse;
    }

    // Onceki acik OTP'leri pasifle — sadece son OTP gecerli olsun ve eski denemeler iptal olsun.
    db.invalidateOldPasswordResets(normalized);

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

    db.db.prepare('INSERT INTO password_resets (email, otp_hash, expires_at, attempts) VALUES (?, ?, ?, 0)')
      .run(normalized, hashOtp(otp, normalized), expiresAt);

    if (SHOULD_LOG_OTP) {
      console.log(`PASSWORD RESET OTP FOR ${normalized}: ${otp}`);
    }

    const { sent, error } = await dispatchOtpEmail(normalized, passwordResetOtp(otp));
    if (!sent) {
      console.error('Password reset email error:', error);
    }

    return genericResponse;
  }

  async resetPassword(email, otp, newPassword) {
    if (!email || !otp || !newPassword) throw new Error('Tüm alanlar zorunludur.');
    if (typeof newPassword !== 'string' || newPassword.length < 6) {
      throw new Error('Yeni şifre en az 6 karakter olmalıdır.');
    }
    const normalized = normalizeEmail(email);

    const activeReset = db.db.prepare(
      `SELECT * FROM password_resets
       WHERE LOWER(email) = LOWER(?) AND used = 0
       AND datetime(expires_at) > datetime('now')
       ORDER BY id DESC LIMIT 1`
    ).get(normalized);
    if (!activeReset) throw new Error('Geçersiz veya süresi dolmuş kod.');

    if ((activeReset.attempts || 0) >= OTP_MAX_ATTEMPTS) {
      db.db.prepare('UPDATE password_resets SET used = 1 WHERE id = ?').run(activeReset.id);
      throw new Error('Bu kod için çok fazla yanlış deneme yapıldı. Yeniden istek gönderin.');
    }

    if (activeReset.otp_hash !== hashOtp(otp, normalized)) {
      const newAttempts = (activeReset.attempts || 0) + 1;
      db.db.prepare('UPDATE password_resets SET attempts = ? WHERE id = ?')
        .run(newAttempts, activeReset.id);
      const remaining = OTP_MAX_ATTEMPTS - newAttempts;
      if (remaining <= 0) {
        db.db.prepare('UPDATE password_resets SET used = 1 WHERE id = ?').run(activeReset.id);
        throw new Error('Çok fazla yanlış deneme. Lütfen yeni bir kod isteyin.');
      }
      throw new Error(`Yanlış kod. Kalan deneme: ${remaining}`);
    }

    const user = db.findUserByEmailCaseInsensitive(normalized);
    if (!user) throw new Error('Kullanıcı bulunamadı.');

    const hashed = bcrypt.hashSync(newPassword, 10);
    db.db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashed, user.id);
    db.db.prepare('UPDATE password_resets SET used = 1 WHERE id = ?').run(activeReset.id);

    // Eski oturumlari kapat — sifre degistikten sonra eski tokenler gecersiz kalsin.
    db.db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);

    return { message: 'Şifreniz başarıyla değiştirildi.' };
  }

  async logout(sessionId) {
    if (!sessionId) return { message: 'Already logged out' };
    if (!state.useDatabase) throw new Error('Database not available');
    await db.deleteSession(sessionId);
    return { message: 'Logged out successfully' };
  }
}

module.exports = new AuthService();
