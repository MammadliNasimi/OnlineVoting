const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const db = require('../config/database-sqlite');
const { voteJobQueue } = require('../services/voteQueue.service');

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
}

module.exports = new AdminController();
