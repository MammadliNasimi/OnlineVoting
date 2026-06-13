const db = require('../config/database-sqlite');
const state = require('../config/state');

class BlockchainSyncService {
  async syncActiveElectionsWithChain() {
    if (!state.relayerService) return { synced: 0, deactivated: [] };

    const rows = db.db.prepare(`
      SELECT id, blockchain_election_id, title
      FROM elections
      WHERE is_active = 1 AND blockchain_election_id IS NOT NULL
    `).all();

    const deactivated = [];
    for (const row of rows) {
      try {
        const status = await state.relayerService.getOnChainElectionStatus(row.blockchain_election_id);
        if (!status.isVotable) {
          db.db.prepare('UPDATE elections SET is_active = 0 WHERE id = ?').run(row.id);
          deactivated.push({ id: row.id, title: row.title, reason: this._reason(status) });
          console.log(`[ChainSync] Election #${row.id} deactivated: ${this._reason(status)}`);
        }
      } catch (err) {
        console.warn(`[ChainSync] Election #${row.id} check failed:`, err.message);
      }
    }

    return { synced: rows.length, deactivated };
  }

  _reason(status) {
    if (!status.exists) return 'on-chain kayit yok';
    if (!status.isActive) return 'on-chain pasif';
    if (!status.hasStarted) return 'henuz baslamadi';
    if (status.hasEnded) return 'on-chain suresi doldu';
    if (status.candidateCount === 0) return 'on-chain aday yok';
    return 'oy verilemez';
  }
}

module.exports = new BlockchainSyncService();
