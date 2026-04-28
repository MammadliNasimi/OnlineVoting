import React, { useMemo, useState } from 'react';
import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import useAdminHeaders from '../../hooks/useAdminHeaders';
import {
  Alert,
  Box,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  InputAdornment,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography
} from '@mui/material';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import SearchIcon from '@mui/icons-material/Search';
import HistoryIcon from '@mui/icons-material/History';
import { API_BASE } from '../../config';
import ElectionResultsView from './ElectionResultsView';

// "active" | "ended" | "all"
function classify(election) {
  if (election.ended_permanently === 1) return 'ended';
  const now = Date.now();
  const start = new Date(election.start_date).getTime();
  const end = new Date(election.end_date).getTime();
  if (election.is_active === 1 && now >= start && now <= end) return 'active';
  if (now > end || election.is_active === 0) return 'ended';
  return 'upcoming';
}

function ElectionCard({ election, onClick }) {
  const cls = classify(election);
  const totalVotes = (election.candidates || []).reduce((s, c) => s + (c.vote_count || 0), 0);
  const leader = (election.candidates || [])
    .slice()
    .sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0))[0];

  const stateColor =
    cls === 'active' ? 'success' :
    cls === 'upcoming' ? 'info' :
    'default';
  const stateLabel =
    cls === 'active' ? 'Aktif' :
    cls === 'upcoming' ? 'Yaklaşıyor' :
    'Sonlandı';

  return (
    <Card elevation={3} sx={{ borderRadius: 3, height: '100%', transition: 'transform 0.15s', '&:hover': { transform: 'translateY(-2px)' } }}>
      <CardActionArea onClick={onClick} sx={{ height: '100%' }}>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography
                variant="h6"
                fontWeight="bold"
                noWrap
                sx={{ pr: 1 }}
                title={election.title}
              >
                {election.title}
              </Typography>
              {election.description && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{
                    mt: 0.5,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical'
                  }}
                >
                  {election.description}
                </Typography>
              )}
            </Box>
            <Chip size="small" label={stateLabel} color={stateColor} />
          </Stack>

          <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
            <Box>
              <Typography variant="caption" color="text.secondary">TOPLAM OY</Typography>
              <Typography variant="h6" fontWeight="bold">{totalVotes}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">ADAY SAYISI</Typography>
              <Typography variant="h6" fontWeight="bold">{(election.candidates || []).length}</Typography>
            </Box>
            {cls === 'ended' && leader && totalVotes > 0 && (
              <Box sx={{ ml: 'auto' }}>
                <Typography variant="caption" color="text.secondary">LİDER</Typography>
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <EmojiEventsIcon sx={{ fontSize: 18, color: '#f59e0b' }} />
                  <Typography variant="body2" fontWeight="bold" noWrap sx={{ maxWidth: 110 }} title={leader.name}>
                    {leader.name}
                  </Typography>
                </Stack>
              </Box>
            )}
          </Stack>

          <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
            {new Date(election.start_date).toLocaleDateString('tr-TR')}
            {' → '}
            {new Date(election.end_date).toLocaleDateString('tr-TR')}
          </Typography>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

function ResultsArchiveTab({ sessionId }) {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  const authHeaders = useAdminHeaders(sessionId);

  const { data: elections = [], isLoading } = useQuery({
    queryKey: ['archive_elections'],
    queryFn: async () => {
      const data = (await axios.get(`${API_BASE}/admin/elections`, authHeaders)).data;
      return Array.isArray(data) ? data : [];
    },
    refetchInterval: 30000
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return elections.filter((e) => {
      if (filter !== 'all' && classify(e) !== filter) return false;
      if (!term) return true;
      return (
        e.title.toLowerCase().includes(term) ||
        (e.description || '').toLowerCase().includes(term)
      );
    });
  }, [elections, filter, search]);

  const counts = useMemo(() => {
    const c = { active: 0, ended: 0, upcoming: 0, all: elections.length };
    elections.forEach((e) => {
      const cls = classify(e);
      if (cls === 'active') c.active += 1;
      else if (cls === 'ended') c.ended += 1;
      else if (cls === 'upcoming') c.upcoming += 1;
    });
    return c;
  }, [elections]);

  if (selectedId) {
    return (
      <ElectionResultsView
        electionId={selectedId}
        sessionId={sessionId}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  return (
    <Box>
      <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ xs: 'flex-start', md: 'center' }} justifyContent="space-between" spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Stack direction="row" alignItems="center" spacing={1}>
            <HistoryIcon color="primary" />
            <Typography variant="h5" fontWeight="bold">Sonuçlar & Arşiv</Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            Tüm seçimleri ve detaylı sonuçlarını buradan görüntüleyebilirsiniz.
          </Typography>
        </Box>

        <Stack direction="row" spacing={1.5} alignItems="center">
          <TextField
            size="small"
            placeholder="Seçim ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              )
            }}
            sx={{ minWidth: 240 }}
          />

          <ToggleButtonGroup
            size="small"
            value={filter}
            exclusive
            onChange={(_, v) => v && setFilter(v)}
          >
            <ToggleButton value="all">Tümü ({counts.all})</ToggleButton>
            <ToggleButton value="active">Aktif ({counts.active})</ToggleButton>
            <ToggleButton value="upcoming">Yaklaşan ({counts.upcoming})</ToggleButton>
            <ToggleButton value="ended">Sonlanan ({counts.ended})</ToggleButton>
          </ToggleButtonGroup>
        </Stack>
      </Stack>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : filtered.length === 0 ? (
        <Alert severity="info" sx={{ borderRadius: 2 }}>
          {search ? 'Aramayla eşleşen seçim bulunamadı.' : 'Bu kategoride seçim yok.'}
        </Alert>
      ) : (
        <Grid container spacing={3}>
          {filtered.map((e) => (
            <Grid item xs={12} sm={6} md={4} key={e.id}>
              <ElectionCard
                election={e}
                onClick={() => setSelectedId(e.id)}
              />
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}

export default ResultsArchiveTab;
