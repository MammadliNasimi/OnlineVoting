import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ethers } from 'ethers';

/**
 * SSI + ZK-Email Voting Component
 * 
 * ZK-Email Flow:
 * 0. User enters e-mail → backend checks domain whitelist → sends OTP
 * 1. User enters OTP → backend verifies → issues EIP-712 credential (email hash = nullifier)
 * 2. User selects candidate → credential already in hand
 * 3. Submit via Relayer (gas-less) or MetaMask
 *
 * Privacy guarantee: raw email is NEVER stored on-chain. Only keccak256(email+salt) is used.
 */
function SSIVoting({ user, sessionId, onLogout }) {
  const [step, setStep] = useState(0); // 0=email, 1=otp, 2=candidate, 3=submit, 4=done
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // ZK-Email state
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [devOtp, setDevOtp] = useState(''); // Only in dev/no-SMTP mode

  // Election & Candidate data
  const [elections, setElections] = useState([]);
  const [selectedElection, setSelectedElection] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [selectedCandidate, setSelectedCandidate] = useState(null);

  // SSI Credential data
  const [credential, setCredential] = useState(null);
  const [txHash, setTxHash] = useState('');

  // Contract info
  const [contractAddress, setContractAddress] = useState('');
  const [domainInfo, setDomainInfo] = useState(null);

  const API_BASE = 'http://localhost:5000/api';

  useEffect(() => {
    loadElections();
    loadDomainInfo();
  }, []);

  const loadElections = async () => {
    try {
      const response = await axios.get(`${API_BASE}/elections`);
      setElections(response.data);
      if (response.data.length > 0) setSelectedElection(response.data[0]);
    } catch (err) {
      console.error('Error loading elections:', err);
    }
  };

  const loadDomainInfo = async () => {
    try {
      const response = await axios.get(`${API_BASE}/ssi/domain`, {
        headers: { 'x-session-id': sessionId }
      });
      setDomainInfo(response.data.domain);
      setContractAddress(response.data.domain.verifyingContract);
    } catch (err) {
      console.error('Error loading domain info:', err);
    }
  };

  const loadCandidates = async (electionId) => {
    try {
      const res = await axios.get(`${API_BASE}/candidates/${electionId}`);
      setCandidates(res.data);
    } catch (err) {
      setError('Failed to load candidates');
    }
  };

  // ── STEP 0: Send OTP to email ──────────────────────────────────────────────
  const sendOtp = async () => {
    setLoading(true); setError(''); setSuccess('');
    try {
      const res = await axios.post(
        `${API_BASE}/zkemail/send-otp`,
        { email },
        { headers: { 'x-session-id': sessionId } }
      );
      if (res.data.devOtp) setDevOtp(res.data.devOtp); // dev mode only
      setSuccess(res.data.message);
      setStep(1);
    } catch (err) {
      setError(err.response?.data?.message || 'OTP gönderilemedi');
    } finally {
      setLoading(false);
    }
  };

  // ── STEP 1: Verify OTP + issue credential ──────────────────────────────────
  const verifyOtpAndGetCredential = async () => {
    if (!selectedCandidate) { setError('Lütfen önce aday seçin'); return; }
    setLoading(true); setError(''); setSuccess('');
    try {
      const res = await axios.post(
        `${API_BASE}/zkemail/verify-otp`,
        {
          email,
          otp,
          electionID: selectedElection.id,
          candidateID: selectedCandidate.blockchain_candidate_id ?? selectedCandidate.id - 1
        },
        { headers: { 'x-session-id': sessionId } }
      );
      setCredential(res.data.credential);
      setSuccess('✅ E-posta doğrulandı! Credential hazır.');
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.message || 'OTP doğrulanamadı');
    } finally {
      setLoading(false);
    }
  };

  // ── STEP 3B: Submit via Relayer ────────────────────────────────────────────
  const submitViaRelayer = async () => {
    setLoading(true); setError(''); setSuccess('');
    try {
      const response = await axios.post(
        `${API_BASE}/ssi/relayer/submit`,
        { credential },
        { headers: { 'x-session-id': sessionId } }
      );
      setTxHash(response.data.txHash);
      setSuccess(`✅ Oy relayer ile gönderildi!`);
      setStep(4);
    } catch (err) {
      setError(err.response?.data?.message || 'Relayer hatası');
    } finally {
      setLoading(false);
    }
  };

  // ── STEP 3A: Submit via MetaMask ───────────────────────────────────────────
  const submitDirectTransaction = async () => {
    setLoading(true); setError(''); setSuccess('');
    try {
      if (!window.ethereum) throw new Error('MetaMask kurulu değil');
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send('eth_requestAccounts', []);
      const signer = await provider.getSigner();
      const contractABI = [
        'function vote(tuple(bytes32 emailHash, uint256 electionID, uint256 candidateID, uint256 timestamp, bytes signature) proof)'
      ];
      const contract = new ethers.Contract(contractAddress, contractABI, signer);
      const voteProof = {
        emailHash: credential.emailHash,
        electionID: credential.electionID,
        candidateID: credential.candidateID,
        timestamp: credential.timestamp,
        signature: credential.signature
      };
      const tx = await contract.vote(voteProof);
      await tx.wait();
      setTxHash(tx.hash);
      setSuccess(`✅ Oy kaydedildi! TX: ${tx.hash.slice(0, 10)}...`);
      setStep(4);
    } catch (err) {
      setError(`İşlem başarısız: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const resetFlow = () => {
    setStep(0); setCredential(null); setSelectedCandidate(null);
    setTxHash(''); setError(''); setSuccess(''); setOtp(''); setDevOtp('');
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
  const cardStyle = { padding: '20px', background: '#fff', borderRadius: '8px', border: '1px solid #ddd', marginBottom: '16px' };

  const btnStyle = (color) => ({
    padding: '12px 24px', background: color, color: 'white', border: 'none',
    borderRadius: '6px', cursor: loading ? 'not-allowed' : 'pointer', marginTop: '12px', fontWeight: '600'
  });

  const inputStyle = {
    width: '100%', padding: '10px 14px', border: '1px solid #ddd',
    borderRadius: '6px', fontSize: '14px', marginTop: '6px', boxSizing: 'border-box'
  };

  // ── Steps indicator ────────────────────────────────────────────────────────
  const steps = [
    { icon: '📧', label: 'E-posta' },
    { icon: '🔑', label: 'OTP + Aday' },
    { icon: '🚀', label: 'Gönder' },
    { icon: '✅', label: 'Tamam' }
  ];

  return (
    <div style={{ padding: '20px', maxWidth: '700px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>🔐 ZK-Email SSI Oylama</h2>
        <button onClick={onLogout} style={{ padding: '8px 16px', cursor: 'pointer' }}>Çıkış</button>
      </div>

      <div style={{ marginBottom: '16px', padding: '12px', background: '#f0f0f0', borderRadius: '8px' }}>
        <strong>{user.name}</strong> — {user.role}
      </div>

      {/* Progress Steps */}
      <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: '24px' }}>
        {steps.map((s, i) => (
          <div key={i} style={{ textAlign: 'center', opacity: step >= i ? 1 : 0.3 }}>
            <div style={{ fontSize: '22px' }}>{s.icon}</div>
            <div style={{ fontSize: '12px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {error && <div style={{ padding: '12px', background: '#fee', border: '1px solid #fcc', borderRadius: '6px', marginBottom: '14px', color: '#c33' }}>❌ {error}</div>}
      {success && <div style={{ padding: '12px', background: '#efe', border: '1px solid #cfc', borderRadius: '6px', marginBottom: '14px', color: '#363' }}>{success}</div>}

      {/* STEP 0: Enter email */}
      {step === 0 && (
        <div style={cardStyle}>
          <h3>Adım 1: E-posta Doğrulama</h3>
          <p style={{ fontSize: '14px', color: '#666', marginBottom: '12px' }}>
            Admin tarafından izin verilen bir e-posta girin. 6 haneli OTP kodunuz gönderilecek.
            E-postanız <strong>kesinlikle saklanmaz</strong> — sadece hash'i nullifier olarak kullanılır.
          </p>
          <label><strong>Seçim:</strong></label>
          <select
            value={selectedElection?.id || ''}
            onChange={(e) => { const el = elections.find(x => x.id === parseInt(e.target.value)); setSelectedElection(el); }}
            style={inputStyle}
          >
            {elections.map(el => <option key={el.id} value={el.id}>{el.title}</option>)}
          </select>
          <label style={{ marginTop: '12px', display: 'block' }}><strong>E-posta Adresi:</strong></label>
          <input
            type="email" value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendOtp()}
            placeholder="ornek@akdeniz.edu.tr"
            style={inputStyle}
          />
          <button onClick={sendOtp} disabled={loading || !email || !selectedElection} style={btnStyle('#7c3aed')}>
            {loading ? 'Gönderiliyor...' : '📧 OTP Gönder'}
          </button>
          <div style={{ marginTop: '14px', padding: '12px', background: '#f9f9f9', borderRadius: '6px', fontSize: '13px' }}>
            <strong>🔐 ZK-Email Gizlilik Modeli:</strong> E-postanız hiç saklanmaz.
            OTP doğrulandıktan sonra <code>keccak256(email + salt)</code> hesaplanır ve bu hash blockchain'e nullifier olarak yazılır.
            <em> Hangi e-postanın oy kullandığı kimse tarafından görülemez.</em>
          </div>
        </div>
      )}

      {/* STEP 1: OTP + Candidate selection */}
      {step === 1 && (
        <div style={cardStyle}>
          <h3>Adım 2: OTP Girin + Aday Seçin</h3>
          {devOtp && (
            <div style={{ padding: '10px', background: '#fffde7', border: '1px solid #f9a825', borderRadius: '6px', marginBottom: '12px', fontSize: '13px' }}>
              🛠 <strong>Dev Modu (SMTP yok) — OTP: <code style={{ fontSize: '20px', letterSpacing: '4px' }}>{devOtp}</code></strong>
            </div>
          )}
          <label><strong>OTP Kodu (6 hane):</strong></label>
          <input
            type="text" maxLength={6} value={otp}
            onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
            placeholder="123456"
            style={{ ...inputStyle, letterSpacing: '8px', fontSize: '22px', textAlign: 'center', fontWeight: 'bold' }}
          />

          <label style={{ marginTop: '16px', display: 'block' }}><strong>Aday Seçin:</strong></label>
          {candidates.length === 0 && (
            <button onClick={() => loadCandidates(selectedElection.id)} style={{ ...btnStyle('#555'), marginBottom: '10px' }}>
              Adayları Yükle
            </button>
          )}
          {candidates.map(c => (
            <div
              key={c.id}
              onClick={() => setSelectedCandidate(c)}
              style={{
                padding: '12px 16px', margin: '8px 0', borderRadius: '8px', cursor: 'pointer',
                border: selectedCandidate?.id === c.id ? '2px solid #7c3aed' : '1px solid #ddd',
                background: selectedCandidate?.id === c.id ? '#f3e8ff' : '#fff'
              }}
            >
              <strong>{c.name}</strong>
              {selectedCandidate?.id === c.id && <span style={{ float: 'right', color: '#7c3aed' }}>✓</span>}
            </div>
          ))}

          <button
            onClick={verifyOtpAndGetCredential}
            disabled={loading || !otp || !selectedCandidate}
            style={btnStyle('#2196F3')}
          >
            {loading ? 'Doğrulanıyor...' : '🔑 OTP Doğrula + Credential Al'}
          </button>
          <button onClick={() => setStep(0)} style={{ ...btnStyle('#999'), marginLeft: '10px' }}>← Geri</button>
        </div>
      )}

      {/* STEP 3: Submit */}
      {step === 3 && (
        <div style={cardStyle}>
          <h3>Adım 3: Oyu Gönder</h3>
          <p style={{ fontSize: '14px', marginBottom: '16px' }}>Credential hazır. Nasıl göndermek istiyorsunuz?</p>

          <div style={{ padding: '14px', background: '#f9f9f9', borderRadius: '8px', marginBottom: '12px' }}>
            <strong>🚀 Seçenek A: Relayer (Önerilen — Gas'sız)</strong>
            <ul style={{ fontSize: '13px', marginTop: '8px', lineHeight: '1.7' }}>
              <li>✅ ETH gerekmez — relayer öder</li>
              <li>✅ Daha iyi anonimlik — gönderen cüzdan sizin değil</li>
            </ul>
            <button onClick={submitViaRelayer} disabled={loading} style={btnStyle('#4CAF50')}>
              {loading ? 'Gönderiliyor...' : '🚀 Relayer ile Gönder'}
            </button>
          </div>

          <div style={{ padding: '14px', background: '#f9f9f9', borderRadius: '8px' }}>
            <strong>🦊 Seçenek B: MetaMask (Direkt)</strong>
            <ul style={{ fontSize: '13px', marginTop: '8px', lineHeight: '1.7' }}>
              <li>⚠️ Gas gerektirir</li>
              <li>⚠️ Cüzdan adresiniz görünür</li>
            </ul>
            <button onClick={submitDirectTransaction} disabled={loading} style={btnStyle('#FF9800')}>
              {loading ? 'Gönderiliyor...' : '🦊 MetaMask ile Gönder'}
            </button>
          </div>

          {credential && (
            <details style={{ marginTop: '16px' }}>
              <summary style={{ cursor: 'pointer', color: '#555', fontSize: '13px' }}>🔍 Credential'ı göster (teknik)</summary>
              <pre style={{ marginTop: '8px', background: '#f0f0f0', padding: '12px', borderRadius: '6px', fontSize: '11px', overflow: 'auto' }}>
                {JSON.stringify(credential, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}

      {/* STEP 4: Success */}
      {step === 4 && (
        <div style={{ ...cardStyle, textAlign: 'center' }}>
          <div style={{ fontSize: '64px', margin: '10px 0' }}>✅</div>
          <h3>Oy Başarıyla Kaydedildi!</h3>
          <p style={{ color: '#555' }}>Oyunuz anonim olarak blockchain'e yazıldı.</p>
          {txHash && (
            <div style={{ marginTop: '16px', padding: '12px', background: '#f0f0f0', borderRadius: '6px', wordBreak: 'break-all', fontSize: '12px' }}>
              <strong>TX Hash:</strong> {txHash}
            </div>
          )}
          <button onClick={resetFlow} style={btnStyle('#7c3aed')}>🔄 Başka Seçimde Oy Ver</button>
        </div>
      )}

      {/* Info box */}
      <div style={{ marginTop: '24px', padding: '14px', background: '#e8f4fd', borderRadius: '8px', fontSize: '13px' }}>
        <strong>📚 ZK-Email SSI Nasıl Çalışır?</strong>
        <ol style={{ lineHeight: '1.9', marginTop: '8px' }}>
          <li><strong>Domain Whitelist:</strong> Admin panelinden izin verilen e-posta domainleri yönetilir</li>
          <li><strong>OTP Gönder:</strong> Girilen e-posta domaini whitelist'teyse OTP kodu e-postaya gider</li>
          <li><strong>ZK Kanıt:</strong> OTP doğrulanınca e-posta hash'i → EIP-712 credential imzalanır</li>
          <li><strong>Nullifier:</strong> <code>keccak256(email+salt)</code> blockchain'e yazılır — raw e-posta asla saklanmaz</li>
          <li><strong>Çift Oy:</strong> Aynı e-posta hash'i tekrar kullanılmaya çalışılınca kontrat reddeder</li>
        </ol>
      </div>
    </div>
  );
}

export default SSIVoting;


  /**
   * STEP 2: Issue Verifiable Credential
   * After user selects candidate, request signed credential
   */
  const issueCredential = async () => {
    if (!selectedCandidate) {
      setError('Please select a candidate');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await axios.post(
        `${API_BASE}/ssi/issue-credential`,
        {
          electionID: selectedElection.id,
          candidateID: selectedCandidate.id
        },
        { headers: { 'x-session-id': sessionId } }
      );

      setCredential(response.data.credential);
      setSuccess('✅ Credential issued! Choose how to submit your vote.');
      setStep(3);

    } catch (err) {
      setError(err.response?.data?.message || 'Failed to issue credential');
    } finally {
      setLoading(false);
    }
  };

  /**
   * STEP 3A: Submit via Direct Transaction (Gas Required)
   * User's wallet pays gas fee - identity could be theoretically traced
   */
  const submitDirectTransaction = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Connect to MetaMask or injected provider
      if (!window.ethereum) {
        throw new Error('MetaMask not installed');
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();

      // Load contract ABI (simplified - you'd load the full ABI)
      const contractABI = [
        "function vote(tuple(bytes32 studentIDHash, uint256 electionID, uint256 candidateID, uint256 timestamp, bytes signature) proof)"
      ];

      const contract = new ethers.Contract(contractAddress, contractABI, signer);

      // Prepare VoteProof struct
      const voteProof = {
        studentIDHash: credential.studentIDHash,
        electionID: credential.electionID,
        candidateID: credential.candidateID,
        timestamp: credential.timestamp,
        signature: credential.signature
      };

      // Submit transaction
      const tx = await contract.vote(voteProof);
      setSuccess(`⏳ Transaction submitted: ${tx.hash}`);
      
      // Wait for confirmation
      await tx.wait();
      setTxHash(tx.hash);
      setSuccess(`✅ Vote recorded! TX: ${tx.hash.slice(0, 10)}...`);
      setStep(4);

    } catch (err) {
      setError(`Transaction failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  /**
   * STEP 3B: Submit via Relayer (Gas-less, More Anonymous)
   * Relayer pays gas fee - better anonymity as submission wallet differs from authorization
   * 
   * NOTE: This requires a relayer backend service to be implemented
   */
  const submitViaRelayer = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Send credential to relayer backend
      const response = await axios.post(
        `${API_BASE}/ssi/relayer/submit`,
        { credential },
        { headers: { 'x-session-id': sessionId } }
      );

      setTxHash(response.data.txHash);
      setSuccess(`✅ Vote submitted via relayer! TX: ${response.data.txHash.slice(0, 10)}...`);
      setStep(4);

    } catch (err) {
      setError(err.response?.data?.message || 'Relayer submission failed');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Reset to start new vote
   */
  const resetFlow = () => {
    setStep(1);
    setAuthToken(null);
    setCredential(null);
    setSelectedCandidate(null);
    setTxHash('');
    setError('');
    setSuccess('');
  };

  return (
    <div className="ssi-voting-container" style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>🔐 Self-Sovereign Identity Voting</h2>
        <button onClick={onLogout} style={{ padding: '8px 16px' }}>Logout</button>
      </div>

      <div style={{ marginBottom: '20px', padding: '15px', background: '#f0f0f0', borderRadius: '8px' }}>
        <p><strong>User:</strong> {user.name}</p>
        <p><strong>Role:</strong> {user.role}</p>
      </div>

      {/* Progress Steps */}
      <div style={{ marginBottom: '30px', display: 'flex', justifyContent: 'space-around' }}>
        <div style={{ textAlign: 'center', opacity: step >= 1 ? 1 : 0.3 }}>
          <div style={{ fontSize: '24px' }}>🎫</div>
          <div>Authorization</div>
        </div>
        <div style={{ textAlign: 'center', opacity: step >= 2 ? 1 : 0.3 }}>
          <div style={{ fontSize: '24px' }}>🗳️</div>
          <div>Select Candidate</div>
        </div>
        <div style={{ textAlign: 'center', opacity: step >= 3 ? 1 : 0.3 }}>
          <div style={{ fontSize: '24px' }}>📝</div>
          <div>Get Credential</div>
        </div>
        <div style={{ textAlign: 'center', opacity: step >= 4 ? 1 : 0.3 }}>
          <div style={{ fontSize: '24px' }}>✅</div>
          <div>Submit Vote</div>
        </div>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div style={{ padding: '15px', background: '#fee', border: '1px solid #fcc', borderRadius: '8px', marginBottom: '20px', color: '#c33' }}>
          ❌ {error}
        </div>
      )}
      {success && (
        <div style={{ padding: '15px', background: '#efe', border: '1px solid #cfc', borderRadius: '8px', marginBottom: '20px', color: '#3c3' }}>
          {success}
        </div>
      )}

      {/* STEP 1: Request Authorization */}
      {step === 1 && (
        <div style={{ padding: '20px', background: '#fff', borderRadius: '8px', border: '1px solid #ddd' }}>
          <h3>Step 1: Request Voting Authorization</h3>
          <p>First, request authorization to vote without revealing your candidate choice.</p>
          
          <div style={{ marginTop: '15px' }}>
            <label><strong>Select Election:</strong></label>
            <select 
              value={selectedElection?.id || ''} 
              onChange={(e) => {
                const election = elections.find(el => el.id === parseInt(e.target.value));
                setSelectedElection(election);
              }}
              style={{ width: '100%', padding: '8px', marginTop: '5px' }}
            >
              {elections.map(election => (
                <option key={election.id} value={election.id}>{election.title}</option>
              ))}
            </select>
          </div>

          <button 
            onClick={requestAuthorization}
            disabled={loading || !selectedElection}
            style={{ 
              marginTop: '20px', 
              padding: '12px 24px', 
              background: '#4CAF50', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Requesting...' : '🎫 Request Authorization'}
          </button>

          <div style={{ marginTop: '20px', padding: '15px', background: '#f9f9f9', borderRadius: '4px' }}>
            <strong>ℹ️ Privacy Note:</strong>
            <p style={{ marginTop: '5px', fontSize: '14px' }}>
              This step only verifies your eligibility to vote. Your candidate choice remains private at this stage.
            </p>
          </div>
        </div>
      )}

      {/* STEP 2: Select Candidate */}
      {step === 2 && (
        <div style={{ padding: '20px', background: '#fff', borderRadius: '8px', border: '1px solid #ddd' }}>
          <h3>Step 2: Select Your Candidate</h3>
          <p>Choose who you want to vote for. This will be included in your verifiable credential.</p>

          <div style={{ marginTop: '15px' }}>
            {candidates.map(candidate => (
              <div 
                key={candidate.id}
                onClick={() => setSelectedCandidate(candidate)}
                style={{
                  padding: '15px',
                  margin: '10px 0',
                  border: selectedCandidate?.id === candidate.id ? '2px solid #4CAF50' : '1px solid #ddd',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  background: selectedCandidate?.id === candidate.id ? '#e8f5e9' : '#fff'
                }}
              >
                <strong>{candidate.name}</strong>
                {selectedCandidate?.id === candidate.id && <span style={{ float: 'right' }}>✓</span>}
              </div>
            ))}
          </div>

          <button 
            onClick={issueCredential}
            disabled={loading || !selectedCandidate}
            style={{ 
              marginTop: '20px', 
              padding: '12px 24px', 
              background: '#2196F3', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px',
              cursor: loading || !selectedCandidate ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Issuing...' : '📝 Get Signed Credential'}
          </button>
        </div>
      )}

      {/* STEP 3: Submit Vote */}
      {step === 3 && (
        <div style={{ padding: '20px', background: '#fff', borderRadius: '8px', border: '1px solid #ddd' }}>
          <h3>Step 3: Submit Your Vote</h3>
          <p>Choose how to submit your signed credential to the blockchain:</p>

          <div style={{ marginTop: '20px' }}>
            <div style={{ padding: '15px', background: '#f9f9f9', borderRadius: '8px', marginBottom: '15px' }}>
              <h4>Option A: Direct Transaction (MetaMask)</h4>
              <p style={{ fontSize: '14px' }}>
                ✅ Immediate confirmation<br/>
                ⚠️ Requires ETH for gas<br/>
                ⚠️ Transaction from your wallet (less anonymous)
              </p>
              <button 
                onClick={submitDirectTransaction}
                disabled={loading}
                style={{ 
                  marginTop: '10px', 
                  padding: '10px 20px', 
                  background: '#FF9800', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '4px',
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
              >
                {loading ? 'Submitting...' : '🦊 Submit via MetaMask'}
              </button>
            </div>

            <div style={{ padding: '15px', background: '#f9f9f9', borderRadius: '8px' }}>
              <h4>Option B: Relayer Service (Recommended)</h4>
              <p style={{ fontSize: '14px' }}>
                ✅ No gas fees required<br/>
                ✅ Better anonymity (relayer wallet submits)<br/>
                ⚠️ Requires relayer backend service
              </p>
              <button 
                onClick={submitViaRelayer}
                disabled={loading}
                style={{ 
                  marginTop: '10px', 
                  padding: '10px 20px', 
                  background: '#4CAF50', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '4px',
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
              >
                {loading ? 'Submitting...' : '🚀 Submit via Relayer'}
              </button>
            </div>
          </div>

          {credential && (
            <div style={{ marginTop: '20px', padding: '15px', background: '#f0f0f0', borderRadius: '8px', fontSize: '12px', wordBreak: 'break-all' }}>
              <strong>Your Credential:</strong>
              <pre style={{ marginTop: '10px', overflow: 'auto' }}>
                {JSON.stringify(credential, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* STEP 4: Success */}
      {step === 4 && (
        <div style={{ padding: '20px', background: '#fff', borderRadius: '8px', border: '1px solid #ddd', textAlign: 'center' }}>
          <div style={{ fontSize: '64px', marginBottom: '20px' }}>✅</div>
          <h3>Vote Successfully Recorded!</h3>
          <p>Your vote has been anonymously recorded on the blockchain.</p>
          
          {txHash && (
            <div style={{ marginTop: '20px', padding: '15px', background: '#f0f0f0', borderRadius: '8px' }}>
              <strong>Transaction Hash:</strong>
              <p style={{ wordBreak: 'break-all', marginTop: '5px' }}>{txHash}</p>
            </div>
          )}

          <button 
            onClick={resetFlow}
            style={{ 
              marginTop: '20px', 
              padding: '12px 24px', 
              background: '#4CAF50', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            🔄 Vote in Another Election
          </button>
        </div>
      )}

      {/* Info Section */}
      <div style={{ marginTop: '30px', padding: '15px', background: '#e3f2fd', borderRadius: '8px' }}>
        <h4>📚 How SSI Voting Works:</h4>
        <ol style={{ fontSize: '14px', lineHeight: '1.8' }}>
          <li><strong>Request Authorization:</strong> Backend verifies you're eligible (database check)</li>
          <li><strong>Receive Token:</strong> You get a hashed student ID (preserves privacy)</li>
          <li><strong>Choose Candidate:</strong> Select who to vote for</li>
          <li><strong>Get Credential:</strong> Backend signs your choice with EIP-712 (verifiable proof)</li>
          <li><strong>Submit to Contract:</strong> Smart contract verifies signature and prevents double voting</li>
        </ol>
        <p style={{ marginTop: '10px', fontSize: '14px' }}>
          <strong>🔐 Privacy:</strong> Your student ID is never stored on-chain. Only a nullifier (hash) is recorded to prevent double voting.
        </p>
      </div>
    </div>
  );
}

export default SSIVoting;
