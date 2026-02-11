require('dotenv').config();
const { getRow, getAllRows } = require('./src/database/connection');

(async () => {
  try {
    // Check if reason_mindset column exists
    const r = await getRow(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'journal_entries' AND column_name = 'reason_mindset'"
    );
    console.log('reason_mindset column:', r ? 'EXISTS' : 'MISSING');

    // Try the exact query the app runs
    console.log('\nTesting journal query...');
    const entries = await getAllRows(
      "SELECT id, title, content, mood_rating, tags, is_private, image_url, image_filename, account_id, reason_mindset, created_at, updated_at, mt5_ticket, before_image_url, after_image_url, pnl, commission, swap, entry_price, exit_price, balance, stop_loss, take_profit, is_plan_compliant, plan_notes FROM journal_entries WHERE account_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3",
      [1, 10, 0]
    );
    console.log('Query SUCCESS. Entries found:', entries.length);
  } catch (e) {
    console.log('Query FAILED:', e.message);
  }
  process.exit(0);
})();
