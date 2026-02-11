const { createConnection, runQuery, closeConnection } = require('./src/database/connection');

/**
 * Quick fix for entry 31 - set it to Oct 16 with the same time
 */
async function fixEntry31() {
  let db;
  
  try {
    console.log('Fixing entry 31...');
    db = await createConnection();
    
    // Get current entry
    const entry = await new Promise((resolve, reject) => {
      db.get('SELECT id, created_at, updated_at FROM journal_entries WHERE id = 31', [], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    console.log(`Current: ${entry.created_at}`);
    
    // Change date from 2025-10-17 to 2025-10-16, keep the time
    const newCreatedAt = entry.created_at.replace('2025-10-17', '2025-10-16');
    const newUpdatedAt = entry.updated_at.replace('2025-10-17', '2025-10-16');
    
    console.log(`New: ${newCreatedAt}`);
    
    // Update the entry
    await runQuery(db,
      'UPDATE journal_entries SET created_at = ?, updated_at = ? WHERE id = ?',
      [newCreatedAt, newUpdatedAt, entry.id]
    );
    
    console.log('Entry 31 fixed successfully!');
    
  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    if (db) {
      await closeConnection(db);
    }
  }
}

// Run the fix
fixEntry31()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
