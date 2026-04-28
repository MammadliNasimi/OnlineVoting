import React, { useMemo, useState } from 'react';
import axios from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import useAdminHeaders from '../../hooks/useAdminHeaders';
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import SecurityIcon from '@mui/icons-material/Security';
import ShieldIcon from '@mui/icons-material/Shield';
import { API_BASE } from '../../config';

function fmtDate(str) {
  if (!str) return '—';
  return new Date(str).toLocaleString('tr-TR', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
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
// Brute Force Attempts Table
// --------------------------------------------------------------------------
function BruteForceTable({ sessionId }) {
  const queryClient = useQueryClient();
  const authHeaders = useAdminHeaders(sessionId);
  const [search, setSearch] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const { data: attempts = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['all_auth_attempts'],
    queryFn: async () => (await axios.get(`${API_BASE}/admin/auth-attempts`, authHeaders)).data,
    refetchInterval: 30000
  });

  const resetMutation = useMutation({
    mutationFn: (userId) =>
      axios.delete(`${API_BASE}/admin/auth-attempts/user/${userId}`, authHeaders),
    onSuccess: (_, userId) => {
      setSuccessMsg(`Kullanıcı #${userId} deneme kayıtları temizlendi.`);
      queryClient.invalidateQueries({ queryKey: ['all_auth_attempts'] });
      setTimeout(() => setSuccessMsg(''), 3000);
    }
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return attempts;
    return attempts.filter(
      (a) =>
        (a.identifier || '').toLowerCase().includes(term) ||
        (a.user_name || '').toLowerCase().includes(term) ||
        (a.user_email || '').toLowerCase().includes(term) ||
        kindLabel(a.kind).toLowerCase().includes(term)
    );
  }, [attempts, search]);

  const lockedCount = attempts.filter(
    (a) => a.locked_until && new Date(a.locked_until) > new Date()
  ).length;

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <ShieldIcon color="warning" />
          <Box>
            <Typography variant="h6" fontWeight="bold">Brute-Force Kilitleri</Typography>
            <Typography variant="caption" color="text.secondary">
              Başarısız giriş denemeleri ve otomatik kilitler. Toplam {attempts.length} kayıt
              {lockedCount > 0 && (
                <Chip size="small" label={`${lockedCount} aktif kilit`} color="error" sx={{ ml: 1 }} />
              )}
            </Typography>
          </Box>
        </Stack>
        <IconButton onClick={() => refetch()} disabled={isFetching} size="small">
          <RefreshIcon sx={{ animation: isFetching ? 'spin 1s linear infinite' : 'none' }} />
        </IconButton>
      </Stack>

      {successMsg && (
        <Alert severity="success" sx={{ mb: 2, borderRadius: 1.5 }}>{successMsg}</Alert>
      )}

      <TextField
        size="small"
        fullWidth
        placeholder="Identifier, kullanıcı adı veya işlem türü ara..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        sx={{ mb: 2 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          )
        }}
      />

      <TableContainer component={Paper} elevation={2} sx={{ borderRadius: 2 }}>
        <Table size="small">
          <TableHead sx={{ bgcolor: 'grey.100' }}>
            <TableRow>
              <TableCell><strong>Identifier</strong></TableCell>
              <TableCell><strong>Kullanıcı</strong></TableCell>
              <TableCell><strong>İşlem Türü</strong></TableCell>
              <TableCell align="center"><strong>Deneme</strong></TableCell>
              <TableCell><strong>Son Deneme</strong></TableCell>
              <TableCell><strong>Kilit Bitiş</strong></TableCell>
              <TableCell align="center"><strong>İşlem</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} align="center"><CircularProgress size={24} /></TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                  {search ? 'Aramayla eşleşen kayıt yok.' : 'Brute-force kaydı bulunmuyor.'}
                </TableCell>
              </TableRow>
            ) : filtered.map((a) => {
              const locked = a.locked_until && new Date(a.locked_until) > new Date();
              return (
                <TableRow
                  key={`${a.identifier}-${a.kind}`}
                  sx={{ bgcolor: locked ? '#fff8f0' : 'transparent' }}
                  hover
                >
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{a.identifier}</TableCell>
                  <TableCell>
                    {a.user_name ? (
                      <Box>
                        <Typography variant="body2" fontWeight="medium">{a.user_name}</Typography>
                        <Typography variant="caption" color="text.secondary">{a.user_email || ''}</Typography>
                      </Box>
                    ) : (
                      <Typography variant="caption" color="text.secondary">Bilinmiyor</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip size="small" label={kindLabel(a.kind)} />
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      size="small"
                      label={a.attempt_count}
                      color={a.attempt_count >= 5 ? 'error' : a.attempt_count >= 3 ? 'warning' : 'default'}
                    />
                  </TableCell>
                  <TableCell sx={{ fontSize: 12 }}>{fmtDate(a.last_attempt_at)}</TableCell>
                  <TableCell>
                    {locked ? (
                      <Chip
                        size="small"
                        label={fmtDate(a.locked_until)}
                        color="error"
                        sx={{ fontSize: 11 }}
                      />
                    ) : (
                      <Typography variant="caption" color="text.secondary">—</Typography>
                    )}
                  </TableCell>
                  <TableCell align="center">
                    {a.user_id && (
                      <Tooltip title="Deneme kayıtlarını sil ve kilidi aç">
                        <span>
                          <IconButton
                            size="small"
                            color="success"
                            onClick={() => resetMutation.mutate(a.user_id)}
                            disabled={resetMutation.isPending}
                          >
                            <LockOpenIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {lockedCount > 0 && (
        <Alert severity="warning" sx={{ mt: 2, borderRadius: 2 }}>
          <strong>{lockedCount} aktif kilit</strong> var. Kilidi açmak için satır sonundaki
          <LockOpenIcon sx={{ fontSize: 14, mx: 0.5, verticalAlign: 'middle' }} />
          simgesine tıklayın.
        </Alert>
      )}
    </Box>
  );
}

// --------------------------------------------------------------------------
// Log Table (mevcut güvenlik logları)
// --------------------------------------------------------------------------
function LogTable({ securityLogs, loadingLogs }) {
  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
        <SecurityIcon color="primary" />
        <Box>
          <Typography variant="h6" fontWeight="bold">Sistem Logları</Typography>
          <Typography variant="caption" color="text.secondary">
            Son 100 log kaydı. Her 5 sn otomatik güncellenir.
          </Typography>
        </Box>
      </Stack>

      <TableContainer
        component={Paper}
        elevation={2}
        sx={{ borderRadius: 2, maxHeight: 560, overflowY: 'auto' }}
      >
        <Table stickyHeader size="small">
          <TableHead sx={{ bgcolor: 'grey.100' }}>
            <TableRow>
              <TableCell><strong>Zaman</strong></TableCell>
              <TableCell><strong>Seviye</strong></TableCell>
              <TableCell><strong>Servis</strong></TableCell>
              <TableCell><strong>Mesaj</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loadingLogs ? (
              <TableRow>
                <TableCell colSpan={4} align="center"><CircularProgress size={24} /></TableCell>
              </TableRow>
            ) : securityLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                  Kayıtlı log bulunamadı.
                </TableCell>
              </TableRow>
            ) : securityLogs.map((log, i) => (
              <TableRow key={i} hover>
                <TableCell sx={{ whiteSpace: 'nowrap', fontSize: 12 }}>{log.timestamp || '—'}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={log.level || '?'}
                    color={log.level === 'error' ? 'error' : log.level === 'warn' ? 'warning' : 'info'}
                  />
                </TableCell>
                <TableCell sx={{ fontSize: 12 }}>{log.service || '—'}</TableCell>
                <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{log.message}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

// --------------------------------------------------------------------------
// SecurityTab — iki alt sekme
// --------------------------------------------------------------------------
function SecurityTab({ sessionId, securityLogs, loadingLogs }) {
  const [subTab, setSubTab] = useState(0);

  return (
    <Box>
      <Typography variant="h5" fontWeight="bold" sx={{ mb: 2 }}>Güvenlik Merkezi</Typography>

      <Paper elevation={0} sx={{ borderRadius: 2, border: '1px solid #e2e8f0', mb: 3 }}>
        <Tabs
          value={subTab}
          onChange={(_, v) => setSubTab(v)}
          sx={{
            px: 2,
            '& .MuiTab-root': { textTransform: 'none', fontWeight: 700, minHeight: 48 }
          }}
        >
          <Tab label="🛡️ Brute-Force Kilitleri" />
          <Tab label="📋 Sistem Logları" />
        </Tabs>
        <Divider />
        <Box sx={{ p: 3 }}>
          {subTab === 0 && <BruteForceTable sessionId={sessionId} />}
          {subTab === 1 && <LogTable securityLogs={securityLogs} loadingLogs={loadingLogs} />}
        </Box>
      </Paper>
    </Box>
  );
}

export default SecurityTab;
