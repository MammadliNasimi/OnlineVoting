import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useMutation, useQuery } from '@tanstack/react-query';
import useAdminHeaders from '../../hooks/useAdminHeaders';
import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import GroupIcon from '@mui/icons-material/Group';
import EmailIcon from '@mui/icons-material/Email';
import { API_BASE } from '../../config';

const DEFAULT_SUBJECT = (title) => `🗳️ "${title}" seçimi hakkında duyuru`;
const DEFAULT_BODY = (title, desc) => `
<p>Sayın seçmen,</p>
<p><strong>${title}</strong> seçimi ile ilgili önemli bir duyurumuz bulunmaktadır.</p>
${desc ? `<p>${desc}</p>` : ''}
<p>Oy kullanmak için sisteme giriş yapmanız yeterlidir.</p>
<p>Saygılarımızla,<br>SSI Voting Yönetimi</p>
`.trim();

function AnnouncementModal({ election, open, onClose, sessionId }) {
  const authHeaders = useAdminHeaders(sessionId);

  const [subject, setSubject] = useState('');
  const [htmlBody, setHtmlBody] = useState('');
  const [result, setResult] = useState(null);

  // Modal her açıldığında varsayılan değerleri doldur.
  useEffect(() => {
    if (open && election) {
      setSubject(DEFAULT_SUBJECT(election.title));
      setHtmlBody(DEFAULT_BODY(election.title, election.description));
      setResult(null);
    }
  }, [open, election]);

  // Uygun seçmen sayısını önceden çek.
  const { data: eligibleData, isLoading: loadingEligible } = useQuery({
    queryKey: ['eligible_voters', election?.id],
    queryFn: async () =>
      (await axios.get(`${API_BASE}/admin/elections/${election.id}/eligible-voters`, authHeaders)).data,
    enabled: open && !!election?.id,
    staleTime: 30000
  });

  const sendMutation = useMutation({
    mutationFn: () =>
      axios.post(
        `${API_BASE}/admin/elections/${election.id}/announce`,
        { subject, htmlBody },
        authHeaders
      ),
    onSuccess: (res) => setResult(res.data),
    onError: (err) => setResult({ error: err?.response?.data?.message || 'Gönderilemedi.' })
  });

  const eligibleCount = eligibleData?.count ?? null;
  const canSend = subject.trim() && htmlBody.trim() && !sendMutation.isPending;

  if (!election) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={1}>
            <EmailIcon sx={{ color: '#4f46e5' }} />
            <Typography variant="h6" fontWeight="bold">Duyuru Maili Gönder</Typography>
          </Stack>
          <IconButton size="small" onClick={onClose}><CloseIcon /></IconButton>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          <strong>{election.title}</strong> seçimine uygun seçmenlere toplu mail
        </Typography>
      </DialogTitle>
      <Divider />

      <DialogContent sx={{ pt: 2.5 }}>
        {/* Alıcı sayısı bilgisi */}
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2.5, p: 1.5, bgcolor: '#f0f9ff', borderRadius: 2, border: '1px solid #bae6fd' }}>
          <GroupIcon sx={{ color: '#0284c7' }} />
          {loadingEligible ? (
            <CircularProgress size={16} />
          ) : (
            <Typography variant="body2">
              <strong style={{ color: '#0284c7' }}>{eligibleCount ?? '?'} uygun seçmen</strong>
              {' '}bu maili alacak.
              {eligibleCount === 0 && (
                <span style={{ color: '#dc2626' }}> Uygun seçmen yok!</span>
              )}
            </Typography>
          )}
          {eligibleData?.voters?.slice(0, 3).map((v, i) => (
            <Chip key={i} size="small" label={v.email} sx={{ maxWidth: 160, fontSize: 10 }} />
          ))}
          {eligibleData?.voters?.length > 3 && (
            <Tooltip title={eligibleData.voters.slice(3).map(v => v.email).join(', ')}>
              <Chip size="small" label={`+${eligibleData.voters.length - 3} daha`} sx={{ fontSize: 10 }} />
            </Tooltip>
          )}
        </Stack>

        {/* Konu */}
        <TextField
          label="E-posta Konusu"
          fullWidth
          size="small"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          sx={{ mb: 2 }}
          inputProps={{ maxLength: 200 }}
          helperText={`${subject.length}/200`}
        />

        {/* HTML Body */}
        <TextField
          label="E-posta İçeriği (HTML desteklenir)"
          fullWidth
          multiline
          minRows={8}
          maxRows={18}
          value={htmlBody}
          onChange={(e) => setHtmlBody(e.target.value)}
          placeholder="<p>Merhaba...</p>"
          inputProps={{ style: { fontFamily: 'monospace', fontSize: 13 } }}
          sx={{ mb: 1 }}
        />
        <Typography variant="caption" color="text.secondary">
          İçerik HTML formatında yazılabilir. Sistem otomatik olarak e-posta şablonuna sarılır.
        </Typography>

        {/* Gönderim sonucu */}
        {result && !result.error && (
          <Alert severity="success" sx={{ mt: 2, borderRadius: 1.5 }}>
            ✅ {result.message} ({result.sent} başarılı, {result.failed} başarısız)
          </Alert>
        )}
        {result?.error && (
          <Alert severity="error" sx={{ mt: 2, borderRadius: 1.5 }}>
            {result.error}
          </Alert>
        )}
        {sendMutation.isError && !result && (
          <Alert severity="error" sx={{ mt: 2, borderRadius: 1.5 }}>
            {sendMutation.error?.response?.data?.message || 'Mail gönderilemedi.'}
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} sx={{ textTransform: 'none' }}>
          {result ? 'Kapat' : 'İptal'}
        </Button>
        {!result && (
          <Button
            variant="contained"
            startIcon={sendMutation.isPending ? <CircularProgress size={18} color="inherit" /> : <SendIcon />}
            onClick={() => sendMutation.mutate()}
            disabled={!canSend || eligibleCount === 0}
            sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#4f46e5', '&:hover': { bgcolor: '#4338ca' } }}
          >
            {sendMutation.isPending ? 'Gönderiliyor...' : `${eligibleCount ?? '?'} Kişiye Gönder`}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

export default AnnouncementModal;
