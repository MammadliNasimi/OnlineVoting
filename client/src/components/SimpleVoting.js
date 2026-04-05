import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Button, Card, CardContent, CircularProgress, Alert,
  MenuItem, Select, FormControl, InputLabel, List, ListItem, ListItemText, Snackbar,
  Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material';
import FaceIcon from '@mui/icons-material/Face';
import HowToVoteIcon from '@mui/icons-material/HowToVote';
import HistoryIcon from '@mui/icons-material/History';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PersonIcon from '@mui/icons-material/Person';
import { io } from 'socket.io-client';
import { signVoteClientSide, getBurnerWallet } from '../LocalIdentity';

const API_BASE = 'http://localhost:5000/api';
const SOCKET_URL = 'http://localhost:5000';

function SimpleVoting({ user, sessionId, onLogout }) {
  const queryClient = useQueryClient();
  const [selectedElectionId, setSelectedElectionId] = useState('');
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [queueMsg, setQueueMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!user || !user.id) return;
    
    // Initialize or load burner wallet silently
    try { getBurnerWallet(); } catch(e) { console.error('Ethers error: ', e) }

    // Connect to WebSocket
    const socket = io(SOCKET_URL, {
      withCredentials: true
    });

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
      // Refresh candidates & elections transparently in the background 
      // if someone else votes, to keep the UI up-to-date.
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

  // 1. Fetch Elections
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

  // 2. Fetch Candidates
  const { data: candidates = [], isLoading: isLoadingCandidates } = useQuery({
    queryKey: ['candidates', selectedElectionId],
    queryFn: async () => {
      const res = await axios.get(`${API_BASE}/candidates/${selectedElectionId}`);
      return res.data;
    },
    enabled: !!selectedElectionId
  });

  // 3. Fetch Voting History
  const { data: votingHistory = [], isLoading: isLoadingHistory } = useQuery({
    queryKey: ['votingHistory'],
    queryFn: async () => {
      const res = await axios.get(`${API_BASE}/voting-history`);
      return res.data;
    }
  });

  // 4. Vote Mutation
  const voteMutation = useMutation({
    mutationFn: async () => {
      const currentElection = elections.find(e => e.id === Number(selectedElectionId));
      const electionBlockchainId = currentElection ? (currentElection.blockchain_election_id !== undefined ? currentElection.blockchain_election_id : currentElection.id) : selectedElectionId;
      const candidateBlockchainId = selectedCandidate.blockchain_candidate_id !== undefined ? selectedCandidate.blockchain_candidate_id : selectedCandidate.id;

      // 1. Genereate Client-Side Burner Signature locally (No MetaMask required!)
      const voteData = await signVoteClientSide(
        candidateBlockchainId,
        electionBlockchainId
      );

      // 2. Relay the vote wrapper to Backend Node.js
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

  const [showFaceModal, setShowFaceModal] = useState(false);
  const [faceMessage, setFaceMessage] = useState('');
  const [faceLoading, setFaceLoading] = useState(false);
  const videoRef = React.useRef(null);
  const streamRef = React.useRef(null);

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
      const detection = await faceapi.detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
                                     .withFaceLandmarks()
                                     .withFaceDescriptor();
      if (!detection) {
        setFaceMessage('Yüz algılanamadı. Lütfen kameraya net bakın.');
        setFaceLoading(false);
        return;
      }
      const descriptor = Array.from(detection.descriptor);
      await axios.post(`${API_BASE}/face/register`, { faceDescriptor: descriptor }, { headers: { 'x-session-id': sessionId }, withCredentials: true });
      setFaceMessage('Yüz profilinize eklendi!');
      setTimeout(() => setShowFaceModal(false), 2000);
    } catch (err) {
      setFaceMessage(err.response?.data?.message || 'Bir hata oluştu.');
    } finally {
      setFaceLoading(false);
    }
  };

  return (
    <Box sx={{ p: 4, maxWidth: 800, mx: 'auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <HowToVoteIcon fontSize="large" color="primary" /> Oylama Sistemi
        </Typography>
        <Box>
          <Button
            variant="outlined"
            startIcon={<PersonIcon />}
            onClick={() => setShowProfile(true)}
            sx={{ mr: 2 }}
          >
            Profil
          </Button>
          <Button
            variant="outlined"
            startIcon={<FaceIcon />}
            onClick={() => { setShowFaceModal(true); startFaceCamera(); }}
            sx={{ mr: 2 }}
          >
            Yüz Ekle
          </Button>
          <Button
            variant="outlined"
            startIcon={<HistoryIcon />}
            onClick={() => setShowHistory(true)}
            sx={{ mr: 2 }}
          >
            Oy Geçmişi
          </Button>
          <Button variant="contained" color="error" onClick={onLogout}>Çıkış</Button>
        </Box>
      </Box>

      <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
        <strong>{user.name}</strong> — {user.role === 'admin' ? 'Yönetici' : 'Vatandaş'}
      </Alert>

      {(electionsError || voteMutation.isError || errorMsg) && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {errorMsg || voteMutation.error?.response?.data?.message || 'Bir hata oluştu'}
        </Alert>
      )}
      {successMsg && <Alert severity="success" sx={{ mb: 3 }}>{successMsg}</Alert>}
      {queueMsg && (
        <Alert severity="info" icon={<CircularProgress size={20} />} sx={{ mb: 3 }}>
          {queueMsg}
        </Alert>
      )}

      <Card elevation={3} sx={{ borderRadius: 3 }}>
        <CardContent>
          <Typography variant="h5" gutterBottom>Oy Kullan</Typography>
          {isLoadingElections ? <CircularProgress sx={{ display: 'block', mx: 'auto', my: 4 }} /> : elections.length === 0 ? (
            <Typography color="text.secondary" align="center" sx={{ py: 4 }}>Sizin domainde uygun secim yok veya daha baslatilmadi.</Typography>
          ) : (
            <>
              <FormControl fullWidth sx={{ mb: 4, mt: 2 }}>
                <InputLabel>Seçim</InputLabel>
                <Select value={selectedElectionId} label="Seçim" onChange={handleElectionChange}>
                  {elections.map(el => (
                    <MenuItem key={el.id} value={el.id}>{el.title}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              {selectedElectionId && (
                <Box sx={{ mb: 4 }}>
                  <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>Aday Seçin:</Typography>
                  {isLoadingCandidates ? <CircularProgress size={30} /> : candidates.length === 0 ? (
                    <Typography color="text.secondary">Bu seçim için aday bulunmuyor</Typography>
                  ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {candidates.map(c => {
                        const isSelected = selectedCandidate?.id === c.id;
                        return (
                          <Box
                            key={c.id}
                            onClick={() => setSelectedCandidate(c)}
                            sx={{
                              p: 2,
                              border: '2px solid',
                              borderColor: isSelected ? 'primary.main' : 'grey.300',
                              bgcolor: isSelected ? 'primary.50' : 'background.paper',
                              borderRadius: 2,
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              '&:hover': {
                                borderColor: isSelected ? 'primary.main' : 'grey.400'
                              }
                            }}
                          >
                            <Typography variant="h6">{c.name}</Typography>
                            {isSelected && <CheckCircleIcon color="primary" />}
                          </Box>
                        )
                      })}
                    </Box>
                  )}
                </Box>
              )}

              {selectedCandidate && (
                <Button
                  variant="contained"
                  color="primary"
                  size="large"
                  fullWidth
                  onClick={handleVoteSubmit}
                  disabled={voteMutation.isPending}
                  startIcon={voteMutation.isPending ? <CircularProgress size={24} color="inherit" /> : <CheckCircleIcon />}
                  sx={{ py: 1.5, fontSize: '1.1rem', borderRadius: 2 }}
                >
                  {voteMutation.isPending ? 'Gönderiliyor...' : 'Oyu Onayla ve Gönder'}
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* History Modal */}
      <Dialog open={showHistory} onClose={() => setShowHistory(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Oy Geçmişi</DialogTitle>
        <DialogContent dividers>
          {isLoadingHistory ? <CircularProgress sx={{ display: 'block', mx: 'auto', my: 4 }} /> : votingHistory.length === 0 ? (
            <Typography color="text.secondary" align="center" sx={{ py: 4 }}>Henüz oy kullanılmamış</Typography>
          ) : (
            <List>
              {votingHistory.map((vote, idx) => (
                <React.Fragment key={idx}>
                  <ListItem alignItems="flex-start" sx={{ bgcolor: 'grey.50', mb: 1, borderRadius: 2 }}>
                    <ListItemText
                      primary={<Typography variant="subtitle1" fontWeight="bold">Seçim: {vote.election_title}</Typography>}
                      secondary={
                        <React.Fragment>
                          <Typography component="span" variant="body2" color="text.primary" display="block">
                            Aday: {vote.candidate_name}
                          </Typography>
                          Tarih: {new Date(vote.timestamp).toLocaleString('tr-TR')}
                        </React.Fragment>
                      }
                    />
                  </ListItem>
                </React.Fragment>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowHistory(false)}>Kapat</Button>
        </DialogActions>
      </Dialog>

      {/* Face Registration Modal */}
      <Dialog open={showFaceModal} onClose={() => setShowFaceModal(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Yüz Profilimi Ekle</DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Alert severity="info" sx={{ mb: 2, w: '100%' }}>
            Yüz verilerinizi ekleyerek sisteme hızlı ve güvenli şekilde giriş yapabilirsiniz.
          </Alert>
          <Box sx={{ width: '100%', maxWidth: 400, minHeight: 300, bgcolor: '#000', borderRadius: 2, overflow: 'hidden', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            {!videoRef.current?.srcObject && <CircularProgress sx={{ position: 'absolute' }} />}
          </Box>
          {faceMessage && (
            <Typography variant="body2" color="primary" sx={{ mt: 2, textAlign: 'center' }}>{faceMessage}</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowFaceModal(false)}>İptal</Button>
          <Button variant="contained" onClick={handleRegisterFace} disabled={faceLoading}>
            {faceLoading ? <CircularProgress size={24} color="inherit" /> : 'Yüz Verimi Kaydet'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={showProfile} onClose={() => setShowProfile(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Profilim</DialogTitle>
        <DialogContent dividers>
          <Typography variant="h6" gutterBottom>Kullanıcı Bilgileri</Typography>
          <List>
            <ListItem sx={{ py: 0.5 }}>
              <ListItemText primary="İsim" secondary={user.name} />
            </ListItem>
            <ListItem sx={{ py: 0.5 }}>
              <ListItemText primary="E-Posta" secondary={user.email || 'Belirtilmemiş'} />
            </ListItem>
            <ListItem sx={{ py: 0.5 }}>
              <ListItemText 
                primary="Öğrenci/Kurum Numarası" 
                secondary={
                  user.email && (user.email.endsWith('@gmail.com') || user.email.endsWith('@hotmail.com') || user.email.endsWith('@yahoo.com') || user.email.endsWith('@outlook.com')) 
                  ? 'Sivil Vatandaş Kaydı (Numara Gerekmez)' 
                  : (user.student_id || 'Belirtilmemiş')
                } 
              />
            </ListItem>
            <ListItem sx={{ py: 0.5 }}>
              <ListItemText primary="Rol" secondary={user.role === 'admin' ? 'Yönetici' : 'Vatandaş'} />
            </ListItem>
            <ListItem sx={{ py: 0.5, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <Typography variant="body2" color="text.secondary">Bağlı Olduğunuz Cüzdan (Oylama için oluşturulan anonim adres)</Typography>
              <Typography variant="body2" sx={{ wordBreak: 'break-all', fontFamily: 'monospace', mt: 1, bgcolor: 'grey.100', p: 1, borderRadius: 1 }}>
                {(() => { try { return getBurnerWallet().address; } catch(e) { return 'Cüzdan bulunamadı'; } })()}
              </Typography>
            </ListItem>
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowProfile(false)}>Kapat</Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
}

export default SimpleVoting;
