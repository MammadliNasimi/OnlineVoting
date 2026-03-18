const express = require('express');
const router = express.Router();
const electionController = require('../controllers/election.controller');
const { authenticateJWT, requireAdmin } = require('../middlewares/auth.middleware');

// Apply JWT verification and Admin requirement to all routes in this router
router.use(authenticateJWT);
router.use(requireAdmin);

// GET /api/admin/elections — list all elections with candidates and domain restrictions
router.get('/', electionController.getAllElections);

// POST /api/admin/elections — create a new election
router.post('/', electionController.createElection);

// PUT /api/admin/elections/:id — update election details
router.put('/:id', electionController.updateElection);

// DELETE /api/admin/elections/:id — delete election
router.delete('/:id', electionController.deleteElection);

// PUT /api/admin/elections/:id/toggle — toggle active/inactive
router.put('/:id/toggle', electionController.toggleActive);

// POST /api/admin/elections/:id/candidates — add candidate to election
router.post('/:id/candidates', electionController.addCandidate);

// DELETE /api/admin/elections/:id/candidates/:cid — remove candidate
router.delete('/:id/candidates/:cid', electionController.removeCandidate);

// PUT /api/admin/elections/:id/candidates/:cid/update — update candidate name/description
router.put('/:id/candidates/:cid/update', electionController.updateCandidate);

// GET /api/admin/elections/:id/domains — list domain restrictions
router.get('/:id/domains', electionController.getDomains);

// POST /api/admin/elections/:id/domains — add domain restriction
router.post('/:id/domains', electionController.addDomain);

// DELETE /api/admin/elections/:id/domains/:did — remove domain restriction
router.delete('/:id/domains/:did', electionController.removeDomain);

module.exports = router;
