const express = require('express');
const router = express.Router();

// GET /api/votes - Tüm oyları getir
router.get('/', (req, res) => {
  const db = req.db;
  db.query('SELECT * FROM votes ORDER BY timestamp DESC', (err, results) => {
    if (err) return res.status(500).json({ message: err.message });
    res.json(results);
  });
});

// POST /api/votes - Yeni oy ekle
router.post('/', (req, res) => {
  const db = req.db;
  const { voterId, candidate } = req.body;
  if (!voterId || !candidate) {
    return res.status(400).json({ message: 'voterId and candidate are required' });
  }
  db.query(
    'INSERT INTO votes (voterId, candidate) VALUES (?, ?)',
    [voterId, candidate],
    (err, result) => {
      if (err) return res.status(500).json({ message: err.message });
      db.query('SELECT * FROM votes WHERE id = ?', [result.insertId], (err2, rows) => {
        if (err2) return res.status(500).json({ message: err2.message });
        res.json(rows[0]);
      });
    }
  );
});

module.exports = router;