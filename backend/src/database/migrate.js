const { createConnection, runQuery, closeConnection } = require('./connection');

// Migration to add accounts table and account_id to journal_entries
const addAccountsSupport = async (db) => {
  try {
    // Check if accounts table exists
    const tablesResult = await new Promise((resolve, reject) => {
      db.all("SELECT name FROM sqlite_master WHERE type='table' AND name='accounts'", [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    const accountsTableExists = tablesResult.length > 0;

    if (!accountsTableExists) {
      console.log('Creating accounts table...');
      await runQuery(db, `
        CREATE TABLE accounts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          description TEXT,
          color TEXT DEFAULT '#4A90E2',
          is_active BOOLEAN DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create default account
      await runQuery(db, `
        INSERT INTO accounts (name, description, color) 
        VALUES ('Default Account', 'Your main trading account', '#4A90E2')
      `);

      console.log('Accounts table created with default account');
    }

    // Check if journal_entries has account_id column
    const tableInfo = await new Promise((resolve, reject) => {
      db.all("PRAGMA table_info(journal_entries)", [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    const hasAccountId = tableInfo.some(col => col.name === 'account_id');

    if (!hasAccountId) {
      console.log('Adding account_id column to journal_entries...');
      await runQuery(db, 'ALTER TABLE journal_entries ADD COLUMN account_id INTEGER DEFAULT 1');

      // Create foreign key index
      await runQuery(db, 'CREATE INDEX IF NOT EXISTS idx_journal_entries_account_id ON journal_entries(account_id)');

      console.log('Successfully added account_id to journal_entries');
    }

  } catch (error) {
    console.error('Accounts migration error:', error);
    throw error;
  }
};

// Migration to add reason_mindset column to journal_entries
const addReasonMindsetColumn = async (db) => {
  try {
    const tableInfo = await new Promise((resolve, reject) => {
      db.all("PRAGMA table_info(journal_entries)", [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    const hasReasonMindset = tableInfo.some(col => col.name === 'reason_mindset');

    if (!hasReasonMindset) {
      console.log('Adding reason_mindset column to journal_entries...');
      await runQuery(db, 'ALTER TABLE journal_entries ADD COLUMN reason_mindset TEXT');
      console.log('Successfully added reason_mindset column');
    }
  } catch (error) {
    console.error('Reason mindset migration error:', error);
    throw error;
  }
};

// Migration to add MT5 specific columns
const addMT5Support = async (db) => {
  try {
    const tableInfo = await new Promise((resolve, reject) => {
      db.all("PRAGMA table_info(journal_entries)", [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    const columnsToAdd = [
      { name: 'mt5_ticket', type: 'INTEGER' },
      { name: 'before_image_url', type: 'TEXT' },
      { name: 'after_image_url', type: 'TEXT' },
      { name: 'pnl', type: 'REAL' },
      { name: 'entry_price', type: 'REAL' },
      { name: 'exit_price', type: 'REAL' },
      { name: 'commission', type: 'REAL' },
      { name: 'swap', type: 'REAL' },
      { name: 'balance', type: 'REAL' }
    ];

    for (const col of columnsToAdd) {
      const exists = tableInfo.some(c => c.name === col.name);
      if (!exists) {
        console.log(`Adding ${col.name} column to journal_entries...`);
        await runQuery(db, `ALTER TABLE journal_entries ADD COLUMN ${col.name} ${col.type}`);
      }
    }

    // Add a unique index to prevent duplicate rows per MT5 ticket.
    // If duplicates already exist, dedupe first to avoid migration failure.
    const refreshedTableInfo = await new Promise((resolve, reject) => {
      db.all("PRAGMA table_info(journal_entries)", [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    const hasMt5Ticket = refreshedTableInfo.some(c => c.name === 'mt5_ticket');
    if (hasMt5Ticket) {
      console.log('Ensuring mt5_ticket values are unique...');
      // Keep the newest row (highest id) for each mt5_ticket, delete older duplicates.
      await runQuery(db, `
        DELETE FROM journal_entries
        WHERE mt5_ticket IS NOT NULL
          AND id NOT IN (
            SELECT MAX(id)
            FROM journal_entries
            WHERE mt5_ticket IS NOT NULL
            GROUP BY mt5_ticket
          )
      `);

      await runQuery(db, 'CREATE UNIQUE INDEX IF NOT EXISTS idx_journal_entries_mt5_ticket_unique ON journal_entries(mt5_ticket)');
    }
  } catch (error) {
    console.error('MT5 support migration error:', error);
    throw error;
  }
};

// Migration to add image columns to existing journal_entries table
const addImageColumns = async (db) => {
  try {
    // Check if columns already exist
    const tableInfo = await new Promise((resolve, reject) => {
      db.all("PRAGMA table_info(journal_entries)", [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    const hasImageUrl = tableInfo.some(col => col.name === 'image_url');
    const hasImageFilename = tableInfo.some(col => col.name === 'image_filename');
    const hasUserId = tableInfo.some(col => col.name === 'user_id');

    if (!hasImageUrl) {
      console.log('Adding image_url column to journal_entries...');
      await runQuery(db, 'ALTER TABLE journal_entries ADD COLUMN image_url TEXT');
    }

    if (!hasImageFilename) {
      console.log('Adding image_filename column to journal_entries...');
      await runQuery(db, 'ALTER TABLE journal_entries ADD COLUMN image_filename TEXT');
    }

    // Remove user_id column if it exists (since we removed authentication)
    if (hasUserId) {
      console.log('Removing user_id constraint from journal_entries...');

      // SQLite doesn't support DROP COLUMN directly, so we need to recreate the table
      await runQuery(db, `
        CREATE TABLE journal_entries_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          mood_rating INTEGER CHECK(mood_rating >= 1 AND mood_rating <= 10),
          tags TEXT,
          is_private BOOLEAN DEFAULT 1,
          image_url TEXT,
          image_filename TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Copy data from old table to new table (excluding user_id)
      await runQuery(db, `
        INSERT INTO journal_entries_new (id, title, content, mood_rating, tags, is_private, image_url, image_filename, created_at, updated_at)
        SELECT id, title, content, mood_rating, tags, is_private, image_url, image_filename, created_at, updated_at
        FROM journal_entries
      `);

      // Drop old table and rename new table
      await runQuery(db, 'DROP TABLE journal_entries');
      await runQuery(db, 'ALTER TABLE journal_entries_new RENAME TO journal_entries');

      console.log('Successfully removed user_id column from journal_entries');
    }

    if (hasImageUrl && hasImageFilename && !hasUserId) {
      console.log('Database schema is up to date - no migration needed');
    }

  } catch (error) {
    console.error('Migration error:', error);
    throw error;
  }
};

// Run migration
const runMigration = async () => {
  let db;
  try {
    console.log('Starting database migration...');
    db = await createConnection();
    await addImageColumns(db);
    await addAccountsSupport(db);
    await addReasonMindsetColumn(db);
    await addMT5Support(db);
    console.log('Database migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    if (db) {
      await closeConnection(db);
    }
  }
};

module.exports = {
  runMigration,
  addImageColumns,
  addAccountsSupport,
  addReasonMindsetColumn
};