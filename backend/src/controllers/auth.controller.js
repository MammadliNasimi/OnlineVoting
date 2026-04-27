const jwt = require('jsonwebtoken');
const authService = require('../services/auth.service');

const JWT_SECRET = process.env.JWT_SECRET;

class AuthController {
  async sendOtp(req, res) {
    try {
      const result = await authService.sendOtp(req.body.email);
      res.json(result);
    } catch (error) {
      console.error('Register send-otp error:', error);
      let status = 500;
      if (error.message.includes('izin listesinde yok')) status = 403;
      if (error.message.includes('Geçerli bir e-posta')) status = 400;
      res.status(status).json({ message: error.message || 'OTP gönderilemedi' });
    }
  }

  async register(req, res) {
    try {
      const data = {
        name: req.body.name ? req.body.name.trim() : null,
        password: req.body.password,
        studentId: req.body.studentId,
        email: req.body.email,
        otp: req.body.otp,
        faceDescriptor: req.body.faceDescriptor || req.body.descriptor,
        firstName: req.body.firstName,
        lastName: req.body.lastName
      };
      
      const result = await authService.register(data);
      res.json(result);
    } catch (error) {
      console.error('Registration error:', error);
      let status = 500;
      if (error.message === 'Database not available') status = 503;
      else if (error.message !== 'Registration failed') status = 400;
      res.status(status).json({ message: error.message || 'Registration failed' });
    }
  }

  async me(req, res) {
    try {
      const result = await authService.me(req.user, req.headers['x-session-id']);
      res.json(result);
    } catch (error) {
      console.error('Me check error:', error);
      res.status(error.message === 'Unauthorized' ? 401 : 500).json({ message: 'Error checking session' });
    }
  }

  async login(req, res) {
    try {
      const name = req.body.name ? req.body.name.trim() : null;
      const { response, token } = await authService.login(name, req.body.password);

      // Cross-origin (Vercel <-> Render) icin sameSite=none + secure=true zorunlu.
      // Lokalde (HTTP) sameSite=lax + secure=false ile cookie set edilir.
      const isProd = process.env.NODE_ENV === 'production';
      res.cookie('jwt_token', token, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'none' : 'lax',
        maxAge: 8 * 60 * 60 * 1000
      });
      res.json(response);
    } catch (error) {
      console.error('Login error:', error);
      let status = 500;
      if (error.message === 'Database not available') status = 503;
      if (error.message === 'Invalid credentials') status = 401;
      if (error.message.startsWith('Forbidden')) status = 403;
      res.status(status).json({ message: error.message || 'Login failed' });
    }
  }

  async faceRegister(req, res) {
    try {
      const descriptor = req.body.descriptor || req.body.faceDescriptor;
      const result = await authService.faceRegister(req.user, descriptor);
      res.json(result);
    } catch (error) {
      console.error('Face register error:', error);
      let status = 500;
      if (error.message === 'Database not available') status = 503;
      if (error.message === 'Unauthorized') status = 401;
      if (error.message === 'Invalid face descriptor') status = 400;
      res.status(status).json({ message: 'Face profile could not be saved' });
    }
  }

  async faceLogin(req, res) {
    try {
      const name = req.body.name ? req.body.name.trim() : null;
      const { response, distance, threshold } = await authService.faceLogin(name, req.body.descriptor);
      
      const token = jwt.sign(
        {
          id: response.user.id,
          role: response.user.role,
          email: response.user.email,
          name: response.user.name,
          sessionId: response.sessionId
        },
        JWT_SECRET,
        { expiresIn: '8h' }
      );

      const isProdFace = process.env.NODE_ENV === 'production';
      res.cookie('jwt_token', token, {
        httpOnly: true,
        secure: isProdFace,
        sameSite: isProdFace ? 'none' : 'lax',
        maxAge: 8 * 60 * 60 * 1000
      });
      
      res.json({
        ...response,
        faceDistance: Number(distance.toFixed(4)),
        faceThreshold: threshold
      });
    } catch (error) {
      console.error('Face login error:', error);
      let status = 500;
      if (error.message === 'Database not available') status = 503;
      if (error.message.includes('required')) status = 400;
      if (error.message.includes('failed') || error.message.includes('No face profile')) status = 401;
      if (error.message.startsWith('Forbidden')) status = 403;
      res.status(status).json({ message: error.message || 'Face login failed' });
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

      const result = await authService.logout(sessionId);
      res.clearCookie('jwt_token');
      res.json(result);
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ message: 'Logout failed' });
    }
  }

  async forgotPassword(req, res) {
    try {
      const result = await authService.forgotPassword(req.body.email);
      res.json(result);
    } catch (error) {
      let status = 500;
      if (error.message === 'E-posta adresi giriniz.') status = 400;
      if (error.message === 'Kullanıcı bulunamadı.') status = 404;
      res.status(status).json({ message: error.message });
    }
  }

  async resetPassword(req, res) {
    try {
      const { email, otp, newPassword } = req.body;
      const result = await authService.resetPassword(email, otp, newPassword);
      res.json(result);
    } catch (error) {
      let status = 500;
      if (error.message === 'Kullanıcı bulunamadı.') status = 404;
      else if (error.message) status = 400;
      res.status(status).json({ message: error.message });
    }
  }
}

module.exports = new AuthController();
