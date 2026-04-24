import React from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  InputAdornment,
  TextField,
  Typography
} from '@mui/material';
import LockResetIcon from '@mui/icons-material/LockReset';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import MarkEmailReadOutlinedIcon from '@mui/icons-material/MarkEmailReadOutlined';
import EmailIcon from '@mui/icons-material/Email';
import KeyOutlinedIcon from '@mui/icons-material/KeyOutlined';
import { fieldSx, iconBubbleSx, primaryButtonSx, secondaryButtonSx } from './styles';

function ForgotPasswordPage({
  error,
  info,
  forgotPasswordStep,
  forgotPasswordOtp,
  setForgotPasswordOtp,
  form,
  setForm,
  showResetPassword,
  setShowResetPassword,
  forgotLoading,
  resetPasswordConfirmLoading,
  handleForgotPasswordRequest,
  handleResetPasswordOtpVerify,
  setCurrentPage,
  setForgotPasswordStep,
  setError,
  setInfo,
  passwordEndAdornment
}) {
  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <Box sx={{ ...iconBubbleSx, color: '#0f9f8f', backgroundColor: 'rgba(16, 185, 129, 0.10)' }}>
          <LockResetIcon />
        </Box>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 900, color: '#111827' }}>
            Sifre Sifirlama
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748b' }}>
            Hesabiniza ait e-posta ile devam edin.
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
              Sifirlama kodu kayitli e-posta adresinize gonderilecek.
            </Typography>
          </>
        )}

        {forgotPasswordStep === 1 && (
          <>
            <TextField
              label="Dogrulama Kodu"
              variant="outlined"
              value={forgotPasswordOtp}
              onChange={e => setForgotPasswordOtp(e.target.value.replace(/\D/g, ''))}
              fullWidth
              inputProps={{ maxLength: 6, style: { fontSize: 22, letterSpacing: 0, textAlign: 'center', fontWeight: 800 } }}
              autoFocus
              sx={fieldSx}
            />
            <Typography variant="caption" sx={{ color: '#64748b' }}>
              Kod {form.resetEmail} adresine gonderildi.
            </Typography>

            <TextField
              label="Yeni Sifre"
              type={showResetPassword ? 'text' : 'password'}
              variant="outlined"
              value={form.resetPassword}
              onChange={e => setForm(f => ({ ...f, resetPassword: e.target.value }))}
              fullWidth
              sx={fieldSx}
              InputProps={passwordEndAdornment(
                showResetPassword,
                () => setShowResetPassword(value => !value),
                showResetPassword ? 'Sifreyi gizle' : 'Sifreyi goster'
              )}
            />

            <TextField
              label="Sifre Tekrar"
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
              <Alert severity="warning" sx={{ borderRadius: 1.5 }}>Sifreler eslesmiyor</Alert>
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
            disabled={
              forgotPasswordStep === 0
                ? forgotLoading || !form.resetEmail
                : resetPasswordConfirmLoading || form.resetPassword !== form.resetPasswordConfirm || !form.resetPassword
            }
            sx={primaryButtonSx}
          >
            {forgotLoading || resetPasswordConfirmLoading ? (
              <CircularProgress size={24} color="inherit" />
            ) : forgotPasswordStep === 0 ? (
              'Kodu Gonder'
            ) : (
              'Sifreyi Yenile'
            )}
          </Button>
        </Box>
      </Box>
    </Box>
  );
}

export default ForgotPasswordPage;
