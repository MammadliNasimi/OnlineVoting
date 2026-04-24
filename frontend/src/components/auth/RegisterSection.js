import React from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  InputAdornment,
  TextField,
  Typography
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import EmailIcon from '@mui/icons-material/Email';
import HowToRegOutlinedIcon from '@mui/icons-material/HowToRegOutlined';
import MarkEmailReadOutlinedIcon from '@mui/icons-material/MarkEmailReadOutlined';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import FaceTools from './FaceTools';
import { fieldSx, primaryButtonSx, secondaryButtonSx } from './styles';

function RegisterSection({
  form,
  setForm,
  registerStep,
  registerOtp,
  setRegisterOtp,
  registerFaceEnabled,
  setRegisterFaceEnabled,
  registerFaceDescriptor,
  setRegisterFaceDescriptor,
  faceBusy,
  showPassword,
  setShowPassword,
  passwordEndAdornment,
  handleSendRegisterOtp,
  handleRegister,
  handleCaptureRegisterFace,
  otpLoading,
  registerLoading,
  setRegisterStep,
  setError,
  setInfo,
  faceLoading,
  faceMessage,
  cameras,
  selectedCameraId,
  setSelectedCameraId,
  requestCameraPermissionAndRefresh,
  loadFaceModels,
  refreshCameras,
  startFaceCamera,
  videoRef
}) {
  return (
    <>
      <TextField
        label="Kullanici Adi"
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
            label="Sifre"
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
              showPassword ? 'Sifreyi gizle' : 'Sifreyi goster'
            )}
          />
        </>
      )}

      {registerStep === 1 && (
        <Box sx={{ display: 'grid', gap: 2 }}>
          <Box
            sx={{
              p: 2,
              borderRadius: 2,
              backgroundColor: '#f7fbfd',
              border: '1px solid rgba(15, 23, 42, 0.08)'
            }}
          >
            <Typography variant="caption" sx={{ color: '#64748b' }}>
              E-posta
            </Typography>
            <Typography variant="subtitle2" sx={{ color: '#111827', fontWeight: 900 }}>
              {form.email}
            </Typography>
          </Box>

          <TextField
            label="Dogrulama Kodu"
            variant="outlined"
            value={registerOtp}
            onChange={e => setRegisterOtp(e.target.value.replace(/\D/g, ''))}
            onKeyDown={e => e.key === 'Enter' && handleRegister()}
            fullWidth
            inputProps={{ maxLength: 6, style: { fontSize: 22, letterSpacing: 0, textAlign: 'center', fontWeight: 800 } }}
            autoFocus
            sx={fieldSx}
          />

          <Box
            sx={{
              p: 2,
              borderRadius: 2,
              backgroundColor: '#fbfdff',
              border: '1px solid rgba(15, 23, 42, 0.08)'
            }}
          >
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
              label={<Typography variant="body2" sx={{ fontWeight: 800, color: '#111827' }}>Yuz profilimi ekle</Typography>}
            />

            {registerFaceEnabled && (
              <Box sx={{ mt: 1.5, display: 'grid', gap: 1.5 }}>
                <FaceTools
                  compact
                  faceBusy={faceBusy}
                  faceLoading={faceLoading}
                  faceMessage={faceMessage}
                  cameras={cameras}
                  selectedCameraId={selectedCameraId}
                  setSelectedCameraId={setSelectedCameraId}
                  requestCameraPermissionAndRefresh={requestCameraPermissionAndRefresh}
                  loadFaceModels={loadFaceModels}
                  refreshCameras={refreshCameras}
                  startFaceCamera={startFaceCamera}
                  videoRef={videoRef}
                />

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
                  {faceBusy ? <CircularProgress size={22} color="inherit" /> : 'Yuz Verisini Yakala'}
                </Button>

                {registerFaceDescriptor && (
                  <Alert severity="success" sx={{ borderRadius: 1.5 }}>
                    Yuz verisi hazir. Kayitta saklanacak.
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
            onClick={() => {
              setRegisterStep(0);
              setRegisterOtp('');
              setRegisterFaceEnabled(false);
              setRegisterFaceDescriptor(null);
              setError('');
              setInfo('');
            }}
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
            (registerStep === 0 && (otpLoading || !form.name || !form.firstName || !form.lastName || !form.email || !form.password)) ||
            (registerStep === 1 && (registerLoading || !registerOtp))
          }
        >
          {otpLoading || registerLoading ? (
            <CircularProgress size={24} color="inherit" />
          ) : registerStep === 0 ? (
            'Kodu Gonder'
          ) : (
            'Hesabi Olustur'
          )}
        </Button>
      </Box>
    </>
  );
}

export default RegisterSection;
