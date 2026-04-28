import React from 'react';
import {
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography
} from '@mui/material';
import BallotOutlinedIcon from '@mui/icons-material/BallotOutlined';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined';
import VerifiedUserOutlinedIcon from '@mui/icons-material/VerifiedUserOutlined';
import TimerOutlinedIcon from '@mui/icons-material/TimerOutlined';
import { fieldSx, panelSx, primaryButtonSx } from './styles';
import { formatElectionDate, useCountdown, padTwo } from './utils';

// ─── Geri sayım bileşeni ─────────────────────────────────────────
function ElectionCountdown({ election }) {
  const now = Date.now();
  const startMs = new Date(election.start_date).getTime();
  const endMs = new Date(election.end_date).getTime();

  const isUpcoming = now < startMs;
  const isEnded = now > endMs;

  // Başlamamışsa başlangıca, aktifse bitişe say.
  const target = isUpcoming ? election.start_date : election.end_date;
  const remaining = useCountdown(target);

  if (isEnded) {
    return (
      <Chip
        size="small"
        icon={<TimerOutlinedIcon style={{ fontSize: 14 }} />}
        label="Seçim sona erdi"
        sx={{ bgcolor: '#fee2e2', color: '#991b1b', fontWeight: 700, fontSize: 11 }}
      />
    );
  }

  if (!remaining) return null;

  const { days, hours, minutes, seconds } = remaining;
  const label = isUpcoming ? 'Başlamasına' : 'Bitmesine';

  const timeParts = days > 0
    ? `${days}g ${padTwo(hours)}s ${padTwo(minutes)}dk`
    : `${padTwo(hours)}:${padTwo(minutes)}:${padTwo(seconds)}`;

  const chipColor = isUpcoming
    ? { bgcolor: '#fef3c7', color: '#b45309' }
    : remaining.totalMs < 60 * 60 * 1000
      ? { bgcolor: '#fee2e2', color: '#991b1b' }    // Son 1 saat: kırmızı
      : remaining.totalMs < 24 * 60 * 60 * 1000
        ? { bgcolor: '#fff7ed', color: '#c2410c' }   // Son 1 gün: turuncu
        : { bgcolor: '#d1fae5', color: '#065f46' };  // Aktif: yeşil

  return (
    <Chip
      size="small"
      icon={<TimerOutlinedIcon style={{ fontSize: 14 }} />}
      label={`${label}: ${timeParts}`}
      sx={{ ...chipColor, fontWeight: 700, fontSize: 11, fontFamily: 'monospace' }}
    />
  );
}

