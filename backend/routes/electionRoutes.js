const express = require('express');
const router = express.Router();
const electionController = require('../controllers/electionController');

router.get('/', electionController.getElections);
router.post('/', electionController.createElection);

module.exports = router;
