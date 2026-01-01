const express = require('express');
const router = express.Router();
const voteController = require('../controllers/voteController');

// Middleware to mock auth check
const requireAuth = (req, res, next) => {
    // In real app, verify JWT
    req.user = { id: 1, role: 'voter' };
    next();
};

router.post('/', requireAuth, voteController.vote);
router.get('/:electionId/results', voteController.getResults);

module.exports = router;
