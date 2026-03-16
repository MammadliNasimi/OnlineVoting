const Database = require('better-sqlite3');
const db = new Database('./database.db');

const elections = db.prepare('SELECT id, title, start_date, end_date, is_active, blockchain_election_id FROM elections').all();

console.log('=== ELECTIONS IN DATABASE ===\n');
elections.forEach(e => {
  console.log(`ID ${e.id}: ${e.title}`);
  console.log(`  Start: ${e.start_date}`);
  console.log(`  End: ${e.end_date}`);
  console.log(`  Active (DB): ${e.is_active}`);
  console.log(`  Blockchain ID: ${e.blockchain_election_id}`);
  
  const now = new Date();
  const start = new Date(e.start_date);
  const end = new Date(e.end_date);
  
  console.log(`  Now: ${now.toISOString()}`);
  console.log(`  Start (parsed): ${start.toISOString()}`);
  console.log(`  End (parsed): ${end.toISOString()}`);
  console.log(`  Time-based active: ${now >= start && now <= end}`);
  console.log('');
});

db.close();
