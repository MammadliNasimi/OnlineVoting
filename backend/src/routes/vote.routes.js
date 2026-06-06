const express = require('express');
const router = express.Router();
const { VoteController } = require('../controllers/vote.controller');
const { authenticateJWT, requireAuth } = require('../middlewares/auth.middleware');

// Unauthenticated routes
router.get('/receipt/:txHash', VoteController.verifyReceipt);

// Authenticated routes
// Tum oylama endpoint'leri kimlik dogrulamasi gerektirir; oturum yoksa 401 doneriz.
router.use(authenticateJWT, requireAuth);

router.get('/elections', VoteController.getElections);
router.get('/candidates/:electionId', VoteController.getElectionCandidates);
router.post('/vote/simple', VoteController.voteSimple);
router.get('/voting-history', VoteController.getVotingHistory);

module.exports = router;
