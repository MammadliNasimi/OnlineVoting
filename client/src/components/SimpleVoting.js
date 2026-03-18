import React, { useState } from 'react';
import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Box, Typography, Button, Card, CardContent, CircularProgress, Alert, 
  MenuItem, Select, FormControl, InputLabel, List, ListItem, ListItemText
} from '@mui/material';
import HowToVoteIcon from '@mui/icons-material/HowToVote';
import HistoryIcon from '@mui/icons-material/History';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

const API_BASE = 'http://localhost:5000/api';

function SimpleVoting({ user, sessionId, onLogout }) {
  const queryClient = useQueryClient();
  const [selectedElectionId, setSelectedElectionId] = useState('');
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // 1. Fetch Elections
  const { data: elections = [], isLoading: isLoadingElections, error: electionsError } = useQuery({
    queryKey: ['elections'],
    queryFn: async () => {
      const res = await axios.get(`${API_BASE}/elections`, { headers: { 'x-session-id': sessionId } });
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
      const res = await axios.get(`${API_BASE}/voting-history`, { headers: { 'x-session-id': sessionId } });
      return res.data;
    }
  });

  // 4. Vote Mutation
  const voteMutation = useMutation({
    mutationFn: async () => {
      return axios.post(
        `${API_BASE}/vote/simple`,
        { electionId: selectedElectionId, candidateId: selectedCandidate.id },
        { headers: { 'x-session-id': sessionId } }
      );
    },
    onSuccess: () => {
      setSuccessMsg('Oyunuz başarıyla kaydedildi!');
      setSelectedCandidate(null);
      queryClient.invalidateQueries({ queryKey: ['votingHistory'] });
      queryClient.invalidateQueries({ queryKey: ['elections'] });
      setTimeout(() => setSuccessMsg(''), 3000);
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

  return (
    <Box sx={{ p: 4, maxWidth: 800, mx: 'auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <HowToVoteIcon fontSize="large" color="primary" /> Oylama Sistemi
        </Typography>
        <Box>
          <Button 
            variant="outlined" 
            startIcon={<HistoryIcon />} 
            onClick={() => setShowHistory(!showHistory)}
            sx={{ mr: 2 }}
          >
            {showHistory ? 'Oy Kullan' : 'Oy Geçmişi'}
          </Button>
          <Button variant="contained" color="error" onClick={onLogout}>Çıkış</Button>
        </Box>
      </Box>

      <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
        <strong>{user.name}</strong> — {user.role === 'admin' ? 'Yönetici' : 'Vatandaş'}
      </Alert>

      {(electionsError || voteMutation.isError) && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {voteMutation.error?.response?.data?.message || 'Bir hata oluştu'}
        </Alert>
      )}
      {successMsg && <Alert severity="success" sx={{ mb: 3 }}>{successMsg}</Alert>}

      {showHistory ? (
        <Card elevation={3} sx={{ borderRadius: 3 }}>
          <CardContent>
            <Typography variant="h5" gutterBottom>Oy Geçmişi</Typography>
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
          </CardContent>
        </Card>
      ) : (
        <Card elevation={3} sx={{ borderRadius: 3 }}>
          <CardContent>
            <Typography variant="h5" gutterBottom>Oy Kullan</Typography>
            {isLoadingElections ? <CircularProgress sx={{ display: 'block', mx: 'auto', my: 4 }} /> : elections.length === 0 ? (
              <Typography color="text.secondary" align="center" sx={{ py: 4 }}>Size ait aktif seçim bulunmuyor</Typography>
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
      )}
    </Box>
  );
}

export default SimpleVoting;
