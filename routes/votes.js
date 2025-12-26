const express = require('express');
const Vote = require('../models/Vote');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const votes = await Vote.find();
    res.json(votes);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const vote = new Vote(req.body);
    await vote.save();
    res.json(vote);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;