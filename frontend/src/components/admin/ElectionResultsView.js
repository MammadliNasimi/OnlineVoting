import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import useAdminHeaders from '../../hooks/useAdminHeaders';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  LinearProgress,
  Paper,
  Stack,
  Tooltip,
  Typography
} from '@mui/material';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis
} from 'recharts';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import VerifiedIcon from '@mui/icons-material/Verified';
import HowToVoteIcon from '@mui/icons-material/HowToVote';
import ScheduleIcon from '@mui/icons-material/Schedule';
import GroupIcon from '@mui/icons-material/Group';
import { API_BASE, explorerContractUrl, explorerTxUrl, EXPLORER_BASE_URL } from '../../config';

const BAR_COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6', '#ec4899', '#22c55e'];

function fmt(v) {
  if (v === null || v === undefined) return '-';
  return v;
}

function StatusChip({ election }) {
  if (!election) return null;
  if (election.ended_permanently === 1) {
    return <Chip size="small" label="Sonlandı" color="default" />;
  }
  if (election.is_active === 1) {
    const now = Date.now();
    const start = new Date(election.start_date).getTime();
    const end = new Date(election.end_date).getTime();
    if (now < start) return <Chip size="small" label="Yakında Başlayacak" color="info" />;
    if (now > end) return <Chip size="small" label="Süresi Doldu" color="warning" />;
    return <Chip size="small" label="Aktif" color="success" />;
  }
  return <Chip size="small" label="Pasif" color="default" />;
}

