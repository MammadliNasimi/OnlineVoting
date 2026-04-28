import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography
} from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { registerPinPrompt } from '../LocalIdentity';

const PIN_NOTICE_SEEN_KEY = 'ov_pin_notice_seen_v1';

// Burner cüzdanın PIN'i ile kilidini açan global dialog. App.js seviyesinde tek
// instance olarak mount edilir. LocalIdentity modülü bunu `registerPinPrompt`
// üzerinden çağırır; her çağrı bir promise döner.
function PinPromptDialog() {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [error, setError] = useState('');
  const [confirmMode, setConfirmMode] = useState(false);
  const [showOneTimeNotice, setShowOneTimeNotice] = useState(false);
  const resolverRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    registerPinPrompt((reasonText) => {
      setReason(reasonText || 'PIN gerekli');
      setPin('');
      setPinConfirm('');
      setError('');
      // İlk kez kullanım gibi durumlarda confirm alanı göster.
      const firstTime = /belirleyin/i.test(reasonText || '');
      setConfirmMode(firstTime);
      if (firstTime) {
        const hasSeen = localStorage.getItem(PIN_NOTICE_SEEN_KEY) === '1';
        setShowOneTimeNotice(!hasSeen);
      } else {
        setShowOneTimeNotice(false);
      }
      setOpen(true);
      return new Promise((resolve) => {
        resolverRef.current = resolve;
      });
    });
  }, []);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(t);
    }
  }, [open]);

  const finish = (value) => {
    setOpen(false);
    if (resolverRef.current) {
      resolverRef.current(value);
      resolverRef.current = null;
    }
  };

  const handleConfirm = () => {
    setError('');
    if (!pin || pin.length < 4) {
      setError('PIN en az 4 karakter olmalı.');
      return;
    }
    if (confirmMode && pin !== pinConfirm) {
      setError('PIN’ler eşleşmiyor.');
      return;
    }
    if (confirmMode && showOneTimeNotice) {
      localStorage.setItem(PIN_NOTICE_SEEN_KEY, '1');
      setShowOneTimeNotice(false);
    }
    finish(pin);
  };

  const handleCancel = () => finish(null);

  return (
    <Dialog
      open={open}
      onClose={handleCancel}
      maxWidth="xs"
      fullWidth
      PaperProps={{ sx: { borderRadius: 2 } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 800 }}>
        <LockOutlinedIcon sx={{ color: '#10b981' }} />
        {confirmMode ? 'Yeni PIN Oluştur' : 'Burner Cüzdan PIN'}
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ color: '#475569', mb: 2 }}>
          {reason}
        </Typography>

        {confirmMode && showOneTimeNotice && (
          <Alert severity="warning" sx={{ mb: 2, borderRadius: 1.5 }}>
            PIN’i güvenli bir yerde saklayın. Unutulursa kurtarılamaz ve cüzdan
            sıfırlanmalıdır.
          </Alert>
        )}

        <Box sx={{ display: 'grid', gap: 1.5 }}>
          <TextField
            inputRef={inputRef}
            type="password"
            label="PIN"
            fullWidth
            autoComplete="new-password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
            inputProps={{ maxLength: 64 }}
          />
          {confirmMode && (
            <TextField
              type="password"
              label="PIN (Tekrar)"
              fullWidth
              autoComplete="new-password"
              value={pinConfirm}
              onChange={(e) => setPinConfirm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
              inputProps={{ maxLength: 64 }}
            />
          )}
        </Box>

        {error && (
          <Alert severity="error" sx={{ mt: 2, borderRadius: 1.5 }}>
            {error}
          </Alert>
        )}

        <Typography variant="caption" sx={{ display: 'block', color: '#94a3b8', mt: 2 }}>
          PIN tarayıcınızda yerel olarak saklanmaz; sadece şifrelenmiş cüzdanın
          kilidini açmak için bellek içinde kullanılır. PIN kaybolursa cüzdan sıfırlanmalıdır.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleCancel} sx={{ textTransform: 'none' }}>
          İptal
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          sx={{
            textTransform: 'none',
            fontWeight: 800,
            background: 'linear-gradient(135deg, #34d399 0%, #10b981 48%, #0f9f8f 100%)'
          }}
        >
          Onayla
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default PinPromptDialog;
