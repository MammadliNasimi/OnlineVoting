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
const FACE_THRESHOLD_DEFAULT = 0.48;
const SHOULD_LOG_OTP = process.env.DEBUG_OTP === 'true' && process.env.NODE_ENV !== 'production';
const FROM_FALLBACK = '"SSI Voting" <noreply@voting.local>';

const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();
const hashOtp = (otp, email) => crypto.createHash('sha256').update(otp + email.toLowerCase()).digest('hex');

async function dispatchOtpEmail(email, otpEmail) {
  const transporter = createMailTransporter();
  if (!transporter) return { sent: false, error: 'No SMTP transporter configured' };

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || FROM_FALLBACK,
      to: email,
      ...otpEmail
    });
    return { sent: true };
  } catch (error) {
    return { sent: false, error: error.message };
  }
}

class AuthService {
  async sendOtp(email) {
    if (!email || !email.includes('@')) {
      throw new Error('Geçerli bir e-posta adresi giriniz');
    }

    if (!db.isEmailDomainAllowed(email)) {
      throw new Error(`Bu e-posta domaini izin listesinde yok. Lütfen admin ile iletişime geçin. (${email.split('@')[1]})`);
    }

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();
    db.createEmailVerification(email, hashEmail(email), hashOtp(otp, email), expiresAt);

    const { sent, error } = await dispatchOtpEmail(email, registrationOtp(otp));
    const isProduction = process.env.NODE_ENV === 'production';
    const devMode = !sent && !isProduction;

    if (sent) {
      console.log(`📧 Register OTP sent to: ${email}`);
    } else {
      console.error('Register OTP email error:', error);
    }

    if (SHOULD_LOG_OTP || devMode) {
      console.log(`🔑 Register OTP for ${email}: ${otp}`);
    }

    if (isProduction && !sent) {
      throw new Error('Şu anda doğrulama e-postası gönderilemiyor. Lütfen daha sonra tekrar deneyin veya yöneticiye başvurun.');
    }

    return {
      success: true,
      message: sent ? `Doğrulama kodu ${email} adresine gönderildi` : `[DEV] OTP: ${otp}`,
      devOtp: devMode ? otp : undefined,
      expiresIn: OTP_TTL_MS / 1000
    };
  }

  async register({ password, studentId, email, otp, faceDescriptor, firstName, lastName, name }) {
    if (!name || !password) throw new Error('İsim ve şifre zorunludur');
    if (!state.useDatabase) throw new Error('Database not available');

    const existingUser = await db.findUserByName(name);
    if (existingUser) throw new Error('Bu kullanıcı adı zaten kayıtlı');

    const normalizedEmail = (email || '').toString().trim().toLowerCase();
    const requiresStudentFormat = isAkdenizStudentEmail(normalizedEmail);
    const mappedStudentId = (studentId && String(studentId).trim())
      || (requiresStudentFormat ? extractStudentIdFromEmail(normalizedEmail) : null);

    if (requiresStudentFormat && !isValidAkdenizStudentIdFormat(mappedStudentId)) {
      throw new Error('Öğrenci numarası formatı geçersiz. Beklenen format: YYYY0808XXX (ör: 20190808081)');
    }
    if (!requiresStudentFormat && mappedStudentId && !isValidStudentId(mappedStudentId)) {
      throw new Error('Öğrenci numarası geçersiz');
    }

    if (email) {
      if (!db.isEmailDomainAllowed(email)) {
        throw new Error('E-posta adresi için izin verilen bir domain kullanılmalıdır');
      }
      if (!otp) throw new Error('E-posta doğrulama kodu (OTP) gereklidir');

      const record = db.getEmailVerification(email, hashOtp(otp, email));
      if (!record) throw new Error('Geçersiz veya süresi dolmuş OTP kodu');
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
      email || null,
      firstName || '',
      lastName || ''
    );
    if (faceDescriptor && createdUser?.id) {
      db.setUserFaceProfile(createdUser.id, faceDescriptor);
    }
    console.log(`✅ User registered: ${name}${email ? ' (' + email + ')' : ''}`);
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
    const user = await db.findUserByName(name);
    if (!user || !bcrypt.compareSync(password, user.password)) {
      throw new Error('Invalid credentials');
    }

    const mappingCheck = validateUserIdentityMapping(user);
    if (!mappingCheck.ok) throw new Error(`Forbidden: ${mappingCheck.message}`);

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

    const user = await db.findUserByName(name);
    if (!user) throw new Error('Face login failed');

    const mappingCheck = validateUserIdentityMapping(user);
    if (!mappingCheck.ok) throw new Error(`Forbidden: ${mappingCheck.message}`);

    const faceProfile = db.getUserFaceProfile(user.id);
    if (!faceProfile) throw new Error('No face profile found for this user');

    const distance = euclideanDistance(descriptor, faceProfile.descriptor);
    const threshold = parseFloat(process.env.FACE_LOGIN_THRESHOLD || FACE_THRESHOLD_DEFAULT);
    if (!Number.isFinite(distance) || distance > threshold) {
      throw new Error('Face verification failed');
    }

    const response = await createSessionForUser(user);
    return { response, distance, threshold };
  }

  async forgotPassword(email) {
    if (!email) throw new Error('E-posta adresi giriniz.');
    const user = db.db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) throw new Error('Kullanıcı bulunamadı.');

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

    db.db.prepare('INSERT INTO password_resets (email, otp_hash, expires_at) VALUES (?, ?, ?)')
      .run(email, hashOtp(otp, email), expiresAt);

    if (SHOULD_LOG_OTP) {
      console.log(`PASSWORD RESET OTP FOR ${email}: ${otp}`);
    }

    const { sent, error } = await dispatchOtpEmail(email, passwordResetOtp(otp));
    if (!sent) {
      console.error('Password reset email error:', error);
    }

    return { message: 'Sıfırlama kodu maile gönderildi.' };
  }

  async resetPassword(email, otp, newPassword) {
    if (!email || !otp || !newPassword) throw new Error('Tüm alanlar zorunludur.');

    const activeReset = db.db.prepare(
      "SELECT * FROM password_resets WHERE email = ? AND used = 0 AND expires_at > datetime('now') ORDER BY id DESC LIMIT 1"
    ).get(email);
    if (!activeReset) throw new Error('Geçersiz veya süresi dolmuş kod.');

    if (activeReset.otp_hash !== hashOtp(otp, email)) {
      throw new Error('Yanlış kod.');
    }

    const user = db.db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) throw new Error('Kullanıcı bulunamadı.');

    const hashed = bcrypt.hashSync(newPassword, 10);
    db.db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashed, user.id);
    db.db.prepare('UPDATE password_resets SET used = 1 WHERE id = ?').run(activeReset.id);

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