function ElectionResultsView({ electionId, sessionId, onBack }) {
  const authHeaders = useAdminHeaders(sessionId);
  const [showFireworks, setShowFireworks] = useState(false);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['election_analytics', electionId],
    queryFn: async () =>
      (await axios.get(`${API_BASE}/admin/analytics/elections/${electionId}`, authHeaders)).data,
    enabled: !!electionId,
    refetchInterval: 30000
  });

  // Kazanan animasyonu — ilk yüklemede 1 sn'lik vurgulama efekti.
  useEffect(() => {
    if (data?.winner) {
      setShowFireworks(true);
      const t = setTimeout(() => setShowFireworks(false), 2600);
      return () => clearTimeout(t);
    }
  }, [data?.winner?.candidate_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const election = data?.election;
  const results = data?.results || [];
  const winner = data?.winner;
  const totalVotes = data?.totalVotes || 0;
  const turnout = data?.turnout;
  const hourly = data?.hourlyDistribution || [];

  // Bar chart için recharts'a uygun format.
  const barData = results.map((r) => ({
    name: r.candidate_name,
    votes: r.vote_count,
    pct: r.percentage
  }));

  // Saatlik akış için bucket'ları frontend'de label'la dönüştür.
  const hourlySeries = hourly.map((h) => {
    const d = new Date(h.hour_bucket);
    return {
      hour: h.hour_bucket,
      label: `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:00`,
      votes: h.vote_count
    };
  });

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 320 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ borderRadius: 2 }}>
        Sonuçlar yüklenemedi: {error.message}
      </Alert>
    );
  }

  if (!election) {
    return <Alert severity="warning">Seçim bulunamadı.</Alert>;
  }

  return (
    <Box>
      {/* Üst Bar */}
      <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ xs: 'flex-start', md: 'center' }} justifyContent="space-between" spacing={2} sx={{ mb: 3 }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          {onBack && (
            <IconButton onClick={onBack} size="small">
              <ArrowBackIcon />
            </IconButton>
          )}
          <Box>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="h5" fontWeight="bold">{election.title}</Typography>
              <StatusChip election={election} />
              {isFetching && <LinearProgress sx={{ width: 60, ml: 1 }} />}
            </Stack>
            {election.description && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {election.description}
              </Typography>
            )}
          </Box>
        </Stack>

        <Stack direction="row" spacing={1}>
          {EXPLORER_BASE_URL && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<VerifiedIcon />}
              endIcon={<OpenInNewIcon fontSize="small" />}
              href={explorerContractUrl()}
              target="_blank"
              rel="noopener noreferrer"
            >
              Sözleşmeyi Doğrula
            </Button>
          )}
          <Button size="small" onClick={() => refetch()}>Yenile</Button>
        </Stack>
      </Stack>

      {/* KAZANAN İLAN PANELİ */}
      {totalVotes > 0 && winner && (
        <Card
          elevation={6}
          sx={{
            mb: 3,
            borderRadius: 3,
            background: 'linear-gradient(135deg, #fde68a 0%, #fbbf24 50%, #f59e0b 100%)',
            color: '#451a03',
            position: 'relative',
            overflow: 'hidden',
            transform: showFireworks ? 'scale(1.01)' : 'scale(1)',
            transition: 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)'
          }}
        >
          <CardContent>
            <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={2}>
              <Box
                sx={{
                  width: 72,
                  height: 72,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: 'rgba(255,255,255,0.5)',
                  color: '#92400e',
                  flexShrink: 0,
                  animation: showFireworks ? 'pulseGlow 1.6s ease-out' : 'none',
                  '@keyframes pulseGlow': {
                    '0%': { boxShadow: '0 0 0 0 rgba(255,255,255,0.9)' },
                    '70%': { boxShadow: '0 0 0 24px rgba(255,255,255,0)' },
                    '100%': { boxShadow: '0 0 0 0 rgba(255,255,255,0)' }
                  }
                }}
              >
                <EmojiEventsIcon sx={{ fontSize: 44 }} />
              </Box>
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="overline" sx={{ fontWeight: 800, letterSpacing: 2, opacity: 0.7 }}>
                  KAZANAN ADAY
                </Typography>
                <Typography variant="h4" fontWeight="900" sx={{ lineHeight: 1.1 }}>
                  {winner.candidate_name}
                </Typography>
                <Typography variant="body1" sx={{ mt: 0.5, opacity: 0.85 }}>
                  {winner.vote_count} oy aldı — toplam oyların <strong>%{winner.percentage}</strong>'ı
                </Typography>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      )}

      {totalVotes === 0 && (
        <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
          Bu seçim için henüz oy kullanılmadı. Veriler oy verildikçe otomatik güncellenir.
        </Alert>
      )}

      {/* ÖZET KARTLARI */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }}>
        <Paper elevation={2} sx={{ p: 2, flex: 1, borderRadius: 2, borderLeft: '4px solid #4f46e5' }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <HowToVoteIcon color="primary" />
            <Box>
              <Typography variant="caption" color="text.secondary">TOPLAM OY</Typography>
              <Typography variant="h5" fontWeight="bold">{totalVotes}</Typography>
            </Box>
          </Stack>
        </Paper>
        <Paper elevation={2} sx={{ p: 2, flex: 1, borderRadius: 2, borderLeft: '4px solid #10b981' }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <GroupIcon sx={{ color: '#10b981' }} />
            <Box>
              <Typography variant="caption" color="text.secondary">UYGUN SEÇMEN</Typography>
              <Typography variant="h5" fontWeight="bold">{turnout?.eligibleVoters ?? '-'}</Typography>
            </Box>
          </Stack>
        </Paper>
        <Paper elevation={2} sx={{ p: 2, flex: 1, borderRadius: 2, borderLeft: '4px solid #f59e0b' }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Box sx={{ color: '#f59e0b', fontSize: 28, fontWeight: 'bold' }}>%</Box>
            <Box>
              <Typography variant="caption" color="text.secondary">KATILIM</Typography>
              <Typography variant="h5" fontWeight="bold">%{turnout?.turnoutPct ?? 0}</Typography>
            </Box>
          </Stack>
        </Paper>
        <Paper elevation={2} sx={{ p: 2, flex: 1, borderRadius: 2, borderLeft: '4px solid #06b6d4' }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <ScheduleIcon sx={{ color: '#06b6d4' }} />
            <Box>
              <Typography variant="caption" color="text.secondary">BİTİŞ</Typography>
              <Typography variant="body1" fontWeight="bold">
                {new Date(election.end_date).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </Typography>
            </Box>
          </Stack>
        </Paper>
      </Stack>

      {/* OY YÜZDELERİ — ANIMASYONLU BAR CHART */}
      <Paper elevation={3} sx={{ p: 3, borderRadius: 3, mb: 3 }}>
        <Typography variant="h6" fontWeight="bold" sx={{ mb: 0.5 }}>
          Oy Dağılımı
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
          Adayların aldığı oy ve yüzdelik karşılaştırması.
        </Typography>

        {barData.length === 0 ? (
          <Box sx={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography color="text.secondary">Aday yok.</Typography>
          </Box>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(280, barData.length * 60)}>
            <BarChart
              data={barData}
              layout="vertical"
              margin={{ top: 10, right: 60, left: 20, bottom: 10 }}
              barCategoryGap="25%"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" tick={{ fontSize: 11 }} domain={[0, 'dataMax + 1']} />
              <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 12 }} />
              <RTooltip
                formatter={(value, key, ctx) => {
                  if (key === 'votes') return [`${value} oy (%${ctx.payload.pct})`, 'Oy'];
                  return [value, key];
                }}
              />
              <Bar
                dataKey="votes"
                isAnimationActive
                animationDuration={1200}
                animationEasing="ease-out"
                radius={[0, 8, 8, 0]}
              >
                {barData.map((d, i) => (
                  <Cell
                    key={i}
                    fill={winner && d.name === winner.candidate_name ? '#f59e0b' : BAR_COLORS[i % BAR_COLORS.length]}
                  />
                ))}
                <LabelList
                  dataKey="votes"
                  position="right"
                  formatter={(v) => `${v}`}
                  style={{ fontWeight: 700, fill: '#1e293b' }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}

        {/* Aday Tablosu (alt detay) */}
        <Divider sx={{ my: 2 }} />
        <Stack spacing={1.2}>
          {results.map((r, i) => {
            const isWinner = winner && r.candidate_id === winner.candidate_id && totalVotes > 0;
            return (
              <Box key={r.candidate_id} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ width: 24, color: 'text.secondary', fontWeight: 700 }}>
                  #{i + 1}
                </Box>
                <Box sx={{ flexGrow: 1 }}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography variant="body1" fontWeight={isWinner ? 800 : 600}>
                      {r.candidate_name}
                    </Typography>
                    {isWinner && (
                      <Chip
                        size="small"
                        label="🏆 Lider"
                        sx={{ bgcolor: '#fef3c7', color: '#92400e', fontWeight: 700 }}
                      />
                    )}
                  </Stack>
                  <Box sx={{ position: 'relative', height: 8, bgcolor: '#e2e8f0', borderRadius: 4, mt: 0.5, overflow: 'hidden' }}>
                    <Box
                      sx={{
                        position: 'absolute',
                        left: 0, top: 0, bottom: 0,
                        width: `${r.percentage}%`,
                        background: isWinner
                          ? 'linear-gradient(90deg, #fbbf24, #f59e0b)'
                          : `linear-gradient(90deg, ${BAR_COLORS[i % BAR_COLORS.length]}, ${BAR_COLORS[i % BAR_COLORS.length]}cc)`,
                        transition: 'width 1.2s cubic-bezier(0.4, 0, 0.2, 1)'
                      }}
                    />
                  </Box>
                </Box>
                <Box sx={{ minWidth: 96, textAlign: 'right' }}>
                  <Typography variant="body2" fontWeight="bold">
                    {r.vote_count} oy
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    %{r.percentage}
                  </Typography>
                </Box>
              </Box>
            );
          })}
        </Stack>
      </Paper>

      {/* SAATLİK OY AKIŞI */}
      <Paper elevation={3} sx={{ p: 3, borderRadius: 3, mb: 3 }}>
        <Typography variant="h6" fontWeight="bold" sx={{ mb: 0.5 }}>
          Saatlik Oy Akışı (Son 72 Saat)
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
          Saat bazında bu seçim için kullanılan oy adedi.
        </Typography>
        {hourlySeries.length === 0 ? (
          <Box sx={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography color="text.secondary">Henüz veri yok.</Typography>
          </Box>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={hourlySeries} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <RTooltip
                formatter={(v) => [`${v} oy`, 'Oy']}
                labelFormatter={(_, p) => p?.[0] ? new Date(p[0].payload.hour).toLocaleString('tr-TR') : ''}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey="votes"
                name="Oy Akışı"
                stroke="#10b981"
                strokeWidth={3}
                dot={{ r: 3, fill: '#10b981' }}
                activeDot={{ r: 6 }}
                isAnimationActive
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Paper>

      {/* META BİLGİ */}
      <Paper elevation={1} sx={{ p: 2.5, borderRadius: 3, bgcolor: '#f8fafc' }}>
        <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700 }}>
          ON-CHAIN META
        </Typography>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mt: 1 }}>
          <Box>
            <Typography variant="caption" color="text.secondary" display="block">DB ID</Typography>
            <Typography variant="body2" fontFamily="monospace">{election.id}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" display="block">Blockchain Election ID</Typography>
            <Typography variant="body2" fontFamily="monospace">{fmt(election.blockchain_election_id)}</Typography>
          </Box>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="caption" color="text.secondary" display="block">Başlangıç → Bitiş</Typography>
            <Typography variant="body2">
              {new Date(election.start_date).toLocaleString('tr-TR')} → {new Date(election.end_date).toLocaleString('tr-TR')}
            </Typography>
          </Box>
          {EXPLORER_BASE_URL && election.blockchain_election_id !== null && (
            <Tooltip title="Akıllı sözleşmenin Etherscan sayfasını aç">
              <Button
                size="small"
                variant="contained"
                startIcon={<VerifiedIcon />}
                endIcon={<OpenInNewIcon />}
                href={explorerContractUrl()}
                target="_blank"
                rel="noopener noreferrer"
              >
                Etherscan'de Doğrula
              </Button>
            </Tooltip>
          )}
        </Stack>
      </Paper>
    </Box>
  );
}

export { explorerTxUrl };
export default ElectionResultsView;
