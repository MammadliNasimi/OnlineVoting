import React, { useState } from 'react';
import useAdminHeaders from '../../hooks/useAdminHeaders';
import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Card,
  CardContent,
  CircularProgress,
  FormControl,
  Grid,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography
} from '@mui/material';
import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import HowToVoteIcon from '@mui/icons-material/HowToVote';
import GroupIcon from '@mui/icons-material/Group';
import CampaignIcon from '@mui/icons-material/Campaign';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import { API_BASE } from '../../config';

const PIE_COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6', '#ec4899', '#22c55e'];

// Tek bir KPI kartı.
function KpiCard({ icon, label, value, subLabel, accent = '#4f46e5' }) {
  return (
    <Card elevation={3} sx={{ borderRadius: 3, borderTop: `4px solid ${accent}`, height: '100%' }}>
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: `${accent}15`,
              color: accent
            }}
          >
            {icon}
          </Box>
          <Box>
            <Typography variant="h4" fontWeight="bold" sx={{ lineHeight: 1.1 }}>
              {value}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ textTransform: 'uppercase', mt: 0.5, fontSize: 11 }}>
              {label}
            </Typography>
            {subLabel && (
              <Typography variant="caption" color="text.secondary" display="block">
                {subLabel}
              </Typography>
            )}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

function AnalyticsTab({ sessionId }) {
  const [selectedElectionId, setSelectedElectionId] = useState('');
  const authHeaders = useAdminHeaders(sessionId);

  const { data: elections = [] } = useQuery({
    queryKey: ['analytics_elections'],
    queryFn: async () => {
      const data = (await axios.get(`${API_BASE}/admin/elections`, authHeaders)).data;
      return Array.isArray(data) ? data : [];
    }
  });

  const { data: overview, isLoading } = useQuery({
    queryKey: ['analytics_overview', selectedElectionId],
    queryFn: async () => {
      const url = selectedElectionId
        ? `${API_BASE}/admin/analytics/overview?electionId=${selectedElectionId}&hours=24`
        : `${API_BASE}/admin/analytics/overview?hours=24`;
      return (await axios.get(url, authHeaders)).data;
    },
    refetchInterval: 30000 // Yedek: 30 sn'de bir; ana refresh WebSocket ile.
  });

  const turnout = overview?.turnout;
  const hourly = overview?.hourlyDistribution || [];
  const domains = overview?.domainParticipation || [];

  const isElectionScope = !!selectedElectionId;

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'center' }} justifyContent="space-between" spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight="bold">Live Analytics</Typography>
          <Typography variant="body2" color="text.secondary">
            Gerçek zamanlı oy istatistikleri ve katılım göstergeleri.
          </Typography>
        </Box>

        <FormControl size="small" sx={{ minWidth: 280 }}>
          <InputLabel id="election-filter-label">Seçim Filtresi</InputLabel>
          <Select
            labelId="election-filter-label"
            label="Seçim Filtresi"
            value={selectedElectionId}
            onChange={(e) => setSelectedElectionId(e.target.value)}
          >
            <MenuItem value="">Tüm Seçimler</MenuItem>
            {elections.map((e) => (
              <MenuItem key={e.id} value={e.id}>
                {e.title} {e.is_active ? '🟢' : '⚪'}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      {isLoading && <LinearProgress sx={{ mb: 2 }} />}

      {/* KPI KARTLARI */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {isElectionScope ? (
          <>
            <Grid item xs={12} sm={6} md={3}>
              <KpiCard
                icon={<GroupIcon />}
                label="Uygun Seçmen"
                value={turnout?.eligibleVoters ?? '-'}
                subLabel="Domain kısıtlamasına göre"
                accent="#4f46e5"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <KpiCard
                icon={<HowToVoteIcon />}
                label="Oy Atan"
                value={turnout?.votedCount ?? '-'}
                accent="#10b981"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <KpiCard
                icon={<TrendingUpIcon />}
                label="Katılım Oranı"
                value={`%${turnout?.turnoutPct ?? 0}`}
                accent="#f59e0b"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <KpiCard
                icon={<CampaignIcon />}
                label="Son 24h Oy"
                value={hourly.reduce((s, h) => s + h.votes, 0)}
                accent="#06b6d4"
              />
            </Grid>
          </>
        ) : (
          <>
            <Grid item xs={12} sm={6} md={3}>
              <KpiCard
                icon={<GroupIcon />}
                label="Toplam Kayıtlı"
                value={turnout?.totalRegistered ?? '-'}
                accent="#4f46e5"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <KpiCard
                icon={<HowToVoteIcon />}
                label="Oy Atan (uniq)"
                value={turnout?.uniqueVoters ?? '-'}
                accent="#10b981"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <KpiCard
                icon={<TrendingUpIcon />}
                label="Katılım Oranı"
                value={`%${turnout?.turnoutPct ?? 0}`}
                accent="#f59e0b"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <KpiCard
                icon={<CampaignIcon />}
                label="Aktif Seçim"
                value={turnout?.activeElections ?? '-'}
                accent="#06b6d4"
              />
            </Grid>
          </>
        )}
      </Grid>

      {/* GRAFIKLER */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Paper elevation={3} sx={{ p: 3, borderRadius: 3, height: 380 }}>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 1 }}>
              Saatlik Oy Dağılımı (Son 24 Saat)
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
              Saat başına başarıyla blokzincire yazılan oy sayısı.
            </Typography>
            {hourly.length === 0 ? (
              <Box sx={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography color="text.secondary">Henüz veri yok.</Typography>
              </Box>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={hourly} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(v) => [`${v} oy`, 'Oy Sayısı']}
                    labelFormatter={(l, payload) => {
                      if (payload && payload[0]) {
                        return new Date(payload[0].payload.hour).toLocaleString();
                      }
                      return l;
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="votes"
                    stroke="#4f46e5"
                    strokeWidth={3}
                    dot={{ r: 3, fill: '#4f46e5' }}
                    activeDot={{ r: 6 }}
                    isAnimationActive
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper elevation={3} sx={{ p: 3, borderRadius: 3, height: 380 }}>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 1 }}>
              Domain Bazlı Katılım
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
              Hangi e-posta domain'inden kaç kullanıcı oy attı.
            </Typography>
            {domains.length === 0 ? (
              <Box sx={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {isLoading ? <CircularProgress /> : <Typography color="text.secondary">Henüz veri yok.</Typography>}
              </Box>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={domains}
                    dataKey="voter_count"
                    nameKey="domain"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={(entry) => `${entry.domain} (${entry.voter_count})`}
                    labelLine={false}
                  >
                    {domains.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => [`${v} kullanıcı`, 'Oy atan']} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Paper>
        </Grid>
      </Grid>

      {!isElectionScope && (
        <Alert severity="info" sx={{ mt: 3, borderRadius: 2 }}>
          Belirli bir seçim için detaylı analiz almak isterseniz yukarıdan filtreden seçim seçin.
        </Alert>
      )}
    </Box>
  );
}

export default AnalyticsTab;
