import React from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Divider,
  InputAdornment,
  TextField,
  Typography
} from '@mui/material';
import FaceIcon from '@mui/icons-material/Face';
import LoginOutlinedIcon from '@mui/icons-material/LoginOutlined';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import { fieldSx, primaryButtonSx } from './styles';
import FaceTools from './FaceTools';

function LoginSection({
  form,
  setForm,
  showPassword,
  setShowPassword,
  passwordEndAdornment,
  handleLogin,
  loginLoading,
  setCurrentPage,
  setError,
  setInfo,
  faceEnabled,
  faceBusy,
  handleFaceLogin,
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
        label="Sifre"
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
          showPassword ? 'Sifreyi gizle' : 'Sifreyi goster'
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
        {loginLoading ? <CircularProgress size={24} color="inherit" /> : 'Giris Yap'}
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
          Sifremi Unuttum
        </Button>
      </Box>

      <Divider sx={{ my: 1.5, color: '#94a3b8', fontSize: 12 }}>veya</Divider>

      <Box sx={{ display: 'grid', gap: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FaceIcon sx={{ color: '#0f9f8f' }} />
          <Typography variant="subtitle2" sx={{ color: '#111827', fontWeight: 900 }}>
            Yuz ile Hizli Giris
          </Typography>
        </Box>

        <FaceTools
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
          {faceBusy ? <CircularProgress size={22} color="inherit" /> : 'Yuz ile Giris'}
        </Button>
      </Box>
    </>
  );
}

export default LoginSection;
