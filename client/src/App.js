import React, { useState, useEffect } from 'react';
import axios from 'axios';
import dayjs from 'dayjs';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';
import { formatTxHash } from './utils/crypto';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

const translations = {
  tr: {
    login: 'Giriş Yap',
    register: 'Kayıt Ol',
    registerAsUser: 'Kullanıcı Olarak Kayıt Ol',
    name: 'İsim',
    password: 'Şifre',
    user: 'Kullanıcı',
    candidate: 'Aday',
    castVote: 'Oy Kullan',
    submitVote: 'Oy Gönder',
    logout: 'Çıkış Yap',
    addCandidate: 'Aday Ekle',
    votingPeriod: 'Oylama Dönemi',
    start: 'Başlangıç',
    end: 'Bitiş',
    clear: 'Temizle',
    votingOpen: 'Oylama Açık',
    votingClosed: 'Oylama Kapalı',
    viewResults: 'Sonuçları Görüntüle',
    backToVoting: 'Oy Verme Sayfasına Dön',
    votingResults: 'Oylama Sonuçları',
    barChart: 'Bar Grafik',
    pieChart: 'Pasta Grafik'
  },
  en: {
    login: 'Login',
    register: 'Register',
    registerAsUser: 'Register as User',
    name: 'Name',
    password: 'Password',
    user: 'User',
    candidate: 'Candidate',
    castVote: 'Cast Vote',
    submitVote: 'Submit Vote',
    logout: 'Logout',
    addCandidate: 'Add Candidate',
    votingPeriod: 'Voting Period',
    start: 'Start',
    end: 'End',
    clear: 'Clear',
    votingOpen: 'Voting Open',
    votingClosed: 'Voting Closed',
    viewResults: 'View Results',
    backToVoting: 'Back to Voting',
    votingResults: 'Voting Results',
    barChart: 'Bar Chart',
    pieChart: 'Pie Chart'
  }
};

