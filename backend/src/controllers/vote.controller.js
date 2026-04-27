const voteService = require('../services/vote.service');

class VoteController {
  async getElections(req, res) {
    try {
      const elections = await voteService.getElections(req.user);
      res.json(elections);
    } catch (error) {
      console.error('Error fetching elections:', error);
      if (error.message === 'Unauthorized') return res.status(401).json({ message: 'Unauthorized' });
      if (error.message.includes('Database')) return res.status(503).json({ message: 'Database not available' });
      res.status(500).json({ message: 'Failed to fetch elections' });
    }
  }

  async getElectionCandidates(req, res) {
    try {
      const candidates = await voteService.getElectionCandidates(parseInt(req.params.electionId), req.user);
      res.json(candidates);
    } catch (error) {
      console.error('Error fetching election candidates:', error);
      if (error.message === 'Invalid election ID') return res.status(400).json({ message: error.message });
      if (error.message === 'Election not found') return res.status(404).json({ message: error.message });
      res.status(500).json({ message: 'Failed to fetch candidates' });
    }
  }

  async voteSimple(req, res) {
    try {
      await voteService.processSimpleVote(req.user, req.body);
      res.status(202).json({
        success: true,
        status: 'queued',
        message: 'Oyunuz havuza alındı, işleniyor. Lütfen bildirim bekleyin veya sayfayı yenileyin.'
      });
    } catch (error) {
      console.error('Error in simple vote pre-check:', error);
      const msg = error.message;
      let status = 500;
      if (msg.includes('Database') || msg.includes('unavailable')) status = 503;
      if (msg === 'Unauthorized') status = 401;
      if (msg.includes('Bulunamadı') || msg.includes('bulunamadı') || msg.includes('Aday')) status = 404;
      if (msg.includes('aktif') || msg.includes('yetkili')) status = 400;
      if (msg.includes('domain')) status = 403;

      res.status(status).json({
        message: msg || 'Oy kuyruğa eklenemedi',
        error: error.toString()
      });
    }
  }

  async getVotingHistory(req, res) {
    try {
      const history = await voteService.getVotingHistory(req.user);
      res.json(history);
    } catch (error) {
      console.error('Get voting history error:', error);
      res.status(error.message === 'Unauthorized' ? 401 : 500).json({ message: 'Failed to fetch voting history' });
    }
  }
}

module.exports = { VoteController: new VoteController() };
