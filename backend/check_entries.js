const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'bulletproof_journal.db');
const db = new sqlite3.Database(dbPath);

console.log('Checking journal entries in database...');

db.all('SELECT id, title, content, account_id, created_at FROM journal_entries ORDER BY created_at DESC LIMIT 5', (err, rows) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('\n=== Latest Journal Entries ===\n');
    rows.forEach(row => {
      console.log('ID:', row.id);
      console.log('Title:', row.title);
      console.log('Account ID:', row.account_id);
      console.log('Created (DB):', row.created_at);
      console.log('---');
    });
  }
  
  db.close();
});