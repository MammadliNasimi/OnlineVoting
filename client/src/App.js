import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import SimpleVoting from './SimpleVoting';

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
      setFaceMessage('Yeni kamera algılandı. Gerekirse listeden telefon kamerasını seçin.');
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
      setFaceMessage('Kamera izni verildi. Telefon kamerası bağlıysa listede görünecektir.');
      return true;
    } catch (err) {
      setFaceMessage('Kamera izni reddedildi veya cihaz bulunamadı. Tarayıcı izinlerini kontrol edin.');
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
        setFaceMessage('Kamera bulunamadı. Telefonu webcam uygulamasıyla bağlayıp tekrar deneyin.');
      } else if (err && err.name === 'NotAllowedError') {
        setFaceMessage('Kamera izni verilmedi. Tarayıcıdan kamera iznini açın.');
      } else {
        setFaceMessage('Kamera açılamadı. Telefon kamerasını webcam olarak bağlayıp tekrar deneyin.');
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
        window.location.href = `http://localhost:5000/admin/dashboard?session=${res.data.sessionId}&name=${encodeURIComponent(res.data.user.name)}`;
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
        // Admin directly goes to the admin panel
        window.location.href = `http://localhost:5000/admin/dashboard?session=${res.data.sessionId}&name=${encodeURIComponent(res.data.user.name)}`;
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

  const renderLogin = () => {
    const cardStyle = {
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Segoe UI', sans-serif",
    };
    const boxStyle = {
      background: 'rgba(255,255,255,0.06)',
      backdropFilter: 'blur(16px)',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: 24,
      padding: '48px 40px',
      width: 420,
      boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
      color: '#fff',
    };
    const tabStyle = (active) => ({
      flex: 1,
      padding: '10px 0',
      background: active ? 'linear-gradient(135deg, #667eea, #764ba2)' : 'transparent',
      border: 'none',
      borderRadius: 10,
      color: active ? '#fff' : 'rgba(255,255,255,0.5)',
      fontWeight: active ? 700 : 400,
      fontSize: 15,
      cursor: 'pointer',
      transition: 'all 0.2s',
    });
    const inputStyle = {
      width: '100%',
      padding: '13px 16px',
      background: 'rgba(255,255,255,0.08)',
      border: '1px solid rgba(255,255,255,0.15)',
      borderRadius: 12,
      color: '#fff',
      fontSize: 15,
      outline: 'none',
      boxSizing: 'border-box',
      marginBottom: 14,
    };
    const labelStyle = {
      display: 'block',
      fontSize: 12,
      color: 'rgba(255,255,255,0.55)',
      marginBottom: 5,
      marginTop: 2,
      letterSpacing: '0.05em',
      textTransform: 'uppercase',
    };
    const btnStyle = {
      width: '100%',
      padding: '14px',
      background: 'linear-gradient(135deg, #667eea, #764ba2)',
      border: 'none',
      borderRadius: 12,
      color: '#fff',
      fontSize: 16,
      fontWeight: 700,
      cursor: 'pointer',
      marginTop: 8,
      letterSpacing: '0.03em',
      boxShadow: '0 4px 20px rgba(102,126,234,0.4)',
    };

    return (
      <div style={cardStyle}>
        <div style={boxStyle}>
          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ fontSize: 42, marginBottom: 6 }}>🗳️</div>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px' }}>SSI Blockchain Oylama</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>
              ZK-Email • EIP-712 • Anonim Kimlik
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 4, marginBottom: 28 }}>
            <button style={tabStyle(!registerMode)} onClick={() => { setRegisterMode(false); setRegisterStep(0); setRegisterOtp(''); setRegisterFaceEnabled(false); setRegisterFaceDescriptor(null); setError(''); setInfo(''); }}>
              Giriş Yap
            </button>
            <button style={tabStyle(registerMode)} onClick={() => { setRegisterMode(true); setRegisterStep(0); setRegisterOtp(''); setRegisterFaceEnabled(false); setRegisterFaceDescriptor(null); setError(''); setInfo(''); }}>
              Kayıt Ol
            </button>
          </div>

          {/* Fields */}
          <div>
            <label style={labelStyle}>Kullanıcı Adı</label>
            <input
              style={inputStyle}
              type="text"
              placeholder="kullanici_adi"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && (registerMode ? handleRegister() : handleLogin())}
            />

            {registerMode && registerStep === 0 && (
              <>
                <label style={labelStyle}>Kurumsal E-posta (ZK-Email için)</label>
                <input
                  style={{ ...inputStyle, borderColor: form.email ? 'rgba(102,126,234,0.6)' : 'rgba(255,255,255,0.15)' }}
                  type="email"
                  placeholder="ad.soyad@akdeniz.edu.tr"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && handleSendRegisterOtp()}
                />
              </>
            )}

            {registerMode && registerStep === 1 && (
              <>
                <label style={labelStyle}>E-posta: <span style={{ color: '#a5d6a7' }}>{form.email}</span></label>
                <label style={labelStyle}>Doğrulama Kodu (OTP)</label>
                <input
                  style={{ ...inputStyle, letterSpacing: 6, fontSize: 22, textAlign: 'center', fontWeight: 700 }}
                  type="text"
                  placeholder="123456"
                  maxLength={6}
                  value={registerOtp}
                  onChange={e => setRegisterOtp(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={e => e.key === 'Enter' && handleRegister()}
                  autoFocus
                />
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>📧 {form.email} adresine 6 haneli kod gönderildi</div>

                <div style={{ marginTop: 10, padding: '10px 12px', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, background: 'rgba(255,255,255,0.03)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'rgba(255,255,255,0.85)', marginBottom: registerFaceEnabled ? 10 : 0 }}>
                    <input
                      type="checkbox"
                      checked={registerFaceEnabled}
                      onChange={e => {
                        const enabled = e.target.checked;
                        setRegisterFaceEnabled(enabled);
                        if (!enabled) {
                          setRegisterFaceDescriptor(null);
                        }
                      }}
                    />
                    Kayıtta yüz profilimi de ekle (opsiyonel)
                  </label>

                  {registerFaceEnabled && (
                    <>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>
                        Sadece PC kamerası ile yüz doğrulama kullanılabilir.
                      </div>

                      <button
                        style={{ ...btnStyle, marginTop: 0, marginBottom: 8, padding: 10, fontSize: 13, boxShadow: 'none', background: 'rgba(67,160,71,0.38)' }}
                        onClick={requestCameraPermissionAndRefresh}
                        disabled={faceBusy}
                        type="button"
                      >
                        İzin İste ve Kameraları Yenile
                      </button>

                      <button
                        style={{ ...btnStyle, marginTop: 0, marginBottom: 8, padding: 10, fontSize: 13, boxShadow: 'none', background: 'rgba(102,126,234,0.35)' }}
                        onClick={async () => {
                          await loadFaceModels();
                          await refreshCameras();
                          await startFaceCamera();
                        }}
                        disabled={faceLoading || faceBusy}
                        type="button"
                      >
                        {faceLoading ? 'Model Yükleniyor...' : 'Kamerayı Başlat'}
                      </button>

                      {cameras.length > 0 && (
                        <select
                          value={selectedCameraId}
                          onChange={e => setSelectedCameraId(e.target.value)}
                          style={{ width: '100%', marginBottom: 8, padding: '10px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff' }}
                        >
                          {cameras.map((cam, i) => (
                            <option key={cam.deviceId || i} value={cam.deviceId}>
                              {cam.label || `Kamera ${i + 1}`}
                            </option>
                          ))}
                        </select>
                      )}

                      <video
                        ref={videoRef}
                        autoPlay
                        muted
                        playsInline
                        style={{ width: '100%', height: 160, borderRadius: 10, background: '#000', objectFit: 'cover', marginBottom: 8 }}
                      />

                      <button
                        style={{ ...btnStyle, marginTop: 0, padding: 10, fontSize: 13, boxShadow: 'none', background: 'rgba(255,193,7,0.45)' }}
                        onClick={handleCaptureRegisterFace}
                        disabled={faceBusy}
                        type="button"
                      >
                        Yüz Verisini Yakala
                      </button>

                      {registerFaceDescriptor && (
                        <div style={{ fontSize: 12, color: '#a5d6a7', marginTop: 8 }}>
                          ✅ Yüz verisi hazır. Kayıtta otomatik saklanacak.
                        </div>
                      )}
                    </>
                  )}
                </div>
              </>
            )}

            {(!registerMode || registerStep === 0) && (
              <>
                <label style={labelStyle}>Şifre</label>
                <input
                  style={inputStyle}
                  type="password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && (registerMode ? handleSendRegisterOtp() : handleLogin())}
                />
              </>
            )}
          </div>

          {/* Error / Info */}
          {error && (
            <div style={{ background: 'rgba(244,67,54,0.15)', border: '1px solid rgba(244,67,54,0.35)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#ff8a80', marginBottom: 12 }}>
              ⚠️ {error}
            </div>
          )}
          {info && (
            <div style={{ background: 'rgba(76,175,80,0.15)', border: '1px solid rgba(76,175,80,0.35)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#a5d6a7', marginBottom: 12 }}>
              ✅ {info}
            </div>
          )}

          {/* Submit */}
          {registerMode && registerStep === 1 && (
            <button style={{ ...btnStyle, background: 'rgba(255,255,255,0.08)', marginBottom: 8 }}
              onClick={() => { setRegisterStep(0); setRegisterOtp(''); setRegisterFaceEnabled(false); setRegisterFaceDescriptor(null); setError(''); setInfo(''); }}>
              ← Geri
            </button>
          )}
          <button
            style={btnStyle}
            onClick={registerMode ? (registerStep === 0 ? handleSendRegisterOtp : handleRegister) : handleLogin}
          >
            {!registerMode ? 'Giriş Yap' : registerStep === 0 ? 'Kod Gönder →' : 'Hesabı Oluştur ✓'}
          </button>

          {!registerMode && (
            <div style={{ marginTop: 14, padding: '12px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }}>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 8 }}>
                📷 Hızlı Giriş (Face Control) — Sadece PC kamerası kullanılır
              </div>

              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>
                Kamera erişim izni verip listeden PC kamerasını seçin.
              </div>

              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <button
                  style={{ ...btnStyle, marginTop: 0, padding: 10, fontSize: 13, boxShadow: 'none', background: 'rgba(67,160,71,0.38)' }}
                  onClick={requestCameraPermissionAndRefresh}
                  disabled={faceBusy}
                >
                  İzin İste ve Kameraları Yenile
                </button>
                <button
                  style={{ ...btnStyle, marginTop: 0, padding: 10, fontSize: 13, boxShadow: 'none', background: 'rgba(102,126,234,0.35)' }}
                  onClick={async () => {
                    await loadFaceModels();
                    await refreshCameras();
                    await startFaceCamera();
                  }}
                  disabled={faceLoading || faceBusy}
                >
                  {faceLoading ? 'Model Yükleniyor...' : 'Kamerayı Başlat'}
                </button>
              </div>

              {cameras.length > 0 && (
                <select
                  value={selectedCameraId}
                  onChange={e => setSelectedCameraId(e.target.value)}
                  style={{ width: '100%', marginBottom: 8, padding: '10px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff' }}
                >
                  {cameras.map((cam, i) => (
                    <option key={cam.deviceId || i} value={cam.deviceId}>
                      {cam.label || `Kamera ${i + 1}`}
                    </option>
                  ))}
                </select>
              )}

              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                style={{ width: '100%', height: 180, borderRadius: 10, background: '#000', objectFit: 'cover', marginBottom: 8 }}
              />

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  style={{ ...btnStyle, marginTop: 0, padding: 10, fontSize: 13, boxShadow: 'none', background: 'rgba(56,142,60,0.45)' }}
                  onClick={handleFaceLogin}
                  disabled={!faceEnabled || faceBusy}
                >
                  Yüz ile Hızlı Giriş
                </button>
              </div>

              {!!faceMessage && (
                <div style={{ marginTop: 8, fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>
                  {faceMessage}
                </div>
              )}
            </div>
          )}

          {/* ZK-Email info badge on register */}
          {registerMode && (
            <div style={{ marginTop: 18, padding: '12px 16px', background: 'rgba(102,126,234,0.1)', border: '1px solid rgba(102,126,234,0.25)', borderRadius: 12, fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 }}>
              🔐 <strong style={{ color: 'rgba(255,255,255,0.8)' }}>ZK-Email oylama özelliği</strong> için kurumsal e-posta adresinizi girin. Oy kullanma ekranında OTP kodu ile kimliğinizi anonim olarak doğrulayacaksınız.
            </div>
          )}
        </div>
      </div>
    );
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

  // Main return for App
  return (
    <div style={currentPage === 'login' ? {} : { padding: 20 }}>
      {currentPage === 'login' && renderLogin()}
      {currentPage === 'vote' && (
        <SimpleVoting 
          user={user} 
          sessionId={sessionId} 
          onLogout={handleLogout}
        />
      )}
    </div>
  );
}

export default App;
