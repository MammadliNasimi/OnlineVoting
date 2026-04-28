const fs = require('fs');
const path = require('path');

const db = require('../config/database-sqlite');
const { voteJobQueue } = require('../services/voteQueue.service');
const { getEligibleVoters, sendBulkEmail } = require('../services/announcementService');
const { electionAnnouncement } = require('../services/emailTemplates');

const ADMIN_LOG_LIMIT = 100;
const DEFAULT_ELECTION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

class AdminController {
  async getDatabaseStats(_req, res) {
    try {
      const usersCount = db.db.prepare('SELECT COUNT(*) as c FROM users').get().c;
      const electionsCount = db.db.prepare('SELECT COUNT(*) as c FROM elections').get().c;
      const votesCount = db.db.prepare('SELECT COUNT(*) as c FROM votes').get().c;
      const sessionsCount = db.db.prepare('SELECT COUNT(*) as c FROM sessions').get().c;

      res.json({
        'Kayıtlı Kullanıcı': usersCount,
        'Toplam Seçim': electionsCount,
        'Kullanılan Oy': votesCount,
        'Aktif Oturum': sessionsCount
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  async getUsers(_req, res) {
    try {
      const users = await db.getAllUsers();
      res.json(users);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  async updateUserRole(req, res) {
    try {
      const targetId = parseInt(req.params.id, 10);
      if (Number.isNaN(targetId)) {
        return res.status(400).json({ message: 'Geçersiz kullanıcı ID' });
      }
      // Admin kendi rolünü değiştiremez — yanlışlıkla kendi yetkisini kaldırmasın.
      if (targetId === req.user.id) {
        return res.status(400).json({ message: 'Kendi rolünüzü değiştiremezsiniz' });
      }

      const { role } = req.body;
      if (!role || typeof role !== 'string') {
        return res.status(400).json({ message: 'Rol belirtilmedi' });
      }

      const updated = db.setUserRole(targetId, role.trim().toLowerCase());
      if (!updated) return res.status(404).json({ message: 'Kullanıcı bulunamadı' });

      console.log(`[Admin] ${req.user.name} changed role of user #${targetId} → ${role}`);
      res.json({ success: true, user: updated });
    } catch (err) {
      const status = err.message.startsWith('Geçersiz rol') ? 400 : 500;
      res.status(status).json({ message: err.message });
    }
  }

  async getUserDetail(req, res) {
    try {
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid user ID' });
      const detail = db.getUserDetail(id);
      if (!detail) return res.status(404).json({ error: 'User not found' });
      res.json(detail);
    } catch (err) {
      console.error('Get user detail error:', err);
      res.status(500).json({ error: err.message });
    }
  }

  async deleteUser(req, res) {
    try {
      const targetId = parseInt(req.params.id, 10);
      if (targetId === req.user.id) {
        return res.status(400).json({ message: 'Kendi hesabinizi silemezsiniz' });
      }
      db.deleteUser(targetId);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  async getElections(_req, res) {
    try {
      const elections = await db.getAllElections();
      res.json(elections);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  async createElection(req, res) {
    try {
      const { title, description, startDate, endDate } = req.body;
      if (!title) return res.status(400).json({ message: 'Seçim başlığı gerekli' });

      const start = startDate ? new Date(startDate).toISOString() : new Date().toISOString();
      const end = endDate
        ? new Date(endDate).toISOString()
        : new Date(Date.now() + DEFAULT_ELECTION_DURATION_MS).toISOString();

      const election = db.createElection(title, description || '', start, end);
      res.json({ message: 'Election created successfully', election });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  async deleteElection(req, res) {
    try {
      db.db.prepare('DELETE FROM elections WHERE id = ?').run(req.params.id);
      res.json({ message: 'Election deleted successfully' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  async getEmailDomains(_req, res) {
    res.json(db.getAllowedEmailDomains());
  }

  async addEmailDomain(req, res) {
    const { domain } = req.body;
    if (!domain) return res.status(400).json({ message: 'domain required' });
    const result = db.addEmailDomain(domain, req.user.name);
    res.json({ success: true, domain: result });
  }

  async deleteEmailDomain(req, res) {
    db.removeEmailDomain(parseInt(req.params.id, 10));
    res.json({ success: true });
  }

  async getQueueJobs(_req, res) {
    try {
      const jobs = db.getAllQueueJobs();
      res.json(jobs);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  async retryQueueJob(req, res) {
    try {
      db.retryQueueJob(req.params.id);
      voteJobQueue.processNext();
      res.json({ message: 'Job rescheduled for processing.' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  async getLogs(_req, res) {
    try {
      const logPath = path.join(__dirname, '../../logs/combined.log');
      if (!fs.existsSync(logPath)) return res.json([]);

      const content = fs.readFileSync(logPath, 'utf8');
      const lines = content.split('\n').filter(l => l.trim() !== '');
      const parsed = lines.slice(-ADMIN_LOG_LIMIT).map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return { level: 'unknown', message: line, timestamp: new Date().toISOString() };
        }
      }).reverse();

      res.json(parsed);
    } catch (error) {
      console.error('Error reading logs:', error);
      res.status(500).json({ error: 'Failed to read logs' });
    }
  }

  // ============== ACCOUNT LOCK ==============

  async lockUser(req, res) {
    try {
      const targetId = parseInt(req.params.id, 10);
      if (Number.isNaN(targetId)) return res.status(400).json({ message: 'Geçersiz kullanıcı ID' });
      if (targetId === req.user.id) {
        return res.status(400).json({ message: 'Kendi hesabınızı kilitleyemezsiniz' });
      }

      const { hours = 24, reason = '' } = req.body;
      const lockHours = Math.min(Math.max(1, parseInt(hours, 10) || 24), 8760); // 1 saat - 1 yıl
      const lockedUntil = new Date(Date.now() + lockHours * 60 * 60 * 1000).toISOString();
      const updated = db.lockUser(targetId, lockedUntil, String(reason).trim().slice(0, 200));

      if (!updated) return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
      console.log(`[Admin] ${req.user.name} locked user #${targetId} until ${lockedUntil}. Reason: ${reason || '—'}`);
      res.json({ success: true, lockedUntil, reason });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }

  async unlockUser(req, res) {
    try {
      const targetId = parseInt(req.params.id, 10);
      if (Number.isNaN(targetId)) return res.status(400).json({ message: 'Geçersiz kullanıcı ID' });
      const updated = db.unlockUser(targetId);
      if (!updated) return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
      console.log(`[Admin] ${req.user.name} unlocked user #${targetId}`);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }

  async triggerPasswordReset(req, res) {
    try {
      const targetId = parseInt(req.params.id, 10);
      if (Number.isNaN(targetId)) return res.status(400).json({ message: 'Geçersiz kullanıcı ID' });

      const userRow = db.db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(targetId);
      if (!userRow) return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
      if (!userRow.email) {
        return res.status(400).json({ message: 'Bu kullanıcının e-posta adresi yok; sıfırlama maili gönderilemez' });
      }

      // auth.service'in forgotPassword metodunu doğrudan çağır.
      const authService = require('../services/auth.service');
      await authService.forgotPassword(userRow.email);
      console.log(`[Admin] ${req.user.name} triggered password reset for user #${targetId} (${userRow.email})`);
      res.json({ success: true, message: `Şifre sıfırlama maili ${userRow.email} adresine gönderildi.` });
    } catch (err) {
      const status = err.message.includes('gönderilemiyor') ? 503 : 500;
      res.status(status).json({ message: err.message });
    }
  }

  // ============== BRUTE FORCE VIEW ==============

  async getAllAuthAttempts(_req, res) {
    try {
      const rows = db.getAllAuthAttempts();
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  async resetUserAuthAttempts(req, res) {
    try {
      const targetId = parseInt(req.params.id, 10);
      if (Number.isNaN(targetId)) return res.status(400).json({ message: 'Geçersiz kullanıcı ID' });
      db.resetAllAuthAttemptsForUser(targetId);
      console.log(`[Admin] ${req.user.name} reset auth attempts for user #${targetId}`);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }

  // ============== BULK ANNOUNCEMENT ==============

  async announceElection(req, res) {
    try {
      const electionId = parseInt(req.params.id, 10);
      if (Number.isNaN(electionId)) return res.status(400).json({ message: 'Geçersiz seçim ID' });

      const election = db.db.prepare('SELECT * FROM elections WHERE id = ?').get(electionId);
      if (!election) return res.status(404).json({ message: 'Seçim bulunamadı' });

      const { subject, htmlBody } = req.body;
      if (!subject || typeof subject !== 'string' || !subject.trim()) {
        return res.status(400).json({ message: 'E-posta konusu (subject) zorunludur' });
      }
      if (!htmlBody || typeof htmlBody !== 'string' || !htmlBody.trim()) {
        return res.status(400).json({ message: 'E-posta içeriği (htmlBody) zorunludur' });
      }

      const voters = getEligibleVoters(electionId);
      if (voters.length === 0) {
        return res.json({ success: true, sent: 0, failed: 0, message: 'Bu seçim için uygun seçmen bulunamadı.' });
      }

      console.log(`[Announcement] #${electionId} → ${voters.length} alıcıya duyuru gönderiliyor. Admin: ${req.user.name}`);

      const result = await sendBulkEmail(
        voters,
        () => electionAnnouncement(election, subject.trim(), htmlBody.trim())
      );

      console.log(`[Announcement] Tamamlandı: ${result.sent} gönderildi, ${result.failed} başarısız`);
      res.json({
        success: true,
        sent: result.sent,
        failed: result.failed,
        total: voters.length,
        message: `${result.sent}/${voters.length} alıcıya mail gönderildi.`
      });
    } catch (err) {
      console.error('announceElection error:', err);
      res.status(500).json({ message: err.message });
    }
  }

  async getEligibleVoterCount(req, res) {
    try {
      const electionId = parseInt(req.params.id, 10);
      if (Number.isNaN(electionId)) return res.status(400).json({ message: 'Geçersiz seçim ID' });
      const voters = getEligibleVoters(electionId);
      res.json({ count: voters.length, voters: voters.map(v => ({ id: v.id, email: v.email })) });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }

  // ============== ADMIN VOTE HISTORY ==============

  async getAllVotes(req, res) {
    try {
      const page = Math.max(1, parseInt(req.query.page || '1', 10));
      const limit = Math.min(100, Math.max(10, parseInt(req.query.limit || '30', 10)));
      const offset = (page - 1) * limit;
      const electionId = req.query.electionId ? parseInt(req.query.electionId, 10) : null;
      const search = (req.query.search || '').trim().toLowerCase();

      const countStmt = electionId
        ? "SELECT COUNT(*) AS c FROM votes WHERE election_id = ?"
        : "SELECT COUNT(*) AS c FROM votes";
      const total = db.db.prepare(countStmt).get(...(electionId ? [electionId] : [])).c;

      let query = `
        SELECT
          vs.user_id,
          u.name AS user_name,
          u.email AS user_email,
          vs.voted_at,
          vs.transaction_hash,
          e.id AS election_id,
          e.title AS election_title,
          c.name AS candidate_name,
          c.blockchain_candidate_id
        FROM vote_status vs
        LEFT JOIN users u ON u.id = vs.user_id
        LEFT JOIN elections e ON e.id = vs.election_id
        LEFT JOIN votes v ON v.election_id = vs.election_id AND v.transaction_hash = vs.transaction_hash
        LEFT JOIN candidates c ON c.id = v.candidate_id
      `;
      const params = [];
      const wheres = [];
      if (electionId) { wheres.push('vs.election_id = ?'); params.push(electionId); }
      if (search) {
        wheres.push("(LOWER(u.name) LIKE ? OR LOWER(u.email) LIKE ? OR LOWER(e.title) LIKE ? OR LOWER(c.name) LIKE ?)");
        const term = `%${search}%`;
        params.push(term, term, term, term);
      }
      if (wheres.length > 0) query += ' WHERE ' + wheres.join(' AND ');
      query += ' ORDER BY vs.voted_at DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const rows = db.db.prepare(query).all(...params);
      res.json({ rows, total, page, limit, pages: Math.ceil(total / limit) });
    } catch (err) {
      console.error('getAllVotes error:', err);
      res.status(500).json({ error: err.message });
    }
  }

  // ============== ANALYTICS ==============

  async getAnalyticsOverview(req, res) {
    try {
      const electionId = req.query.electionId ? parseInt(req.query.electionId, 10) : null;
      const hours = req.query.hours ? Math.min(168, Math.max(1, parseInt(req.query.hours, 10))) : 24;

      const turnout = db.getTurnoutStats(electionId);
      const hourly = db.getHourlyVoteDistribution(hours, electionId);
      const domains = db.getDomainParticipation(electionId);

      // Hourly bucket'lari frontend icin tum saatleri (eksik dahil) doldur.
      const filled = [];
      const now = new Date();
      now.setMinutes(0, 0, 0);
      const bucketMap = new Map(hourly.map(r => [r.hour_bucket, r.vote_count]));
      for (let i = hours - 1; i >= 0; i -= 1) {
        const t = new Date(now.getTime() - i * 60 * 60 * 1000);
        const key = t.toISOString().slice(0, 13) + ':00:00';
        filled.push({
          hour: key,
          label: `${String(t.getHours()).padStart(2, '0')}:00`,
          votes: bucketMap.get(key) || 0
        });
      }

      res.json({
        turnout,
        hourlyDistribution: filled,
        domainParticipation: domains
      });
    } catch (err) {
      console.error('Analytics overview error:', err);
      res.status(500).json({ error: err.message });
    }
  }

  async getElectionAnalytics(req, res) {
    try {
      const electionId = parseInt(req.params.id, 10);
      if (Number.isNaN(electionId)) {
        return res.status(400).json({ error: 'Invalid election ID' });
      }

      const election = db.db.prepare('SELECT * FROM elections WHERE id = ?').get(electionId);
      if (!election) return res.status(404).json({ error: 'Election not found' });

      const results = db.getElectionResults(electionId);
      const turnout = db.getTurnoutStats(electionId);
      const hourly = db.getHourlyVoteDistribution(72, electionId);
      const domains = db.getDomainParticipation(electionId);

      const totalVotes = results.reduce((s, c) => s + c.vote_count, 0);
      const enriched = results.map(c => ({
        ...c,
        percentage: totalVotes > 0 ? Number(((c.vote_count / totalVotes) * 100).toFixed(2)) : 0
      }));
      const winner = enriched.length > 0
        ? [...enriched].sort((a, b) => b.vote_count - a.vote_count)[0]
        : null;

      res.json({
        election: {
          id: election.id,
          title: election.title,
          description: election.description,
          start_date: election.start_date,
          end_date: election.end_date,
          is_active: election.is_active,
          ended_permanently: election.ended_permanently,
          blockchain_election_id: election.blockchain_election_id
        },
        results: enriched,
        winner,
        totalVotes,
        turnout,
        hourlyDistribution: hourly,
        domainParticipation: domains
      });
    } catch (err) {
      console.error('Election analytics error:', err);
      res.status(500).json({ error: err.message });
    }
  }
}

module.exports = new AdminController();
