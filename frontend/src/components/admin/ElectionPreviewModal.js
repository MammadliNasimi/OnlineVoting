/**
 * ElectionPreviewModal
 * ---------------------
 * Seçmen gözünden seçimin nasıl görüneceğini tam ekran simüle eder.
 * Gerçek VotingMainPanel + VotingSidebar komponentleri kullanılır;
 * oy gönderme devre dışı, tüm aksiyonlar no-op'tur.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Dialog,
  DialogContent,
  Divider,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ScheduleIcon from '@mui/icons-material/Schedule';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import VotingMainPanel from '../voting/VotingMainPanel';
import VotingSidebar from '../voting/VotingSidebar';
import { useCountdown, padTwo } from '../voting/utils';

const pad = padTwo;

// --------------------------------------------------------------------------
// Durum hesaplama
// --------------------------------------------------------------------------
function getElectionStatus(election) {
  const now = Date.now();
  const start = new Date(election.start_date).getTime();
  const end = new Date(election.end_date).getTime();
  if (!election.is_active) return 'inactive';
  if (now < start) return 'upcoming';
  if (now > end) return 'ended';
  return 'active';
}

// --------------------------------------------------------------------------
// Önizleme Üst Bandı
// --------------------------------------------------------------------------
function PreviewBanner({ election }) {
  const status = getElectionStatus(election);

  // Geri sayım: başlamamışsa başlangıca, aktifse bitişe kadar say.
  const countdownTarget = status === 'upcoming' ? election.start_date : election.end_date;
  const remaining = useCountdown(countdownTarget);

  const statusInfo = {
    inactive: { label: 'Henüz yayınlanmadı', color: '#64748b', bg: '#f1f5f9' },
    upcoming: { label: 'Başlamadı', color: '#b45309', bg: '#fef3c7' },
    active: { label: 'Aktif', color: '#065f46', bg: '#d1fae5' },
    ended: { label: 'Sona Erdi', color: '#991b1b', bg: '#fee2e2' }
  }[status];

  const countdownLabel = status === 'upcoming' ? 'Başlamasına' : 'Bitmesine';

  return (
    <Box
      sx={{
        bgcolor: '#0f172a',
        px: { xs: 2, md: 4 },
        py: 1.5,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 2,
        borderBottom: '2px solid #10b981'
      }}
    >
      {/* Sol: önizleme etiketi */}
      <Stack direction="row" alignItems="center" spacing={1.5}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            px: 1.5,
            py: 0.5,
            bgcolor: '#10b981',
            borderRadius: 1.5
          }}
        >
          <VisibilityIcon sx={{ fontSize: 16, color: '#071014' }} />
          <Typography variant="caption" fontWeight="900" sx={{ color: '#071014', letterSpacing: 0.5 }}>
            ÖNİZLEME MODU
          </Typography>
        </Box>
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            px: 1.25,
            py: 0.4,
            bgcolor: statusInfo.bg,
            borderRadius: 1,
          }}
        >
          <Typography variant="caption" fontWeight="700" sx={{ color: statusInfo.color }}>
            {statusInfo.label}
          </Typography>
        </Box>
      </Stack>

      {/* Sağ: geri sayım */}
      {remaining && (status === 'upcoming' || status === 'active') && (
        <Stack direction="row" alignItems="center" spacing={1}>
          <ScheduleIcon sx={{ fontSize: 16, color: '#94a3b8' }} />
          <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 600 }}>
            {countdownLabel}:
          </Typography>
          <Typography
            variant="body2"
            fontFamily="monospace"
            fontWeight="bold"
            sx={{ color: status === 'active' ? '#34d399' : '#fbbf24' }}
          >
            {remaining.days > 0 && `${remaining.days}g `}
            {pad(remaining.hours)}:{pad(remaining.minutes)}:{pad(remaining.seconds)}
          </Typography>
        </Stack>
      )}
    </Box>
  );
}

