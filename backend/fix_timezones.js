const { createConnection, runQuery, closeConnection } = require('./src/database/connection');

/**
 * Migration script to fix timezone issues in existing journal entries
 * Converts UTC timestamps to East Africa Time (UTC+3) by subtracting 3 hours
 */
async function fixTimezones() {
  let db;
  
  try {
    console.log('Starting timezone fix migration...');
    db = await createConnection();
    
    // Get all journal entries
    const entries = await new Promise((resolve, reject) => {
      db.all('SELECT id, created_at, updated_at FROM journal_entries', [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    console.log(`Found ${entries.length} entries to fix`);
    
    // Fix each entry
    for (const entry of entries) {
      // Parse the timestamp as UTC by appending 'Z'
      const createdDate = new Date(entry.created_at + 'Z');
      const updatedDate = new Date(entry.updated_at + 'Z');
      
      // Subtract 3 hours to convert from UTC to EAT
      createdDate.setHours(createdDate.getHours() - 3);
      updatedDate.setHours(updatedDate.getHours() - 3);
      
      // Format back to SQLite datetime format (YYYY-MM-DD HH:MM:SS)
      const newCreatedAt = createdDate.toISOString().slice(0, 19).replace('T', ' ');
      const newUpdatedAt = updatedDate.toISOString().slice(0, 19).replace('T', ' ');
      
      console.log(`Entry ${entry.id}: ${entry.created_at} -> ${newCreatedAt}`);
      
      // Update the entry
      await runQuery(db,
        'UPDATE journal_entries SET created_at = ?, updated_at = ? WHERE id = ?',
        [newCreatedAt, newUpdatedAt, entry.id]
      );
    }
    
    console.log('Timezone fix completed successfully!');
    console.log(`Fixed ${entries.length} journal entries`);
    
  } catch (error) {
    console.error('Error fixing timezones:', error);
    throw error;
  } finally {
    if (db) {
      await closeConnection(db);
    }
  }
}

// Run the migration
fixTimezones()
  .then(() => {
    console.log('Migration complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
