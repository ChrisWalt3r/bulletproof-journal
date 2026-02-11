const { Pool } = require('pg');
require('dotenv').config();

// Create a new pool using the connection string from environment variables
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Required for Supabase/Neon
  }
});

// Test the connection
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Execute query with parameters
const runQuery = async (query, params = []) => {
  const client = await pool.connect();
  try {
    const res = await client.query(query, params);
    // Mimic sqlite3 "this.lastID" behavior for INSERTs is tricky in PG without RETURNING.
    // We will update init.js/logic to use RETURNING id.
    // Return unified structure
    return {
      rows: res.rows,
      rowCount: res.rowCount,
      // Helper for migration compatibility (sqlite returns lastID, changes)
      // PG returns rows.
      lastID: res.rows[0]?.id || null 
    };
  } finally {
    client.release();
  }
};

// Get single row helper
const getRow = async (query, params = []) => {
  const client = await pool.connect();
  try {
    const res = await client.query(query, params);
    return res.rows[0];
  } finally {
    client.release();
  }
};

// Get all rows helper
const getAllRows = async (query, params = []) => {
    const client = await pool.connect();
    try {
      const res = await client.query(query, params);
      return res.rows;
    } finally {
      client.release();
    }
  };

const closeConnection = async () => {
  await pool.end();
  console.log('Database pool closed');
};

module.exports = {
  pool,
  runQuery, // Kept name for compatibility, but signature changed slightly (no db param needed)
  getRow,
  getAllRows,
  closeConnection
};