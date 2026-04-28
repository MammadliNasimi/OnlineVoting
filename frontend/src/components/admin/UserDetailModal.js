import React, { useState } from 'react';
import axios from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import useAdminHeaders from '../../hooks/useAdminHeaders';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PersonIcon from '@mui/icons-material/Person';
import FaceIcon from '@mui/icons-material/Face';
import LockIcon from '@mui/icons-material/Lock';
import HowToVoteIcon from '@mui/icons-material/HowToVote';
import DevicesIcon from '@mui/icons-material/Devices';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import PasswordIcon from '@mui/icons-material/Password';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { API_BASE, explorerTxUrl, EXPLORER_BASE_URL } from '../../config';

const ROLE_OPTIONS = [
  { value: 'user', label: 'Kullanıcı', color: 'default' },
  { value: 'moderator', label: 'Moderatör', color: 'info' },
  { value: 'admin', label: 'Admin', color: 'secondary' }
];

// --------------------------------------------------------------------------

function SectionTitle({ icon, children }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
      <Box sx={{ color: '#4f46e5' }}>{icon}</Box>
      <Typography variant="subtitle1" fontWeight="bold" sx={{ color: '#1e293b' }}>
        {children}
      </Typography>
    </Stack>
  );
}

function InfoRow({ label, value }) {
  return (
    <Stack direction="row" spacing={2} sx={{ py: 0.75 }}>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ minWidth: 160, flexShrink: 0, fontWeight: 500 }}
      >
        {label}
      </Typography>
      <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
        {value ?? <em style={{ color: '#94a3b8' }}>—</em>}
      </Typography>
    </Stack>
  );
}

