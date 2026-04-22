import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Button, CircularProgress, Alert, MenuItem, Select,
  FormControl, InputLabel, List, ListItem, ListItemText, Dialog,
  DialogTitle, DialogContent, DialogActions, Paper, Chip, Divider,
  Stack, Avatar, Tooltip, IconButton, LinearProgress
} from '@mui/material';
import FaceIcon from '@mui/icons-material/Face';
import HowToVoteIcon from '@mui/icons-material/HowToVote';
import HistoryIcon from '@mui/icons-material/History';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PersonIcon from '@mui/icons-material/Person';
import LogoutIcon from '@mui/icons-material/Logout';
import VerifiedUserOutlinedIcon from '@mui/icons-material/VerifiedUserOutlined';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined';
import BallotOutlinedIcon from '@mui/icons-material/BallotOutlined';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import SensorsOutlinedIcon from '@mui/icons-material/SensorsOutlined';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import { io } from 'socket.io-client';
import { signVoteClientSide, getBurnerWallet } from '../LocalIdentity';

const API_BASE = 'http://localhost:5001/api';
const SOCKET_URL = 'http://localhost:5001';

const panelSx = {
  borderRadius: 2,
  border: '1px solid rgba(15, 23, 42, 0.10)',
  boxShadow: '0 24px 70px rgba(17, 24, 39, 0.12)'
};

const primaryButtonSx = {
  py: 1.35,
  borderRadius: 1.5,
  fontWeight: 900,
  textTransform: 'none',
  color: '#06221d',
  background: 'linear-gradient(135deg, #34d399 0%, #10b981 48%, #0f9f8f 100%)',
  boxShadow: '0 16px 34px rgba(16, 185, 129, 0.24)',
  '&:hover': {
    background: 'linear-gradient(135deg, #2cc98f 0%, #0ea774 48%, #0b867a 100%)',
    boxShadow: '0 18px 38px rgba(16, 185, 129, 0.30)'
  },
  '&.Mui-disabled': {
    color: 'rgba(6, 34, 29, 0.55)',
    background: 'linear-gradient(135deg, rgba(52, 211, 153, 0.56), rgba(15, 159, 143, 0.56))'
  }
};

const outlineButtonSx = {
  borderRadius: 1.5,
  fontWeight: 800,
  textTransform: 'none',
  borderColor: 'rgba(15, 23, 42, 0.16)',
  color: '#243141',
  backgroundColor: 'rgba(255, 255, 255, 0.72)',
  '&:hover': {
    borderColor: '#10b981',
    backgroundColor: 'rgba(16, 185, 129, 0.08)'
  }
};

const headerButtonSx = {
  height: 46,
  px: 2.2,
  borderRadius: 1.5,
  fontWeight: 900,
  textTransform: 'none',
  color: '#f8fafc',
  border: '1px solid rgba(248, 250, 252, 0.18)',
  backgroundColor: 'rgba(255, 255, 255, 0.08)',
  boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.10), 0 10px 28px rgba(0, 0, 0, 0.16)',
  backdropFilter: 'blur(12px)',
  '&:hover': {
    borderColor: 'rgba(52, 211, 153, 0.58)',
    backgroundColor: 'rgba(16, 185, 129, 0.16)',
    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.14), 0 12px 32px rgba(16, 185, 129, 0.14)'
  }
};

const headerPrimaryButtonSx = {
  ...headerButtonSx,
  color: '#d1fae5',
  borderColor: 'rgba(52, 211, 153, 0.34)',
  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.18), rgba(45, 212, 191, 0.10))'
};

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: 1.5,
    backgroundColor: '#fbfdff',
    '& fieldset': {
      borderColor: 'rgba(15, 23, 42, 0.14)'
    },
    '&:hover fieldset': {
      borderColor: '#10b981'
    },
    '&.Mui-focused fieldset': {
      borderColor: '#10b981',
      boxShadow: '0 0 0 3px rgba(16, 185, 129, 0.14)'
    }
  },
  '& .MuiInputLabel-root.Mui-focused': {
    color: '#0f9f8f'
  }
};

