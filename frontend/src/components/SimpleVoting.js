import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, Box, CircularProgress } from '@mui/material';
import { io } from 'socket.io-client';
import { getBurnerWallet, signVoteClientSide } from '../LocalIdentity';
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

  const {
    showFaceModal,
    setShowFaceModal,
    faceMessage,
    faceLoading,
    videoRef,
    startFaceCamera,
    handleRegisterFace
  } = useFaceRegistration(sessionId, API_BASE);

  useEffect(() => {
    if (!user || !user.id) return;

    try {
      getBurnerWallet();
    } catch (e) {
      console.error('Ethers error:', e);
    }

    const socket = io(SOCKET_URL, { withCredentials: true });
    socket.on('connect', () => socket.emit('join', user.id));

    socket.on('voteProcessed', (data) => {
      if (data.success) {
        setSuccessMsg(data.message || 'Oyunuz basariyla blokzincire yazildi!');
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
      setErrorMsg(data.message || 'Oy islemi basarisiz oldu');
      setQueueMsg('');
      setTimeout(() => setErrorMsg(''), 5000);
    });

    return () => socket.disconnect();
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

  const walletAddress = useMemo(() => {
    try {
      return getBurnerWallet().address;
    } catch {
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
        setQueueMsg(res.data.message || 'Oyunuz havuza alindi, isleniyor...');
        setTimeout(() => setQueueMsg(''), 6000);
      } else {
        setSuccessMsg(res.data.message || 'Oyunuz basariyla kaydedildi!');
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
    if (selectedCandidate) voteMutation.mutate();
  };

  const handleCopyWallet = async () => {
    if (!walletAddress || !navigator.clipboard) return;
    await navigator.clipboard.writeText(walletAddress);
    setWalletCopied(true);
    setTimeout(() => setWalletCopied(false), 1800);
  };

  const userRole = user.role === 'admin' ? 'Yonetici' : 'Vatandas';
  const userInitial = (user.name || 'U').slice(0, 1).toUpperCase();
  const studentLabel = getPublicEmailType(user.email || '')
    ? 'Sivil Vatandas Kaydi'
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
        user={user}
        userInitial={userInitial}
        userRole={userRole}
        studentLabel={studentLabel}
        walletAddress={walletAddress}
        walletCopied={walletCopied}
        onCopyWallet={handleCopyWallet}
      />
    </Box>
  );
}

export default SimpleVoting;
