const express = require('express');
const Vote = require('../models/Vote');

const router = express.Router();

router.get('/', async (req, res) => {
  const votes = await Vote.find();
  res.json(votes);
});

router.post('/', async (req, res) => {
  const vote = new Vote(req.body);
  await vote.save();
  res.json(vote);
});

module.exports = router;