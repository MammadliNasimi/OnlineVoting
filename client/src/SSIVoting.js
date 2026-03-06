import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ethers } from 'ethers';

/**
 * SSI + ZK-Email Voting Component
 * 
 * ZK-Email Flow:
 * 0. User enters e-mail â†’ backend checks domain whitelist â†’ sends OTP
 * 1. User enters OTP â†’ backend verifies â†’ issues EIP-712 credential (email hash = nullifier)
 * 2. User selects candidate â†’ credential already in hand
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

  // â”€â”€ STEP 0: Send OTP to email â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
      setError(err.response?.data?.message || 'OTP gÃ¶nderilemedi');
    } finally {
      setLoading(false);
    }
  };

  // â”€â”€ STEP 1: Verify OTP + issue credential â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const verifyOtpAndGetCredential = async () => {
    if (!selectedCandidate) { setError('LÃ¼tfen Ã¶nce aday seÃ§in'); return; }
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
      setSuccess('âœ… E-posta doÄŸrulandÄ±! Credential hazÄ±r.');
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.message || 'OTP doÄŸrulanamadÄ±');
    } finally {
      setLoading(false);
    }
  };

  // â”€â”€ STEP 3B: Submit via Relayer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const submitViaRelayer = async () => {
    setLoading(true); setError(''); setSuccess('');
    try {
      const response = await axios.post(
        `${API_BASE}/ssi/relayer/submit`,
        { credential },
        { headers: { 'x-session-id': sessionId } }
      );
      setTxHash(response.data.txHash);
      setSuccess(`âœ… Oy relayer ile gÃ¶nderildi!`);
      setStep(4);
    } catch (err) {
      setError(err.response?.data?.message || 'Relayer hatasÄ±');
    } finally {
      setLoading(false);
    }
  };

  // â”€â”€ STEP 3A: Submit via MetaMask â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const submitDirectTransaction = async () => {
    setLoading(true); setError(''); setSuccess('');
    try {
      if (!window.ethereum) throw new Error('MetaMask kurulu deÄŸil');
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
      setSuccess(`âœ… Oy kaydedildi! TX: ${tx.hash.slice(0, 10)}...`);
      setStep(4);
    } catch (err) {
      setError(`Ä°ÅŸlem baÅŸarÄ±sÄ±z: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const resetFlow = () => {
    setStep(0); setCredential(null); setSelectedCandidate(null);
    setTxHash(''); setError(''); setSuccess(''); setOtp(''); setDevOtp('');
  };

  // â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const cardStyle = { padding: '20px', background: '#fff', borderRadius: '8px', border: '1px solid #ddd', marginBottom: '16px' };

  const btnStyle = (color) => ({
    padding: '12px 24px', background: color, color: 'white', border: 'none',
    borderRadius: '6px', cursor: loading ? 'not-allowed' : 'pointer', marginTop: '12px', fontWeight: '600'
  });

  const inputStyle = {
    width: '100%', padding: '10px 14px', border: '1px solid #ddd',
    borderRadius: '6px', fontSize: '14px', marginTop: '6px', boxSizing: 'border-box'
  };

  // â”€â”€ Steps indicator â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const steps = [
    { icon: 'ðŸ“§', label: 'E-posta' },
    { icon: 'ðŸ”‘', label: 'OTP + Aday' },
    { icon: 'ðŸš€', label: 'GÃ¶nder' },
    { icon: 'âœ…', label: 'Tamam' }
  ];

  return (
    <div style={{ padding: '20px', maxWidth: '700px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>ðŸ” ZK-Email SSI Oylama</h2>
        <button onClick={onLogout} style={{ padding: '8px 16px', cursor: 'pointer' }}>Ã‡Ä±kÄ±ÅŸ</button>
      </div>

      <div style={{ marginBottom: '16px', padding: '12px', background: '#f0f0f0', borderRadius: '8px' }}>
        <strong>{user.name}</strong> â€” {user.role}
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

      {error && <div style={{ padding: '12px', background: '#fee', border: '1px solid #fcc', borderRadius: '6px', marginBottom: '14px', color: '#c33' }}>âŒ {error}</div>}
      {success && <div style={{ padding: '12px', background: '#efe', border: '1px solid #cfc', borderRadius: '6px', marginBottom: '14px', color: '#363' }}>{success}</div>}

      {/* STEP 0: Enter email */}
      {step === 0 && (
        <div style={cardStyle}>
          <h3>AdÄ±m 1: E-posta DoÄŸrulama</h3>
          <p style={{ fontSize: '14px', color: '#666', marginBottom: '12px' }}>
            Admin tarafÄ±ndan izin verilen bir e-posta girin. 6 haneli OTP kodunuz gÃ¶nderilecek.
            E-postanÄ±z <strong>kesinlikle saklanmaz</strong> â€” sadece hash'i nullifier olarak kullanÄ±lÄ±r.
          </p>
          <label><strong>SeÃ§im:</strong></label>
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
            {loading ? 'GÃ¶nderiliyor...' : 'ðŸ“§ OTP GÃ¶nder'}
          </button>
          <div style={{ marginTop: '14px', padding: '12px', background: '#f9f9f9', borderRadius: '6px', fontSize: '13px' }}>
            <strong>ðŸ” ZK-Email Gizlilik Modeli:</strong> E-postanÄ±z hiÃ§ saklanmaz.
            OTP doÄŸrulandÄ±ktan sonra <code>keccak256(email + salt)</code> hesaplanÄ±r ve bu hash blockchain'e nullifier olarak yazÄ±lÄ±r.
            <em> Hangi e-postanÄ±n oy kullandÄ±ÄŸÄ± kimse tarafÄ±ndan gÃ¶rÃ¼lemez.</em>
          </div>
        </div>
      )}

      {/* STEP 1: OTP + Candidate selection */}
      {step === 1 && (
        <div style={cardStyle}>
          <h3>AdÄ±m 2: OTP Girin + Aday SeÃ§in</h3>
          {devOtp && (
            <div style={{ padding: '10px', background: '#fffde7', border: '1px solid #f9a825', borderRadius: '6px', marginBottom: '12px', fontSize: '13px' }}>
              ðŸ›  <strong>Dev Modu (SMTP yok) â€” OTP: <code style={{ fontSize: '20px', letterSpacing: '4px' }}>{devOtp}</code></strong>
            </div>
          )}
          <label><strong>OTP Kodu (6 hane):</strong></label>
          <input
            type="text" maxLength={6} value={otp}
            onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
            placeholder="123456"
            style={{ ...inputStyle, letterSpacing: '8px', fontSize: '22px', textAlign: 'center', fontWeight: 'bold' }}
          />

          <label style={{ marginTop: '16px', display: 'block' }}><strong>Aday SeÃ§in:</strong></label>
          {candidates.length === 0 && (
            <button onClick={() => loadCandidates(selectedElection.id)} style={{ ...btnStyle('#555'), marginBottom: '10px' }}>
              AdaylarÄ± YÃ¼kle
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
              {selectedCandidate?.id === c.id && <span style={{ float: 'right', color: '#7c3aed' }}>âœ“</span>}
            </div>
          ))}

          <button
            onClick={verifyOtpAndGetCredential}
            disabled={loading || !otp || !selectedCandidate}
            style={btnStyle('#2196F3')}
          >
            {loading ? 'DoÄŸrulanÄ±yor...' : 'ðŸ”‘ OTP DoÄŸrula + Credential Al'}
          </button>
          <button onClick={() => setStep(0)} style={{ ...btnStyle('#999'), marginLeft: '10px' }}>â† Geri</button>
        </div>
      )}

      {/* STEP 3: Submit */}
      {step === 3 && (
        <div style={cardStyle}>
          <h3>AdÄ±m 3: Oyu GÃ¶nder</h3>
          <p style={{ fontSize: '14px', marginBottom: '16px' }}>Credential hazÄ±r. NasÄ±l gÃ¶ndermek istiyorsunuz?</p>

          <div style={{ padding: '14px', background: '#f9f9f9', borderRadius: '8px', marginBottom: '12px' }}>
            <strong>ðŸš€ SeÃ§enek A: Relayer (Ã–nerilen â€” Gas'sÄ±z)</strong>
            <ul style={{ fontSize: '13px', marginTop: '8px', lineHeight: '1.7' }}>
              <li>âœ… ETH gerekmez â€” relayer Ã¶der</li>
              <li>âœ… Daha iyi anonimlik â€” gÃ¶nderen cÃ¼zdan sizin deÄŸil</li>
            </ul>
            <button onClick={submitViaRelayer} disabled={loading} style={btnStyle('#4CAF50')}>
              {loading ? 'GÃ¶nderiliyor...' : 'ðŸš€ Relayer ile GÃ¶nder'}
            </button>
          </div>

          <div style={{ padding: '14px', background: '#f9f9f9', borderRadius: '8px' }}>
            <strong>ðŸ¦Š SeÃ§enek B: MetaMask (Direkt)</strong>
            <ul style={{ fontSize: '13px', marginTop: '8px', lineHeight: '1.7' }}>
              <li>âš ï¸ Gas gerektirir</li>
              <li>âš ï¸ CÃ¼zdan adresiniz gÃ¶rÃ¼nÃ¼r</li>
            </ul>
            <button onClick={submitDirectTransaction} disabled={loading} style={btnStyle('#FF9800')}>
              {loading ? 'GÃ¶nderiliyor...' : 'ðŸ¦Š MetaMask ile GÃ¶nder'}
            </button>
          </div>

          {credential && (
            <details style={{ marginTop: '16px' }}>
              <summary style={{ cursor: 'pointer', color: '#555', fontSize: '13px' }}>ðŸ” Credential'Ä± gÃ¶ster (teknik)</summary>
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
          <div style={{ fontSize: '64px', margin: '10px 0' }}>âœ…</div>
          <h3>Oy BaÅŸarÄ±yla Kaydedildi!</h3>
          <p style={{ color: '#555' }}>Oyunuz anonim olarak blockchain'e yazÄ±ldÄ±.</p>
          {txHash && (
            <div style={{ marginTop: '16px', padding: '12px', background: '#f0f0f0', borderRadius: '6px', wordBreak: 'break-all', fontSize: '12px' }}>
              <strong>TX Hash:</strong> {txHash}
            </div>
          )}
          <button onClick={resetFlow} style={btnStyle('#7c3aed')}>ðŸ”„ BaÅŸka SeÃ§imde Oy Ver</button>
        </div>
      )}

      {/* Info box */}
      <div style={{ marginTop: '24px', padding: '14px', background: '#e8f4fd', borderRadius: '8px', fontSize: '13px' }}>
        <strong>ðŸ“š ZK-Email SSI NasÄ±l Ã‡alÄ±ÅŸÄ±r?</strong>
        <ol style={{ lineHeight: '1.9', marginTop: '8px' }}>
          <li><strong>Domain Whitelist:</strong> Admin panelinden izin verilen e-posta domainleri yÃ¶netilir</li>
          <li><strong>OTP GÃ¶nder:</strong> Girilen e-posta domaini whitelist'teyse OTP kodu e-postaya gider</li>
          <li><strong>ZK KanÄ±t:</strong> OTP doÄŸrulanÄ±nca e-posta hash'i â†’ EIP-712 credential imzalanÄ±r</li>
          <li><strong>Nullifier:</strong> <code>keccak256(email+salt)</code> blockchain'e yazÄ±lÄ±r â€” raw e-posta asla saklanmaz</li>
          <li><strong>Ã‡ift Oy:</strong> AynÄ± e-posta hash'i tekrar kullanÄ±lmaya Ã§alÄ±ÅŸÄ±lÄ±nca kontrat reddeder</li>
        </ol>
      </div>
    </div>
  );
}

export default SSIVoting;
