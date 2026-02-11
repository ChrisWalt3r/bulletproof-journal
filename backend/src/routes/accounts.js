const express = require('express');
const { runQuery, getRow, getAllRows } = require('../database/connection');

const router = express.Router();

// GET /api/accounts - Get all accounts
router.get('/', async (req, res) => {
  try {
    const accounts = await getAllRows(
      `SELECT id, name, description, color, starting_balance, is_active, created_at, updated_at 
         FROM accounts 
         WHERE is_active = true 
         ORDER BY created_at ASC`
    );

    // Add entry count for each account
    const accountsWithStats = await Promise.all(accounts.map(async (account) => {
      const row = await getRow(
        'SELECT COUNT(*) as count FROM journal_entries WHERE account_id = $1',
        [account.id]
      );
      return {
        ...account,
        entryCount: parseInt(row?.count || 0)
      };
    }));

    res.json({
      success: true,
      data: accountsWithStats
    });
  } catch (error) {
    console.error('Error fetching accounts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch accounts'
    });
  }
});

// POST /api/accounts - Create new account
router.post('/', async (req, res) => {
  try {
    const { name, description, color, starting_balance } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: 'Account name is required' });
    }

    const result = await runQuery(
      `INSERT INTO accounts (name, description, color, starting_balance) 
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name, description || '', color || '#4A90E2', parseFloat(starting_balance) || 0]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error creating account:', error);
    if (error.message.includes('unique constraint') || error.code === '23505') {
      return res.status(400).json({ success: false, error: 'Account name already exists' });
    }
    res.status(500).json({ success: false, error: 'Failed to create account' });
  }
});

// PUT /api/accounts/:id - Update account
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, color, is_active, starting_balance } = req.body;

    const existingAccount = await getRow('SELECT id FROM accounts WHERE id = $1', [id]);
    if (!existingAccount) {
      return res.status(404).json({ success: false, error: 'Account not found' });
    }

    const result = await runQuery(
      `UPDATE accounts 
       SET name = COALESCE($1, name), 
           description = COALESCE($2, description), 
           color = COALESCE($3, color), 
           is_active = COALESCE($4, is_active), 
           starting_balance = COALESCE($5, starting_balance),
           updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [
        name,
        description,
        color,
        is_active,
        starting_balance != null ? parseFloat(starting_balance) : null,
        id
      ]
    );

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating account:', error);
    if (error.message.includes('unique constraint')) {
      return res.status(400).json({ success: false, error: 'Account name already exists' });
    }
    res.status(500).json({ success: false, error: 'Failed to update account' });
  }
});

// DELETE /api/accounts/:id - Delete account and all related data
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const existingAccount = await getRow('SELECT id FROM accounts WHERE id = $1', [id]);
    if (!existingAccount) {
      return res.status(404).json({ success: false, error: 'Account not found' });
    }

    // Postgres CASCADE should handle this if defined in schema, but explicit delete is safer if not
    // Schema says: account_id INTEGER REFERENCES accounts(id) -- NO CASCADE DEFINED in my init.js for journal_entries!
    // I should manually delete journal entries first.

    // Get count
    const countRow = await getRow('SELECT COUNT(*) as count FROM journal_entries WHERE account_id = $1', [id]);
    const entryCount = parseInt(countRow?.count || 0);

    // Delete entries
    await runQuery('DELETE FROM journal_entries WHERE account_id = $1', [id]);

    // Delete account
    await runQuery('DELETE FROM accounts WHERE id = $1', [id]);

    res.json({
      success: true,
      message: `Account deleted successfully. ${entryCount} journal entries were also deleted.`,
      deletedEntries: entryCount
    });
  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({ success: false, error: 'Failed to delete account' });
  }
});

// GET /api/accounts/:id/stats - Get account statistics
router.get('/:id/stats', async (req, res) => {
  try {
    const { id } = req.params;

    const account = await getRow('SELECT * FROM accounts WHERE id = $1', [id]);
    if (!account) {
      return res.status(404).json({ success: false, error: 'Account not found' });
    }

    const totalRow = await getRow('SELECT COUNT(*) as count FROM journal_entries WHERE account_id = $1', [id]);
    const totalEntries = parseInt(totalRow?.count || 0);

    const monthRow = await getRow(
      `SELECT COUNT(*) as count FROM journal_entries 
         WHERE account_id = $1 AND created_at >= DATE_TRUNC('month', NOW())`,
      [id]
    );
    const entriesThisMonth = parseInt(monthRow?.count || 0);

    const recentEntries = await getAllRows(
      `SELECT id, title, created_at FROM journal_entries 
         WHERE account_id = $1 
         ORDER BY created_at DESC LIMIT 5`,
      [id]
    );

    res.json({
      success: true,
      data: {
        account,
        stats: {
          totalEntries,
          entriesThisMonth,
          recentEntries
        }
      }
    });
  } catch (error) {
    console.error('Error fetching account stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch account statistics' });
  }
});

module.exports = router;