function VotingMainPanel({
  elections,
  selectedElection,
  selectedElectionId,
  handleElectionChange,
  isLoadingElections,
  candidates,
  isLoadingCandidates,
  selectedCandidate,
  setSelectedCandidate,
  handleVoteSubmit,
  votePending
}) {
  return (
    <Paper elevation={0} sx={{ ...panelSx, overflow: 'hidden', backgroundColor: '#ffffff' }}>
      <Box sx={{ p: { xs: 2.5, md: 3 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, gap: 2, mb: 3, flexDirection: { xs: 'column', sm: 'row' } }}>
          <Box>
            <Typography variant="overline" sx={{ color: '#0f9f8f', fontWeight: 900, letterSpacing: 0 }}>
              Aktif Secim
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 900, color: '#111827', mt: 0.25 }}>
              Oy Kullan
            </Typography>
          </Box>
          <Chip
            icon={<VerifiedUserOutlinedIcon />}
            label={selectedElection ? 'Katilima acik' : 'Secim bekleniyor'}
            sx={{ borderRadius: 1.5, fontWeight: 800, color: selectedElection ? '#064e3b' : '#475569', backgroundColor: selectedElection ? '#d5f8e9' : '#eef2f7' }}
          />
        </Box>

        {isLoadingElections ? (
          <Box sx={{ py: 9, display: 'grid', placeItems: 'center', gap: 2 }}>
            <CircularProgress sx={{ color: '#10b981' }} />
            <Typography variant="body2" sx={{ color: '#64748b' }}>
              Secimler yukleniyor...
            </Typography>
          </Box>
        ) : elections.length === 0 ? (
          <Box sx={{ py: 8, textAlign: 'center' }}>
            <EventAvailableOutlinedIcon sx={{ fontSize: 54, color: '#94a3b8', mb: 1.5 }} />
            <Typography variant="h6" sx={{ fontWeight: 900, color: '#111827' }}>
              Uygun secim bulunamadi
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b', mt: 1 }}>
              Domaininize uygun aktif secim yok veya secim henuz baslatilmadi.
            </Typography>
          </Box>
        ) : (
          <>
            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel>Secim</InputLabel>
              <Select value={selectedElectionId} label="Secim" onChange={handleElectionChange} sx={fieldSx}>
                {elections.map(el => <MenuItem key={el.id} value={el.id}>{el.title}</MenuItem>)}
              </Select>
            </FormControl>

            {selectedElection && (
              <Box sx={{ mb: 3, p: 2, borderRadius: 2, backgroundColor: '#f7fbfd', border: '1px solid rgba(15, 23, 42, 0.08)' }}>
                <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1} sx={{ mb: 0.5 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 900, color: '#111827' }}>
                    {selectedElection.title}
                  </Typography>
                  <ElectionCountdown election={selectedElection} />
                </Stack>
                {selectedElection.description && <Typography variant="body2" sx={{ color: '#64748b', mt: 0.75 }}>{selectedElection.description}</Typography>}
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ mt: 1.5 }}>
                  <Chip size="small" icon={<EventAvailableOutlinedIcon />} label={`Baslangic: ${formatElectionDate(selectedElection.start_date)}`} />
                  <Chip size="small" icon={<EventAvailableOutlinedIcon />} label={`Bitis: ${formatElectionDate(selectedElection.end_date)}`} />
                </Stack>
              </Box>
            )}

            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 900, color: '#111827', mb: 1.5 }}>
                Aday Secin
              </Typography>

              {isLoadingCandidates ? (
                <Box sx={{ py: 4 }}>
                  <LinearProgress sx={{ '& .MuiLinearProgress-bar': { backgroundColor: '#10b981' } }} />
                </Box>
              ) : candidates.length === 0 ? (
                <Typography sx={{ color: '#64748b', py: 3 }}>
                  Bu secim icin aday bulunmuyor.
                </Typography>
              ) : (
                <Box sx={{ display: 'grid', gap: 1.5 }}>
                  {candidates.map((candidate, index) => {
                    const isSelected = selectedCandidate?.id === candidate.id;
                    return (
                      <Box
                        key={candidate.id}
                        onClick={() => setSelectedCandidate(candidate)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === ' ') setSelectedCandidate(candidate);
                        }}
                        sx={{
                          p: 2,
                          borderRadius: 2,
                          cursor: 'pointer',
                          transition: '160ms ease',
                          display: 'grid',
                          gridTemplateColumns: 'auto 1fr auto',
                          gap: 1.5,
                          alignItems: 'center',
                          border: '1px solid',
                          borderColor: isSelected ? '#10b981' : 'rgba(15, 23, 42, 0.10)',
                          backgroundColor: isSelected ? '#e8fbf4' : '#ffffff',
                          boxShadow: isSelected ? '0 14px 34px rgba(16, 185, 129, 0.16)' : '0 8px 24px rgba(15, 23, 42, 0.04)',
                          '&:hover': { borderColor: '#10b981', transform: 'translateY(-1px)' }
                        }}
                      >
                        <Avatar sx={{ width: 42, height: 42, borderRadius: 1.5, fontWeight: 900, color: isSelected ? '#06221d' : '#0f9f8f', backgroundColor: isSelected ? '#34d399' : 'rgba(16, 185, 129, 0.10)' }}>
                          {index + 1}
                        </Avatar>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 900, color: '#111827' }}>
                            {candidate.name}
                          </Typography>
                          {candidate.description && <Typography variant="body2" sx={{ color: '#64748b', mt: 0.25 }}>{candidate.description}</Typography>}
                        </Box>
                        {isSelected ? <CheckCircleIcon sx={{ color: '#0f9f8f' }} /> : <BallotOutlinedIcon sx={{ color: '#94a3b8' }} />}
                      </Box>
                    );
                  })}
                </Box>
              )}
            </Box>

            <Button
              variant="contained"
              size="large"
              fullWidth
              onClick={handleVoteSubmit}
              disabled={!selectedCandidate || votePending}
              startIcon={votePending ? <CircularProgress size={22} color="inherit" /> : <CheckCircleIcon />}
              sx={primaryButtonSx}
            >
              {votePending ? 'Gonderiliyor...' : selectedCandidate ? 'Oyu Onayla ve Gonder' : 'Aday Secin'}
            </Button>
          </>
        )}
      </Box>
    </Paper>
  );
}

export default VotingMainPanel;
