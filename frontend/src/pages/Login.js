import React, { useState } from 'react';
import axios from 'axios';
import {
  Box, Paper, Typography, Tabs, Tab, Alert,
  InputAdornment, IconButton, Tooltip
} from '@mui/material';
import PasswordOutlinedIcon from '@mui/icons-material/PasswordOutlined';
import LoginOutlinedIcon from '@mui/icons-material/LoginOutlined';
import HowToRegOutlinedIcon from '@mui/icons-material/HowToRegOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import AuthHeroPanel from '../components/auth/AuthHeroPanel';
import ForgotPasswordPage from '../components/auth/ForgotPasswordPage';
import LoginSection from '../components/auth/LoginSection';
import RegisterSection from '../components/auth/RegisterSection';
import useFaceAuth from '../components/auth/useFaceAuth';
import '../App.css';

function Login({ onLoginComplete }) {
  const [currentPage, setCurrentPage] = useState('login'); // login, register, forgotPassword, resetPassword

  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);

  const [registerMode, setRegisterMode] = useState(false);
  const [registerStep, setRegisterStep] = useState(0); // 0=form, 1=OTP
  const [registerOtp, setRegisterOtp] = useState('');

  const [forgotPasswordStep, setForgotPasswordStep] = useState(0); // 0=email, 1=OTP, 2=newPassword
  const [forgotPasswordOtp, setForgotPasswordOtp] = useState('');
  const [resetPasswordConfirmLoading, setResetPasswordConfirmLoading] = useState(false);

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

  const {
    faceEnabled,
    faceLoading,
    faceBusy,
    setFaceBusy,
    faceMessage,
    setFaceMessage,
    registerFaceEnabled,
    setRegisterFaceEnabled,
    registerFaceDescriptor,
    setRegisterFaceDescriptor,
    cameras,
    selectedCameraId,
    setSelectedCameraId,
    videoRef,
    loadFaceModels,
    refreshCameras,
    requestCameraPermissionAndRefresh,
    startFaceCamera,
    captureFaceDescriptor
  } = useFaceAuth(currentPage);

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
      setError(err.response?.data?.message || err.response?.data?.error || 'OTP gönderilemedi');
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
        <AuthHeroPanel />

        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: { xs: 2.5, sm: 4, md: 5 },
          backgroundColor: '#ffffff'
        }}>
          <Box sx={{ width: '100%', maxWidth: 500 }}>
            <AuthHeroPanel mobile />

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

            {currentPage === 'forgotPassword' && (
              <ForgotPasswordPage error={error} info={info} forgotPasswordStep={forgotPasswordStep} forgotPasswordOtp={forgotPasswordOtp} setForgotPasswordOtp={setForgotPasswordOtp} form={form} setForm={setForm} showResetPassword={showResetPassword} setShowResetPassword={setShowResetPassword} forgotLoading={forgotLoading} resetPasswordConfirmLoading={resetPasswordConfirmLoading} handleForgotPasswordRequest={handleForgotPasswordRequest} handleResetPasswordOtpVerify={handleResetPasswordOtpVerify} setCurrentPage={setCurrentPage} setForgotPasswordStep={setForgotPasswordStep} setError={setError} setInfo={setInfo} passwordEndAdornment={passwordEndAdornment} />
            )}

            {(currentPage === 'login' || currentPage === 'resetPassword') && (
              <>
                {error && <Alert severity="error" sx={{ mb: 2.5, borderRadius: 1.5 }}>{error}</Alert>}
                {info && <Alert severity="success" sx={{ mb: 2.5, borderRadius: 1.5 }}>{info}</Alert>}

                <Box component="form" noValidate autoComplete="off" sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {!registerMode && (
                    <LoginSection form={form} setForm={setForm} showPassword={showPassword} setShowPassword={setShowPassword} passwordEndAdornment={passwordEndAdornment} handleLogin={handleLogin} loginLoading={loginLoading} setCurrentPage={setCurrentPage} setError={setError} setInfo={setInfo} faceEnabled={faceEnabled} faceBusy={faceBusy} handleFaceLogin={handleFaceLogin} faceLoading={faceLoading} faceMessage={faceMessage} cameras={cameras} selectedCameraId={selectedCameraId} setSelectedCameraId={setSelectedCameraId} requestCameraPermissionAndRefresh={requestCameraPermissionAndRefresh} loadFaceModels={loadFaceModels} refreshCameras={refreshCameras} startFaceCamera={startFaceCamera} videoRef={videoRef} />
                  )}

                  {registerMode && (
                    <RegisterSection form={form} setForm={setForm} registerStep={registerStep} registerOtp={registerOtp} setRegisterOtp={setRegisterOtp} registerFaceEnabled={registerFaceEnabled} setRegisterFaceEnabled={setRegisterFaceEnabled} registerFaceDescriptor={registerFaceDescriptor} setRegisterFaceDescriptor={setRegisterFaceDescriptor} faceBusy={faceBusy} showPassword={showPassword} setShowPassword={setShowPassword} passwordEndAdornment={passwordEndAdornment} handleSendRegisterOtp={handleSendRegisterOtp} handleRegister={handleRegister} handleCaptureRegisterFace={handleCaptureRegisterFace} otpLoading={otpLoading} registerLoading={registerLoading} setRegisterStep={setRegisterStep} setError={setError} setInfo={setInfo} faceLoading={faceLoading} faceMessage={faceMessage} cameras={cameras} selectedCameraId={selectedCameraId} setSelectedCameraId={setSelectedCameraId} requestCameraPermissionAndRefresh={requestCameraPermissionAndRefresh} loadFaceModels={loadFaceModels} refreshCameras={refreshCameras} startFaceCamera={startFaceCamera} videoRef={videoRef} />
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
