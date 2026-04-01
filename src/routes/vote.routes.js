const express = require('express');
const router = express.Router();
const voteController = require('../controllers/vote.controller');

router.post('/candidates', voteController.addCandidate);
router.get('/candidates', voteController.getCandidates);
router.get('/elections', voteController.getElections);
router.get('/candidates/:electionId', voteController.getElectionCandidates);
router.post('/vote/simple', voteController.voteSimple);
router.get('/votes', voteController.getVotes);
router.post('/votes', voteController.postVote);
router.get('/voting-history', voteController.getVotingHistory);
router.get('/voting-period', voteController.getVotingPeriod);
router.post('/voting-period', voteController.setVotingPeriod);

module.exports = router;
