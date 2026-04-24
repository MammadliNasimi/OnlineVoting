const db = require('../config/database-sqlite');
const { voteJobQueue } = require('../services/voteQueue.service');

class AdminController {
    async createElection(req, res) {
      try {
        if (!req.user || req.user.role !== 'admin') return res.status(401).json({ message: 'Admin required' });
        const { title, description, startDate: bodyStartDate, endDate: bodyEndDate } = req.body;
        if (!title) return res.status(400).json({ message: 'Seçim başlığı gerekli' });
        
        // Belirtilen tarihler yoksa şimdiki andan 30 gün sonrasına kadar aktif bir seçim oluştur
        const startDate = bodyStartDate ? new Date(bodyStartDate).toISOString() : new Date().toISOString();
        const endDate = bodyEndDate ? new Date(bodyEndDate).toISOString() : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

        const election = db.createElection(title, description || "", startDate, endDate);
        res.json({ message: 'Election created successfully', election });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    }

    async deleteElection(req, res) {
      try {
        if (!req.user || req.user.role !== 'admin') return res.status(401).json({ message: 'Admin required' });
        const { id } = req.params;
        db.db.prepare('DELETE FROM elections WHERE id = ?').run(id);
        res.json({ message: 'Election deleted successfully' });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    }
  async getDatabaseStats(req, res) {
    try {
      if (!req.user || req.user.role !== 'admin') return res.status(401).json({ message: 'Admin required' });
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

  async getUsers(req, res) {
    try {
      if (!req.user || req.user.role !== 'admin') return res.status(401).json({ message: 'Admin required' });
      const users = await db.getAllUsers();
      res.json(users);
    } catch(err) {
      res.status(500).json({ error: err.message });
    }
  }

  async getElections(req, res) {
    try {
      if (!req.user || req.user.role !== 'admin') return res.status(401).json({ message: 'Admin required' });
      const elections = await db.getAllElections();
      res.json(elections);
    } catch(err) {
      res.status(500).json({ error: err.message });
    }
  }

  async getEmailDomains(req, res) {

  const user = req.user;
  if (!user || user.role !== 'admin') return res.status(401).json({ message: 'Admin required' });
  res.json(db.getAllowedEmailDomains());

  }

  async getQueueJobs(req, res) {
    try {
      if (!req.user || req.user.role !== 'admin') return res.status(401).json({ message: 'Admin required' });
      const jobs = db.getAllQueueJobs();
      res.json(jobs);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  async retryQueueJob(req, res) {
    try {
      if (!req.user || req.user.role !== 'admin') return res.status(401).json({ message: 'Admin required' });
      const { id } = req.params;
      db.retryQueueJob(id);

      voteJobQueue.processNext();
      
      res.json({ message: 'Job rescheduled for processing.' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  async addEmailDomain(req, res) {

  const user = req.user;
  if (!user || user.role !== 'admin') return res.status(401).json({ message: 'Admin required' });
  const { domain } = req.body;
  if (!domain) return res.status(400).json({ message: 'domain required' });
  const result = db.addEmailDomain(domain, user.name);
  res.json({ success: true, domain: result });

  }

  async deleteEmailDomain(req, res) {

  const user = req.user;
  if (!user || user.role !== 'admin') return res.status(401).json({ message: 'Admin required' });
  db.removeEmailDomain(parseInt(req.params.id));
  res.json({ success: true });

  }

  async createUser(req, res) {

  const user = req.user;
  if (!user || user.role !== 'admin') return res.status(401).json({ message: 'Admin required' });
  const { name, password, role, email } = req.body;
  if (!name || !password) return res.status(400).json({ message: 'name and password required' });
  if (role !== 'admin') return res.status(400).json({ message: 'Bu endpoint ile sadece admin rolu olusturulabilir' });
  try {
    const bcrypt = require('bcryptjs');
    const existing = await db.findUserByName(name);
    if (existing) return res.status(409).json({ message: 'Bu kullanici adi zaten var' });
    const hashed = bcrypt.hashSync(password, 10);
    const newUser = await db.createUser(name, hashed, 'admin', null, email || null);
    res.json({ success: true, user: { id: newUser.id, name: newUser.name, role: newUser.role } });
  } catch (e) { res.status(500).json({ message: e.message }); }

  }

  async updateUser(req, res) {

  const user = req.user;
  if (!user || user.role !== 'admin') return res.status(401).json({ message: 'Admin required' });
  const updated = db.updateUser(parseInt(req.params.id), req.body);
  res.json({ success: true, user: updated });

  }

  async deleteUser(req, res) {

  const user = req.user;
  if (!user || user.role !== 'admin') return res.status(401).json({ message: 'Admin required' });
  const targetId = parseInt(req.params.id);
  if (targetId === user.id) return res.status(400).json({ message: 'Kendi hesabinizi silemezsiniz' });
  db.deleteUser(targetId);
  res.json({ success: true });

  }

  async deleteSession(req, res) {

  const user = req.user;
  if (!user || user.role !== 'admin') return res.status(401).json({ message: 'Admin required' });
  db.deleteSession(req.params.id);
  res.json({ success: true });

  }

  async deleteVote(req, res) {

  const user = req.user;
  if (!user || user.role !== 'admin') return res.status(401).json({ message: 'Admin required' });
  db.deleteVote(parseInt(req.params.id));
  res.json({ success: true });

  }

  async deleteVoteStatus(req, res) {

  const user = req.user;
  if (!user || user.role !== 'admin') return res.status(401).json({ message: 'Admin required' });
  db.deleteVoteStatus(parseInt(req.params.id));
  res.json({ success: true });

  }

  async getLogs(req, res) {
    try {
      const fs = require('fs');
      const path = require('path');
      const logPath = path.join(__dirname, '../../logs/combined.log');
      if (!fs.existsSync(logPath)) {
        return res.json([]);
      }
      
      const content = fs.readFileSync(logPath, 'utf8');
      const lines = content.split('\n').filter(l => l.trim() !== '');
      
      // Parse last 100 lines
      const parsedLogs = lines.slice(-100).map(line => {
        try {
          return JSON.parse(line);
        } catch(e) {
          return { level: 'unknown', message: line, timestamp: new Date().toISOString() };
        }
      }).reverse();

      res.json(parsedLogs);
    } catch (error) {
      console.error('Error reading logs:', error);
      res.status(500).json({ error: 'Failed to read logs' });
    }
  }

}

module.exports = new AdminController();