// --------------------------------------------------------------------------
// Ana Modal
// --------------------------------------------------------------------------
function ElectionPreviewModal({ election, open, onClose }) {
  const [selectedCandidate, setSelectedCandidate] = useState(null);

  // Modal her açıldığında seçimi sıfırla.
  useEffect(() => {
    if (open) setSelectedCandidate(null);
  }, [open, election?.id]);

  // VotingMainPanel'in beklediği format
  const elections = useMemo(() => (election ? [election] : []), [election]);
  const candidates = useMemo(() => election?.candidates || [], [election]);

  const mockUser = useMemo(() => ({
    id: 0,
    name: 'Örnek Seçmen',
    email: 'ornek@akdeniz.edu.tr',
    role: 'user',
    student_id: '20230808001'
  }), []);

  if (!election) return null;

  const status = getElectionStatus(election);
  const isLive = status === 'active';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen
      PaperProps={{
        sx: {
          bgcolor: '#dbe6eb',
          backgroundImage: `
            linear-gradient(rgba(16, 24, 32, 0.075) 1px, transparent 1px),
            linear-gradient(90deg, rgba(16, 24, 32, 0.075) 1px, transparent 1px),
            linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(15, 23, 42, 0.08))
          `,
          backgroundSize: '42px 42px, 42px 42px, cover'
        }
      }}
    >
      {/* ── ÖNİZLEME BANDI ──────────────────────────────── */}
      <PreviewBanner election={election} />

      {/* ── KAPAT BUTONU ─────────────────────────────────── */}
      <Box
        sx={{
          position: 'fixed',
          top: 56,
          right: 16,
          zIndex: 1400
        }}
      >
        <Tooltip title="Önizlemeyi kapat">
          <IconButton
            onClick={onClose}
            sx={{
              bgcolor: 'rgba(15, 23, 42, 0.85)',
              color: '#f8fafc',
              borderRadius: 2,
              '&:hover': { bgcolor: '#0f172a' },
              boxShadow: '0 4px 16px rgba(0,0,0,0.3)'
            }}
          >
            <CloseIcon />
          </IconButton>
        </Tooltip>
      </Box>

      <DialogContent sx={{ p: 0, overflow: 'auto' }}>
        <Box sx={{ px: { xs: 2, md: 4 }, py: { xs: 2.5, md: 4 }, maxWidth: 1220, mx: 'auto' }}>

          {/* ── GERÇEĞİNE BENZER OYLAMA HEADER'I ────────── */}
          <Paper
            elevation={0}
            sx={{
              mb: 3,
              borderRadius: 3,
              overflow: 'hidden',
              backgroundColor: '#101820',
              color: '#f8fafc'
            }}
          >
            <Box
              sx={{
                p: { xs: 2.5, md: 3 },
                display: 'flex',
                alignItems: { xs: 'flex-start', md: 'center' },
                justifyContent: 'space-between',
                flexDirection: { xs: 'column', md: 'row' },
                gap: 2.5,
                backgroundImage: `
                  linear-gradient(145deg, rgba(16, 185, 129, 0.20), transparent 44%),
                  linear-gradient(315deg, rgba(45, 212, 191, 0.13), transparent 48%),
                  linear-gradient(rgba(255, 255, 255, 0.045) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(255, 255, 255, 0.045) 1px, transparent 1px)
                `,
                backgroundSize: 'cover, cover, 36px 36px, 36px 36px'
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.75 }}>
                <Avatar sx={{ width: 54, height: 54, borderRadius: 2, color: '#071014', backgroundColor: '#2dd4bf' }}>
                  <VisibilityIcon />
                </Avatar>
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 900, lineHeight: 1.05 }}>
                    Oylama Merkezi
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'rgba(248, 250, 252, 0.68)', mt: 0.75 }}>
                    Hoş geldin, {mockUser.name}. Aktif seçimleri güvenli şekilde takip edebilirsin.
                  </Typography>
                </Box>
              </Box>
              <Stack direction="row" spacing={1} sx={{ opacity: 0.5 }}>
                <Button variant="outlined" disabled size="small" sx={{ color: '#f8fafc', borderColor: 'rgba(248,250,252,0.2)', borderRadius: 1.5, textTransform: 'none' }}>Profil</Button>
                <Button variant="outlined" disabled size="small" sx={{ color: '#f8fafc', borderColor: 'rgba(248,250,252,0.2)', borderRadius: 1.5, textTransform: 'none' }}>Geçmiş</Button>
              </Stack>
            </Box>
          </Paper>

          {/* ── DURUM UYARILARI ───────────────────────────── */}
          {status === 'inactive' && (
            <Alert severity="warning" icon={<InfoOutlinedIcon />} sx={{ mb: 2.5, borderRadius: 2 }}>
              Bu seçim henüz yayınlanmadı (pasif). Seçmenler bunu göremez.
            </Alert>
          )}
          {status === 'upcoming' && (
            <Alert severity="info" icon={<ScheduleIcon />} sx={{ mb: 2.5, borderRadius: 2 }}>
              Seçim henüz başlamadı. Seçmenler bu seçimi göremez; başlangıç saatinde otomatik görünür.
            </Alert>
          )}
          {status === 'ended' && (
            <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2 }}>
              Bu seçim sona erdi. Seçmenler artık oy kullanamaz.
            </Alert>
          )}

          {/* ── ANA İÇERİK: MainPanel + Sidebar ─────────── */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.65fr) minmax(320px, 0.8fr)' },
              gap: 3
            }}
          >
            {/* VotingMainPanel'i gerçekten render ediyoruz — sadece submit disabled */}
            <Box sx={{ position: 'relative' }}>
              <VotingMainPanel
                elections={elections}
                selectedElection={election}
                selectedElectionId={election.id}
                handleElectionChange={() => {}}
                isLoadingElections={false}
                candidates={candidates}
                isLoadingCandidates={false}
                selectedCandidate={selectedCandidate}
                setSelectedCandidate={setSelectedCandidate}
                handleVoteSubmit={() => {}}
                votePending={false}
              />
              {/* Oy gönder butonunun üzerine "önizleme" overlay'i */}
              <Box
                sx={{
                  position: 'absolute',
                  bottom: { xs: 20, md: 24 },
                  left: { xs: 20, md: 24 },
                  right: { xs: 20, md: 24 },
                  height: 56,
                  borderRadius: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: 'rgba(15, 23, 42, 0.75)',
                  backdropFilter: 'blur(4px)',
                  pointerEvents: 'none'
                }}
              >
                <Stack direction="row" alignItems="center" spacing={1}>
                  <VisibilityIcon sx={{ color: '#10b981', fontSize: 18 }} />
                  <Typography variant="body2" fontWeight="bold" sx={{ color: '#f8fafc' }}>
                    Önizleme Modu — Oy Gönderilemez
                  </Typography>
                </Stack>
              </Box>
            </Box>

            {/* VotingSidebar mock verilerle */}
            <VotingSidebar
              user={mockUser}
              userInitial="Ö"
              userRole="Vatandaş"
              walletAddress="0xPreview...Mock"
              isLoadingHistory={false}
              visibleHistory={[]}
              onShowHistory={() => {}}
            />
          </Box>

          {/* ── ADMIN BİLGİ NOTU ─────────────────────────── */}
          <Paper
            elevation={0}
            sx={{
              mt: 3,
              p: 2.5,
              borderRadius: 3,
              bgcolor: 'rgba(79, 70, 229, 0.06)',
              border: '1px dashed rgba(79, 70, 229, 0.3)'
            }}
          >
            <Stack direction="row" alignItems="flex-start" spacing={1.5}>
              <InfoOutlinedIcon sx={{ color: '#4f46e5', mt: 0.3 }} />
              <Box>
                <Typography variant="subtitle2" fontWeight="bold" sx={{ color: '#4f46e5' }}>
                  Admin Önizleme Notu
                </Typography>
                <Divider sx={{ my: 1 }} />
                <Stack spacing={0.5}>
                  {[
                    `Seçim durumu: ${status === 'active' ? '✅ Aktif — Seçmenler bu seçimi şu an görebilir.' : status === 'upcoming' ? '⏳ Yaklaşıyor — Başlangıç tarihine kadar gizli.' : status === 'ended' ? '🔒 Sona Erdi' : '⚪ Pasif — Aktif edilene kadar gizli.'}`,
                    `Aday sayısı: ${candidates.length}`,
                    `Domain kısıtlaması: ${election.allowedDomains?.length > 0 ? election.allowedDomains.map(d => d.domain).join(', ') : 'Yok (tüm kayıtlı kullanıcılar)'}`,
                    `Blockchain Election ID: ${election.blockchain_election_id ?? 'Henüz on-chain değil'}`,
                    isLive ? `⚠️ Bu seçim şu an aktif. Önizleme gerçek seçmen deneyimini gösterir.` : null
                  ].filter(Boolean).map((line, i) => (
                    <Typography key={i} variant="caption" sx={{ color: '#475569', display: 'block' }}>
                      {line}
                    </Typography>
                  ))}
                </Stack>
              </Box>
            </Stack>
          </Paper>
        </Box>
      </DialogContent>
    </Dialog>
  );
}

export default ElectionPreviewModal;
