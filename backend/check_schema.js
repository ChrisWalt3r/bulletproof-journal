require('dotenv').config();
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL });

p.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='journal_entries' ORDER BY ordinal_position")
  .then(r => {
    r.rows.forEach(c => console.log(c.column_name, '-', c.data_type));
    return p.query("SELECT id, title, symbol, direction, mt5_ticket, following_plan, forcing_trade, emotional_state, notes FROM journal_entries LIMIT 3");
  })
  .then(r => {
    console.log('\n--- Sample entries ---');
    r.rows.forEach(row => console.log(JSON.stringify(row)));
    p.end();
  })
  .catch(e => {
    console.error(e.message);
    // Try without the new columns
    p.query("SELECT id, title, symbol, direction, mt5_ticket FROM journal_entries LIMIT 3")
      .then(r => {
        console.log('\n--- Sample entries (basic) ---');
        r.rows.forEach(row => console.log(JSON.stringify(row)));
        p.end();
      })
      .catch(e2 => { console.error(e2.message); p.end(); });
  });
