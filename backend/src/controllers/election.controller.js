const { ethers } = require('ethers');

const db = require('../config/database-sqlite');
const state = require('../config/state');
const { getEligibleVoters, sendBulkEmail } = require('../services/announcementService');
const { electionStarted } = require('../services/emailTemplates');

function isAlreadyOnChain(election, chainElection) {
  // On-chain'de gerçekten oluşturulmuş mu? startTime > 0 ise createElection çağrılmış demektir.
  if (!chainElection) return false;
  const startTime = typeof chainElection.startTime === 'bigint'
    ? chainElection.startTime
    : BigInt(chainElection.startTime || 0);
  return startTime > 0n;
}

class ElectionController {
  async toggleActive(req, res) {
    try {
      const id = parseInt(req.params.id, 10);
      const election = db.db.prepare('SELECT * FROM elections WHERE id = ?').get(id);
      if (!election) return res.status(404).json({ message: 'Election not found' });

      const currentActive = election.is_active;
      const newActive = currentActive === 1 ? 0 : 1;

      const provider = state.relayerService.provider;
      const contractAddress = state.relayerService.contractAddress;
      const contractABI = state.relayerService.contractABI;
      const issuerWallet = state.credentialIssuer.issuerWallet.connect(provider);
      const contract = new ethers.Contract(contractAddress, contractABI, issuerWallet);

      // Try to fetch blockchain election, but if it fails (not found), treat as non-existent
      let chainElection = { startTime: 0n, isActive: false };
      if (election.blockchain_election_id) {
        try {
          chainElection = await contract.elections(election.blockchain_election_id);
        } catch (err) {
          console.log('⚠️  Could not fetch blockchain election - treating as new:', err.message);
          chainElection = { startTime: 0n, isActive: false };
        }
      }

      const onChainExists = isAlreadyOnChain(election, chainElection);

      if (newActive === 1) {
        const nowSec = Math.floor(Date.now() / 1000);
        const endTimeCheck = Math.floor(new Date(election.end_date).getTime() / 1000);
        if (endTimeCheck <= nowSec) {
          return res.status(400).json({
            message: 'Seçim bitiş tarihi geçmiş. On-chain oluşturmak için bitiş tarihini güncelleyin.'
          });
        }

        // İlk aktivasyon: on-chain'de hiç yoksa createElection çağır.
        if (!onChainExists) {
          const candidates = db.db.prepare('SELECT * FROM candidates WHERE election_id = ? ORDER BY id').all(id);
          const candidateNames = candidates.map(c => c.name);

          if (candidateNames.length === 0) {
            return res.status(400).json({ message: 'Seçimi başlatmak için en az bir aday eklemelisiniz.' });
          }

          const startTime = Math.floor(new Date(election.start_date).getTime() / 1000);
          const endTime = Math.floor(new Date(election.end_date).getTime() / 1000);

          const tx = await contract.createElection(election.title, startTime, endTime, candidateNames);
          const receipt = await tx.wait();

          const event = receipt.logs.find(log => {
            try {
              const parsed = contract.interface.parseLog(log);
              return parsed && parsed.name === 'ElectionCreated';
            } catch {
              return false;
            }
          });

          if (event) {
            const parsedLog = contract.interface.parseLog(event);
            const newBcId = Number(parsedLog.args[0]);
            db.db.prepare(
              'UPDATE elections SET blockchain_election_id = ?, candidates_locked = 1 WHERE id = ?'
            ).run(newBcId, id);

            // Adaylar artik kilitli — DB id <-> on-chain id eslesmesini de yenile.
            for (let i = 0; i < candidates.length; i += 1) {
              db.db.prepare(
                'UPDATE candidates SET blockchain_candidate_id = ? WHERE id = ?'
              ).run(i, candidates[i].id);
            }

            election.blockchain_election_id = newBcId;
          }
        } else if (!chainElection.isActive) {
          // Geriye dönük uyumluluk:
          // Eski sürümde "durdur" => endElection çağırdığı için seçim zincirde kapanmış olabilir.
          // Eğer bu seçimde henüz oy yoksa güvenli şekilde yeni on-chain election oluşturarak
          // yeniden başlatmaya izin veriyoruz.
          const voteCount = db.db.prepare('SELECT COUNT(*) AS c FROM votes WHERE election_id = ?').get(id)?.c || 0;
          const votedUsers = db.db.prepare('SELECT COUNT(*) AS c FROM vote_status WHERE election_id = ?').get(id)?.c || 0;
          if (voteCount > 0 || votedUsers > 0) {
            return res.status(409).json({
              message: 'Bu seçim on-chain üzerinde sonlandırılmış ve oy içeriyor. Veri bütünlüğü için yeniden aktive edilemez; yeni seçim oluşturun.'
            });
          }

          const candidates = db.db.prepare('SELECT * FROM candidates WHERE election_id = ? ORDER BY id').all(id);
          const candidateNames = candidates.map(c => c.name);
          if (candidateNames.length === 0) {
            return res.status(400).json({ message: 'Seçimi başlatmak için en az bir aday eklemelisiniz.' });
          }

          const startTime = Math.floor(new Date(election.start_date).getTime() / 1000);
          const endTime = Math.floor(new Date(election.end_date).getTime() / 1000);
          const tx = await contract.createElection(election.title, startTime, endTime, candidateNames);
          const receipt = await tx.wait();
          const event = receipt.logs.find(log => {
            try {
              const parsed = contract.interface.parseLog(log);
              return parsed && parsed.name === 'ElectionCreated';
            } catch {
              return false;
            }
          });
          if (event) {
            const parsedLog = contract.interface.parseLog(event);
            const newBcId = Number(parsedLog.args[0]);
            db.db.prepare(
              'UPDATE elections SET blockchain_election_id = ?, candidates_locked = 1, ended_permanently = 0 WHERE id = ?'
            ).run(newBcId, id);
            for (let i = 0; i < candidates.length; i += 1) {
              db.db.prepare(
                'UPDATE candidates SET blockchain_candidate_id = ? WHERE id = ?'
              ).run(i, candidates[i].id);
            }
            election.blockchain_election_id = newBcId;
          }
        }
      } else {
        // "Durdur" işlemi bir "pause" davranışıdır:
        // seçim sadece uygulama (DB) tarafında pasife alınır.
        // On-chain endElection çağırırsak seçim kalıcı kapanır ve tekrar başlatılamaz.
      }

      if (newActive === 1) {
        db.db.prepare('UPDATE elections SET is_active = 1, ended_permanently = 0 WHERE id = ?').run(id);
      } else {
        db.db.prepare('UPDATE elections SET is_active = 0 WHERE id = ?').run(id);
      }

      // Seçim aktifleştirildiğinde uygun seçmenlere otomatik bildirim gönder (fire-and-forget).
      if (newActive === 1) {
        const freshElection = db.db.prepare('SELECT * FROM elections WHERE id = ?').get(id);
        setImmediate(async () => {
          try {
            const voters = getEligibleVoters(id);
            if (voters.length === 0) return;
            const result = await sendBulkEmail(voters, () => electionStarted(freshElection));
            console.log(`[Announcement] Election #${id} start mail: ${result.sent} sent, ${result.failed} failed`);
          } catch (e) {
            console.error('[Announcement] Election start mail error:', e.message);
          }
        });
      }

      res.json({ success: true, is_active: newActive });
    } catch (error) {
      console.error('Error toggling election status:', error.message);
      res.status(500).json({ message: error.message });
    }
  }

