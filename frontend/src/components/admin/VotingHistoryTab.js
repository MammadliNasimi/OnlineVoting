import React, { useState } from 'react';
import useAdminHeaders from '../../hooks/useAdminHeaders';
import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Pagination,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import HowToVoteIcon from '@mui/icons-material/HowToVote';
import RefreshIcon from '@mui/icons-material/Refresh';
import { API_BASE, explorerTxUrl, EXPLORER_BASE_URL } from '../../config';

function fmtDate(str) {
  if (!str) return '—';
  return new Date(str).toLocaleString('tr-TR', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function VotingHistoryTab({ sessionId }) {
  const authHeaders = useAdminHeaders(sessionId);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [selectedElectionId, setSelectedElectionId] = useState('');

  const { data: elections = [] } = useQuery({
    queryKey: ['archive_elections'],
    queryFn: async () => {
      const d = (await axios.get(`${API_BASE}/admin/elections`, authHeaders)).data;
      return Array.isArray(d) ? d : [];
    }
  });

  const queryKey = ['admin_votes', page, search, selectedElectionId];
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams({ page, limit: 30 });
      if (search) params.set('search', search);
      if (selectedElectionId) params.set('electionId', selectedElectionId);
      return (await axios.get(`${API_BASE}/admin/votes?${params}`, authHeaders)).data;
    },
    keepPreviousData: true
  });

  const rows = data?.rows || [];
  const total = data?.total || 0;
  const pages = data?.pages || 1;

  const handleSearch = () => {
    setPage(1);
    setSearch(searchInput);
  };

  return (
    <Box>
      <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ xs: 'flex-start', md: 'center' }} justifyContent="space-between" spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Stack direction="row" alignItems="center" spacing={1}>
            <HowToVoteIcon color="primary" />
            <Typography variant="h5" fontWeight="bold">Geçmiş Oylar</Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            Tüm seçimlerde kullanılan oyların detaylı kaydı.
            {total > 0 && <Chip size="small" label={`${total} toplam kayıt`} sx={{ ml: 1 }} />}
          </Typography>
        </Box>
        <IconButton onClick={() => refetch()} disabled={isFetching} size="small">
          <RefreshIcon sx={{ animation: isFetching ? 'spin 1s linear infinite' : 'none' }} />
        </IconButton>
      </Stack>

      {/* Filtreler */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2.5 }}>
        <TextField
          size="small"
          placeholder="Kullanıcı adı, e-posta, seçim, aday..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          sx={{ minWidth: 280 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            )
          }}
        />
        <FormControl size="small" sx={{ minWidth: 240 }}>
          <InputLabel id="vote-election-filter">Seçim Filtresi</InputLabel>
          <Select
            labelId="vote-election-filter"
            label="Seçim Filtresi"
            value={selectedElectionId}
            onChange={(e) => { setSelectedElectionId(e.target.value); setPage(1); }}
          >
            <MenuItem value="">Tüm Seçimler</MenuItem>
            {elections.map((e) => (
              <MenuItem key={e.id} value={e.id}>{e.title}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
          Veriler yüklenemedi: {error.message}
        </Alert>
      )}

      <TableContainer component={Paper} elevation={3} sx={{ borderRadius: 3 }}>
        <Table size="small">
          <TableHead sx={{ bgcolor: 'grey.100' }}>
            <TableRow>
              <TableCell><strong>Kullanıcı</strong></TableCell>
              <TableCell><strong>E-Posta</strong></TableCell>
              <TableCell><strong>Seçim</strong></TableCell>
              <TableCell><strong>Aday</strong></TableCell>
              <TableCell><strong>Oy Tarihi</strong></TableCell>
              <TableCell align="center"><strong>TX</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                  <CircularProgress size={28} />
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  {search || selectedElectionId ? 'Filtreyle eşleşen oy kaydı bulunamadı.' : 'Henüz hiçbir oy kullanılmadı.'}
                </TableCell>
              </TableRow>
            ) : rows.map((row, i) => {
              const txUrl = EXPLORER_BASE_URL ? explorerTxUrl(row.transaction_hash) : null;
              return (
                <TableRow key={i} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {row.user_name || <em style={{ color: '#94a3b8' }}>Silinmiş</em>}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ fontSize: 12, color: '#64748b' }}>{row.user_email || '—'}</TableCell>
                  <TableCell>
                    <Typography
                      variant="body2"
                      noWrap
                      sx={{ maxWidth: 200 }}
                      title={row.election_title}
                    >
                      {row.election_title || `#${row.election_id}`}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" noWrap sx={{ maxWidth: 160 }} title={row.candidate_name}>
                      {row.candidate_name || <em style={{ color: '#94a3b8' }}>Anonim</em>}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                    {fmtDate(row.voted_at)}
                  </TableCell>
                  <TableCell align="center">
                    {txUrl ? (
                      <Tooltip title={row.transaction_hash}>
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
                      <Tooltip title={row.transaction_hash || 'TX yok'}>
                        <Typography
                          variant="caption"
                          fontFamily="monospace"
                          sx={{ color: '#64748b', cursor: 'default' }}
                        >
                          {row.transaction_hash
                            ? `${row.transaction_hash.slice(0, 8)}…`
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

      {pages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Pagination
            count={pages}
            page={page}
            onChange={(_, v) => setPage(v)}
            color="primary"
            shape="rounded"
          />
        </Box>
      )}
    </Box>
  );
}

export default VotingHistoryTab;