function fmtDate(str) {
  if (!str) return null;
  return new Date(str).toLocaleString('tr-TR', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function kindLabel(kind) {
  const map = {
    login: 'Şifre Girişi',
    face_login: 'Yüz Girişi',
    otp_request: 'OTP İsteği',
    forgot_password_unknown: 'Şifre Sıfırlama'
  };
  return map[kind] || kind;
}

// --------------------------------------------------------------------------

function UserDetailModal({ userId, sessionId, open, onClose }) {
  const queryClient = useQueryClient();
  const authHeaders = useAdminHeaders(sessionId);

  // Rol değiştirme state'leri
  const [pendingRole, setPendingRole] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [roleSuccess, setRoleSuccess] = useState('');

  // Kilit state'leri
  const [lockHours, setLockHours] = useState('24');
  const [lockReason, setLockReason] = useState('');
  const [lockSuccess, setLockSuccess] = useState('');

  // Şifre sıfırlama state'leri
  const [pwResetSuccess, setPwResetSuccess] = useState('');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['user_detail', userId],
    queryFn: async () =>
      (await axios.get(`${API_BASE}/admin/users/${userId}/detail`, authHeaders)).data,
    enabled: open && !!userId,
    staleTime: 10000
  });

  const lockMutation = useMutation({
    mutationFn: () =>
      axios.post(`${API_BASE}/admin/users/${userId}/lock`, { hours: lockHours, reason: lockReason }, authHeaders),
    onSuccess: () => {
      setLockSuccess(`Hesap ${lockHours} saat kilitlendi.`);
      setLockReason('');
      queryClient.invalidateQueries({ queryKey: ['user_detail', userId] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      refetch();
      setTimeout(() => setLockSuccess(''), 4000);
    }
  });

  const unlockMutation = useMutation({
    mutationFn: () =>
      axios.post(`${API_BASE}/admin/users/${userId}/unlock`, {}, authHeaders),
    onSuccess: () => {
      setLockSuccess('Hesap kilidi kaldırıldı.');
      queryClient.invalidateQueries({ queryKey: ['user_detail', userId] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['all_auth_attempts'] });
      refetch();
      setTimeout(() => setLockSuccess(''), 4000);
    }
  });

  const resetAttemptsMutation = useMutation({
    mutationFn: () =>
      axios.delete(`${API_BASE}/admin/auth-attempts/user/${userId}`, authHeaders),
    onSuccess: () => {
      setLockSuccess('Başarısız deneme kayıtları temizlendi.');
      queryClient.invalidateQueries({ queryKey: ['user_detail', userId] });
      queryClient.invalidateQueries({ queryKey: ['all_auth_attempts'] });
      refetch();
      setTimeout(() => setLockSuccess(''), 4000);
    }
  });

  const pwResetMutation = useMutation({
    mutationFn: () =>
      axios.post(`${API_BASE}/admin/users/${userId}/reset-password`, {}, authHeaders),
    onSuccess: (res) => {
      setPwResetSuccess(res.data?.message || 'Şifre sıfırlama maili gönderildi.');
      setTimeout(() => setPwResetSuccess(''), 6000);
    }
  });

  const roleMutation = useMutation({
    mutationFn: (role) =>
      axios.put(`${API_BASE}/admin/users/${userId}/role`, { role }, authHeaders),
    onSuccess: (res) => {
      const newRole = res.data?.user?.role;
      setRoleSuccess(`Rol başarıyla "${ROLE_OPTIONS.find(r => r.value === newRole)?.label || newRole}" olarak güncellendi.`);
      setConfirmOpen(false);
      setPendingRole('');
      // Detay + kullanıcı listesi cache'ini invalidate et.
      queryClient.invalidateQueries({ queryKey: ['user_detail', userId] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      refetch();
      setTimeout(() => setRoleSuccess(''), 4000);
    },
    onError: (err) => {
      setConfirmOpen(false);
    }
  });

  const { user, lastSession, activeSessionCount, faceProfile, authAttempts = [], voteHistory = [], voteCount } = data || {};

  const initial = user?.name?.charAt(0).toUpperCase() || '?';
  const isBruteForceLocked = authAttempts.some(
    (a) => a.locked_until && new Date(a.locked_until) > new Date()
  );
  const isManuallyLocked = !!user?.locked_until && new Date(user.locked_until) > new Date();
  const isLocked = isBruteForceLocked || isManuallyLocked;
  const totalFailedAttempts = authAttempts.reduce((s, a) => s + (a.attempt_count || 0), 0);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ p: 0 }}>
        <Stack direction="row" alignItems="center" spacing={2} sx={{ px: 3, pt: 3, pb: 2 }}>
          <Avatar sx={{ width: 52, height: 52, bgcolor: '#4f46e5', fontSize: 22, fontWeight: 900 }}>
            {initial}
          </Avatar>
          <Box sx={{ flexGrow: 1 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="h6" fontWeight="bold">
                {user?.name ?? '…'}
              </Typography>
              <Chip
                size="small"
                label={user?.role === 'admin' ? 'Admin' : 'Kullanıcı'}
                color={user?.role === 'admin' ? 'secondary' : 'default'}
              />
              {isManuallyLocked && (
                <Chip size="small" label="🔒 Admin Kilidi" color="error" />
              )}
              {isBruteForceLocked && !isManuallyLocked && (
                <Chip size="small" label="⚠️ Brute-Force Kilidi" color="warning" />
              )}
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {user?.email || <em>E-posta yok</em>}
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Stack>
        {isLoading && <LinearProgress />}
        <Divider />
      </DialogTitle>

      <DialogContent sx={{ px: 3, py: 2.5 }}>
        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        )}

        {error && (
          <Box sx={{ color: 'error.main', py: 3, textAlign: 'center' }}>
            Kullanıcı bilgileri yüklenemedi.
          </Box>
        )}

        {!isLoading && data && (
          <Stack spacing={3}>
            {/* ── 1. KİMLİK BİLGİLERİ ─────────────────────────── */}
            <Paper elevation={0} sx={{ p: 2.5, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}>
              <SectionTitle icon={<PersonIcon />}>Kimlik Bilgileri</SectionTitle>
              <Divider sx={{ mb: 1.5 }} />
              <InfoRow label="Kullanıcı ID" value={`#${user.id}`} />
              <InfoRow label="Kullanıcı Adı" value={user.name} />
              <InfoRow label="Ad Soyad"
                value={[user.first_name, user.last_name].filter(Boolean).join(' ') || null} />
              <InfoRow label="E-posta" value={user.email} />
              <InfoRow label="Öğrenci No" value={user.student_id} />
              <InfoRow label="Mevcut Rol" value={
                <Chip
                  size="small"
                  label={ROLE_OPTIONS.find(r => r.value === user.role)?.label || user.role}
                  color={ROLE_OPTIONS.find(r => r.value === user.role)?.color || 'default'}
                />
              } />
              <InfoRow label="Kayıt Tarihi" value={fmtDate(user.created_at)} />
            </Paper>

            {/* ── 2. HESAP KİLİTLEME ───────────────────────────── */}
            <Paper elevation={0} sx={{ p: 2.5, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}>
              <SectionTitle icon={<LockIcon />}>Hesap Kilitleme</SectionTitle>
              <Divider sx={{ mb: 1.5 }} />

              {lockSuccess && (
                <Alert severity="success" sx={{ mb: 1.5, borderRadius: 1.5 }}>{lockSuccess}</Alert>
              )}
              {lockMutation.isError && (
                <Alert severity="error" sx={{ mb: 1.5, borderRadius: 1.5 }}>
                  {lockMutation.error?.response?.data?.message || 'Kilit uygulanamadı.'}
                </Alert>
              )}
              {unlockMutation.isError && (
                <Alert severity="error" sx={{ mb: 1.5, borderRadius: 1.5 }}>
                  {unlockMutation.error?.response?.data?.message || 'Kilit kaldırılamadı.'}
                </Alert>
              )}

              {isManuallyLocked ? (
                /* Kilit aktif — bilgi + kaldır butonu */
                <Stack spacing={1.5}>
                  <Box
                    sx={{
                      p: 2,
                      bgcolor: '#fff1f2',
                      borderRadius: 2,
                      border: '1px solid #fca5a5',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 1.5
                    }}
                  >
                    <LockIcon sx={{ color: '#ef4444', mt: 0.3 }} />
                    <Box>
                      <Typography variant="body2" fontWeight="bold" color="error">
                        Hesap kilitli
                      </Typography>
                      <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 0.5 }}>
                        <AccessTimeIcon sx={{ fontSize: 14, color: '#94a3b8' }} />
                        <Typography variant="caption" color="text.secondary">
                          Bitiş: {fmtDate(user.locked_until)}
                        </Typography>
                      </Stack>
                      {user.lock_reason && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                          Neden: <em>{user.lock_reason}</em>
                        </Typography>
                      )}
                    </Box>
                  </Box>
                  <Button
                    variant="outlined"
                    color="success"
                    startIcon={<LockOpenIcon />}
                    onClick={() => unlockMutation.mutate()}
                    disabled={unlockMutation.isPending}
                    sx={{ textTransform: 'none', fontWeight: 700, alignSelf: 'flex-start' }}
                  >
                    {unlockMutation.isPending ? <CircularProgress size={18} /> : 'Kilidi Kaldır'}
                  </Button>
                </Stack>
              ) : (
                /* Kilit yok — yeni kilit uygula */
                <Stack spacing={1.5}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                    <FormControl size="small" sx={{ minWidth: 160 }}>
                      <InputLabel id="lock-hours-label">Süre</InputLabel>
                      <Select
                        labelId="lock-hours-label"
                        label="Süre"
                        value={lockHours}
                        onChange={(e) => setLockHours(e.target.value)}
                      >
                        {[
                          { v: '1', l: '1 Saat' },
                          { v: '6', l: '6 Saat' },
                          { v: '24', l: '24 Saat (1 Gün)' },
                          { v: '72', l: '3 Gün' },
                          { v: '168', l: '1 Hafta' },
                          { v: '720', l: '30 Gün' }
                        ].map((o) => (
                          <MenuItem key={o.v} value={o.v}>{o.l}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <Box sx={{ flexGrow: 1 }}>
                      <input
                        placeholder="Kilit nedeni (isteğe bağlı)"
                        value={lockReason}
                        onChange={(e) => setLockReason(e.target.value)}
                        maxLength={200}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          fontSize: 14,
                          borderRadius: 8,
                          border: '1px solid #cbd5e1',
                          outline: 'none',
                          fontFamily: 'inherit'
                        }}
                      />
                    </Box>
                  </Stack>
                  <Button
                    variant="contained"
                    color="error"
                    startIcon={<LockIcon />}
                    onClick={() => lockMutation.mutate()}
                    disabled={lockMutation.isPending || userId === undefined}
                    sx={{ textTransform: 'none', fontWeight: 700, alignSelf: 'flex-start' }}
                  >
                    {lockMutation.isPending ? <CircularProgress size={18} color="inherit" /> : 'Hesabı Kilitle'}
                  </Button>
                </Stack>
              )}

              {/* Brute-force kilidini de buraya sığdır */}
              {isBruteForceLocked && (
                <Box sx={{ mt: 2 }}>
                  <Divider sx={{ mb: 1.5 }} />
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <WarningAmberIcon sx={{ color: '#f59e0b' }} />
                      <Typography variant="body2" color="text.secondary">
                        Brute-force kilidi aktif ({totalFailedAttempts} başarısız deneme)
                      </Typography>
                    </Stack>
                    <Button
                      size="small"
                      variant="outlined"
                      color="warning"
                      startIcon={<LockOpenIcon />}
                      onClick={() => resetAttemptsMutation.mutate()}
                      disabled={resetAttemptsMutation.isPending}
                      sx={{ textTransform: 'none' }}
                    >
                      Kilidi Aç
                    </Button>
                  </Stack>
                </Box>
              )}
            </Paper>

            {/* ── 3. ŞİFRE SIFIRLAMA TETİKLE ──────────────────── */}
            <Paper elevation={0} sx={{ p: 2.5, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}>
              <SectionTitle icon={<PasswordIcon />}>Şifre Sıfırlama (Admin)</SectionTitle>
              <Divider sx={{ mb: 1.5 }} />

              {pwResetSuccess && (
                <Alert severity="success" sx={{ mb: 1.5, borderRadius: 1.5 }}>{pwResetSuccess}</Alert>
              )}
              {pwResetMutation.isError && (
                <Alert severity="error" sx={{ mb: 1.5, borderRadius: 1.5 }}>
                  {pwResetMutation.error?.response?.data?.message || 'Mail gönderilemedi.'}
                </Alert>
              )}

              <Stack direction="row" alignItems="center" spacing={2}>
                <Button
                  variant="outlined"
                  startIcon={<PasswordIcon />}
                  onClick={() => pwResetMutation.mutate()}
                  disabled={!user?.email || pwResetMutation.isPending}
                  sx={{ textTransform: 'none', fontWeight: 700 }}
                >
                  {pwResetMutation.isPending
                    ? <CircularProgress size={18} />
                    : 'Şifre Sıfırlama Maili Gönder'}
                </Button>
                {!user?.email && (
                  <Typography variant="caption" color="text.secondary">
                    E-posta adresi olmayan kullanıcıya gönderilemez.
                  </Typography>
                )}
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                Kullanıcı sistemde kayıtlı e-postasına OTP kodu alacak; kodu girerek yeni şifre belirleyebilecek.
              </Typography>
            </Paper>

            {/* ── 5. ROL DEĞİŞTİRME ────────────────────────────── */}
            <Paper elevation={0} sx={{ p: 2.5, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}>
              <SectionTitle icon={<ManageAccountsIcon />}>Rol Değiştir</SectionTitle>
              <Divider sx={{ mb: 1.5 }} />

              {roleSuccess && (
                <Alert severity="success" sx={{ mb: 1.5, borderRadius: 1.5 }}>
                  {roleSuccess}
                </Alert>
              )}
              {roleMutation.isError && (
                <Alert severity="error" sx={{ mb: 1.5, borderRadius: 1.5 }}>
                  {roleMutation.error?.response?.data?.message || 'Rol değiştirilemedi.'}
                </Alert>
              )}

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', sm: 'center' }}>
                <FormControl size="small" sx={{ minWidth: 200 }}>
                  <InputLabel id="role-select-label">Yeni Rol</InputLabel>
                  <Select
                    labelId="role-select-label"
                    label="Yeni Rol"
                    value={pendingRole}
                    onChange={(e) => setPendingRole(e.target.value)}
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <MenuItem
                        key={r.value}
                        value={r.value}
                        disabled={r.value === user.role}
                      >
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Chip size="small" label={r.label} color={r.color} />
                          {r.value === user.role && (
                            <Typography variant="caption" color="text.secondary">(mevcut)</Typography>
                          )}
                        </Stack>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <Button
                  variant="contained"
                  disabled={!pendingRole || pendingRole === user.role || roleMutation.isPending}
                  onClick={() => setConfirmOpen(true)}
                  startIcon={<ManageAccountsIcon />}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 700,
                    bgcolor: '#4f46e5',
                    '&:hover': { bgcolor: '#4338ca' }
                  }}
                >
                  {roleMutation.isPending ? <CircularProgress size={20} color="inherit" /> : 'Rolü Güncelle'}
                </Button>
              </Stack>

              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
                ⚠️ Bir kullanıcıya Admin yetkisi vermek tüm yönetim fonksiyonlarına erişim sağlar.
                Kendi rolünüzü değiştiremezsiniz.
              </Typography>
            </Paper>

            {/* ── 6. OTURUM & GİRİŞ ─────────────────────────────── */}
            <Paper elevation={0} sx={{ p: 2.5, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}>
              <SectionTitle icon={<DevicesIcon />}>Oturum Bilgisi</SectionTitle>
              <Divider sx={{ mb: 1.5 }} />
              <InfoRow label="Son Giriş" value={fmtDate(lastSession?.created_at) ?? 'Henüz giriş yapılmadı'} />
              <InfoRow label="Son Oturum Sonu" value={fmtDate(lastSession?.expires_at)} />
              <InfoRow
                label="Aktif Oturum"
                value={
                  <Stack direction="row" alignItems="center" spacing={0.5}>
                    <Box
                      sx={{
                        width: 8, height: 8, borderRadius: '50%',
                        bgcolor: activeSessionCount > 0 ? '#10b981' : '#94a3b8'
                      }}
                    />
                    <span>{activeSessionCount} aktif oturum</span>
                  </Stack>
                }
              />
            </Paper>

            {/* ── 7. YÜZ TANIMI DURUMU ──────────────────────────── */}
            <Paper elevation={0} sx={{ p: 2.5, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}>
              <SectionTitle icon={<FaceIcon />}>Yüz Tanıma Profili</SectionTitle>
              <Divider sx={{ mb: 1.5 }} />
              <Stack direction="row" alignItems="center" spacing={1.5}>
                {faceProfile ? (
                  <>
                    <CheckCircleOutlineIcon sx={{ color: '#10b981', fontSize: 28 }} />
                    <Box>
                      <Typography variant="body2" fontWeight="bold" color="success.main">
                        Yüz profili kayıtlı (şifrelenmiş)
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Oluşturulma: {fmtDate(faceProfile.created_at)} — Son güncelleme: {fmtDate(faceProfile.updated_at)}
                      </Typography>
                    </Box>
                  </>
                ) : (
                  <>
                    <WarningAmberIcon sx={{ color: '#f59e0b', fontSize: 28 }} />
                    <Typography variant="body2" color="text.secondary">
                      Yüz profili henüz kaydedilmedi.
                    </Typography>
                  </>
                )}
              </Stack>
            </Paper>

            {/* ── 8. BAŞARISIZ GİRİŞ DENEMELERİ ───────────────── */}
            <Paper elevation={0} sx={{ p: 2.5, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}>
              <SectionTitle icon={<LockIcon />}>Başarısız Giriş Denemeleri</SectionTitle>
              <Divider sx={{ mb: 1.5 }} />
              {authAttempts.length === 0 ? (
                <Stack direction="row" alignItems="center" spacing={1}>
                  <VerifiedUserIcon sx={{ color: '#10b981' }} />
                  <Typography variant="body2" color="text.secondary">
                    Başarısız giriş denemesi kaydı yok.
                  </Typography>
                </Stack>
              ) : (
                <>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                    <Chip
                      size="small"
                      label={`Toplam ${totalFailedAttempts} başarısız deneme`}
                      color={isLocked ? 'error' : totalFailedAttempts > 3 ? 'warning' : 'default'}
                    />
                    {isLocked && (
                      <Chip size="small" label="Hesap kilitli" color="error" icon={<LockIcon />} />
                    )}
                  </Stack>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell><strong>Tür</strong></TableCell>
                          <TableCell align="center"><strong>Deneme</strong></TableCell>
                          <TableCell><strong>Son Deneme</strong></TableCell>
                          <TableCell><strong>Kilitli Bitiş</strong></TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {authAttempts.map((a) => {
                          const locked = a.locked_until && new Date(a.locked_until) > new Date();
                          return (
                            <TableRow key={a.kind} sx={{ bgcolor: locked ? '#fff1f2' : 'transparent' }}>
                              <TableCell>{kindLabel(a.kind)}</TableCell>
                              <TableCell align="center">
                                <Chip
                                  size="small"
                                  label={a.attempt_count}
                                  color={a.attempt_count >= 5 ? 'error' : a.attempt_count >= 3 ? 'warning' : 'default'}
                                />
                              </TableCell>
                              <TableCell sx={{ fontSize: 12 }}>{fmtDate(a.last_attempt_at) ?? '—'}</TableCell>
                              <TableCell sx={{ fontSize: 12 }}>
                                {locked
                                  ? <Chip size="small" label={fmtDate(a.locked_until)} color="error" />
                                  : <span style={{ color: '#94a3b8' }}>—</span>}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </>
              )}
            </Paper>

            {/* ── 9. OY GEÇMİŞİ ────────────────────────────────── */}
            <Paper elevation={0} sx={{ p: 2.5, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}>
              <SectionTitle icon={<HowToVoteIcon />}>
                Oy Geçmişi
                <Chip size="small" label={`${voteCount} seçim`} sx={{ ml: 1 }} />
              </SectionTitle>
              <Divider sx={{ mb: 1.5 }} />
              {voteHistory.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Bu kullanıcı henüz hiçbir seçimde oy kullanmadı.
                </Typography>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell><strong>Seçim</strong></TableCell>
                        <TableCell><strong>Oy Verilen Aday</strong></TableCell>
                        <TableCell><strong>Tarih</strong></TableCell>
                        <TableCell align="center"><strong>TX</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {voteHistory.map((v, i) => {
                        const txUrl = EXPLORER_BASE_URL ? explorerTxUrl(v.transaction_hash) : null;
                        return (
                          <TableRow key={i} hover>
                            <TableCell>
                              <Typography variant="body2" fontWeight="medium" noWrap sx={{ maxWidth: 180 }} title={v.election_title}>
                                {v.election_title || `Seçim #${v.election_id}`}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" noWrap sx={{ maxWidth: 140 }} title={v.candidate_name}>
                                {v.candidate_name ?? <em style={{ color: '#94a3b8' }}>Gizli (anonim)</em>}
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                              {fmtDate(v.voted_at) ?? '—'}
                            </TableCell>
                            <TableCell align="center">
                              {txUrl ? (
                                <Tooltip title={v.transaction_hash}>
                                  <IconButton
                                    size="small"
                                    href={txUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    component="a"
                                  >
                                    <OpenInNewIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              ) : (
                                <Tooltip title={v.transaction_hash ?? 'TX hash yok'}>
                                  <Typography
                                    variant="caption"
                                    fontFamily="monospace"
                                    sx={{ color: '#64748b' }}
                                  >
                                    {v.transaction_hash
                                      ? `${v.transaction_hash.slice(0, 8)}…`
                                      : '—'}
                                  </Typography>
                                </Tooltip>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Paper>
          </Stack>
        )}
      </DialogContent>

      {/* ── ONAY DIALOG ──────────────────────────────────── */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold' }}>Rolü Değiştir</DialogTitle>
        <DialogContent>
          <DialogContentText>
            <strong>{user?.name}</strong> kullanıcısının rolünü{' '}
            <Chip
              size="small"
              label={ROLE_OPTIONS.find(r => r.value === user?.role)?.label || user?.role}
              color={ROLE_OPTIONS.find(r => r.value === user?.role)?.color || 'default'}
            />
            {' → '}
            <Chip
              size="small"
              label={ROLE_OPTIONS.find(r => r.value === pendingRole)?.label || pendingRole}
              color={ROLE_OPTIONS.find(r => r.value === pendingRole)?.color || 'default'}
            />
            {' '}olarak değiştirmek istediğinize emin misiniz?
          </DialogContentText>
          {pendingRole === 'admin' && (
            <Alert severity="warning" sx={{ mt: 2, borderRadius: 1.5 }}>
              Admin rolü tüm yönetim yetkilerini verir. Dikkatli olun.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)} sx={{ textTransform: 'none' }}>
            İptal
          </Button>
          <Button
            variant="contained"
            color={pendingRole === 'admin' ? 'error' : 'primary'}
            onClick={() => roleMutation.mutate(pendingRole)}
            disabled={roleMutation.isPending}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            {roleMutation.isPending
              ? <CircularProgress size={18} color="inherit" />
              : 'Onayla'}
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
}

export default UserDetailModal;
