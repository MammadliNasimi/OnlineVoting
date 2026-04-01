const express = require('express');
const router = express.Router();
const electionController = require('../controllers/election.controller');
const { authenticateJWT, requireAdmin } = require('../middlewares/auth.middleware');

router.use(authenticateJWT);
router.use(requireAdmin);

router.get('/', electionController.getAllElections);

router.post('/', electionController.createElection);

router.put('/:id', electionController.updateElection);

router.delete('/:id', electionController.deleteElection);

router.put('/:id/toggle', electionController.toggleActive);

router.post('/:id/candidates', electionController.addCandidate);

router.delete('/:id/candidates/:cid', electionController.removeCandidate);

router.put('/:id/candidates/:cid/update', electionController.updateCandidate);

router.get('/:id/domains', electionController.getDomains);

router.post('/:id/domains', electionController.addDomain);

router.delete('/:id/domains/:did', electionController.removeDomain);

module.exports = router;
