const { runQuery, closeConnection } = require('./connection');

// Create tables
const createTables = async () => {
  const tables = [
    // Accounts table (Modified for Auth)
    `CREATE TABLE IF NOT EXISTS accounts (
      id SERIAL PRIMARY KEY,
      auth_id UUID, -- Link to Supabase Auth User
      name TEXT NOT NULL,
      description TEXT,
      color TEXT DEFAULT '#4A90E2',
      starting_balance DECIMAL DEFAULT 0,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(auth_id, name)
    )`,

    // Journal entries table (Heavily modified for MT5 & Win Def)
    `CREATE TABLE IF NOT EXISTS journal_entries (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      mood_rating INTEGER CHECK(mood_rating >= 1 AND mood_rating <= 10),
      tags JSONB, 
      is_private BOOLEAN DEFAULT true,
      
      -- Image Data
      image_url TEXT, 
      image_filename TEXT,
      before_image_url TEXT,
      after_image_url TEXT,

      -- Account Link
      account_id INTEGER REFERENCES accounts(id),
      
      -- Trading Data (MT5)
      mt5_ticket BIGINT,
      mt5_position_id TEXT,
      symbol TEXT, 
      entry_price DECIMAL,
      exit_price DECIMAL,
      stop_loss DECIMAL,
      take_profit DECIMAL,
      volume DECIMAL,
      direction TEXT, -- BUY/SELL
      asset_type TEXT DEFAULT 'forex', -- forex, index, commodity, crypto, stock, other
      
      -- Results
      pnl DECIMAL,
      commission DECIMAL,
      swap DECIMAL,
      balance DECIMAL,
      
      -- "Win Usage" Feature
      is_plan_compliant BOOLEAN DEFAULT false,
      plan_notes TEXT,
      reason_mindset TEXT,
      following_plan BOOLEAN DEFAULT false,
      emotional_state TEXT,
      notes TEXT,
      gallery_images JSONB DEFAULT '[]'::jsonb,

      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    // Goals table
    `CREATE TABLE IF NOT EXISTS goals (
      id SERIAL PRIMARY KEY,
      account_id INTEGER REFERENCES accounts(id),
      title TEXT NOT NULL,
      description TEXT,
      target_date DATE,
      is_completed BOOLEAN DEFAULT false,
      priority INTEGER CHECK(priority >= 1 AND priority <= 5) DEFAULT 3,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      completed_at TIMESTAMPTZ
    )`,

    // Habits table
    `CREATE TABLE IF NOT EXISTS habits (
      id SERIAL PRIMARY KEY,
      account_id INTEGER REFERENCES accounts(id),
      name TEXT NOT NULL,
      description TEXT,
      frequency TEXT NOT NULL,
      target_count INTEGER DEFAULT 1,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    // Habit tracking table
    `CREATE TABLE IF NOT EXISTS habit_logs (
      id SERIAL PRIMARY KEY,
      habit_id INTEGER NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
      completed_count INTEGER DEFAULT 1,
      log_date DATE NOT NULL,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(habit_id, log_date)
    )`
  ];

  for (const tableQuery of tables) {
    await runQuery(tableQuery);
  }
};

// Create indexes
const createIndexes = async () => {
  // Postgres automatically indexes PRIMARY KEYs
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_journal_entries_created_at ON journal_entries(created_at)',
    'CREATE INDEX IF NOT EXISTS idx_journal_entries_auth ON journal_entries(account_id)',
    'CREATE INDEX IF NOT EXISTS idx_journal_entries_mt5 ON journal_entries(mt5_ticket)',
    'CREATE INDEX IF NOT EXISTS idx_journal_entries_asset_type ON journal_entries(asset_type)',
    'CREATE INDEX IF NOT EXISTS idx_accounts_auth ON accounts(auth_id)'
  ];

  for (const indexQuery of indexes) {
    await runQuery(indexQuery);
  }
};

// Live migrations — safely add new columns to existing tables
const runLiveMigrations = async () => {
  const migrations = [
    // Add asset_type column (forex, index, commodity, crypto, stock, other)
    `ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS asset_type TEXT DEFAULT 'forex'`,
    // Add gallery_images column for up to 5 user-uploaded images
    `ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS gallery_images JSONB DEFAULT '[]'::jsonb`,
    // Fix: reset all unreviewed MT5 entries to NULL (NEEDS REVIEW) instead of false (OFF PLAN)
    // Only affects MT5 entries that have never been explicitly reviewed
    `UPDATE journal_entries SET following_plan = NULL WHERE mt5_ticket IS NOT NULL AND following_plan = false AND emotional_state IS NULL`,
    // Accounts table migrations — add columns that may be missing from older deployments
    `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS auth_id UUID`,
    `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#4A90E2'`,
    `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS description TEXT`,
    `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS starting_balance DECIMAL DEFAULT 0`,
    `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true`,
    // Drop the bad single-column unique constraint on auth_id (only allows 1 account per user)
    `DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'accounts_auth_id_key') THEN ALTER TABLE accounts DROP CONSTRAINT accounts_auth_id_key; END IF; END $$`,
    // Add correct composite unique constraint on (auth_id, name) — allows multiple accounts per user
    `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'accounts_auth_id_name_key') THEN ALTER TABLE accounts ADD CONSTRAINT accounts_auth_id_name_key UNIQUE (auth_id, name); END IF; END $$`,
  ];

  for (const migration of migrations) {
    try {
      await runQuery(migration);
    } catch (err) {
      // Ignore "already exists" errors, log others
      if (!err.message.includes('already exists')) {
        console.warn('Migration warning:', err.message);
      }
    }
  }
  console.log('Live migrations completed');
};

// Initialize database
const initializeDatabase = async () => {
  try {
    console.log('Creating database tables...');
    await createTables();

    // Run live migrations BEFORE indexes (indexes may depend on new columns)
    await runLiveMigrations();

    console.log('Creating database indexes...');
    await createIndexes();

    // Skip data migration for now as we are starting fresh on Cloud
    // await runMigration();

    console.log('Database initialization completed successfully');
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
};

module.exports = {
  initializeDatabase,
  createTables,
  createIndexes
};