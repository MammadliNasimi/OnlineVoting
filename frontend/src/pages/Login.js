import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import {
  Box, Paper, Typography, Tabs, Tab, TextField, Button, Alert,
  CircularProgress, Select, MenuItem, FormControlLabel, Checkbox,
  InputAdornment, IconButton, Tooltip, Divider
} from '@mui/material';
import HowToVoteIcon from '@mui/icons-material/HowToVote';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import FaceIcon from '@mui/icons-material/Face';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LockResetIcon from '@mui/icons-material/LockReset';
import EmailIcon from '@mui/icons-material/Email';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import PasswordOutlinedIcon from '@mui/icons-material/PasswordOutlined';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import LoginOutlinedIcon from '@mui/icons-material/LoginOutlined';
import HowToRegOutlinedIcon from '@mui/icons-material/HowToRegOutlined';
import MarkEmailReadOutlinedIcon from '@mui/icons-material/MarkEmailReadOutlined';
import VerifiedUserOutlinedIcon from '@mui/icons-material/VerifiedUserOutlined';
import SensorsOutlinedIcon from '@mui/icons-material/SensorsOutlined';
import KeyOutlinedIcon from '@mui/icons-material/KeyOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import '../App.css';

const cameraPriority = (label = '') => {
  const text = label.toLowerCase();
  if (text.includes('droidcam') || text.includes('ivcam') || text.includes('iriun') || text.includes('epoccam')) return 100;
  if (text.includes('android') || text.includes('iphone') || text.includes('phone') || text.includes('telefon')) return 80;
  if (text.includes('usb') || text.includes('webcam') || text.includes('camera')) return 40;
  return 10;
};

const pickPreferredCameraId = (videoInputs, currentSelectedId = '') => {
  if (!videoInputs || videoInputs.length === 0) return '';
  const exists = videoInputs.some(v => v.deviceId === currentSelectedId);
  if (exists) return currentSelectedId;
  const sorted = [...videoInputs].sort((a, b) => cameraPriority(b.label) - cameraPriority(a.label));
  return sorted[0].deviceId;
};

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: 1.5,
    backgroundColor: '#fbfdff',
    '& fieldset': {
      borderColor: 'rgba(15, 23, 42, 0.14)'
    },
    '&:hover fieldset': {
      borderColor: '#10b981'
    },
    '&.Mui-focused fieldset': {
      borderColor: '#10b981',
      boxShadow: '0 0 0 3px rgba(16, 185, 129, 0.14)'
    }
  },
  '& .MuiInputLabel-root.Mui-focused': {
    color: '#0f9f8f'
  }
};

const primaryButtonSx = {
  py: 1.45,
  borderRadius: 1.5,
  fontWeight: 800,
  textTransform: 'none',
  color: '#06221d',
  boxShadow: '0 16px 34px rgba(16, 185, 129, 0.24)',
  background: 'linear-gradient(135deg, #34d399 0%, #10b981 48%, #0f9f8f 100%)',
  '&:hover': {
    boxShadow: '0 18px 38px rgba(16, 185, 129, 0.30)',
    background: 'linear-gradient(135deg, #2cc98f 0%, #0ea774 48%, #0b867a 100%)'
  }
};

const secondaryButtonSx = {
  borderRadius: 1.5,
  fontWeight: 700,
  textTransform: 'none',
  borderColor: 'rgba(15, 23, 42, 0.18)',
  color: '#243141',
  '&:hover': {
    borderColor: '#10b981',
    backgroundColor: 'rgba(16, 185, 129, 0.07)'
  }
};

const iconBubbleSx = {
  width: 40,
  height: 40,
  borderRadius: 2,
  display: 'grid',
  placeItems: 'center',
  color: '#2dd4bf',
  backgroundColor: 'rgba(45, 212, 191, 0.12)',
  border: '1px solid rgba(45, 212, 191, 0.22)'
};