const formatVoteDate = (vote) => {
  const raw =
    vote.voted_at ??
    vote.timestamp ??
    vote.created_at ??
    vote.createdAt ??
    vote.date;

  if (!raw) return 'Tarih yok';

  const d = new Date(String(raw).replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? 'Geçersiz tarih' : d.toLocaleString('tr-TR');
};

const formatElectionDate = (value) => {
  if (!value) return 'Belirtilmemiş';
  const d = new Date(String(value).replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? 'Belirtilmemiş' : d.toLocaleDateString('tr-TR');
};

const shortAddress = (address = '') => {
  if (!address || address.length < 12) return address || '-';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

const getPublicEmailType = (email = '') => (
  email.endsWith('@gmail.com') ||
  email.endsWith('@hotmail.com') ||
  email.endsWith('@yahoo.com') ||
  email.endsWith('@outlook.com')
);

function SimpleVoting({ user, sessionId, onLogout }) {
  const queryClient = useQueryClient();
  const [selectedElectionId, setSelectedElectionId] = useState('');
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [queueMsg, setQueueMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showFaceModal, setShowFaceModal] = useState(false);
  const [faceMessage, setFaceMessage] = useState('');
  const [faceLoading, setFaceLoading] = useState(false);
  const [walletCopied, setWalletCopied] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    if (!user || !user.id) return;

    try {
      getBurnerWallet();
    } catch (e) {
      console.error('Ethers error: ', e);
    }

    const socket = io(SOCKET_URL, { withCredentials: true });

    socket.on('connect', () => {
      console.log('Connected to WebSocket server');
      socket.emit('join', user.id);
    });

    socket.on('voteProcessed', (data) => {
      if (data.success) {
        setSuccessMsg(data.message || 'Oyunuz başarıyla blokzincire yazıldı!');
        setQueueMsg('');
        queryClient.invalidateQueries({ queryKey: ['votingHistory'] });
        queryClient.invalidateQueries({ queryKey: ['elections'] });
        setTimeout(() => setSuccessMsg(''), 5000);
      }
    });

    socket.on('voteUpdated', () => {
      queryClient.invalidateQueries({ queryKey: ['elections'] });
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
    });

    socket.on('voteFailed', (data) => {
      setErrorMsg(data.message || 'Oy işlemi başarısız oldu');
      setQueueMsg('');
      setTimeout(() => setErrorMsg(''), 5000);
    });

    return () => {
      socket.disconnect();
    };
  }, [user, queryClient]);

  const { data: elections = [], isLoading: isLoadingElections, error: electionsError } = useQuery({
    queryKey: ['elections'],
    queryFn: async () => {
      const res = await axios.get(`${API_BASE}/elections`);
      if (res.data && res.data.length > 0 && !selectedElectionId) {
        setSelectedElectionId(res.data[0].id);
      }
      return res.data;
    }
  });

  const { data: candidates = [], isLoading: isLoadingCandidates } = useQuery({
    queryKey: ['candidates', selectedElectionId],
    queryFn: async () => {
      const res = await axios.get(`${API_BASE}/candidates/${selectedElectionId}`);
      return res.data;
    },
    enabled: !!selectedElectionId
  });

  const { data: votingHistory = [], isLoading: isLoadingHistory } = useQuery({
    queryKey: ['votingHistory'],
    queryFn: async () => {
      const res = await axios.get(`${API_BASE}/voting-history`);
      return res.data;
    }
  });

  const selectedElection = useMemo(
    () => elections.find(e => e.id === Number(selectedElectionId)),
    [elections, selectedElectionId]
  );

  const walletAddress = useMemo(() => {
    try {
      return getBurnerWallet().address;
    } catch (e) {
      return '';
    }
  }, []);

  const visibleHistory = votingHistory.slice(0, 3);

  const voteMutation = useMutation({
    mutationFn: async () => {
      const currentElection = elections.find(e => e.id === Number(selectedElectionId));
      const electionBlockchainId = currentElection
        ? (currentElection.blockchain_election_id !== undefined ? currentElection.blockchain_election_id : currentElection.id)
        : selectedElectionId;
      const candidateBlockchainId = selectedCandidate.blockchain_candidate_id !== undefined
        ? selectedCandidate.blockchain_candidate_id
        : selectedCandidate.id;

      const voteData = await signVoteClientSide(candidateBlockchainId, electionBlockchainId);

      return axios.post(
        `${API_BASE}/vote/simple`,
        {
          electionId: selectedElectionId,
          candidateId: selectedCandidate.id,
          burnerAddress: voteData.burnerAddress,
          burnerSignature: voteData.burnerSignature,
          timestamp: voteData.timestamp
        },
        { headers: { 'x-session-id': sessionId }, withCredentials: true }
      );
    },
    onSuccess: (res) => {
      if (res.data.status === 'queued') {
        setQueueMsg(res.data.message || 'Oyunuz havuza alındı, işleniyor...');
        setTimeout(() => setQueueMsg(''), 6000);
      } else {
        setSuccessMsg(res.data.message || 'Oyunuz başarıyla kaydedildi!');
        queryClient.invalidateQueries({ queryKey: ['votingHistory'] });
        queryClient.invalidateQueries({ queryKey: ['elections'] });
        setTimeout(() => setSuccessMsg(''), 5000);
      }
      setSelectedCandidate(null);
    }
  });

  const handleElectionChange = (e) => {
    setSelectedElectionId(e.target.value);
    setSelectedCandidate(null);
  };

  const handleVoteSubmit = () => {
    if (selectedCandidate) {
      voteMutation.mutate();
    }
  };

  const stopFaceCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  useEffect(() => {
    if (!showFaceModal) stopFaceCamera();
  }, [showFaceModal]);

  const startFaceCamera = async () => {
    setFaceMessage('Kamera açılıyor...');
    try {
      const ensureFaceApiLoaded = async () => {
        if (window.faceapi) return window.faceapi;
        await new Promise((resolve, reject) => {
          const existing = document.querySelector('script[data-faceapi="1"]');
          if (existing) {
            existing.addEventListener('load', resolve, { once: true });
            existing.addEventListener('error', reject, { once: true });
            return;
          }
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js';
          script.async = true;
          script.dataset.faceapi = '1';
          script.onload = resolve;
          script.onerror = reject;
          document.body.appendChild(script);
        });
        return window.faceapi;
      };

      const faceapi = await ensureFaceApiLoaded();
      const modelBase = 'https://justadudewhohacks.github.io/face-api.js/models';
      await faceapi.nets.tinyFaceDetector.loadFromUri(modelBase);
      await faceapi.nets.faceLandmark68Net.loadFromUri(modelBase);
      await faceapi.nets.faceRecognitionNet.loadFromUri(modelBase);

      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setFaceMessage('Yüzünüzü kameraya gösterin ve butona basın.');
    } catch (err) {
      setFaceMessage('Kamera veya yüz modeli başlatılamadı.');
    }
  };

  const handleRegisterFace = async () => {
    if (!videoRef.current || !window.faceapi) return;
    setFaceLoading(true);
    setFaceMessage('Yüz verisi alınıyor...');
    try {
      const faceapi = window.faceapi;
      const detection = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        setFaceMessage('Yüz algılanamadı. Lütfen kameraya net bakın.');
        setFaceLoading(false);
        return;
      }

      const descriptor = Array.from(detection.descriptor);
      await axios.post(
        `${API_BASE}/face/register`,
        { faceDescriptor: descriptor },
        { headers: { 'x-session-id': sessionId }, withCredentials: true }
      );
      setFaceMessage('Yüz profilinize eklendi!');
      setTimeout(() => setShowFaceModal(false), 2000);
    } catch (err) {
      setFaceMessage(err.response?.data?.message || 'Bir hata oluştu.');
    } finally {
      setFaceLoading(false);
    }
  };

  const handleCopyWallet = async () => {
    if (!walletAddress || !navigator.clipboard) return;
    await navigator.clipboard.writeText(walletAddress);
    setWalletCopied(true);
    setTimeout(() => setWalletCopied(false), 1800);
  };

  const userRole = user.role === 'admin' ? 'Yönetici' : 'Vatandaş';
  const userInitial = (user.name || 'U').slice(0, 1).toUpperCase();
  const studentLabel = getPublicEmailType(user.email || '')
    ? 'Sivil Vatandaş Kaydı'
    : (user.student_id || '-');

  return (
    <Box
      sx={{
        minHeight: '100vh',
        backgroundColor: '#dbe6eb',
        backgroundImage: `
          linear-gradient(rgba(16, 24, 32, 0.075) 1px, transparent 1px),
          linear-gradient(90deg, rgba(16, 24, 32, 0.075) 1px, transparent 1px),
          linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(15, 23, 42, 0.08))
        `,
        backgroundSize: '42px 42px, 42px 42px, cover',
        px: { xs: 2, md: 4 },
        py: { xs: 2.5, md: 4 }
      }}
    >
      <Box sx={{ maxWidth: 1220, mx: 'auto' }}>
        <Paper
          elevation={0}
          sx={{
            ...panelSx,
            mb: 3,
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
              <Avatar
                sx={{
                  width: 54,
                  height: 54,
                  borderRadius: 2,
                  color: '#071014',
                  backgroundColor: '#2dd4bf'
                }}
              >
                <HowToVoteIcon />
              </Avatar>
              <Box>
                <Typography variant="h4" sx={{ fontWeight: 900, lineHeight: 1.05, letterSpacing: 0 }}>
                  Oylama Merkezi
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(248, 250, 252, 0.68)', mt: 0.75 }}>
                  Hoş geldin, {user.name}. Aktif seçimleri güvenli şekilde takip edebilirsin.
                </Typography>
              </Box>
            </Box>

            <Stack
              direction="row"
              spacing={1}
              sx={{
                flexWrap: 'wrap',
                gap: 1,
                justifyContent: { xs: 'flex-start', md: 'flex-end' },
                width: { xs: '100%', md: 'auto' }
              }}
            >
              <Tooltip title="Profil">
                <Button
                  variant="outlined"
                  startIcon={<PersonIcon />}
                  onClick={() => setShowProfile(true)}
                  sx={headerPrimaryButtonSx}
                >
                  Profil
                </Button>
              </Tooltip>
              <Tooltip title="Yüz profili ekle">
                <Button
                  variant="outlined"
                  startIcon={<FaceIcon />}
                  onClick={() => { setShowFaceModal(true); startFaceCamera(); }}
                  sx={headerButtonSx}
                >
                  Yüz Ekle
                </Button>
              </Tooltip>
              <Tooltip title="Oy geçmişi">
                <Button
                  variant="outlined"
                  startIcon={<HistoryIcon />}
                  onClick={() => setShowHistory(true)}
                  sx={headerButtonSx}
                >
                  Geçmiş
                </Button>
              </Tooltip>
              <Tooltip title="Çıkış yap">
                <IconButton
                  onClick={onLogout}
                  sx={{
                    width: 42,
                    height: 42,
                    borderRadius: 1.5,
                    color: '#fecaca',
                    border: '1px solid rgba(254, 202, 202, 0.22)',
                    backgroundColor: 'rgba(127, 29, 29, 0.18)',
                    '&:hover': { backgroundColor: 'rgba(127, 29, 29, 0.28)' }
                  }}
                >
                  <LogoutIcon />
                </IconButton>
              </Tooltip>
            </Stack>
          </Box>
        </Paper>

        {(electionsError || voteMutation.isError || errorMsg) && (
          <Alert severity="error" sx={{ mb: 2.5, borderRadius: 1.5 }}>
            {errorMsg || voteMutation.error?.response?.data?.message || 'Bir hata oluştu'}
          </Alert>
        )}
        {successMsg && <Alert severity="success" sx={{ mb: 2.5, borderRadius: 1.5 }}>{successMsg}</Alert>}
        {queueMsg && (
          <Alert severity="info" icon={<CircularProgress size={20} />} sx={{ mb: 2.5, borderRadius: 1.5 }}>
            {queueMsg}
          </Alert>
        )}

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.65fr) minmax(320px, 0.8fr)' }, gap: 3 }}>
          <Paper elevation={0} sx={{ ...panelSx, overflow: 'hidden', backgroundColor: '#ffffff' }}>
            <Box sx={{ p: { xs: 2.5, md: 3 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, gap: 2, mb: 3, flexDirection: { xs: 'column', sm: 'row' } }}>
                <Box>
                  <Typography variant="overline" sx={{ color: '#0f9f8f', fontWeight: 900, letterSpacing: 0 }}>
                    Aktif Seçim
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 900, color: '#111827', mt: 0.25 }}>
                    Oy Kullan
                  </Typography>
                </Box>
                <Chip
                  icon={<VerifiedUserOutlinedIcon />}
                  label={selectedElection ? 'Katılıma açık' : 'Seçim bekleniyor'}
                  sx={{
                    borderRadius: 1.5,
                    fontWeight: 800,
                    color: selectedElection ? '#064e3b' : '#475569',
                    backgroundColor: selectedElection ? '#d5f8e9' : '#eef2f7'
                  }}
                />
              </Box>

              {isLoadingElections ? (
                <Box sx={{ py: 9, display: 'grid', placeItems: 'center', gap: 2 }}>
                  <CircularProgress sx={{ color: '#10b981' }} />
                  <Typography variant="body2" sx={{ color: '#64748b' }}>
                    Seçimler yükleniyor...
                  </Typography>
                </Box>
              ) : elections.length === 0 ? (
                <Box sx={{ py: 8, textAlign: 'center' }}>
                  <EventAvailableOutlinedIcon sx={{ fontSize: 54, color: '#94a3b8', mb: 1.5 }} />
                  <Typography variant="h6" sx={{ fontWeight: 900, color: '#111827' }}>
                    Uygun seçim bulunamadı
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#64748b', mt: 1 }}>
                    Domaininize uygun aktif seçim yok veya seçim henüz başlatılmadı.
                  </Typography>
                </Box>
              ) : (
                <>
                  <FormControl fullWidth sx={{ mb: 3 }}>
                    <InputLabel>Seçim</InputLabel>
                    <Select value={selectedElectionId} label="Seçim" onChange={handleElectionChange} sx={fieldSx}>
                      {elections.map(el => (
                        <MenuItem key={el.id} value={el.id}>{el.title}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  {selectedElection && (
                    <Box
                      sx={{
                        mb: 3,
                        p: 2,
                        borderRadius: 2,
                        backgroundColor: '#f7fbfd',
                        border: '1px solid rgba(15, 23, 42, 0.08)'
                      }}
                    >
                      <Typography variant="subtitle1" sx={{ fontWeight: 900, color: '#111827' }}>
                        {selectedElection.title}
                      </Typography>
                      {selectedElection.description && (
                        <Typography variant="body2" sx={{ color: '#64748b', mt: 0.75 }}>
                          {selectedElection.description}
                        </Typography>
                      )}
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ mt: 1.5 }}>
                        <Chip size="small" icon={<EventAvailableOutlinedIcon />} label={`Başlangıç: ${formatElectionDate(selectedElection.start_date)}`} />
                        <Chip size="small" icon={<EventAvailableOutlinedIcon />} label={`Bitiş: ${formatElectionDate(selectedElection.end_date)}`} />
                      </Stack>
                    </Box>
                  )}

                  <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 900, color: '#111827', mb: 1.5 }}>
                      Aday Seçin
                    </Typography>

                    {isLoadingCandidates ? (
                      <Box sx={{ py: 4 }}>
                        <LinearProgress sx={{ '& .MuiLinearProgress-bar': { backgroundColor: '#10b981' } }} />
                      </Box>
                    ) : candidates.length === 0 ? (
                      <Typography sx={{ color: '#64748b', py: 3 }}>
                        Bu seçim için aday bulunmuyor.
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
                              onKeyDown={(e) => {
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
                                '&:hover': {
                                  borderColor: '#10b981',
                                  transform: 'translateY(-1px)'
                                }
                              }}
                            >
                              <Avatar
                                sx={{
                                  width: 42,
                                  height: 42,
                                  borderRadius: 1.5,
                                  fontWeight: 900,
                                  color: isSelected ? '#06221d' : '#0f9f8f',
                                  backgroundColor: isSelected ? '#34d399' : 'rgba(16, 185, 129, 0.10)'
                                }}
                              >
                                {index + 1}
                              </Avatar>
                              <Box sx={{ minWidth: 0 }}>
                                <Typography variant="subtitle1" sx={{ fontWeight: 900, color: '#111827' }}>
                                  {candidate.name}
                                </Typography>
                                {candidate.description && (
                                  <Typography variant="body2" sx={{ color: '#64748b', mt: 0.25 }}>
                                    {candidate.description}
                                  </Typography>
                                )}
                              </Box>
                              {isSelected ? (
                                <CheckCircleIcon sx={{ color: '#0f9f8f' }} />
                              ) : (
                                <BallotOutlinedIcon sx={{ color: '#94a3b8' }} />
                              )}
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
                    disabled={!selectedCandidate || voteMutation.isPending}
                    startIcon={voteMutation.isPending ? <CircularProgress size={22} color="inherit" /> : <CheckCircleIcon />}
                    sx={primaryButtonSx}
                  >
                    {voteMutation.isPending ? 'Gönderiliyor...' : selectedCandidate ? 'Oyu Onayla ve Gönder' : 'Aday Seçin'}
                  </Button>
                </>
              )}
            </Box>
          </Paper>

          <Box sx={{ display: 'grid', gap: 3, alignContent: 'start' }}>
            <Paper elevation={0} sx={{ ...panelSx, p: 2.5, backgroundColor: '#ffffff' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Avatar sx={{ width: 50, height: 50, borderRadius: 2, backgroundColor: '#d5f8e9', color: '#064e3b', fontWeight: 900 }}>
                  {userInitial}
                </Avatar>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 900, color: '#111827' }}>
                    {user.name}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#64748b' }}>
                    {userRole}
                  </Typography>
                </Box>
              </Box>

              <Divider sx={{ my: 2 }} />

              <Stack spacing={1.5}>
                <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'center' }}>
                  <MailOutlineIcon sx={{ color: '#0f9f8f' }} />
                  <Typography variant="body2" sx={{ color: '#475569', wordBreak: 'break-all' }}>
                    {user.email || 'E-posta belirtilmemiş'}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'center' }}>
                  <AccountBalanceWalletOutlinedIcon sx={{ color: '#0f9f8f' }} />
                  <Typography variant="body2" sx={{ color: '#475569', fontFamily: 'monospace' }}>
                    {shortAddress(walletAddress)}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'center' }}>
                  <ShieldOutlinedIcon sx={{ color: '#0f9f8f' }} />
                  <Typography variant="body2" sx={{ color: '#475569' }}>
                    HTTP-only oturum aktif
                  </Typography>
                </Box>
              </Stack>
            </Paper>

            <Paper elevation={0} sx={{ ...panelSx, p: 2.5, backgroundColor: '#ffffff' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 900, color: '#111827' }}>
                  Son Oylar
                </Typography>
                <Button size="small" onClick={() => setShowHistory(true)} sx={{ color: '#0f9f8f', textTransform: 'none', fontWeight: 800 }}>
                  Tümü
                </Button>
              </Box>

              {isLoadingHistory ? (
                <LinearProgress sx={{ '& .MuiLinearProgress-bar': { backgroundColor: '#10b981' } }} />
              ) : visibleHistory.length === 0 ? (
                <Typography variant="body2" sx={{ color: '#64748b' }}>
                  Henüz oy geçmişi bulunmuyor.
                </Typography>
              ) : (
                <Stack spacing={1.25}>
                  {visibleHistory.map((vote, idx) => (
                    <Box
                      key={`${vote.election_title}-${idx}`}
                      sx={{
                        p: 1.5,
                        borderRadius: 1.5,
                        backgroundColor: '#f7fbfd',
                        border: '1px solid rgba(15, 23, 42, 0.08)'
                      }}
                    >
                      <Typography variant="body2" sx={{ fontWeight: 900, color: '#111827' }}>
                        {vote.election_title}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mt: 0.5 }}>
                        {vote.candidate_name} • {formatVoteDate(vote)}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              )}
            </Paper>

            <Paper elevation={0} sx={{ ...panelSx, p: 2.5, backgroundColor: '#101820', color: '#f8fafc' }}>
              <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', mb: 1.5 }}>
                <Avatar sx={{ borderRadius: 2, backgroundColor: 'rgba(45, 212, 191, 0.14)', color: '#2dd4bf' }}>
                  <SensorsOutlinedIcon />
                </Avatar>
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
                    Anonim Oy Akışı
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(248, 250, 252, 0.62)' }}>
                    İmza cihazınızda oluşturulur, oy relayer ile iletilir.
                  </Typography>
                </Box>
              </Box>
            </Paper>
          </Box>
        </Box>
      </Box>

      <Dialog open={showHistory} onClose={() => setShowHistory(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 2 } }}>
        <DialogTitle sx={{ fontWeight: 900 }}>Oy Geçmişi</DialogTitle>
        <DialogContent dividers>
          {isLoadingHistory ? (
            <CircularProgress sx={{ display: 'block', mx: 'auto', my: 4, color: '#10b981' }} />
          ) : votingHistory.length === 0 ? (
            <Typography color="text.secondary" align="center" sx={{ py: 4 }}>Henüz oy kullanılmamış</Typography>
          ) : (
            <List sx={{ display: 'grid', gap: 1 }}>
              {votingHistory.map((vote, idx) => (
                <ListItem key={idx} alignItems="flex-start" sx={{ bgcolor: '#f7fbfd', borderRadius: 1.5, border: '1px solid rgba(15, 23, 42, 0.08)' }}>
                  <ListItemText
                    primary={<Typography variant="subtitle1" fontWeight="900">Seçim: {vote.election_title}</Typography>}
                    secondary={
                      <React.Fragment>
                        <Typography component="span" variant="body2" color="text.primary" display="block">
                          Aday: {vote.candidate_name}
                        </Typography>
                        Tarih: {formatVoteDate(vote)}
                      </React.Fragment>
                    }
                  />
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setShowHistory(false)} sx={outlineButtonSx}>Kapat</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={showFaceModal} onClose={() => setShowFaceModal(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 2 } }}>
        <DialogTitle sx={{ fontWeight: 900 }}>Yüz Profilimi Ekle</DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Alert severity="info" sx={{ mb: 2, width: '100%', borderRadius: 1.5 }}>
            Yüz verilerinizi ekleyerek sisteme hızlı ve güvenli şekilde giriş yapabilirsiniz.
          </Alert>
          <Box sx={{ width: '100%', maxWidth: 420, aspectRatio: '4 / 3', bgcolor: '#070d10', borderRadius: 2, overflow: 'hidden', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            {!videoRef.current?.srcObject && <CircularProgress sx={{ position: 'absolute', color: '#10b981' }} />}
          </Box>
          {faceMessage && (
            <Typography variant="body2" sx={{ mt: 2, textAlign: 'center', color: '#0f9f8f', fontWeight: 800 }}>{faceMessage}</Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setShowFaceModal(false)} sx={outlineButtonSx}>İptal</Button>
          <Button variant="contained" onClick={handleRegisterFace} disabled={faceLoading} sx={primaryButtonSx}>
            {faceLoading ? <CircularProgress size={24} color="inherit" /> : 'Yüz Verimi Kaydet'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={showProfile}
        onClose={() => setShowProfile(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2, overflow: 'hidden' } }}
      >
        <Box
          sx={{
            p: 3,
            color: '#f8fafc',
            backgroundColor: '#101820',
            backgroundImage: `
              linear-gradient(145deg, rgba(16, 185, 129, 0.22), transparent 46%),
              linear-gradient(rgba(255, 255, 255, 0.045) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255, 255, 255, 0.045) 1px, transparent 1px)
            `,
            backgroundSize: 'cover, 34px 34px, 34px 34px'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.75 }}>
            <Avatar
              sx={{
                width: 62,
                height: 62,
                borderRadius: 2,
                color: '#06221d',
                backgroundColor: '#34d399',
                fontWeight: 900,
                fontSize: 28
              }}
            >
              {userInitial}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="overline" sx={{ color: '#2dd4bf', fontWeight: 900, letterSpacing: 0 }}>
                Profilim
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 900, lineHeight: 1.1, wordBreak: 'break-word' }}>
                {user.name || 'Kullanıcı'}
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap', gap: 1 }}>
                <Chip
                  size="small"
                  icon={<VerifiedUserOutlinedIcon />}
                  label={userRole}
                  sx={{ color: '#064e3b', backgroundColor: '#d5f8e9', fontWeight: 800 }}
                />
                <Chip
                  size="small"
                  icon={<ShieldOutlinedIcon />}
                  label="Oturum aktif"
                  sx={{ color: '#e2e8f0', backgroundColor: 'rgba(255, 255, 255, 0.10)', fontWeight: 800 }}
                />
              </Stack>
            </Box>
          </Box>
        </Box>

        <DialogContent dividers sx={{ p: 0, backgroundColor: '#f8fafc' }}>
          <Box sx={{ p: 2.5, display: 'grid', gap: 1.5 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
              <Box sx={{ p: 2, borderRadius: 2, backgroundColor: '#ffffff', border: '1px solid rgba(15, 23, 42, 0.08)' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <PersonIcon sx={{ color: '#0f9f8f' }} />
                  <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 800 }}>
                    Kullanıcı Adı
                  </Typography>
                </Box>
                <Typography variant="body1" sx={{ color: '#111827', fontWeight: 900, wordBreak: 'break-word' }}>
                  {user.name || '-'}
                </Typography>
              </Box>

              <Box sx={{ p: 2, borderRadius: 2, backgroundColor: '#ffffff', border: '1px solid rgba(15, 23, 42, 0.08)' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <VerifiedUserOutlinedIcon sx={{ color: '#0f9f8f' }} />
                  <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 800 }}>
                    Rol
                  </Typography>
                </Box>
                <Typography variant="body1" sx={{ color: '#111827', fontWeight: 900 }}>
                  {userRole}
                </Typography>
              </Box>
            </Box>

            <Box sx={{ p: 2, borderRadius: 2, backgroundColor: '#ffffff', border: '1px solid rgba(15, 23, 42, 0.08)' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <MailOutlineIcon sx={{ color: '#0f9f8f' }} />
                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 800 }}>
                  E-Posta
                </Typography>
              </Box>
              <Typography variant="body1" sx={{ color: '#111827', fontWeight: 900, wordBreak: 'break-all' }}>
                {user.email || 'Belirtilmemiş'}
              </Typography>
            </Box>

            <Box sx={{ p: 2, borderRadius: 2, backgroundColor: '#ffffff', border: '1px solid rgba(15, 23, 42, 0.08)' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <ShieldOutlinedIcon sx={{ color: '#0f9f8f' }} />
                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 800 }}>
                  Öğrenci/Kurum Numarası
                </Typography>
              </Box>
              <Typography variant="body1" sx={{ color: '#111827', fontWeight: 900 }}>
                {studentLabel}
              </Typography>
              {getPublicEmailType(user.email || '') && (
                <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mt: 0.5 }}>
                  Genel e-posta domaini için numara gerekmiyor.
                </Typography>
              )}
            </Box>

            <Box sx={{ p: 2, borderRadius: 2, backgroundColor: '#101820', color: '#f8fafc' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1.5, mb: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AccountBalanceWalletOutlinedIcon sx={{ color: '#2dd4bf' }} />
                  <Typography variant="caption" sx={{ color: 'rgba(248, 250, 252, 0.72)', fontWeight: 800 }}>
                    Anonim Oylama Cüzdanı
                  </Typography>
                </Box>
                <Tooltip title={walletCopied ? 'Kopyalandı' : 'Cüzdanı kopyala'}>
                  <span>
                    <IconButton
                      size="small"
                      onClick={handleCopyWallet}
                      disabled={!walletAddress}
                      sx={{
                        color: walletCopied ? '#34d399' : '#e2e8f0',
                        borderRadius: 1.5,
                        border: '1px solid rgba(248, 250, 252, 0.14)'
                      }}
                    >
                      <ContentCopyOutlinedIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </Box>
              <Typography
                variant="body2"
                sx={{
                  p: 1.25,
                  borderRadius: 1.5,
                  color: '#d1fae5',
                  backgroundColor: 'rgba(6, 12, 16, 0.68)',
                  border: '1px solid rgba(45, 212, 191, 0.16)',
                  wordBreak: 'break-all',
                  fontFamily: 'monospace'
                }}
              >
                {walletAddress || 'Cüzdan bulunamadı'}
              </Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, backgroundColor: '#ffffff' }}>
          <Button
            onClick={() => {
              setShowProfile(false);
              setShowFaceModal(true);
              startFaceCamera();
            }}
            startIcon={<FaceIcon />}
            sx={{
              py: 1,
              borderRadius: 1.5,
              fontWeight: 900,
              textTransform: 'none',
              color: '#064e3b',
              background: 'linear-gradient(135deg, #a7f3d0 0%, #6ee7b7 48%, #34d399 100%)',
              boxShadow: '0 12px 28px rgba(16, 185, 129, 0.18)',
              '&:hover': {
                background: 'linear-gradient(135deg, #8ff0c1 0%, #5bdca8 48%, #2cc98f 100%)',
                boxShadow: '0 14px 32px rgba(16, 185, 129, 0.24)'
              }
            }}
          >
            Yüz Ekle
          </Button>
          <Button
            onClick={() => setShowProfile(false)}
            sx={{
              borderRadius: 1.5,
              fontWeight: 800,
              textTransform: 'none',
              color: '#7f1d1d',
              border: '1px solid rgba(239, 68, 68, 0.26)',
              backgroundColor: 'rgba(254, 226, 226, 0.86)',
              '&:hover': {
                borderColor: '#ef4444',
                backgroundColor: 'rgba(254, 202, 202, 0.95)'
              }
            }}
          >
            Kapat
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default SimpleVoting;
