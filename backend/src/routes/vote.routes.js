const express = require('express');
const router = express.Router();
const { VoteController } = require('../controllers/vote.controller');
const { authenticateJWT } = require('../middlewares/auth.middleware');

router.use(authenticateJWT);

router.get('/elections', VoteController.getElections);
router.get('/candidates/:electionId', VoteController.getElectionCandidates);
router.post('/vote/simple', VoteController.voteSimple);
router.get('/voting-history', VoteController.getVotingHistory);

module.exports = router;
