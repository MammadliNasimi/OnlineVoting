const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../config/database-sqlite');
const state = require('../config/state');
const { hashEmail, isValidFaceDescriptor, euclideanDistance, isValidStudentId, extractStudentIdFromEmail, isAkdenizStudentEmail, isValidAkdenizStudentIdFormat, validateUserIdentityMapping, createSessionForUser, createMailTransporter } = require('../utils/helpers');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is required. Set JWT_SECRET in environment variables.');
}

const shouldLogSensitiveOtp = process.env.DEBUG_OTP === 'true' && process.env.NODE_ENV !== 'production';

class AuthService {
  async sendOtp(email) {
    if (!email || !email.includes('@')) {
      throw new Error('Geçerli bir e-posta adresi giriniz');
    }

    const domainAllowed = db.isEmailDomainAllowed(email);
    if (!domainAllowed) {
      throw new Error(`Bu e-posta domaini izin listesinde yok. Lütfen admin ile iletişime geçin. (${email.split('@')[1]})`);
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = crypto.createHash('sha256').update(otp + email.toLowerCase()).digest('hex');
    const emailHash = hashEmail(email);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    db.createEmailVerification(email, emailHash, otpHash, expiresAt);

    let emailSent = false;
    const transporter = createMailTransporter();
    if (transporter) {
      try {
        await transporter.sendMail({
          from: process.env.SMTP_FROM || '"SSI Voting" <noreply@voting.local>',
          to: email,
          subject: '🔐 SSI Voting - Kayıt Doğrulama Kodunuz',
          html: `
            <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:480px;margin:auto;background:#0f0c29;border-radius:16px;overflow:hidden">
              <div style="background:linear-gradient(135deg,#667eea,#764ba2);padding:28px 32px">
                <h1 style="margin:0;color:#fff;font-size:22px;font-weight:800">🗳️ SSI Blockchain Oylama</h1>
                <p style="margin:6px 0 0;color:rgba(255,255,255,0.7);font-size:13px">Hesap Kayıt Doğrulaması</p>
              </div>
              <div style="padding:32px">
                <p style="color:#c4b5fd;font-size:15px;margin:0 0 8px">Kayıt doğrulama kodunuz:</p>
                <div style="background:#1e1b4b;border:2px solid #7c3aed;border-radius:12px;padding:24px;text-align:center;margin:16px 0">
                  <span style="font-size:44px;font-weight:900;letter-spacing:12px;color:#4ade80;font-family:monospace">${otp}</span>
                </div>
                <p style="color:#9ca3af;font-size:13px;margin:16px 0 0">⏰ Bu kod <strong style="color:#fbbf24">10 dakika</strong> geçerlidir.</p>
                <p style="color:#9ca3af;font-size:13px;margin:8px 0 0">🛡️ Kodu kimseyle paylaşmayınız.</p>
                <hr style="border:none;border-top:1px solid #374151;margin:24px 0">
                <p style="color:#6b7280;font-size:12px;margin:0">Bu isteği siz yapmadıysanız, bu e-postayı dikkate almayınız.</p>
              </div>
            </div>
          `
        });
        emailSent = true;
        console.log(`📧 Register OTP sent to: ${email}`);
      } catch (e) {
        console.error('Register OTP email error:', e.message);
      }
    }

    const devMode = !transporter || !emailSent;
    if (shouldLogSensitiveOtp) {
      console.log(`🔑 Register OTP for ${email}: ${otp}`);
    }

    return {
      success: true,
      message: emailSent ? `Doğrulama kodu ${email} adresine gönderildi` : `[DEV] OTP: ${otp}`,
      devOtp: devMode ? otp : undefined,
      expiresIn: 600
    };
  }

  async register({ password, studentId, email, otp, faceDescriptor, firstName, lastName, name }) {
    if (!name || !password) throw new Error('İsim ve şifre zorunludur');
    if (!state.useDatabase) throw new Error('Database not available');

    const hashedPassword = bcrypt.hashSync(password, 10);
    const existingUser = await db.findUserByName(name);
    if (existingUser) throw new Error('Bu kullanıcı adı zaten kayıtlı');

    const normalizedEmail = (email || '').toString().trim().toLowerCase();
    const requiresStudentFormat = isAkdenizStudentEmail(normalizedEmail);
    const mappedStudentId = (studentId && String(studentId).trim()) || (requiresStudentFormat ? extractStudentIdFromEmail(normalizedEmail) : null);

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

      const otpHash = crypto.createHash('sha256').update(otp + email.toLowerCase()).digest('hex');
      const record = db.getEmailVerification(email, otpHash);
      if (!record) throw new Error('Geçersiz veya süresi dolmuş OTP kodu');
      db.markEmailVerificationUsed(record.id);
    }

    if (faceDescriptor !== undefined && !isValidFaceDescriptor(faceDescriptor)) {
      throw new Error('Geçersiz yüz verisi');
    }

    const createdUser = await db.createUser(name, hashedPassword, 'user', mappedStudentId, email || null, firstName || '', lastName || '');
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
    if (!name || !isValidFaceDescriptor(descriptor)) throw new Error('Name and valid face descriptor are required');

    const user = await db.findUserByName(name);
    if (!user) throw new Error('Face login failed');

    const mappingCheck = validateUserIdentityMapping(user);
    if (!mappingCheck.ok) throw new Error(`Forbidden: ${mappingCheck.message}`);

    const faceProfile = db.getUserFaceProfile(user.id);
    if (!faceProfile) throw new Error('No face profile found for this user');

    const distance = euclideanDistance(descriptor, faceProfile.descriptor);
    const threshold = parseFloat(process.env.FACE_LOGIN_THRESHOLD || '0.48');
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

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = crypto.createHash('sha256').update(otp + email.toLowerCase()).digest('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    db.db.prepare('INSERT INTO password_resets (email, otp_hash, expires_at) VALUES (?, ?, ?)').run(email, otpHash, expiresAt);
    if (shouldLogSensitiveOtp) {
      console.log(`PASSWORD RESET OTP FOR ${email}: ${otp}`);
    }

    const transporter = createMailTransporter();
    if (transporter) {
      try {
        await transporter.sendMail({
          from: process.env.SMTP_FROM || '"SSI Voting" <noreply@voting.local>',
          to: email,
          subject: 'Hesap Şifre Sıfırlama Kodu',
          html: `
          <div style="font-family:sans-serif;max-width:500px;margin:0 auto;background:#0d0a1f;color:#fff;border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,0.5)">
            <div style="background:linear-gradient(135deg, #4f46e5, #7c3aed);padding:32px;text-align:center">
              <h1 style="margin:0;color:#fff;font-size:24px;letter-spacing:1px">🔐 SSI Blockchain Oylama</h1>
              <p style="margin:6px 0 0;color:rgba(255,255,255,0.7);font-size:13px">Şifre Sıfırlama Talebi</p>
            </div>
            <div style="padding:32px">
              <p style="color:#c4b5fd;font-size:15px;margin:0 0 8px">Şifre sıfırlama kodunuz:</p>
              <div style="background:#1e1b4b;border:2px solid #7c3aed;border-radius:12px;padding:24px;text-align:center;margin:16px 0">
                <span style="font-size:44px;font-weight:900;letter-spacing:12px;color:#4ade80;font-family:monospace">${otp}</span>
              </div>
              <p style="color:#8b5cf6;font-size:13px;text-align:center;margin:24px 0 0">Bu kod 10 dakika boyunca geçerlidir.<br>Eğer bu işlemi siz yapmadıysanız lütfen bu e-postayı dikkate almayın.</p>
            </div>
            <div style="background:#0f0c29;padding:16px;text-align:center;font-size:12px;color:#6b7280;border-top:1px solid rgba(124,58,237,0.2)">
              © 2026 SSI Voting System
            </div>
          </div>`
        });
      } catch (mailError) {
        console.log('E-posta gönderme hatası (Şifre Sıfırlama):', mailError);
      }
    }
    return { message: 'Sıfırlama kodu maile gönderildi.' };
  }

  async resetPassword(email, otp, newPassword) {
    if (!email || !otp || !newPassword) throw new Error('Tüm alanlar zorunludur.');
    
    const activeReset = db.db.prepare("SELECT * FROM password_resets WHERE email = ? AND used = 0 AND expires_at > datetime('now') ORDER BY id DESC LIMIT 1").get(email);
    if (!activeReset) throw new Error('Geçersiz veya süresi dolmuş kod.');

    const otpHash = crypto.createHash('sha256').update(otp + email.toLowerCase()).digest('hex');
    if (activeReset.otp_hash !== otpHash) throw new Error('Yanlış kod.');

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