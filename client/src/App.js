import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import SimpleVoting from './components/SimpleVoting';
import AdminDashboard from './components/AdminDashboard';
import {
  Box, Paper, Typography, Tabs, Tab, TextField, Button, Alert,
  CircularProgress, Select, MenuItem, FormControlLabel, Checkbox
} from '@mui/material';
import HowToVoteIcon from '@mui/icons-material/HowToVote';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import FaceIcon from '@mui/icons-material/Face';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import './App.css'; // Sadece temizlenmiş boş CSS olacak, form için değil

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

function App() {
  const [currentPage, setCurrentPage] = useState('login');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [user, setUser] = useState(null);
  const [registerMode, setRegisterMode] = useState(false);
  const [registerStep, setRegisterStep] = useState(0); // 0=form, 1=OTP
  const [registerOtp, setRegisterOtp] = useState('');
  const [form, setForm] = useState({ name: '', password: '', email: '' });
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
      setSessionId(res.data.sessionId);
      setUser(res.data.user);
      setForm(f => ({ ...f, password: '' }));
      if (res.data.walletFundingWarning) {
        setInfo(`⚠️ ${res.data.walletFundingWarning}`);
      }
      setFaceMessage(`Hızlı giriş başarılı (distance: ${res.data.faceDistance})`);
      if (res.data.user?.role === 'admin') {
        localStorage.setItem('adminSession', res.data.sessionId);
        localStorage.setItem('adminName', res.data.user.name);
        setCurrentPage('admin');
        return;
      }
      setCurrentPage('vote');
    } catch (err) {
      setFaceMessage(err.response?.data?.message || err.message || 'Yüz ile giriş başarısız.');
    } finally {
      setFaceBusy(false);
    }
  };

  const handleLogin = async () => {
    setError('');
    setInfo('');
    try {
      const res = await axios.post('/api/login', { name: form.name, password: form.password });
      setSessionId(res.data.sessionId);
      setUser(res.data.user);
      setForm({ name: '', password: '', email: '' });
      if (res.data.walletFundingWarning) {
        setInfo(`⚠️ ${res.data.walletFundingWarning}`);
      }
      if (res.data.user?.role === 'admin') {
        localStorage.setItem('adminSession', res.data.sessionId);
        localStorage.setItem('adminName', res.data.user.name);
        setCurrentPage('admin');
        return;
      }
      setCurrentPage('vote');
    } catch (err) {
      setError(err.response?.data?.message || 'Giriş başarısız');
    }
  };

  const handleSendRegisterOtp = async () => {
    setError('');
    if (!form.email) { setError('OTP için e-posta adresi giriniz'); return; }
    try {
      const res = await axios.post('/api/register/send-otp', { email: form.email });
      setRegisterStep(1);
      setInfo(res.data.message);
      if (res.data.devOtp) setRegisterOtp(res.data.devOtp); // dev mode prefill
    } catch (err) {
      setError(err.response?.data?.message || 'OTP gönderilemedi');
    }
  };

  const handleRegister = async () => {
    setError('');
    try {
      await axios.post('/api/register', {
        name: form.name,
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
      setForm({ name: '', password: '', email: '' });
      setInfo('Kayıt başarılı! Şimdi giriş yapabilirsiniz.');
    } catch (err) {
      setError(err.response?.data?.message || 'Kayıt başarısız');
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

  const handleLogout = async () => {
    try {
      await axios.post('/api/logout', {}, { headers: { 'x-session-id': sessionId } });
    } catch (err) {
      console.error('Logout error:', err);
    }
    localStorage.removeItem('adminSession');
    localStorage.removeItem('adminName');
    setUser(null);
    setSessionId('');
    setForm({ name: '', password: '', email: '' });
    setError('');
    setInfo('');
    setCurrentPage('login');
  };

  if (currentPage === 'vote') {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: 'grey.100', py: 4 }}>
        <SimpleVoting user={user} sessionId={sessionId} onLogout={handleLogout} />
      </Box>
    );
  }

  if (currentPage === 'admin') {
    return <AdminDashboard user={user} sessionId={sessionId} onLogout={handleLogout} />;
  }

  return (
    <Box sx={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
      p: 2
    }}>
      <Paper elevation={24} sx={{ width: '100%', maxWidth: 460, borderRadius: 4, overflow: 'hidden' }}>
        <Box sx={{ pt: 4, pb: 2, px: 4, textAlign: 'center', bgcolor: 'background.paper' }}>
          <HowToVoteIcon sx={{ fontSize: 50, color: 'primary.main', mb: 1 }} />
          <Typography variant="h5" fontWeight="900" letterSpacing={-0.5} gutterBottom>
            SSI Blockchain Oylama
          </Typography>
          <Typography variant="body2" color="text.secondary">
            ZK-Email • EIP-712 • Anonim Kimlik
          </Typography>
        </Box>

        <Tabs 
          value={registerMode ? 1 : 0} 
          onChange={handleTabChange} 
          variant="fullWidth"
          indicatorColor="primary"
          textColor="primary"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="GİRİŞ YAP" sx={{ fontWeight: 'bold' }} />
          <Tab label="KAYIT OL" sx={{ fontWeight: 'bold' }} />
        </Tabs>

        <Box sx={{ p: 4 }}>
          {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
          {info && <Alert severity="success" sx={{ mb: 3 }}>{info}</Alert>}

          <Box component="form" noValidate autoComplete="off" sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Kullanıcı Adı"
              variant="outlined"
              size="medium"
              disabled={registerMode && registerStep === 1}
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && (registerMode ? (registerStep === 0 ? handleSendRegisterOtp() : handleRegister()) : handleLogin())}
              fullWidth
            />

            {registerMode && registerStep === 0 && (
              <TextField
                label="Kurumsal E-posta (ZK-Email için)"
                type="email"
                placeholder="ad.soyad@akdeniz.edu.tr"
                variant="outlined"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && handleSendRegisterOtp()}
                fullWidth
              />
            )}

            {registerMode && registerStep === 1 && (
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="subtitle2" color="primary" gutterBottom>
                  E-posta: {form.email}
                </Typography>
                <TextField
                  label="Doğrulama Kodu (OTP)"
                  variant="outlined"
                  value={registerOtp}
                  onChange={e => setRegisterOtp(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={e => e.key === 'Enter' && handleRegister()}
                  fullWidth
                  inputProps={{ maxLength: 6, style: { fontSize: 24, letterSpacing: 10, textAlign: 'center', fontWeight: 'bold' } }}
                  autoFocus
                  sx={{ mb: 1, mt: 1 }}
                />
                <Typography variant="caption" color="text.secondary">
                  📧 {form.email} adresine 6 haneli kod gönderildi
                </Typography>

                <Paper variant="outlined" sx={{ p: 2, mt: 3, textAlign: 'left', bgcolor: 'grey.50', borderRadius: 2 }}>
                  <FormControlLabel
                    control={
                      <Checkbox 
                        checked={registerFaceEnabled} 
                        onChange={e => {
                          const enabled = e.target.checked;
                          setRegisterFaceEnabled(enabled);
                          if (!enabled) setRegisterFaceDescriptor(null);
                        }} 
                      />
                    }
                    label={<Typography variant="body2" fontWeight="medium">Kayıtta yüz profilimi de ekle (opsiyonel)</Typography>}
                  />

                  {registerFaceEnabled && (
                    <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      <Typography variant="caption" color="text.secondary">
                        Sadece cihazınızın kamerası (PC/Telefon) kullanılarak doğrulama verisi oluşturulur.
                      </Typography>
                      
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button size="small" variant="outlined" color="success" onClick={requestCameraPermissionAndRefresh} disabled={faceBusy} fullWidth>
                          İzin İste / Yenile
                        </Button>
                        <Button size="small" variant="contained" color="primary" onClick={async () => {
                          await loadFaceModels();
                          await refreshCameras();
                          await startFaceCamera();
                        }} disabled={faceLoading || faceBusy} fullWidth>
                          {faceLoading ? <CircularProgress size={20} color="inherit" /> : 'Kamerayı Başlat'}
                        </Button>
                      </Box>
                      
                      {cameras.length > 0 && (
                        <Select size="small" value={selectedCameraId} onChange={e => setSelectedCameraId(e.target.value)} fullWidth>
                          {cameras.map((cam, i) => (
                            <MenuItem key={cam.deviceId || i} value={cam.deviceId}>{cam.label || `Kamera ${i + 1}`}</MenuItem>
                          ))}
                        </Select>
                      )}

                      <video ref={videoRef} autoPlay muted playsInline style={{ width: '100%', height: 160, borderRadius: 8, background: '#000', objectFit: 'cover' }} />

                      <Button variant="contained" color="warning" onClick={handleCaptureRegisterFace} disabled={faceBusy} startIcon={<CameraAltIcon />}>
                        Yüz Verisini Yakala
                      </Button>

                      {registerFaceDescriptor && (
                        <Typography variant="caption" color="success.main" fontWeight="bold">
                          ✅ Yüz verisi hazır. Kayıtta otomatik saklanacak.
                        </Typography>
                      )}
                    </Box>
                  )}
                </Paper>
              </Box>
            )}

            {(!registerMode || registerStep === 0) && (
              <TextField
                label="Şifre"
                type="password"
                variant="outlined"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && (registerMode ? handleSendRegisterOtp() : handleLogin())}
                fullWidth
              />
            )}

            <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
              {registerMode && registerStep === 1 && (
                <Button 
                  variant="outlined" 
                  size="large"
                  onClick={() => { setRegisterStep(0); setRegisterOtp(''); setRegisterFaceEnabled(false); setRegisterFaceDescriptor(null); setError(''); setInfo(''); }}
                  startIcon={<ArrowBackIcon />}
                >
                  Geri
                </Button>
              )}
              <Button
                variant="contained"
                size="large"
                fullWidth
                sx={{ py: 1.5, fontWeight: 'bold' }}
                onClick={registerMode ? (registerStep === 0 ? handleSendRegisterOtp : handleRegister) : handleLogin}
              >
                {!registerMode ? 'Giriş Yap' : registerStep === 0 ? 'Kod Gönder →' : 'Hesabı Oluştur ✓'}
              </Button>
            </Box>
          </Box>

          {/* Quick Login - Face Recognition */}
          {!registerMode && (
            <Box sx={{ mt: 4 }}>
              <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, color: 'text.secondary', fontWeight: 'bold', textTransform: 'uppercase' }}>
                <FaceIcon fontSize="small" /> Hızlı Giriş (Face Control)
              </Typography>
              
              <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 2, borderStyle: 'dashed' }}>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                  Kameraya izin verdikten sonra yüz verinizi doğrulayarak şifresiz giriş yapabilirsiniz. Kullanıcı adınızı formda belirtmeyi unutmayın.
                </Typography>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button size="small" variant="outlined" color="success" fullWidth onClick={requestCameraPermissionAndRefresh} disabled={faceBusy}>
                      İzin İste
                    </Button>
                    <Button size="small" variant="contained" color="primary" fullWidth onClick={async () => {
                      await loadFaceModels();
                      await refreshCameras();
                      await startFaceCamera();
                    }} disabled={faceLoading || faceBusy}>
                      {faceLoading ? <CircularProgress size={20} color="inherit" /> : 'Kamerayı Başlat'}
                    </Button>
                  </Box>

                  {cameras.length > 0 && (
                    <Select size="small" value={selectedCameraId} onChange={e => setSelectedCameraId(e.target.value)} fullWidth>
                      {cameras.map((cam, i) => (
                        <MenuItem key={cam.deviceId || i} value={cam.deviceId}>{cam.label || `Kamera ${i + 1}`}</MenuItem>
                      ))}
                    </Select>
                  )}

                  <video ref={videoRef} autoPlay muted playsInline style={{ width: '100%', height: 160, borderRadius: 8, background: '#000', objectFit: 'cover' }} />

                  <Button variant="contained" color="success" onClick={handleFaceLogin} disabled={!faceEnabled || faceBusy}>
                     Yüz ile Hızlı Giriş
                  </Button>

                  {!!faceMessage && (
                    <Typography variant="caption" color="text.secondary" textAlign="center">
                      {faceMessage}
                    </Typography>
                  )}
                </Box>
              </Paper>
            </Box>
          )}

          {registerMode && (
            <Alert severity="info" sx={{ mt: 4, borderRadius: 2 }}>
              <strong>ZK-Email oylama özelliği</strong> için kurumsal e-posta adresinizi girin. Oy kullanma ekranında OTP kodu ile kimliğinizi <strong>anonim</strong> olarak doğrulayacaksınız.
            </Alert>
          )}

        </Box>
      </Paper>
    </Box>
  );
}

export default App;
