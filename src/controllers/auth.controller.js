const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database-sqlite');

const state = require('../config/state');
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_2026';

const { hashEmail, isValidFaceDescriptor, isValidStudentId, extractStudentIdFromEmail, validateUserIdentityMapping, getUserFromSession, createSessionForUser, createMailTransporter } = require('../utils/helpers');

class AuthController {

  async sendOtp(req, res) {

  try {
    const { email } = req.body;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ message: 'Geçerli bir e-posta adresi giriniz' });
    }

    const domainAllowed = db.isEmailDomainAllowed(email);
    if (!domainAllowed) {
      return res.status(403).json({ message: `Bu e-posta domaini izin listesinde yok. Lütfen admin ile iletişime geçin. (${email.split('@')[1]})` });
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
    console.log(`🔑 Register OTP for ${email}: ${otp}`);

    res.json({
      success: true,
      message: emailSent ? `Doğrulama kodu ${email} adresine gönderildi` : `[DEV] OTP: ${otp}`,
      devOtp: devMode ? otp : undefined,
      expiresIn: 600
    });
  } catch (error) {
    console.error('Register send-otp error:', error);
    res.status(500).json({ message: 'OTP gönderilemedi', error: error.message });
  }

  }

  async register(req, res) {

  try {
    const { name, password, studentId, email, otp, faceDescriptor } = req.body;
    if (!name || !password) {
      return res.status(400).json({ message: 'İsim ve şifre zorunludur' });
    }

    if (!state.useDatabase) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const existingUser = await db.findUserByName(name);
    if (existingUser) {
      return res.status(400).json({ message: 'Bu kullanıcı adı zaten kayıtlı' });
    }

    const mappedStudentId = (studentId && String(studentId).trim()) || extractStudentIdFromEmail(email);
    if (!isValidStudentId(mappedStudentId)) {
      return res.status(400).json({
        message: 'Öğrenci numarası formatı geçersiz. Beklenen format: YYYY0808XXX (ör: 20190808081)'
      });
    }

    if (email) {
      const domainAllowed = db.isEmailDomainAllowed(email);
      if (!domainAllowed) {
        return res.status(400).json({ message: 'E-posta adresi için izin verilen bir domain kullanılmalıdır' });
      }
      if (!otp) {
        return res.status(400).json({ message: 'E-posta doğrulama kodu (OTP) gereklidir' });
      }
      const otpHash = crypto.createHash('sha256').update(otp + email.toLowerCase()).digest('hex');
      const record = db.getEmailVerification(email, otpHash);
      if (!record) {
        return res.status(400).json({ message: 'Geçersiz veya süresi dolmuş OTP kodu' });
      }
      db.markEmailVerificationUsed(record.id);
    }

    if (faceDescriptor !== undefined && !isValidFaceDescriptor(faceDescriptor)) {
      return res.status(400).json({ message: 'Geçersiz yüz verisi' });
    }

    const createdUser = await db.createUser(name, hashedPassword, 'user', mappedStudentId, email || null);
    if (faceDescriptor && createdUser?.id) {
      db.setUserFaceProfile(createdUser.id, faceDescriptor);
    }
    console.log(`✅ User registered: ${name}${email ? ' (' + email + ')' : ''}`);

    res.json({ message: 'Kayıt başarılı' });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Registration failed' });
  }

  }

  async me(req, res) {
    try {
      const user = await getUserFromSession(req);
      if (!user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      res.json({
        user,
        sessionId: user.sessionId || req.headers['x-session-id']
      });
    } catch (error) {
      console.error('Me check error:', error);
      res.status(500).json({ message: 'Error checking session' });
    }
  }

  async login(req, res) {

  try {
    const { name, password } = req.body;

    if (!state.useDatabase) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const user = await db.findUserByName(name);
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (!bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const mappingCheck = validateUserIdentityMapping(user);
    if (!mappingCheck.ok) {
      return res.status(403).json({ message: mappingCheck.message });
    }

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

    res.cookie('jwt_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 8 * 60 * 60 * 1000
    });

    res.json(response);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Login failed' });
  }

  }

  async faceRegister(req, res) {

  try {
    if (!state.useDatabase) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const user = await getUserFromSession(req);
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { descriptor } = req.body;
    if (!isValidFaceDescriptor(descriptor)) {
      return res.status(400).json({ message: 'Invalid face descriptor' });
    }

    db.setUserFaceProfile(user.id, descriptor);
    res.json({ success: true, message: 'Face profile saved' });
  } catch (error) {
    console.error('Face register error:', error);
    res.status(500).json({ message: 'Face profile could not be saved' });
  }

  }

  async faceLogin(req, res) {

  try {
    if (!state.useDatabase) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { name, descriptor } = req.body;
    if (!name || !isValidFaceDescriptor(descriptor)) {
      return res.status(400).json({ message: 'Name and valid face descriptor are required' });
    }

    const user = await db.findUserByName(name);
    if (!user) {
      return res.status(401).json({ message: 'Face login failed' });
    }

    const mappingCheck = validateUserIdentityMapping(user);
    if (!mappingCheck.ok) {
      return res.status(403).json({ message: mappingCheck.message });
    }

    const faceProfile = db.getUserFaceProfile(user.id);
    if (!faceProfile) {
      return res.status(404).json({ message: 'No face profile found for this user' });
    }

    const distance = euclideanDistance(descriptor, faceProfile.descriptor);
    const threshold = parseFloat(process.env.FACE_LOGIN_THRESHOLD || '0.48');
    if (!Number.isFinite(distance) || distance > threshold) {
      return res.status(401).json({ message: 'Face verification failed' });
    }

    const response = await createSessionForUser(user);
    res.json({
      ...response,
      faceDistance: Number(distance.toFixed(4)),
      faceThreshold: threshold
    });
  } catch (error) {
    console.error('Face login error:', error);
    res.status(500).json({ message: 'Face login failed' });
  }

  }

  async logout(req, res) {

  try {
    let sessionId = req.headers['x-session-id'];

    if (!sessionId && req.cookies && req.cookies.jwt_token) {
        try {
            const decoded = jwt.verify(req.cookies.jwt_token, JWT_SECRET);
            sessionId = decoded.sessionId;
        } catch(e) { }
    }

    if (!sessionId) {

      return res.status(200).json({ message: 'Already logged out' });
    }

    if (!state.useDatabase) {
      return res.status(503).json({ message: 'Database not available' });
    }

    await db.deleteSession(sessionId);

    res.clearCookie('jwt_token');

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Logout failed' });
  }

  }

}

module.exports = new AuthController();
