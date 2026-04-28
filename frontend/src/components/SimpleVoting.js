import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, Box, CircularProgress } from '@mui/material';
import { io } from 'socket.io-client';
import Confetti from 'react-confetti';
import {
  changeBurnerPin,
  getBurnerAddress,
  resetBurnerWallet,
  signVoteClientSide
} from '../LocalIdentity';
import VotingHeader from './voting/VotingHeader';
import VotingMainPanel from './voting/VotingMainPanel';
import VotingSidebar from './voting/VotingSidebar';
import { FaceDialog, HistoryDialog, ProfileDialog } from './voting/VotingDialogs';
import { getPublicEmailType } from './voting/utils';
import useFaceRegistration from './voting/useFaceRegistration';

import { API_BASE, SOCKET_URL } from '../config';

function SimpleVoting({ user, sessionId, onLogout }) {
  const queryClient = useQueryClient();

  const [selectedElectionId, setSelectedElectionId] = useState('');
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [queueMsg, setQueueMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [walletCopied, setWalletCopied] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');

  // Konfeti state — oy blokzincire yazıldığında 5 sn patlıyor.
  const [showConfetti, setShowConfetti] = useState(false);
  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const confettiTimerRef = useRef(null);

  // Ekran boyutu değişince konfeti alanını güncelle.
  useEffect(() => {
    const handleResize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const {
    showFaceModal,
    setShowFaceModal,
    faceMessage,
    faceLoading,
    videoRef,
    startFaceCamera,
    handleRegisterFace
  } = useFaceRegistration(sessionId, API_BASE);

  // Konfeti'yi tetikle — balonları 5 sn sonra durdur.
  const triggerConfetti = () => {
    setShowConfetti(true);
    if (confettiTimerRef.current) clearTimeout(confettiTimerRef.current);
    confettiTimerRef.current = setTimeout(() => setShowConfetti(false), 5000);
  };

  useEffect(() => {
    if (!user || !user.id) return;

    // Burner cüzdan artik PIN ile şifreli; ilk oy verme anına kadar açmıyoruz.
    // Sadece adres okuyabilmek için kasada kayıt varsa o yeterli.

    const socket = io(SOCKET_URL, { withCredentials: true });
    socket.on('connect', () => socket.emit('join', user.id));

    socket.on('voteProcessed', (data) => {
      if (data.success) {
        setSuccessMsg(data.message || 'Oyunuz basariyla blokzincire yazildi!');
        setQueueMsg('');
        triggerConfetti();
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
      setErrorMsg(data.message || 'Oy islemi basarisiz oldu');
      setQueueMsg('');
      setTimeout(() => setErrorMsg(''), 5000);
    });

    return () => {
      socket.disconnect();
      if (confettiTimerRef.current) clearTimeout(confettiTimerRef.current);
    };
  }, [user, queryClient]); // eslint-disable-line react-hooks/exhaustive-deps

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

  useEffect(() => {
    if (!Array.isArray(elections) || elections.length === 0) {
      setSelectedElectionId('');
      return;
    }

    const selectedExists = elections.some(e => e.id === Number(selectedElectionId));
    if (!selectedExists) {
      setSelectedElectionId(elections[0].id);
      setSelectedCandidate(null);
    }
  }, [elections, selectedElectionId]);

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

  const refreshWalletAddress = useCallback(() => {
    try {
      setWalletAddress(getBurnerAddress());
    } catch {
      setWalletAddress('');
    }
  }, []);

  useEffect(() => {
    refreshWalletAddress();
  }, [refreshWalletAddress]);

  const visibleHistory = votingHistory.slice(0, 3);

  const voteMutation = useMutation({
    onMutate: () => {
      // Yeni oy denemesinde eski durum mesajlarını temizle.
      setErrorMsg('');
      setSuccessMsg('');
      setQueueMsg('');
    },
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
      setErrorMsg('');
      if (res.data.status === 'queued') {
        setQueueMsg(res.data.message || 'Oyunuz havuza alindi, isleniyor...');
        setTimeout(() => setQueueMsg(''), 6000);
      } else {
        setSuccessMsg(res.data.message || 'Oyunuz basariyla kaydedildi!');
        triggerConfetti();
        queryClient.invalidateQueries({ queryKey: ['votingHistory'] });
        queryClient.invalidateQueries({ queryKey: ['elections'] });
        setTimeout(() => setSuccessMsg(''), 5000);
      }
      setSelectedCandidate(null);
    },
    onError: (err) => {
      setQueueMsg('');
      // PIN iptali / yanlis PIN durumlari kullanici dostu mesaj olarak gosterilsin.
      const local = err?.message;
      const remote = err?.response?.data?.message;
      const msg = remote || local || 'Oy işlemi başarısız oldu';
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(''), 6000);
    }
  });

  const handleElectionChange = (e) => {
    setSelectedElectionId(e.target.value);
    setSelectedCandidate(null);
  };

  const handleVoteSubmit = () => {
    if (selectedCandidate) voteMutation.mutate();
  };

  const handleCopyWallet = async () => {
    if (!walletAddress || !navigator.clipboard) return;
    await navigator.clipboard.writeText(walletAddress);
    setWalletCopied(true);
    setTimeout(() => setWalletCopied(false), 1800);
  };

  const handleChangePin = async () => {
    const oldPin = window.prompt('Mevcut PIN girin');
    if (oldPin === null) return;
    const newPin = window.prompt('Yeni PIN girin (en az 4 karakter)');
    if (newPin === null) return;
    const confirmPin = window.prompt('Yeni PIN tekrar girin');
    if (confirmPin === null) return;

    if (!newPin || newPin.length < 4) {
      setErrorMsg('Yeni PIN en az 4 karakter olmalı.');
      setTimeout(() => setErrorMsg(''), 5000);
      return;
    }
    if (newPin !== confirmPin) {
      setErrorMsg('Yeni PIN alanları eşleşmiyor.');
      setTimeout(() => setErrorMsg(''), 5000);
      return;
    }

    try {
      await changeBurnerPin(oldPin, newPin);
      setSuccessMsg('PIN başarıyla değiştirildi.');
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err) {
      setErrorMsg(err?.message || 'PIN değiştirilemedi.');
      setTimeout(() => setErrorMsg(''), 5000);
    }
  };

  const handleResetWallet = () => {
    const ok = window.confirm(
      'Cüzdan sıfırlanırsa mevcut burner cüzdan erişimi kaybolur. Devam etmek istiyor musunuz?'
    );
    if (!ok) return;
    resetBurnerWallet();
    refreshWalletAddress();
    setSuccessMsg('Cüzdan sıfırlandı. İlk oy işleminde yeni PIN belirleyerek yeni cüzdan oluşturabilirsiniz.');
    setTimeout(() => setSuccessMsg(''), 7000);
  };

  const userRole = user.role === 'admin' ? 'Yonetici' : 'Vatandas';
  const userInitial = (user.name || 'U').slice(0, 1).toUpperCase();
  const studentLabel = getPublicEmailType(user.email || '')
    ? 'Sivil Vatandas Kaydi'
    : (user.student_id || '-');

  return (
    <>
    {/* Konfeti — fixed pozisyonda tüm viewport üzerinde patlıyor */}
    {showConfetti && (
      <Confetti
        width={windowSize.width}
        height={windowSize.height}
        recycle={false}
        numberOfPieces={340}
        gravity={0.28}
        colors={['#10b981', '#34d399', '#4f46e5', '#a78bfa', '#fbbf24', '#f59e0b', '#06b6d4', '#fff']}
        style={{ position: 'fixed', top: 0, left: 0, zIndex: 9999, pointerEvents: 'none' }}
      />
    )}
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
        <VotingHeader
          user={user}
          onLogout={onLogout}
          onShowProfile={() => setShowProfile(true)}
          onShowFace={() => {
            setShowFaceModal(true);
            startFaceCamera();
          }}
          onShowHistory={() => setShowHistory(true)}
        />

        {(electionsError || voteMutation.isError || errorMsg) && (
          <Alert severity="error" sx={{ mb: 2.5, borderRadius: 1.5 }}>
            {errorMsg || voteMutation.error?.response?.data?.message || 'Bir hata olustu'}
          </Alert>
        )}

        {successMsg && <Alert severity="success" sx={{ mb: 2.5, borderRadius: 1.5 }}>{successMsg}</Alert>}
        {queueMsg && (
          <Alert severity="info" icon={<CircularProgress size={20} />} sx={{ mb: 2.5, borderRadius: 1.5 }}>
            {queueMsg}
          </Alert>
        )}

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.65fr) minmax(320px, 0.8fr)' }, gap: 3 }}>
          <VotingMainPanel
            elections={elections}
            selectedElection={selectedElection}
            selectedElectionId={selectedElectionId}
            handleElectionChange={handleElectionChange}
            isLoadingElections={isLoadingElections}
            candidates={candidates}
            isLoadingCandidates={isLoadingCandidates}
            selectedCandidate={selectedCandidate}
            setSelectedCandidate={setSelectedCandidate}
            handleVoteSubmit={handleVoteSubmit}
            votePending={voteMutation.isPending}
          />

          <VotingSidebar
            user={user}
            userInitial={userInitial}
            userRole={userRole}
            walletAddress={walletAddress}
            isLoadingHistory={isLoadingHistory}
            visibleHistory={visibleHistory}
            onShowHistory={() => setShowHistory(true)}
          />
        </Box>
      </Box>

      <HistoryDialog
        open={showHistory}
        onClose={() => setShowHistory(false)}
        isLoadingHistory={isLoadingHistory}
        votingHistory={votingHistory}
        burnerAddress={walletAddress}
      />

      <FaceDialog
        open={showFaceModal}
        onClose={() => setShowFaceModal(false)}
        videoRef={videoRef}
        faceMessage={faceMessage}
        faceLoading={faceLoading}
        onSave={handleRegisterFace}
      />

      <ProfileDialog
        open={showProfile}
        onClose={() => setShowProfile(false)}
        onOpenFace={() => {
          setShowProfile(false);
          setShowFaceModal(true);
          startFaceCamera();
        }}
        onChangePin={handleChangePin}
        onResetWallet={handleResetWallet}
        user={user}
        userInitial={userInitial}
        userRole={userRole}
        studentLabel={studentLabel}
        walletAddress={walletAddress}
        walletCopied={walletCopied}
        onCopyWallet={handleCopyWallet}
      />
    </Box>
    </>
  );
}

export default SimpleVoting;
