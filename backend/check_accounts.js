const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'bulletproof_journal.db');
const db = new sqlite3.Database(dbPath);

console.log('Checking accounts in database at:', dbPath);

db.all('SELECT * FROM accounts', (err, rows) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('Accounts found:', JSON.stringify(rows, null, 2));
  }
  
  db.close();
});