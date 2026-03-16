import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

function SimpleVoting({ user, sessionId, onLogout }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [elections, setElections] = useState([]);
  const [selectedElection, setSelectedElection] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  
  const [votingHistory, setVotingHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [voteResults, setVoteResults] = useState([]);

  const API_BASE = 'http://localhost:5000/api';

  const loadCandidates = useCallback(async (electionId) => {
    try {
      const res = await axios.get(`${API_BASE}/candidates/${electionId}`);
      setCandidates(res.data);
    } catch (err) {
      setError('Adaylar yüklenemedi');
    }
  }, [API_BASE]);

  const loadElections = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE}/elections`, {
        headers: { 'x-session-id': sessionId }
      });
      setElections(response.data);
      if (response.data.length > 0) {
        setSelectedElection(response.data[0]);
        loadCandidates(response.data[0].id);
      }
    } catch (err) {
      console.error('Seçimler yüklenemedi:', err);
      setError('Seçimler yüklenemedi');
    }
  }, [API_BASE, sessionId, loadCandidates]);

  const loadVotingHistory = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/voting-history`, {
        headers: { 'x-session-id': sessionId }
      });
      setVotingHistory(res.data || []);
    } catch (err) {
      console.error('Oy geçmişi yüklenemedi:', err);
    }
  }, [API_BASE, sessionId]);

  const loadVoteResults = useCallback(async (electionId) => {
    try {
      const res = await axios.get(`${API_BASE}/votes`, { params: { electionId } });
      setVoteResults(res.data || []);
    } catch (err) {
      console.error('Canli sonuclar yuklenemedi:', err);
    }
  }, [API_BASE]);

  useEffect(() => {
    loadElections();
    loadVotingHistory();
  }, [loadElections, loadVotingHistory]);

  useEffect(() => {
    if (!selectedElection?.id) return undefined;

    loadVoteResults(selectedElection.id);
    const intervalId = window.setInterval(() => {
      loadVoteResults(selectedElection.id);
    }, 3000);

    return () => window.clearInterval(intervalId);
  }, [selectedElection?.id, loadVoteResults]);

  const submitVote = async () => {
    if (!selectedCandidate) {
      setError('Lütfen bir aday seçin');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await axios.post(
        `${API_BASE}/vote/simple`,
        {
          electionId: selectedElection.id,
          candidateId: selectedCandidate.id
        },
        { headers: { 'x-session-id': sessionId } }
      );

      setSuccess('Oyunuz başarıyla kaydedildi!');
      setSelectedCandidate(null);
      loadVotingHistory();
      loadVoteResults(selectedElection.id);
      
      // Refresh elections list
      setTimeout(() => {
        loadElections();
        setSuccess('');
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Oy gönderilemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleElectionChange = (electionId) => {
    const election = elections.find(e => e.id === parseInt(electionId));
    setSelectedElection(election);
    setSelectedCandidate(null);
    loadCandidates(election.id);
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>🗳️ Oylama Sistemi</h2>
        <div>
          <button 
            onClick={() => setShowHistory(!showHistory)} 
            style={{ padding: '8px 16px', marginRight: '10px', cursor: 'pointer', borderRadius: '4px', border: '1px solid #ddd', background: '#fff' }}
          >
            {showHistory ? '← Oylama' : '📋 Geçmiş'}
          </button>
          <button 
            onClick={onLogout} 
            style={{ padding: '8px 16px', cursor: 'pointer', borderRadius: '4px', border: '1px solid #ddd', background: '#fff' }}
          >
            Çıkış
          </button>
        </div>
      </div>

      <div style={{ marginBottom: '16px', padding: '12px', background: '#f0f0f0', borderRadius: '8px' }}>
        <strong>{user.name}</strong> — {user.role}
      </div>

      {error && (
        <div style={{ padding: '12px', background: '#fee', border: '1px solid #fcc', borderRadius: '6px', marginBottom: '14px', color: '#c33' }}>
          ❌ {error}
        </div>
      )}
      
      {success && (
        <div style={{ padding: '12px', background: '#efe', border: '1px solid #cfc', borderRadius: '6px', marginBottom: '14px', color: '#363' }}>
          ✅ {success}
        </div>
      )}

      {showHistory ? (
        <div style={{ padding: '20px', background: '#fff', borderRadius: '8px', border: '1px solid #ddd' }}>
          <h3>Oy Geçmişi</h3>
          {votingHistory.length === 0 ? (
            <p style={{ color: '#999', textAlign: 'center', padding: '20px' }}>Henüz oy kullanılmamış</p>
          ) : (
            <div>
              {votingHistory.map((vote, idx) => (
                <div key={idx} style={{ padding: '12px', margin: '10px 0', border: '1px solid #ddd', borderRadius: '6px', background: '#f9f9f9' }}>
                  <div><strong>Seçim:</strong> {vote.election_title}</div>
                  <div><strong>Aday:</strong> {vote.candidate_name}</div>
                  <div><strong>Tarih:</strong> {new Date(vote.timestamp).toLocaleString('tr-TR')}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div style={{ padding: '20px', background: '#fff', borderRadius: '8px', border: '1px solid #ddd' }}>
          <h3>Oy Kullan</h3>
          
          {elections.length === 0 ? (
            <p style={{ color: '#999', textAlign: 'center', padding: '20px' }}>
              Size ait aktif seçim bulunmuyor
            </p>
          ) : (
            <>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Seçim:</label>
                <select
                  value={selectedElection?.id || ''}
                  onChange={(e) => handleElectionChange(e.target.value)}
                  style={{ 
                    width: '100%', 
                    padding: '12px', 
                    borderRadius: '6px', 
                    border: '1px solid #ddd',
                    fontSize: '14px'
                  }}
                >
                  {elections.map(el => (
                    <option key={el.id} value={el.id}>{el.title}</option>
                  ))}
                </select>
              </div>

              {selectedElection && (
                <>
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Aday Seçin:</label>
                    {candidates.length === 0 ? (
                      <p style={{ color: '#999', padding: '10px' }}>Bu seçim için aday bulunmuyor</p>
                    ) : (
                      <div>
                        {candidates.map(c => (
                          <div
                            key={c.id}
                            onClick={() => setSelectedCandidate(c)}
                            style={{
                              padding: '16px',
                              margin: '8px 0',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              border: selectedCandidate?.id === c.id ? '2px solid #7c3aed' : '1px solid #ddd',
                              background: selectedCandidate?.id === c.id ? '#f3e8ff' : '#fff',
                              transition: 'all 0.2s'
                            }}
                          >
                            <strong style={{ fontSize: '16px' }}>{c.name}</strong>
                            {selectedCandidate?.id === c.id && (
                              <span style={{ float: 'right', color: '#7c3aed', fontSize: '20px' }}>✓</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {selectedCandidate && (
                    <button
                      onClick={submitVote}
                      disabled={loading}
                      style={{
                        padding: '14px 28px',
                        background: loading ? '#ccc' : '#4CAF50',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        width: '100%',
                        fontSize: '16px',
                        fontWeight: 'bold'
                      }}
                    >
                      {loading ? 'Gönderiliyor...' : '✓ Oyu Onayla ve Gönder'}
                    </button>
                  )}

                  <div style={{ marginTop: '24px' }}>
                    <h3>Canli Sonuclar</h3>
                    {voteResults.length === 0 ? (
                      <p style={{ color: '#999', padding: '10px 0' }}>Bu secim icin sonuc verisi bulunamadi.</p>
                    ) : (
                      <div>
                        {voteResults.map((r) => (
                          <div key={`${r.election_id}-${r.candidate_id}`} style={{ marginBottom: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                              <span>{r.candidate}</span>
                              <strong>{r.vote_count}</strong>
                            </div>
                            <div style={{ height: 8, borderRadius: 999, background: '#eee', overflow: 'hidden' }}>
                              <div
                                style={{
                                  height: '100%',
                                  width: `${Math.max(4, Math.min(100, (r.vote_count / Math.max(1, ...voteResults.map(v => v.vote_count))) * 100))}%`,
                                  background: '#4CAF50'
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default SimpleVoting;
