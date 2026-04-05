const db = require('../config/database-sqlite');

class ElectionController {
    async getAllElections(req, res) {
        try {
            const elections = db.getAllElections();
            if (req.user && req.user.role !== 'admin') {
                const user = await db.findUserByName(req.user.name);
                const filteredElections = elections.filter(election => {        
                    const domains = db.getElectionDomainRestrictions(election.id);
                    if (!domains || domains.length === 0) return true;
                    if (!user || !user.email) return false;
                    const userDomain = user.email.split('@')[1];
                    return domains.some(d => d.domain === userDomain);
                });
                return res.json(filteredElections);
            }
            res.json(elections);
        } catch (error) {
            res.status(500).json({ message: 'Internal server error', error: error.message });
        }
    }

    async createElection(req, res) {
        const { title, description, startDate, endDate } = req.body;
        try {
            const election = db.createElection(title, description, startDate, endDate);
            res.json(election);
        } catch (error) {
            res.status(500).json({ message: 'Failed to create election: ' + error.message });
        }
    }

    async updateElection(req, res) {
        try {
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async deleteElection(req, res) {
        try {
            db.deleteElection(parseInt(req.params.id));
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async toggleActive(req, res) {
        try {
            const id = parseInt(req.params.id);
            const election = db.db.prepare('SELECT * FROM elections WHERE id = ?').get(id);
            if (!election) return res.status(404).json({ message: 'Election not found' });

            const state = require('../config/state');
            const { ethers } = require('ethers');

            const currentActive = election.is_active;
            const newActive = currentActive === 1 ? 0 : 1;

            const provider = state.relayerService.provider;
            const contractAddress = state.relayerService.contractAddress;       
            const contractABI = state.relayerService.contractABI;
            const issuerWallet = state.credentialIssuer.issuerWallet.connect(provider);
            const contract = new ethers.Contract(contractAddress, contractABI, issuerWallet);

            const chainElection = await contract.elections(election.blockchain_election_id);

            if (newActive === 1) {
                if (chainElection.startTime == 0n || !chainElection.isActive) { 
                    const candidates = db.db.prepare('SELECT * FROM candidates WHERE election_id = ?').all(id);
                    const candidateNames = candidates.map(c => c.name);

                    if (candidateNames.length === 0) {
                        return res.status(400).json({ message: 'Seçimi başlatmak için en az bir aday eklemelisiniz.' });
                    }

                    const startTime = Math.floor(new Date(election.start_date).getTime() / 1000);
                    const endTime = Math.floor(new Date(election.end_date).getTime() / 1000);

                    const tx = await contract.createElection(
                        election.title,
                        startTime,
                        endTime,
                        candidateNames
                    );
                    const receipt = await tx.wait();

                    const event = receipt.logs.find(log => {
                        try {
                            const parsed = contract.interface.parseLog(log);    
                            return parsed && parsed.name === 'ElectionCreated'; 
                        } catch (e) {
                            return false;
                        }
                    });

                    if (event) {
                        const parsedLog = contract.interface.parseLog(event);   
                        const newBcId = Number(parsedLog.args[0]);
                        db.db.prepare('UPDATE elections SET blockchain_election_id = ? WHERE id = ?').run(newBcId, id);
                        election.blockchain_election_id = newBcId;
                    }
                }
            } else {
                if (chainElection.isActive) {
                    const tx = await contract.endElection(election.blockchain_election_id);
                    await tx.wait();
                }
            }

            db.db.prepare('UPDATE elections SET is_active = ? WHERE id = ?').run(newActive, id);
            res.json({ success: true, is_active: newActive });
        } catch (error) {
            console.error('Error toggling election status:', error);
            res.status(500).json({ message: error.message });
        }
    }

    async addCandidate(req, res) {
        const { name, description } = req.body;
        if (!name) return res.status(400).json({ message: 'name required' });   
        try {
            const candidate = db.addCandidateToElection(parseInt(req.params.id), name, description);
            res.json(candidate);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async removeCandidate(req, res) {
        try {
            db.removeCandidateFromElection(parseInt(req.params.cid));
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async updateCandidate(req, res) {
        const { name, description } = req.body;
        if (!name) return res.status(400).json({ message: 'name required' });   
        try {
            db.updateCandidate(parseInt(req.params.cid), name, description);    
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async getDomains(req, res) {
        try {
            const domains = db.getElectionDomainRestrictions(parseInt(req.params.id));
            res.json(domains);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async addDomain(req, res) {
        const { domain } = req.body;
        if (!domain) return res.status(400).json({ message: 'domain required' });
        try {
            db.addElectionDomainRestriction(parseInt(req.params.id), domain);   
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async removeDomain(req, res) {
        try {
            db.removeElectionDomainRestriction(parseInt(req.params.did));       
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
}
module.exports = new ElectionController();
