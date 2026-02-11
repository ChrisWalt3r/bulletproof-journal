const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./database.db');

console.log('Deleting default account and its associated data...');

// First, let's see what we have
db.all('SELECT name FROM sqlite_master WHERE type="table"', (err, tables) => {
  if (err) {
    console.error('Error checking tables:', err);
    db.close();
    return;
  }
  
  console.log('Available tables:', tables.map(t => t.name));
  
  // Check if accounts table exists
  if (tables.some(t => t.name === 'accounts')) {
    // Check current accounts
    db.all('SELECT * FROM accounts', (err, accounts) => {
      if (err) {
        console.error('Error checking accounts:', err);
      } else {
        console.log('Current accounts:', accounts);
        
        // Delete the default account with ID 1 if it exists
        if (accounts.some(acc => acc.id === 1)) {
          console.log('Deleting default account...');
          
          // First delete associated journal entries
          db.run('DELETE FROM journal_entries WHERE account_id = 1', (err) => {
            if (err) console.error('Error deleting journal entries:', err);
            else console.log('Deleted journal entries for default account');
            
            // Then delete the default account
            db.run('DELETE FROM accounts WHERE id = 1', (err) => {
              if (err) console.error('Error deleting default account:', err);
              else console.log('Default account deleted successfully');
              
              // Show remaining accounts
              db.all('SELECT * FROM accounts', (err, remainingAccounts) => {
                if (err) {
                  console.error('Error checking remaining accounts:', err);
                } else {
                  console.log('Remaining accounts:', remainingAccounts);
                }
                db.close();
              });
            });
          });
        } else {
          console.log('No default account found');
          db.close();
        }
      }
    });
  } else {
    console.log('Accounts table does not exist');
    db.close();
  }
});