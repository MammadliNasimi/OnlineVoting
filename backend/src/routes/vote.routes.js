const express = require('express');
const router = express.Router();
const { VoteController } = require('../controllers/vote.controller');
const { authenticateJWT } = require('../middlewares/auth.middleware');

router.use(authenticateJWT);

router.post('/candidates', VoteController.addCandidate);
router.get('/candidates', VoteController.getCandidates);
router.get('/elections', VoteController.getElections);
router.get('/candidates/:electionId', VoteController.getElectionCandidates);
router.post('/vote/simple', VoteController.voteSimple);
router.get('/votes', VoteController.getVotes);
router.post('/votes', VoteController.postVote);
router.get('/voting-history', VoteController.getVotingHistory);
router.get('/voting-period', VoteController.getVotingPeriod);
router.post('/voting-period', VoteController.setVotingPeriod);

module.exports = router;
