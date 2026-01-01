const blockchainService = require('../services/blockchainService');

exports.vote = async (req, res) => {
    const { electionId, candidateId } = req.body;
    const userId = req.user ? req.user.id : 999; // Mock user ID

    try {
        // 1. Check if user has already voted (DB check)
        // const hasVoted = await db.query('SELECT * FROM vote_status WHERE user_id = $1 AND election_id = $2', [userId, electionId]);
        // if (hasVoted.rows.length > 0) return res.status(400).json({ message: 'Already voted' });

        // 2. Submit vote to blockchain
        const txHash = await blockchainService.submitVote(electionId, candidateId);

        // 3. Record in DB
        // await db.query('INSERT INTO vote_status ...');

        res.json({ success: true, txHash });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Voting failed', error: error.message });
    }
};

exports.getResults = async (req, res) => {
    const { electionId } = req.params;
    try {
        const results = await blockchainService.getResults(electionId);
        res.json(results);
    } catch (error) {
        res.status(500).json({ message: 'Could not fetch results', error: error.message });
    }
};
