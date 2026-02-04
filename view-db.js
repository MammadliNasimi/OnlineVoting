const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'database.db');
const db = new Database(dbPath);

console.log('📊 SQLite Database Viewer\n');
console.log('Database:', dbPath, '\n');

// Get all tables
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();

tables.forEach(({ name }) => {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📋 TABLE: ${name}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  
  const rows = db.prepare(`SELECT * FROM ${name}`).all();
  
  if (rows.length === 0) {
    console.log('   (empty)');
  } else {
    console.table(rows);
  }
});

db.close();