  // Aday eklemeyi sadece on-chain henuz aktive edilmemis seçimlerde izin ver. Aksi halde
  // ekleyeceğimiz aday on-chain'de yer almadığı için oy alamayacak.
  async addCandidate(req, res) {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ message: 'name required' });
    try {
      const id = parseInt(req.params.id, 10);
      const election = db.getElectionRow(id);
      if (!election) return res.status(404).json({ message: 'Election not found' });
      if (election.candidates_locked === 1) {
        return res.status(409).json({
          message: 'Bu seçim aktive edildiği için aday eklenemez. Adaylar on-chain olarak sabitlenmiştir.'
        });
      }

      const candidate = db.addCandidateToElection(id, name, description);
      res.json(candidate);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  async removeCandidate(req, res) {
    try {
      const id = parseInt(req.params.id, 10);
      const election = db.getElectionRow(id);
      if (election && election.candidates_locked === 1) {
        return res.status(409).json({
          message: 'Bu seçim aktive edildiği için aday silinemez.'
        });
      }
      db.removeCandidateFromElection(parseInt(req.params.cid, 10));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  async updateCandidate(req, res) {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ message: 'name required' });
    try {
      const id = parseInt(req.params.id, 10);
      const election = db.getElectionRow(id);
      if (election && election.candidates_locked === 1) {
        return res.status(409).json({
          message: 'Bu seçim aktive edildiği için aday bilgisi değiştirilemez. On-chain isimler dondurulmuştur.'
        });
      }
      db.updateCandidate(parseInt(req.params.cid, 10), name, description);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  async getDomains(req, res) {
    try {
      const domains = db.getElectionDomainRestrictions(parseInt(req.params.id, 10));
      res.json(domains);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  async addDomain(req, res) {
    const { domain } = req.body;
    if (!domain) return res.status(400).json({ message: 'domain required' });
    try {
      db.addElectionDomainRestriction(parseInt(req.params.id, 10), domain);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  async removeDomain(req, res) {
    try {
      db.removeElectionDomainRestriction(parseInt(req.params.did, 10));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  async getGovernance(req, res) {
    try {
      const id = parseInt(req.params.id, 10);
      const election = db.db.prepare('SELECT * FROM elections WHERE id = ?').get(id);
      
      if (!election) {
        return res.status(404).json({ error: 'Election not found' });
      }

      // Blockchain contract info
      const contractAddress = state.relayerService?.contractAddress;
      const issuerAddress = state.credentialIssuer?.issuerWallet?.address;

      // DAO governance model
      const governanceInfo = {
        electionID: election.id,
        electionTitle: election.title,
        issuerAddress,
        contractAddress,
        governanceModel: 'credential-issuer',
        issuerRole: 'Backend-centralized issuer in the current prototype; can be upgraded to multi-sig or DAO in a future version',
        blockchainNetwork: process.env.BLOCKCHAIN_NETWORK || 'Local Hardhat',
        verificationModel: 'Nullifier + EIP-712 signature verification',
        anonymityGuarantee: 'Email hash never stored on blockchain; only nullifier (hash of email+electionID)',
        doubleVotePrevention: 'Nullifier checked against blockchain state',
        candidatesLocked: election.candidates_locked === 1,
        electionActive: election.is_active === 1,
        createdAt: election.created_at,
        documentation: {
          architecture: 'See the repository README for the local prototype overview'
        }
      };

      res.json(governanceInfo);
    } catch (error) {
      console.error('Get governance error:', error);
      res.status(500).json({ error: 'Failed to fetch governance info', message: error.message });
    }
  }
}

module.exports = new ElectionController();
