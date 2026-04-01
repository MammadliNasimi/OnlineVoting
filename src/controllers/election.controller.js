const electionService = require('../services/election.service');

class ElectionController {
    async getAllElections(req, res) {
        try {
            const elections = await electionService.getAllElections();
            res.json(elections);
        } catch (error) {
            res.status(500).json({ message: 'Internal server error', error: error.message });
        }
    }

    async createElection(req, res) {
        const { title, description, startDate, endDate, candidates, allowedDomains } = req.body;

        if (!title || !startDate || !endDate) {
            return res.status(400).json({ message: 'title, startDate, endDate required' });
        }

        try {
            const newElection = await electionService.createElectionOnChainAndDb(
                title, description, startDate, endDate, candidates, allowedDomains
            );
            res.json(newElection);
        } catch (error) {
            console.error('❌ Error creating election:', error);
            res.status(500).json({ message: 'Failed to create election: ' + error.message });
        }
  }

  async updateElection(req, res) {
        const { title, description, startDate, endDate } = req.body;

        if (!title || !startDate || !endDate) {
            return res.status(400).json({ message: 'title, startDate, endDate required' });
        }

        try {
            const election = await electionService.updateElection(parseInt(req.params.id), title, description, startDate, endDate);
            res.json(election);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
  }

  async deleteElection(req, res) {
        try {
            await electionService.deleteElection(parseInt(req.params.id));
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
  }

  async toggleActive(req, res) {
        try {
            const election = await electionService.toggleElectionActive(parseInt(req.params.id));
            res.json(election);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
  }

  async addCandidate(req, res) {
        const { name, description } = req.body;
        if (!name) return res.status(400).json({ message: 'name required' });

        try {
            const candidate = await electionService.addCandidateToElection(parseInt(req.params.id), name, description);
            res.json(candidate);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
  }

  async removeCandidate(req, res) {
        try {
            await electionService.removeCandidateFromElection(parseInt(req.params.cid));
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
  }

  async updateCandidate(req, res) {
        const { name, description } = req.body;
        if (!name) return res.status(400).json({ message: 'name required' });

        try {
            const candidate = await electionService.updateCandidate(parseInt(req.params.cid), name, description);
            res.json(candidate);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
  }

  async getDomains(req, res) {
        try {
            const domains = await electionService.getElectionDomainRestrictions(parseInt(req.params.id));
            res.json(domains);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
  }

  async addDomain(req, res) {
        const { domain } = req.body;
        if (!domain) return res.status(400).json({ message: 'domain required' });

        try {
            const result = await electionService.addElectionDomainRestriction(parseInt(req.params.id), domain);
            res.json({ success: true, domain: result });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
  }

  async removeDomain(req, res) {
        try {
            await electionService.removeElectionDomainRestriction(parseInt(req.params.did));
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
}

module.exports = new ElectionController();