function Login({ onLoginComplete }) {
  // Page navigation
  const [currentPage, setCurrentPage] = useState('login'); // login, register, forgotPassword, resetPassword

  // UI state
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);

  // Registration state
  const [registerMode, setRegisterMode] = useState(false);
  const [registerStep, setRegisterStep] = useState(0); // 0=form, 1=OTP
  const [registerOtp, setRegisterOtp] = useState('');

  // Forgot/Reset password state
  const [forgotPasswordStep, setForgotPasswordStep] = useState(0); // 0=email, 1=OTP, 2=newPassword
  const [forgotPasswordOtp, setForgotPasswordOtp] = useState('');
  const [resetPasswordConfirmLoading, setResetPasswordConfirmLoading] = useState(false);

  // Form state - expanded with firstName and lastName
  const [form, setForm] = useState({
    name: '',
    password: '',
    email: '',
    firstName: '',
    lastName: '',
    resetEmail: '',
    resetPassword: '',
    resetPasswordConfirm: ''
  });

  // Face recognition state
  const [faceEnabled, setFaceEnabled] = useState(false);
  const [faceLoading, setFaceLoading] = useState(false);
  const [faceBusy, setFaceBusy] = useState(false);
  const [faceMessage, setFaceMessage] = useState('');
  const [registerFaceEnabled, setRegisterFaceEnabled] = useState(false);
  const [registerFaceDescriptor, setRegisterFaceDescriptor] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // Camera cleanup
  const stopFaceCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  useEffect(() => {
    return () => stopFaceCamera();
  }, []);

  useEffect(() => {
    if (currentPage !== 'login') {
      stopFaceCamera();
    }
  }, [currentPage]);

  // Face API loading
  const loadFaceModels = async () => {
    if (faceEnabled) return;
    setFaceLoading(true);
    setFaceMessage('Yüz modelleri yükleniyor...');
    try {
      const ensureFaceApiLoaded = async () => {
        if (window.faceapi) return window.faceapi;
        await new Promise((resolve, reject) => {
          const existing = document.querySelector('script[data-faceapi="1"]');
          if (existing) {
            existing.addEventListener('load', resolve, { once: true });
            existing.addEventListener('error', reject, { once: true });
            return;
          }
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js';
          script.async = true;
          script.dataset.faceapi = '1';
          script.onload = resolve;
          script.onerror = reject;
          document.body.appendChild(script);
        });
        return window.faceapi;
      };

      const faceapi = await ensureFaceApiLoaded();
      const modelBase = 'https://justadudewhohacks.github.io/face-api.js/models';
      await faceapi.nets.tinyFaceDetector.loadFromUri(modelBase);
      await faceapi.nets.faceLandmark68Net.loadFromUri(modelBase);
      await faceapi.nets.faceRecognitionNet.loadFromUri(modelBase);
      setFaceEnabled(true);
      setFaceMessage('Yüz doğrulama hazır.');
    } catch (err) {
      setFaceMessage('Yüz modeli yüklenemedi. İnternet bağlantısını kontrol edin.');
    } finally {
      setFaceLoading(false);
    }
  };

  // Camera management
  const refreshCameras = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter(d => d.kind === 'videoinput');
      setCameras(videoInputs);
      const bestId = pickPreferredCameraId(videoInputs, selectedCameraId);
      if (bestId) setSelectedCameraId(bestId);
    } catch {
      setFaceMessage('Kamera listesi alınamadı.');
    }
  }, [selectedCameraId]);

  useEffect(() => {
    const onDeviceChange = async () => {
      await refreshCameras();
      setFaceMessage('Yeni kamera algılandı. Gerekirse listeden telefonu seçin.');
    };

    if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', onDeviceChange);
    }

    return () => {
      if (navigator.mediaDevices && navigator.mediaDevices.removeEventListener) {
        navigator.mediaDevices.removeEventListener('devicechange', onDeviceChange);
      }
    };
  }, [refreshCameras]);

  const requestCameraPermissionAndRefresh = async () => {
    try {
      const tempStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      tempStream.getTracks().forEach(track => track.stop());
      await refreshCameras();
      setFaceMessage('Kamera izni verildi. Kameranız listede görünecektir.');
      return true;
    } catch (err) {
      setFaceMessage('Kamera izni reddedildi. Tarayıcı izinlerini açın.');
      return false;
    }
  };

  const startFaceCamera = async () => {
    setFaceMessage('');
    try {
      const granted = await requestCameraPermissionAndRefresh();
      if (!granted) return;

      stopFaceCamera();
      const constraints = {
        audio: false,
        video: selectedCameraId
          ? { deviceId: { exact: selectedCameraId }, width: { ideal: 640 }, height: { ideal: 480 } }
          : { width: { ideal: 640 }, height: { ideal: 480 } }
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      await refreshCameras();
    } catch (err) {
      if (err && err.name === 'NotFoundError') {
        setFaceMessage('Kamera bulunamadı.');
      } else if (err && err.name === 'NotAllowedError') {
        setFaceMessage('Kamera izni verilmedi. Lütfen izin verin.');
      } else {
        setFaceMessage('Kamera açılamadı.');
      }
    }
  };

  const captureFaceDescriptor = async () => {
    if (!videoRef.current) {
      throw new Error('Kamera hazır değil');
    }
    if (!window.faceapi) {
      throw new Error('Yüz modeli hazır değil. Önce kamerayı başlatın.');
    }
    const faceapi = window.faceapi;
    const detection = await faceapi
      .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) {
      throw new Error('Yüz algılanamadı. Kameraya daha net bakın.');
    }

    return Array.from(detection.descriptor);
  };

  // Login handlers
  const handleFaceLogin = async () => {
    setError('');
    if (!form.name) {
      setFaceMessage('Hızlı yüz girişi için kullanıcı adı girin.');
      return;
    }

    setFaceBusy(true);
    setFaceMessage('Yüz doğrulanıyor...');
    try {
      const descriptor = await captureFaceDescriptor();
      const res = await axios.post('/api/face/login', { name: form.name, descriptor });
      setForm(f => ({ ...f, password: '' }));
      if (res.data.walletFundingWarning) {
        setInfo(`⚠️ ${res.data.walletFundingWarning}`);
      }
      setFaceMessage(`Hızlı giriş başarılı (distance: ${res.data.faceDistance})`);
      if (res.data.user?.role === 'admin') {
        localStorage.setItem('adminSession', res.data.sessionId);
        localStorage.setItem('adminName', res.data.user.name);
        if (onLoginComplete) onLoginComplete(res.data.user, res.data.sessionId);
        return;
      }
      if (onLoginComplete) onLoginComplete(res.data.user, res.data.sessionId);
    } catch (err) {
      setFaceMessage(err.response?.data?.message || err.message || 'Yüz ile giriş başarısız.');
    } finally {
      setFaceBusy(false);
    }
  };

  const handleLogin = async () => {
    setError('');
    setInfo('');
    if (!form.name || !form.password) {
      setError('Kullanıcı adı ve şifre giriniz');
      return;
    }

    setLoginLoading(true);
    try {
      const res = await axios.post('/api/login', { name: form.name, password: form.password });
      setForm(f => ({ ...f, password: '' }));
      if (res.data.walletFundingWarning) {
        setInfo(`⚠️ ${res.data.walletFundingWarning}`);
      }
      if (res.data.user?.role === 'admin') {
        localStorage.setItem('adminSession', res.data.sessionId);
        localStorage.setItem('adminName', res.data.user.name);
        if (onLoginComplete) onLoginComplete(res.data.user, res.data.sessionId);
        return;
      }
      if (onLoginComplete) onLoginComplete(res.data.user, res.data.sessionId);
    } catch (err) {
      setError(err.response?.data?.message || 'Giriş başarısız');
    } finally {
      setLoginLoading(false);
    }
  };

  // Registration handlers
  const handleSendRegisterOtp = async () => {
    setError('');
    setInfo('');
    if (!form.name || !form.firstName || !form.lastName || !form.email || !form.password) {
      setError('Kayıt için tüm alanları doldurunuz');
      return;
    }

    setOtpLoading(true);
    try {
      const res = await axios.post('/api/register/send-otp', { email: form.email });
      setRegisterStep(1);
      setInfo(res.data.message);
      if (res.data.devOtp) setRegisterOtp(res.data.devOtp);
    } catch (err) {
      setError(err.response?.data?.message || 'OTP gönderilemedi');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleRegister = async () => {
    setError('');
    setInfo('');
    setRegisterLoading(true);
    try {
      await axios.post('/api/register', {
        name: form.name,
        firstName: form.firstName,
        lastName: form.lastName,
        password: form.password,
        email: form.email || undefined,
        otp: form.email ? registerOtp : undefined,
        faceDescriptor: registerFaceEnabled ? (registerFaceDescriptor || undefined) : undefined
      });
      setRegisterMode(false);
      setRegisterStep(0);
      setRegisterOtp('');
      setRegisterFaceEnabled(false);
      setRegisterFaceDescriptor(null);
      setForm(f => ({ ...f, name: '', password: '', email: '', firstName: '', lastName: '' }));
      setInfo('Kayıt başarılı. Şimdi giriş yapabilirsiniz.');
    } catch (err) {
      setError(err.response?.data?.message || 'Kayıt başarısız');
    } finally {
      setRegisterLoading(false);
    }
  };

  const handleCaptureRegisterFace = async () => {
    setFaceBusy(true);
    setFaceMessage('Kayıt için yüz verisi alınıyor...');
    try {
      if (!faceEnabled) {
        await loadFaceModels();
      }
      const descriptor = await captureFaceDescriptor();
      setRegisterFaceDescriptor(descriptor);
      setFaceMessage('Yüz verisi kayıt için hazır. İsterseniz bu adımı atlayabilirsiniz.');
    } catch (err) {
      setFaceMessage(err.message || 'Yüz yakalanamadı.');
    } finally {
      setFaceBusy(false);
    }
  };

  // Forgot Password handlers
  const handleForgotPasswordRequest = async () => {
    setError('');
    setInfo('');
    if (!form.resetEmail) {
      setError('Hesabınızla ilişkili e-posta adresini giriniz');
      return;
    }

    setForgotLoading(true);
    try {
      const res = await axios.post('/api/forgot-password', { email: form.resetEmail });
      setForgotPasswordStep(1);
      setInfo(res.data.message || `${form.resetEmail} adresine kod gönderildi`);
    } catch (err) {
      setError(err.response?.data?.message || 'E-posta gönderilemedi');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPasswordOtpVerify = async () => {
    setError('');
    setInfo('');
    if (!forgotPasswordOtp) {
      setError('Doğrulama kodunu giriniz');
      return;
    }
    if (!form.resetPassword || form.resetPassword !== form.resetPasswordConfirm) {
      setError('Yeni şifre alanları eşleşmelidir');
      return;
    }

    try {
      setResetPasswordConfirmLoading(true);
      await axios.post('/api/reset-password', {
        email: form.resetEmail,
        otp: forgotPasswordOtp,
        newPassword: form.resetPassword
      });
      setInfo('Şifre başarıyla sıfırlandı. Şimdi giriş yapabilirsiniz.');
      // Reset forgot password state
      setTimeout(() => {
        setCurrentPage('login');
        setForgotPasswordStep(0);
        setForgotPasswordOtp('');
        setForm(f => ({ ...f, resetEmail: '', resetPassword: '', resetPasswordConfirm: '' }));
        setError('');
      }, 1800);
    } catch (err) {
      setError(err.response?.data?.message || 'Şifre sıfırlama başarısız');
    } finally {
      setResetPasswordConfirmLoading(false);
    }
  };

  // Tab change handler for registration
  const handleTabChange = (e, newValue) => {
    const isRegister = newValue === 1;
    setRegisterMode(isRegister);
    setRegisterStep(0);
    setRegisterOtp('');
    setRegisterFaceEnabled(false);
    setRegisterFaceDescriptor(null);
    setError('');
    setInfo('');
  };

  const passwordEndAdornment = (visible, toggle, label) => ({
    startAdornment: (
      <InputAdornment position="start">
        <PasswordOutlinedIcon sx={{ color: '#64748b' }} />
      </InputAdornment>
    ),
    endAdornment: (
      <InputAdornment position="end">
        <Tooltip title={label}>
          <IconButton edge="end" onClick={toggle} aria-label={label}>
            {visible ? <VisibilityOffOutlinedIcon /> : <VisibilityOutlinedIcon />}
          </IconButton>
        </Tooltip>
      </InputAdornment>
    )
  });

  const renderCameraSelect = () => cameras.length > 0 && (
    <Select
      size="small"
      value={selectedCameraId}
      onChange={e => setSelectedCameraId(e.target.value)}
      fullWidth
      sx={{
        borderRadius: 1.5,
        backgroundColor: '#ffffff'
      }}
    >
      {cameras.map((cam, i) => (
        <MenuItem key={cam.deviceId || i} value={cam.deviceId}>{cam.label || `Kamera ${i + 1}`}</MenuItem>
      ))}
    </Select>
  );

  const renderFaceTools = ({ compact = false } = {}) => (
    <Box sx={{
      display: 'grid',
      gap: 1.5,
      p: compact ? 2 : 2.25,
      borderRadius: 2,
      backgroundColor: '#f7fbfd',
      border: '1px dashed rgba(16, 185, 129, 0.34)'
    }}>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button
          type="button"
          size="small"
          variant="outlined"
          fullWidth
          onClick={requestCameraPermissionAndRefresh}
          disabled={faceBusy}
          sx={secondaryButtonSx}
        >
          İzin
        </Button>
        <Button
          type="button"
          size="small"
          variant="contained"
          fullWidth
          startIcon={faceLoading ? null : <CameraAltIcon />}
          onClick={async () => {
            await loadFaceModels();
            await refreshCameras();
            await startFaceCamera();
          }}
          disabled={faceLoading || faceBusy}
          sx={{ ...primaryButtonSx, py: 0.9, boxShadow: 'none' }}
        >
          {faceLoading ? <CircularProgress size={20} color="inherit" /> : 'Kamera'}
        </Button>
      </Box>

      {renderCameraSelect()}

      <Box
        component="video"
        ref={videoRef}
        autoPlay
        muted
        playsInline
        sx={{
          width: '100%',
          height: compact ? 132 : 156,
          borderRadius: 1.5,
          backgroundColor: '#080f14',
          objectFit: 'cover',
          border: '1px solid rgba(15, 23, 42, 0.12)'
        }}
      />

      {!!faceMessage && (
        <Typography variant="caption" sx={{ color: '#516173', textAlign: 'center' }}>
          {faceMessage}
        </Typography>
      )}
    </Box>
  );

  // Render forgot password page
  const RenderForgotPasswordPage = () => (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <Box sx={{ ...iconBubbleSx, color: '#0f9f8f', backgroundColor: 'rgba(16, 185, 129, 0.10)' }}>
          <LockResetIcon />
        </Box>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 900, color: '#111827' }}>
            Şifre Sıfırlama
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748b' }}>
            Hesabınıza ait e-posta ile devam edin.
          </Typography>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 1.5 }}>{error}</Alert>}
      {info && <Alert severity="success" sx={{ mb: 2, borderRadius: 1.5 }}>{info}</Alert>}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {forgotPasswordStep === 0 && (
          <>
            <TextField
              label="E-posta Adresi"
              type="email"
              placeholder="ad.soyad@akdeniz.edu.tr"
              variant="outlined"
              value={form.resetEmail}
              onChange={e => setForm(f => ({ ...f, resetEmail: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && handleForgotPasswordRequest()}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <EmailIcon sx={{ color: '#64748b' }} />
                  </InputAdornment>
                )
              }}
              fullWidth
              sx={fieldSx}
            />
            <Typography variant="body2" sx={{ color: '#64748b' }}>
              Sıfırlama kodu kayıtlı e-posta adresinize gönderilecek.
            </Typography>
          </>
        )}

        {forgotPasswordStep === 1 && (
          <>
            <TextField
              label="Doğrulama Kodu"
              variant="outlined"
              value={forgotPasswordOtp}
              onChange={e => setForgotPasswordOtp(e.target.value.replace(/\D/g, ''))}
              fullWidth
              inputProps={{ maxLength: 6, style: { fontSize: 22, letterSpacing: 0, textAlign: 'center', fontWeight: 800 } }}
              autoFocus
              sx={fieldSx}
            />
            <Typography variant="caption" sx={{ color: '#64748b' }}>
              Kod {form.resetEmail} adresine gönderildi.
            </Typography>

            <TextField
              label="Yeni Şifre"
              type={showResetPassword ? 'text' : 'password'}
              variant="outlined"
              value={form.resetPassword}
              onChange={e => setForm(f => ({ ...f, resetPassword: e.target.value }))}
              fullWidth
              sx={fieldSx}
              InputProps={passwordEndAdornment(
                showResetPassword,
                () => setShowResetPassword(value => !value),
                showResetPassword ? 'Şifreyi gizle' : 'Şifreyi göster'
              )}
            />

            <TextField
              label="Şifre Tekrar"
              type={showResetPassword ? 'text' : 'password'}
              variant="outlined"
              value={form.resetPasswordConfirm}
              onChange={e => setForm(f => ({ ...f, resetPasswordConfirm: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && handleResetPasswordOtpVerify()}
              fullWidth
              sx={fieldSx}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <KeyOutlinedIcon sx={{ color: '#64748b' }} />
                  </InputAdornment>
                )
              }}
            />

            {form.resetPassword !== form.resetPasswordConfirm && form.resetPasswordConfirm && (
              <Alert severity="warning" sx={{ borderRadius: 1.5 }}>Şifreler eşleşmiyor</Alert>
            )}
          </>
        )}

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '0.9fr 1.1fr' }, gap: 1.5, mt: 1 }}>
          <Button
            type="button"
            variant="outlined"
            size="large"
            startIcon={<ArrowBackIcon />}
            onClick={() => {
              setCurrentPage('login');
              setForgotPasswordStep(0);
              setForgotPasswordOtp('');
              setForm(f => ({ ...f, resetEmail: '', resetPassword: '', resetPasswordConfirm: '' }));
              setError('');
              setInfo('');
            }}
            sx={secondaryButtonSx}
          >
            Geri
          </Button>
          <Button
            type="button"
            variant="contained"
            size="large"
            startIcon={forgotPasswordStep === 0 ? <MarkEmailReadOutlinedIcon /> : <LockResetIcon />}
            onClick={forgotPasswordStep === 0 ? handleForgotPasswordRequest : handleResetPasswordOtpVerify}
            disabled={forgotPasswordStep === 0 ? (forgotLoading || !form.resetEmail) : (resetPasswordConfirmLoading || form.resetPassword !== form.resetPasswordConfirm || !form.resetPassword)}
            sx={primaryButtonSx}
          >
            {forgotLoading || resetPasswordConfirmLoading ? <CircularProgress size={24} color="inherit" /> : (forgotPasswordStep === 0 ? 'Kodu Gönder' : 'Şifreyi Yenile')}
          </Button>
        </Box>
      </Box>
    </Box>
  );

  // Main render
  return (
    <Box sx={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#dbe6eb',
      backgroundImage: `
        linear-gradient(rgba(16, 24, 32, 0.075) 1px, transparent 1px),
        linear-gradient(90deg, rgba(16, 24, 32, 0.075) 1px, transparent 1px),
        linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(15, 23, 42, 0.08))
      `,
      backgroundSize: '42px 42px, 42px 42px, cover',
      p: { xs: 2, md: 4 }
    }}>
      <Paper
        elevation={0}
        sx={{
          width: '100%',
          maxWidth: 1120,
          minHeight: { md: 720 },
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '0.9fr 1fr' },
          overflow: 'hidden',
          borderRadius: 2,
          border: '1px solid rgba(15, 23, 42, 0.10)',
          boxShadow: '0 28px 80px rgba(17, 24, 39, 0.18)'
        }}
      >
        <Box sx={{
          position: 'relative',
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          justifyContent: 'space-between',
          p: 5,
          color: '#f8fafc',
          backgroundColor: '#101820',
          backgroundImage: `
            linear-gradient(145deg, rgba(16, 185, 129, 0.20), transparent 42%),
            linear-gradient(315deg, rgba(45, 212, 191, 0.18), transparent 46%),
            linear-gradient(rgba(255, 255, 255, 0.045) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.045) 1px, transparent 1px)
          `,
          backgroundSize: 'cover, cover, 36px 36px, 36px 36px'
        }}>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 7 }}>
              <Box sx={{
                width: 48,
                height: 48,
                borderRadius: 2,
                display: 'grid',
                placeItems: 'center',
                color: '#071014',
                backgroundColor: '#2dd4bf'
              }}>
                <HowToVoteIcon />
              </Box>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 900, letterSpacing: 0 }}>
                  SSI Voting
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(248, 250, 252, 0.68)' }}>
                  Blockchain oylama arayüzü
                </Typography>
              </Box>
            </Box>

            <Typography variant="overline" sx={{ color: '#2dd4bf', fontWeight: 900, letterSpacing: 0 }}>
              Güvenli Oturum
            </Typography>
            <Typography variant="h3" sx={{ mt: 1.5, maxWidth: 420, fontWeight: 900, lineHeight: 1.08, letterSpacing: 0 }}>
              Kimlik doğrulama sade, seçim süreci şeffaf.
            </Typography>
            <Typography variant="body1" sx={{ mt: 2.5, maxWidth: 420, color: 'rgba(248, 250, 252, 0.72)', lineHeight: 1.75 }}>
              Kurumsal e-posta, oturum güvenliği ve anonim oy kullanma akışı aynı panelde toplanır.
            </Typography>
          </Box>

          <Box sx={{ display: 'grid', gap: 2.5 }}>
            {[
              { icon: <VerifiedUserOutlinedIcon />, title: 'ZK-Email doğrulama', text: 'Domain kısıtlı kayıt akışı' },
              { icon: <SensorsOutlinedIcon />, title: 'Yüz ile hızlı giriş', text: 'Opsiyonel biyometrik oturum' },
              { icon: <KeyOutlinedIcon />, title: '8 saatlik güvenli oturum', text: 'HTTP-only JWT cookie desteği' }
            ].map(item => (
              <Box key={item.title} sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                <Box sx={iconBubbleSx}>
                  {item.icon}
                </Box>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>
                    {item.title}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(248, 250, 252, 0.62)' }}>
                    {item.text}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </Box>

        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: { xs: 2.5, sm: 4, md: 5 },
          backgroundColor: '#ffffff'
        }}>
          <Box sx={{ width: '100%', maxWidth: 500 }}>
            <Box sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'center', gap: 1.5, mb: 3 }}>
              <Box sx={{
                width: 44,
                height: 44,
                borderRadius: 2,
                display: 'grid',
                placeItems: 'center',
                color: '#071014',
                backgroundColor: '#2dd4bf'
              }}>
                <HowToVoteIcon />
              </Box>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 900, color: '#111827' }}>
                  SSI Voting
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748b' }}>
                  Blockchain oylama arayüzü
                </Typography>
              </Box>
            </Box>

            {currentPage === 'login' && (
              <>
                <Typography variant="h4" sx={{ fontWeight: 900, color: '#111827', letterSpacing: 0, mb: 1 }}>
                  {registerMode ? 'Yeni Hesap' : 'Hoş Geldiniz'}
                </Typography>
                <Typography variant="body2" sx={{ color: '#64748b', mb: 3 }}>
                  {registerMode ? 'Kurumsal e-posta doğrulaması ile hesabınızı oluşturun.' : 'Kullanıcı bilgilerinizle güvenli oturuma geçin.'}
                </Typography>

                <Tabs
                  value={registerMode ? 1 : 0}
                  onChange={handleTabChange}
                  variant="fullWidth"
                  sx={{
                    mb: 3,
                    minHeight: 48,
                    border: '1px solid rgba(15, 23, 42, 0.10)',
                    borderRadius: 2,
                    p: 0.5,
                    '& .MuiTabs-indicator': {
                      display: 'none'
                    },
                    '& .MuiTab-root': {
                      minHeight: 40,
                      borderRadius: 1.5,
                      textTransform: 'none',
                      fontWeight: 800,
                      color: '#64748b'
                    },
                    '& .Mui-selected': {
                      color: '#064e3b',
                      backgroundColor: '#d5f8e9',
                      boxShadow: 'inset 0 0 0 1px rgba(16, 185, 129, 0.22)'
                    }
                  }}
                >
                  <Tab icon={<LoginOutlinedIcon fontSize="small" />} iconPosition="start" label="Giriş" />
                  <Tab icon={<HowToRegOutlinedIcon fontSize="small" />} iconPosition="start" label="Kayıt" />
                </Tabs>
              </>
            )}

            {currentPage === 'forgotPassword' && RenderForgotPasswordPage()}

            {(currentPage === 'login' || currentPage === 'resetPassword') && (
              <>
                {error && <Alert severity="error" sx={{ mb: 2.5, borderRadius: 1.5 }}>{error}</Alert>}
                {info && <Alert severity="success" sx={{ mb: 2.5, borderRadius: 1.5 }}>{info}</Alert>}

                <Box component="form" noValidate autoComplete="off" sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {!registerMode && (
                    <>
                      <TextField
                        label="Kullanıcı Adı"
                        variant="outlined"
                        size="medium"
                        value={form.name}
                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                        onKeyDown={e => e.key === 'Enter' && handleLogin()}
                        fullWidth
                        sx={fieldSx}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <PersonOutlineIcon sx={{ color: '#64748b' }} />
                            </InputAdornment>
                          )
                        }}
                      />

                      <TextField
                        label="Şifre"
                        type={showPassword ? 'text' : 'password'}
                        variant="outlined"
                        value={form.password}
                        onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                        onKeyDown={e => e.key === 'Enter' && handleLogin()}
                        fullWidth
                        sx={fieldSx}
                        InputProps={passwordEndAdornment(
                          showPassword,
                          () => setShowPassword(value => !value),
                          showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'
                        )}
                      />

                      <Button
                        type="button"
                        variant="contained"
                        size="large"
                        fullWidth
                        startIcon={loginLoading ? null : <LoginOutlinedIcon />}
                        sx={{ ...primaryButtonSx, mt: 1 }}
                        onClick={handleLogin}
                        disabled={loginLoading}
                      >
                        {loginLoading ? <CircularProgress size={24} color="inherit" /> : 'Giriş Yap'}
                      </Button>

                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mt: 0.5 }}>
                        <Button
                          type="button"
                          variant="text"
                          size="small"
                          onClick={() => {
                            setCurrentPage('forgotPassword');
                            setError('');
                            setInfo('');
                          }}
                          sx={{ color: '#0f9f8f', textTransform: 'none', fontWeight: 700 }}
                        >
                          Şifremi Unuttum
                        </Button>
                      </Box>

                      <Divider sx={{ my: 1.5, color: '#94a3b8', fontSize: 12 }}>veya</Divider>

                      <Box sx={{ display: 'grid', gap: 1.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <FaceIcon sx={{ color: '#0f9f8f' }} />
                          <Typography variant="subtitle2" sx={{ color: '#111827', fontWeight: 900 }}>
                            Yüz ile Hızlı Giriş
                          </Typography>
                        </Box>

                        {renderFaceTools()}

                        <Button
                          type="button"
                          variant="contained"
                          color="success"
                          onClick={handleFaceLogin}
                          disabled={!faceEnabled || faceBusy}
                          startIcon={faceBusy ? null : <FaceIcon />}
                          sx={{
                            py: 1.25,
                            borderRadius: 1.5,
                            textTransform: 'none',
                            fontWeight: 800,
                            color: '#06221d',
                            background: 'linear-gradient(135deg, #34d399 0%, #10b981 48%, #0f9f8f 100%)',
                            boxShadow: '0 14px 30px rgba(16, 185, 129, 0.22)',
                            '&:hover': {
                              background: 'linear-gradient(135deg, #2cc98f 0%, #0ea774 48%, #0b867a 100%)'
                            }
                          }}
                        >
                          {faceBusy ? <CircularProgress size={22} color="inherit" /> : 'Yüz ile Giriş'}
                        </Button>
                      </Box>
                    </>
                  )}

                  {registerMode && (
                    <>
                      <TextField
                        label="Kullanıcı Adı"
                        variant="outlined"
                        size="medium"
                        disabled={registerStep === 1}
                        value={form.name}
                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                        onKeyDown={e => e.key === 'Enter' && (registerStep === 0 ? handleSendRegisterOtp() : handleRegister())}
                        fullWidth
                        sx={fieldSx}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <PersonOutlineIcon sx={{ color: '#64748b' }} />
                            </InputAdornment>
                          )
                        }}
                      />

                      {registerStep === 0 && (
                        <>
                          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
                            <TextField
                              label="Ad"
                              variant="outlined"
                              value={form.firstName}
                              onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
                              fullWidth
                              sx={fieldSx}
                              InputProps={{
                                startAdornment: (
                                  <InputAdornment position="start">
                                    <BadgeOutlinedIcon sx={{ color: '#64748b' }} />
                                  </InputAdornment>
                                )
                              }}
                            />
                            <TextField
                              label="Soyad"
                              variant="outlined"
                              value={form.lastName}
                              onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
                              fullWidth
                              sx={fieldSx}
                            />
                          </Box>

                          <TextField
                            label="Kurumsal E-posta"
                            type="email"
                            placeholder="ad.soyad@akdeniz.edu.tr"
                            variant="outlined"
                            value={form.email}
                            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                            onKeyDown={e => e.key === 'Enter' && handleSendRegisterOtp()}
                            fullWidth
                            sx={fieldSx}
                            InputProps={{
                              startAdornment: (
                                <InputAdornment position="start">
                                  <EmailIcon sx={{ color: '#64748b' }} />
                                </InputAdornment>
                              )
                            }}
                          />

                          <TextField
                            label="Şifre"
                            type={showPassword ? 'text' : 'password'}
                            variant="outlined"
                            value={form.password}
                            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                            onKeyDown={e => e.key === 'Enter' && handleSendRegisterOtp()}
                            fullWidth
                            sx={fieldSx}
                            InputProps={passwordEndAdornment(
                              showPassword,
                              () => setShowPassword(value => !value),
                              showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'
                            )}
                          />
                        </>
                      )}

                      {registerStep === 1 && (
                        <Box sx={{ display: 'grid', gap: 2 }}>
                          <Box sx={{
                            p: 2,
                            borderRadius: 2,
                            backgroundColor: '#f7fbfd',
                            border: '1px solid rgba(15, 23, 42, 0.08)'
                          }}>
                            <Typography variant="caption" sx={{ color: '#64748b' }}>
                              E-posta
                            </Typography>
                            <Typography variant="subtitle2" sx={{ color: '#111827', fontWeight: 900 }}>
                              {form.email}
                            </Typography>
                          </Box>

                          <TextField
                            label="Doğrulama Kodu"
                            variant="outlined"
                            value={registerOtp}
                            onChange={e => setRegisterOtp(e.target.value.replace(/\D/g, ''))}
                            onKeyDown={e => e.key === 'Enter' && handleRegister()}
                            fullWidth
                            inputProps={{ maxLength: 6, style: { fontSize: 22, letterSpacing: 0, textAlign: 'center', fontWeight: 800 } }}
                            autoFocus
                            sx={fieldSx}
                          />

                          <Box sx={{
                            p: 2,
                            borderRadius: 2,
                            backgroundColor: '#fbfdff',
                            border: '1px solid rgba(15, 23, 42, 0.08)'
                          }}>
                            <FormControlLabel
                              control={
                                <Checkbox
                                  checked={registerFaceEnabled}
                                  onChange={e => {
                                    const enabled = e.target.checked;
                                    setRegisterFaceEnabled(enabled);
                                    if (!enabled) setRegisterFaceDescriptor(null);
                                  }}
                                  sx={{
                                    color: '#64748b',
                                    '&.Mui-checked': { color: '#0f9f8f' }
                                  }}
                                />
                              }
                              label={<Typography variant="body2" sx={{ fontWeight: 800, color: '#111827' }}>Yüz profilimi ekle</Typography>}
                            />

                            {registerFaceEnabled && (
                              <Box sx={{ mt: 1.5, display: 'grid', gap: 1.5 }}>
                                {renderFaceTools({ compact: true })}

                                <Button
                                  type="button"
                                  variant="contained"
                                  onClick={handleCaptureRegisterFace}
                                  disabled={faceBusy}
                                  startIcon={faceBusy ? null : <CameraAltIcon />}
                                  sx={{
                                    py: 1.15,
                                    borderRadius: 1.5,
                                    textTransform: 'none',
                                    fontWeight: 800,
                                    backgroundColor: '#f59e0b',
                                    color: '#111827',
                                    boxShadow: 'none',
                                    '&:hover': { backgroundColor: '#d88906' }
                                  }}
                                >
                                  {faceBusy ? <CircularProgress size={22} color="inherit" /> : 'Yüz Verisini Yakala'}
                                </Button>

                                {registerFaceDescriptor && (
                                  <Alert severity="success" sx={{ borderRadius: 1.5 }}>
                                    Yüz verisi hazır. Kayıtta saklanacak.
                                  </Alert>
                                )}
                              </Box>
                            )}
                          </Box>
                        </Box>
                      )}

                      <Box sx={{ display: 'grid', gridTemplateColumns: registerStep === 1 ? { xs: '1fr', sm: '0.8fr 1.2fr' } : '1fr', gap: 1.5, mt: 1 }}>
                        {registerStep === 1 && (
                          <Button
                            type="button"
                            variant="outlined"
                            size="large"
                            onClick={() => { setRegisterStep(0); setRegisterOtp(''); setRegisterFaceEnabled(false); setRegisterFaceDescriptor(null); setError(''); setInfo(''); }}
                            startIcon={<ArrowBackIcon />}
                            sx={secondaryButtonSx}
                          >
                            Geri
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="contained"
                          size="large"
                          fullWidth
                          startIcon={registerStep === 0 ? <MarkEmailReadOutlinedIcon /> : <HowToRegOutlinedIcon />}
                          sx={primaryButtonSx}
                          onClick={registerStep === 0 ? handleSendRegisterOtp : handleRegister}
                          disabled={
                            (registerStep === 0 && (otpLoading || !form.name || !form.firstName || !form.lastName || !form.email || !form.password))
                            || (registerStep === 1 && (registerLoading || !registerOtp))
                          }
                        >
                          {otpLoading || registerLoading ? <CircularProgress size={24} color="inherit" /> : (registerStep === 0 ? 'Kodu Gönder' : 'Hesabı Oluştur')}
                        </Button>
                      </Box>
                    </>
                  )}
                </Box>
              </>
            )}
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}

export default Login;