function App() {
  const [lang, setLang] = useState('tr');
  const t = translations[lang];
  const [currentPage, setCurrentPage] = useState('login');
  const [history, setHistory] = useState([]);
  const [feedbacks, setFeedbacks] = useState({});
  const [feedbackInput, setFeedbackInput] = useState({});
  const [votes, setVotes] = useState([]);
  const [candidate, setCandidate] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [votingPeriod, setVotingPeriod] = useState({ start: null, end: null });
  const [votingOpen, setVotingOpen] = useState(true);
  const [sessionId, setSessionId] = useState('');
  const [user, setUser] = useState(null);
  const [registerMode, setRegisterMode] = useState(false);
  const [registerStep, setRegisterStep] = useState(0); // 0=form, 1=OTP
  const [registerOtp, setRegisterOtp] = useState('');
  const [form, setForm] = useState({ name: '', password: '', email: '' });
  const [newCandidate, setNewCandidate] = useState('');
  const [txStatus, setTxStatus] = useState('');
  const [txHash, setTxHash] = useState('');

  // Fetch voting history
  const fetchHistory = async () => {
    try {
      const res = await axios.get('/api/voting-history', { headers: { 'x-session-id': sessionId } });
      setHistory(res.data);
    } catch {}
  };

  // Fetch feedbacks for all candidates
  const fetchAllFeedbacks = async () => {
    let all = {};
    for (const c of candidates) {
      try {
        const res = await axios.get(`/api/feedback/${c}`);
        all[c] = res.data;
      } catch {}
    }
    setFeedbacks(all);
  };

  const fetchVotingPeriod = async () => {
    try {
      const res = await axios.get('/api/voting-period');
      setVotingPeriod(res.data);
    } catch {}
  };

  const fetchVotes = async () => {
    try {
      const res = await axios.get('/api/votes');
      setVotes(res.data);
    } catch {}
  };

  const fetchCandidates = async () => {
    try {
      const res = await axios.get('/api/candidates');
      setCandidates(res.data);
      if (res.data.length > 0) setCandidate(res.data[0]);
    } catch {}
  };

  useEffect(() => {
    fetchVotes();
    fetchCandidates();
    fetchVotingPeriod();
    // Subscribe to candidate updates
    const eventSource = new window.EventSource('/api/candidates/subscribe');
    eventSource.onmessage = (e) => {
      try {
        const updatedCandidates = JSON.parse(e.data);
        setCandidates(updatedCandidates);
        if (!updatedCandidates.includes(candidate)) {
          setCandidate(updatedCandidates[0] || '');
        }
      } catch {}
    };
    return () => eventSource.close();
  }, []);

  useEffect(() => {
    if (candidates.length > 0) {
      fetchAllFeedbacks();
    }
  }, [candidates]);

  useEffect(() => {
    if (currentPage === 'history' && sessionId) {
      fetchHistory();
    }
  }, [currentPage, sessionId]);

  useEffect(() => {
    // Check voting open/closed status
    if (!votingPeriod.start && !votingPeriod.end) {
      setVotingOpen(true);
      return;
    }
    const now = new Date();
    const start = votingPeriod.start ? new Date(votingPeriod.start) : null;
    const end = votingPeriod.end ? new Date(votingPeriod.end) : null;
    if ((start && now < start) || (end && now > end)) {
      setVotingOpen(false);
    } else {
      setVotingOpen(true);
    }
  }, [votingPeriod]);

  const handleSetVotingPeriod = async (start, end) => {
    setError('');
    setInfo('');
    try {
      await axios.post('/api/voting-period', { start, end }, { headers: { 'x-session-id': sessionId } });
      setInfo('Voting period updated');
      fetchVotingPeriod();
    } catch (err) {
      setError(err.response?.data?.message || 'Voting period update failed');
    }
  };

  const handleLogin = async () => {
    setError('');
    try {
      const res = await axios.post('/api/login', { name: form.name, password: form.password });
      setSessionId(res.data.sessionId);
      setUser(res.data.user);
      setForm({ name: '', password: '', email: '' });
      if (res.data.user?.role === 'admin') {
        localStorage.setItem('adminSession', res.data.sessionId);
        localStorage.setItem('adminName', res.data.user.name);
        // Admin directly goes to the admin panel
        window.location.href = `http://localhost:5000/admin/dashboard?session=${res.data.sessionId}&name=${encodeURIComponent(res.data.user.name)}`;
        return;
      }
      setCurrentPage('vote');
    } catch (err) {
      setError(err.response?.data?.message || 'Giriş başarısız');
    }
  };

  const handleSendRegisterOtp = async () => {
    setError('');
    if (!form.email) { setError('OTP için e-posta adresi giriniz'); return; }
    try {
      const res = await axios.post('/api/register/send-otp', { email: form.email });
      setRegisterStep(1);
      setInfo(res.data.message);
      if (res.data.devOtp) setRegisterOtp(res.data.devOtp); // dev mode prefill
    } catch (err) {
      setError(err.response?.data?.message || 'OTP gönderilemedi');
    }
  };

  const handleRegister = async () => {
    setError('');
    try {
      await axios.post('/api/register', {
        name: form.name,
        password: form.password,
        email: form.email || undefined,
        otp: form.email ? registerOtp : undefined
      });
      setRegisterMode(false);
      setRegisterStep(0);
      setRegisterOtp('');
      setForm({ name: '', password: '', email: '' });
      setInfo('Kayıt başarılı! Şimdi giriş yapabilirsiniz.');
    } catch (err) {
      setError(err.response?.data?.message || 'Kayıt başarısız');
    }
  };

  const handleAddCandidate = async () => {
    setError('');
    try {
      await axios.post('/api/candidates', { name: newCandidate }, { headers: { 'x-session-id': sessionId } });
      setNewCandidate('');
      fetchCandidates();
    } catch (err) {
      setError(err.response?.data?.message || 'Error adding candidate');
    }
  };

  const submitVote = async () => {
    setError('');
    setInfo('');
    setTxStatus('');
    setTxHash('');
    
    if (!votingOpen) {
      setError('Voting is currently closed.');
      return;
    }
    
    const electionId = 1;
    const candidateId = candidates.indexOf(candidate);
    
    if (candidateId === -1) {
      setError('Geçersiz aday / Invalid candidate');
      return;
    }
    
    try {
      setTxStatus('Oy gönderiliyor... / Sending vote...');
      
      const response = await axios.post(
        '/api/votes',
        {
          candidate: candidate,
          electionId: electionId
        },
        {
          headers: { 'x-session-id': sessionId }
        }
      );
      
      setTxHash(response.data.transactionHash);
      setTxStatus('');
      setInfo(`✅ Oy başarıyla kaydedildi! / Vote submitted successfully! Transaction: ${formatTxHash(response.data.transactionHash)}`);
      
      fetchVotes();
      fetchHistory();
    } catch (err) {
      setTxStatus('');
      console.error('Vote error:', err);
      setError(err.response?.data?.message || 'Oy gönderilirken hata oluştu / Error submitting vote');
    }
  };

  const handleFeedbackSubmit = async (candidateName) => {
    const comment = feedbackInput[candidateName];
    if (!comment || !comment.trim()) return;
    setError('');
    try {
      await axios.post('/api/feedback', { candidate: candidateName, comment }, { headers: { 'x-session-id': sessionId } });
      setFeedbackInput(f => ({ ...f, [candidateName]: '' }));
      fetchAllFeedbacks();
    } catch (err) {
      setError(err.response?.data?.message || 'Error submitting feedback');
    }
  };

  const renderLogin = () => {
    const cardStyle = {
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Segoe UI', sans-serif",
    };
    const boxStyle = {
      background: 'rgba(255,255,255,0.06)',
      backdropFilter: 'blur(16px)',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: 24,
      padding: '48px 40px',
      width: 420,
      boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
      color: '#fff',
    };
    const tabStyle = (active) => ({
      flex: 1,
      padding: '10px 0',
      background: active ? 'linear-gradient(135deg, #667eea, #764ba2)' : 'transparent',
      border: 'none',
      borderRadius: 10,
      color: active ? '#fff' : 'rgba(255,255,255,0.5)',
      fontWeight: active ? 700 : 400,
      fontSize: 15,
      cursor: 'pointer',
      transition: 'all 0.2s',
    });
    const inputStyle = {
      width: '100%',
      padding: '13px 16px',
      background: 'rgba(255,255,255,0.08)',
      border: '1px solid rgba(255,255,255,0.15)',
      borderRadius: 12,
      color: '#fff',
      fontSize: 15,
      outline: 'none',
      boxSizing: 'border-box',
      marginBottom: 14,
    };
    const labelStyle = {
      display: 'block',
      fontSize: 12,
      color: 'rgba(255,255,255,0.55)',
      marginBottom: 5,
      marginTop: 2,
      letterSpacing: '0.05em',
      textTransform: 'uppercase',
    };
    const btnStyle = {
      width: '100%',
      padding: '14px',
      background: 'linear-gradient(135deg, #667eea, #764ba2)',
      border: 'none',
      borderRadius: 12,
      color: '#fff',
      fontSize: 16,
      fontWeight: 700,
      cursor: 'pointer',
      marginTop: 8,
      letterSpacing: '0.03em',
      boxShadow: '0 4px 20px rgba(102,126,234,0.4)',
    };

    return (
      <div style={cardStyle}>
        <div style={boxStyle}>
          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ fontSize: 42, marginBottom: 6 }}>🗳️</div>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px' }}>SSI Blockchain Oylama</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>
              ZK-Email • EIP-712 • Anonim Kimlik
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 4, marginBottom: 28 }}>
            <button style={tabStyle(!registerMode)} onClick={() => { setRegisterMode(false); setRegisterStep(0); setRegisterOtp(''); setError(''); setInfo(''); }}>
              Giriş Yap
            </button>
            <button style={tabStyle(registerMode)} onClick={() => { setRegisterMode(true); setRegisterStep(0); setRegisterOtp(''); setError(''); setInfo(''); }}>
              Kayıt Ol
            </button>
          </div>

          {/* Fields */}
          <div>
            <label style={labelStyle}>Kullanıcı Adı</label>
            <input
              style={inputStyle}
              type="text"
              placeholder="kullanici_adi"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && (registerMode ? handleRegister() : handleLogin())}
            />

            {registerMode && registerStep === 0 && (
              <>
                <label style={labelStyle}>Kurumsal E-posta (ZK-Email için)</label>
                <input
                  style={{ ...inputStyle, borderColor: form.email ? 'rgba(102,126,234,0.6)' : 'rgba(255,255,255,0.15)' }}
                  type="email"
                  placeholder="ad.soyad@akdeniz.edu.tr"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && handleSendRegisterOtp()}
                />
              </>
            )}

            {registerMode && registerStep === 1 && (
              <>
                <label style={labelStyle}>E-posta: <span style={{ color: '#a5d6a7' }}>{form.email}</span></label>
                <label style={labelStyle}>Doğrulama Kodu (OTP)</label>
                <input
                  style={{ ...inputStyle, letterSpacing: 6, fontSize: 22, textAlign: 'center', fontWeight: 700 }}
                  type="text"
                  placeholder="123456"
                  maxLength={6}
                  value={registerOtp}
                  onChange={e => setRegisterOtp(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={e => e.key === 'Enter' && handleRegister()}
                  autoFocus
                />
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>📧 {form.email} adresine 6 haneli kod gönderildi</div>
              </>
            )}

            {(!registerMode || registerStep === 0) && (
              <>
                <label style={labelStyle}>Şifre</label>
                <input
                  style={inputStyle}
                  type="password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && (registerMode ? handleSendRegisterOtp() : handleLogin())}
                />
              </>
            )}
          </div>

          {/* Error / Info */}
          {error && (
            <div style={{ background: 'rgba(244,67,54,0.15)', border: '1px solid rgba(244,67,54,0.35)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#ff8a80', marginBottom: 12 }}>
              ⚠️ {error}
            </div>
          )}
          {info && (
            <div style={{ background: 'rgba(76,175,80,0.15)', border: '1px solid rgba(76,175,80,0.35)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#a5d6a7', marginBottom: 12 }}>
              ✅ {info}
            </div>
          )}

          {/* Submit */}
          {registerMode && registerStep === 1 && (
            <button style={{ ...btnStyle, background: 'rgba(255,255,255,0.08)', marginBottom: 8 }}
              onClick={() => { setRegisterStep(0); setRegisterOtp(''); setError(''); setInfo(''); }}>
              ← Geri
            </button>
          )}
          <button
            style={btnStyle}
            onClick={registerMode ? (registerStep === 0 ? handleSendRegisterOtp : handleRegister) : handleLogin}
          >
            {!registerMode ? 'Giriş Yap' : registerStep === 0 ? 'Kod Gönder →' : 'Hesabı Oluştur ✓'}
          </button>

          {/* ZK-Email info badge on register */}
          {registerMode && (
            <div style={{ marginTop: 18, padding: '12px 16px', background: 'rgba(102,126,234,0.1)', border: '1px solid rgba(102,126,234,0.25)', borderRadius: 12, fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 }}>
              🔐 <strong style={{ color: 'rgba(255,255,255,0.8)' }}>ZK-Email oylama özelliği</strong> için kurumsal e-posta adresinizi girin. Oy kullanma ekranında OTP kodu ile kimliğinizi anonim olarak doğrulayacaksınız.
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderHistory = () => (
    <div>
      <h2>Oylama Geçmişi / Voting History</h2>
      {history.length === 0 ? (
        <p>Hiç oy kullanmadınız / No votes yet.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {history.map((v, i) => (
            <li key={i} style={{ marginBottom: 20, padding: 15, border: '1px solid #ddd', borderRadius: 8 }}>
              <div><strong>Seçim / Election:</strong> {v.election_title}</div>
              <div><strong>Aday / Candidate:</strong> {v.candidate_name}</div>
              <div><strong>Tarih / Date:</strong> {dayjs(v.voted_at).format('YYYY-MM-DD HH:mm')}</div>
              <div><strong>Transaction Hash:</strong> <code style={{ fontSize: 11 }}>{v.transaction_hash}</code></div>
            </li>
          ))}
        </ul>
      )}
      <button onClick={() => setCurrentPage('vote')}>{t.backToVoting}</button>
    </div>
  );

  const handleLogout = async () => {
    try {
      await axios.post('/api/logout', {}, { headers: { 'x-session-id': sessionId } });
    } catch (err) {
      console.error('Logout error:', err);
    }
    localStorage.removeItem('adminSession');
    localStorage.removeItem('adminName');
    setUser(null);
    setSessionId('');
    setForm({ name: '', password: '', email: '' });
    setError('');
    setInfo('');
    setCurrentPage('login');
  };

  const renderVotePage = () => (
    <div>
      <h2>{t.castVote}</h2>
      
      <div>
        <b>{t.user}:</b> {user?.name} <span style={{ marginLeft: 10, color: '#888' }}>({user?.role})</span>
        <span style={{ marginLeft: 20, color: votingOpen ? 'green' : 'red' }}>
          {votingOpen ? t.votingOpen : t.votingClosed}
        </span>
        <label style={{ marginLeft: 10 }}>
          {t.candidate}:
          <select value={candidate} onChange={e => setCandidate(e.target.value)}>
            {candidates.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
        <button 
          style={{ marginLeft: 10 }} 
          onClick={submitVote} 
          disabled={!votingOpen || !!txStatus}
        >
          {txStatus || t.submitVote}
        </button>
        <button style={{ marginLeft: 10 }} onClick={handleLogout}>{t.logout}</button>
      </div>
      
      {/* Transaction status */}
      {txHash && (
        <div style={{ marginTop: 10, padding: 10, background: '#e8f5e9', borderRadius: 6, fontSize: 14 }}>
          <b>Transaction Hash:</b> 
          <span style={{ marginLeft: 5, fontFamily: 'monospace', color: '#2e7d32' }}>
            {formatTxHash(txHash)}
          </span>
        </div>
      )}
      
      {user?.role === 'admin' && (
        <div style={{ marginTop: 20, background: '#f3f3f3', padding: 10, borderRadius: 6 }}>
          <b>{t.addCandidate}:</b>
          <input
            type="text"
            value={newCandidate}
            onChange={e => setNewCandidate(e.target.value)}
            placeholder={t.candidate}
            style={{ marginLeft: 10 }}
          />
          <button style={{ marginLeft: 10 }} onClick={handleAddCandidate}>{t.addCandidate}</button>
          <div style={{ marginTop: 20 }}>
            <b>{t.votingPeriod}:</b>
            <div style={{ marginTop: 5 }}>
              <label>{t.start}: <input type="datetime-local" value={votingPeriod.start ? dayjs(votingPeriod.start).format('YYYY-MM-DDTHH:mm') : ''} onChange={e => handleSetVotingPeriod(e.target.value, votingPeriod.end)} /></label>
              <label style={{ marginLeft: 10 }}>{t.end}: <input type="datetime-local" value={votingPeriod.end ? dayjs(votingPeriod.end).format('YYYY-MM-DDTHH:mm') : ''} onChange={e => handleSetVotingPeriod(votingPeriod.start, e.target.value)} /></label>
              <button style={{ marginLeft: 10 }} onClick={() => handleSetVotingPeriod(null, null)}>{t.clear}</button>
            </div>
            <div style={{ fontSize: 13, color: '#888', marginTop: 5 }}>
              {votingPeriod.start && <span>{t.start}: {dayjs(votingPeriod.start).format('YYYY-MM-DD HH:mm')}</span>}
              {votingPeriod.end && <span style={{ marginLeft: 10 }}>{t.end}: {dayjs(votingPeriod.end).format('YYYY-MM-DD HH:mm')}</span>}
            </div>
          </div>
        </div>
      )}
      {info && <div style={{ color: 'green', marginTop: 10 }}>{info}</div>}
      {error && <div style={{ color: 'red', marginTop: 10 }}>{error}</div>}
      <button onClick={() => setCurrentPage('results')} style={{ marginTop: 20 }}>{t.viewResults}</button>
      <button onClick={() => setCurrentPage('history')} style={{ marginTop: 20 }}>Oylama Geçmişi</button>
      {user?.role === 'admin' && (
        <button 
          onClick={() => window.open(`http://localhost:5000/admin/dashboard?session=${encodeURIComponent(sessionId)}&name=${encodeURIComponent(user.name)}`, '_blank')} 
          style={{ marginTop: 20, background: '#667eea', color: 'white' }}
        >
          🗄️ Database Monitor (Admin)
        </button>
      )}
    </div>
  );

  const renderResults = () => {
    // Adaylara göre oy sayısı
    const voteCounts = candidates.reduce((acc, c) => {
      acc[c] = votes.filter(v => v.candidate === c).length;
      return acc;
    }, {});

    const chartData = {
      labels: candidates,
      datasets: [
        {
          label: 'Votes',
          data: candidates.map(c => voteCounts[c]),
          backgroundColor: [
            '#4caf50', '#2196f3', '#ff9800', '#e91e63', '#9c27b0', '#00bcd4', '#ffc107', '#8bc34a', '#f44336', '#607d8b'
          ],
          borderWidth: 1,
        },
      ],
    };

    const pieData = {
      labels: candidates,
      datasets: [
        {
          data: candidates.map(c => voteCounts[c]),
          backgroundColor: [
            '#4caf50', '#2196f3', '#ff9800', '#e91e63', '#9c27b0', '#00bcd4', '#ffc107', '#8bc34a', '#f44336', '#607d8b'
          ],
        },
      ],
    };

    return (
      <div>
        <h2>{t.votingResults}</h2>
        <div style={{ maxWidth: 600, margin: '0 auto', display: 'flex', flexWrap: 'wrap', gap: 30, justifyContent: 'center' }}>
          <div style={{ width: 280, minWidth: 200 }}>
            <h4>{t.barChart}</h4>
            <Bar 
              key={`bar-${candidates.join('-')}-${votes.length}`}
              data={chartData} 
              options={{
                responsive: true,
                maintainAspectRatio: true,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true, precision: 0 } }
              }} 
            />
          </div>
          <div style={{ width: 280, minWidth: 200 }}>
            <h4>{t.pieChart}</h4>
            <Pie 
              key={`pie-${candidates.join('-')}-${votes.length}`}
              data={pieData} 
              options={{ 
                responsive: true,
                maintainAspectRatio: true,
                plugins: { legend: { position: 'bottom' } } 
              }} 
            />
          </div>
        </div>
        <div style={{ marginTop: 30 }}>
          <h3>Adaylara Yorumlar / Candidate Feedback</h3>
          {candidates.map(c => (
            <div key={c} style={{ marginBottom: 20, background: '#f3f3f3', borderRadius: 6, padding: 10 }}>
              <b>{c}</b>
              <ul>
                {(feedbacks[c] || []).length === 0 && <li>Henüz yorum yok / No feedback yet.</li>}
                {(feedbacks[c] || []).map((f, i) => (
                  <li key={i}><span style={{ color: '#888' }}>{f.user}:</span> {f.comment} <span style={{ fontSize: 12, color: '#aaa' }}>({dayjs(f.timestamp).format('YYYY-MM-DD HH:mm')})</span></li>
                ))}
              </ul>
              {user && (
                <div style={{ marginTop: 5 }}>
                  <input
                    type="text"
                    placeholder="Yorumunuzu yazın / Write feedback"
                    value={feedbackInput[c] || ''}
                    onChange={e => setFeedbackInput(f => ({ ...f, [c]: e.target.value }))}
                    style={{ width: '70%' }}
                  />
                  <button onClick={() => handleFeedbackSubmit(c)} style={{ marginLeft: 5 }}>Gönder / Submit</button>
                </div>
              )}
            </div>
          ))}
        </div>
        <button style={{ marginTop: 20 }} onClick={() => setCurrentPage('vote')}>{t.backToVoting}</button>
      </div>
    );
  };

  // Main return for App
  return (
    <div style={currentPage === 'login' ? {} : { padding: 20 }}>
      {currentPage === 'login' && renderLogin()}
      {currentPage === 'vote' && renderVotePage()}
      {currentPage === 'results' && renderResults()}
      {currentPage === 'history' && renderHistory()}
    </div>
  );
}

export default App;
