const db = require('../config/db');

exports.getElections = async (req, res) => {
    // Mock data for skeleton if DB not available
    const elections = [
        { id: 1, title: 'University President Election', candidates: ['Alice', 'Bob'], isActive: true },
        { id: 2, title: 'Class Representative', candidates: ['Charlie', 'Dave'], isActive: false }
    ];

    // DB Implementation:
    // try {
    //    const { rows } = await db.query('SELECT * FROM elections');
    //    res.json(rows);
    // } catch (e) { ... }

    res.json(elections);
};

exports.createElection = async (req, res) => {
    // Admin only
    res.json({ message: 'Election created (stub)' });
};
