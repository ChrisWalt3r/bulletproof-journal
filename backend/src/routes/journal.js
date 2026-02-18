const express = require('express');
const { runQuery, getRow, getAllRows } = require('../database/connection');

const router = express.Router();

// Get all journal entries (user-scoped via accounts)
router.get('/', async (req, res) => {
  try {
    const authId = req.user.id; // Supabase Auth UUID
    const { page = 1, limit = 10, search = '', accountId, assetType } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT je.id, je.title, je.content, je.mood_rating, je.tags, je.is_private, je.image_url, je.image_filename, je.account_id, je.reason_mindset, je.created_at, je.updated_at,
             je.mt5_ticket, je.before_image_url, je.after_image_url, je.pnl, je.commission, je.swap, je.entry_price, je.exit_price, je.balance, je.stop_loss, je.take_profit,
             je.is_plan_compliant, je.plan_notes, je.symbol, je.direction, je.volume, je.following_plan, je.emotional_state, je.notes, je.asset_type
      FROM journal_entries je
      JOIN accounts a ON je.account_id = a.id
    `;
    let params = [];
    let whereConditions = [];
    let paramCount = 1;

    // Always scope to authenticated user's accounts
    whereConditions.push(`a.auth_id = $${paramCount++}`);
    params.push(authId);

    // Filter by account if specified
    if (accountId) {
      whereConditions.push(`je.account_id = $${paramCount++}`);
      params.push(parseInt(accountId));
    }

    // Filter by asset type if specified
    if (assetType) {
      whereConditions.push(`je.asset_type = $${paramCount++}`);
      params.push(assetType);
    }

    // Add search filter
    if (search) {
      whereConditions.push(`(je.title ILIKE $${paramCount} OR je.content ILIKE $${paramCount})`);
      params.push(`%${search}%`);
      paramCount++;
    }

    // Add WHERE clause if there are conditions
    if (whereConditions.length > 0) {
      query += ` WHERE ${whereConditions.join(' AND ')}`;
    }

    query += ` ORDER BY je.created_at DESC LIMIT $${paramCount++} OFFSET $${paramCount++}`;
    params.push(parseInt(limit), parseInt(offset));

    const entries = await getAllRows(query, params);

    // Get total count for pagination (user-scoped)
    let countQuery = 'SELECT COUNT(*) as total FROM journal_entries je JOIN accounts a ON je.account_id = a.id';
    let countParams = [];
    let countParamIdx = 1;

    // Always scope to authenticated user's accounts
    let countConditions = [];
    countConditions.push(`a.auth_id = $${countParamIdx++}`);
    countParams.push(authId);

    if (accountId) {
      countConditions.push(`je.account_id = $${countParamIdx++}`);
      countParams.push(parseInt(accountId));
    }
    if (assetType) {
      countConditions.push(`je.asset_type = $${countParamIdx++}`);
      countParams.push(assetType);
    }
    if (search) {
      countConditions.push(`(je.title ILIKE $${countParamIdx} OR je.content ILIKE $${countParamIdx})`);
      countParams.push(`%${search}%`);
      countParamIdx++;
    }
    countQuery += ` WHERE ${countConditions.join(' AND ')}`;

    const countResult = await getRow(countQuery, countParams);
    const totalEntries = parseInt(countResult?.total || 0);

    res.json({
      entries: entries.map(entry => ({
        ...entry,
        tags: entry.tags || [], // Postgres JSONB returns object/array directly
        is_private: Boolean(entry.is_private)
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalEntries,
        pages: Math.ceil(totalEntries / limit)
      }
    });

  } catch (error) {
    console.error('Get entries error:', error);
    res.status(500).json({
      error: 'Failed to fetch entries',
      message: 'An error occurred while fetching journal entries'
    });
  }
});

// Get single journal entry (user-scoped)
router.get('/:id', async (req, res) => {
  try {
    const authId = req.user.id;
    const { id } = req.params;

    const entry = await getRow(
      `SELECT je.* FROM journal_entries je
       JOIN accounts a ON je.account_id = a.id
       WHERE je.id = $1 AND a.auth_id = $2`,
      [id, authId]
    );

    if (!entry) {
      return res.status(404).json({
        error: 'Entry not found',
        message: 'Journal entry not found'
      });
    }

    res.json({
      ...entry,
      tags: entry.tags || [],
      is_private: Boolean(entry.is_private)
    });

  } catch (error) {
    console.error('Get entry error:', error);
    res.status(500).json({
      error: 'Failed to fetch entry',
      message: 'An error occurred while fetching the journal entry'
    });
  }
});

// Create new journal entry (user-scoped)
router.post('/', async (req, res) => {
  try {
    const authId = req.user.id;
    const {
      title, content, moodRating, tags = [], isPrivate = true,
      imageUrl, imageFilename, accountId, reasonMindset,
      createdAt, isPlanCompliant, planNotes,
      followingPlan, emotionalState, notes
    } = req.body;

    if (!title || !content) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Title and content are required'
      });
    }

    // Verify the account belongs to this user
    const resolvedAccountId = accountId || null;
    if (resolvedAccountId) {
      const ownerCheck = await getRow('SELECT id FROM accounts WHERE id = $1 AND auth_id = $2', [resolvedAccountId, authId]);
      if (!ownerCheck) {
        return res.status(403).json({ error: 'Forbidden', message: 'Account does not belong to you' });
      }
    }

    // Timestamp logic (Postgres handles timezone, but we can store explicit UTC if provided)
    const timestamp = createdAt || new Date().toISOString(); // Simplified for now, Postgres accepts ISO string

    const result = await runQuery(
      `INSERT INTO journal_entries (
        title, content, mood_rating, tags, is_private, 
        image_url, image_filename, account_id, reason_mindset, 
        is_plan_compliant, plan_notes,
        following_plan, emotional_state, notes,
        created_at, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $15)
       RETURNING *`,
      [
        title,
        content,
        moodRating || null,
        JSON.stringify(tags), // JSONB accepts string or object, but stringify is safer
        isPrivate,
        imageUrl || null,
        imageFilename || null,
        resolvedAccountId,
        reasonMindset || null,
        isPlanCompliant || false,
        planNotes || null,
        followingPlan || false,
        emotionalState || null,
        notes || null,
        timestamp
      ]
    );

    const newEntry = result.rows[0];

    res.status(201).json({
      message: 'Journal entry created successfully',
      entry: {
        ...newEntry,
        tags: newEntry.tags || [],
        is_private: Boolean(newEntry.is_private)
      }
    });

  } catch (error) {
    console.error('Create entry error:', error);
    res.status(500).json({
      error: 'Failed to create entry',
      message: 'An error occurred while creating the journal entry'
    });
  }
});

// Update journal entry (user-scoped)
router.put('/:id', async (req, res) => {
  try {
    const authId = req.user.id;
    const { id } = req.params;
    const {
      title, content, moodRating, tags, isPrivate,
      imageUrl, imageFilename, accountId, reasonMindset,
      isPlanCompliant, planNotes, followingPlan, emotionalState, notes
    } = req.body;

    // Verify entry belongs to this user's accounts
    const existingEntry = await getRow(
      `SELECT je.id FROM journal_entries je
       JOIN accounts a ON je.account_id = a.id
       WHERE je.id = $1 AND a.auth_id = $2`,
      [id, authId]
    );

    if (!existingEntry) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    const result = await runQuery(
      `UPDATE journal_entries 
       SET title = COALESCE($1, title),
           content = COALESCE($2, content),
           mood_rating = COALESCE($3, mood_rating),
           tags = COALESCE($4, tags),
           is_private = COALESCE($5, is_private),
           image_url = COALESCE($6, image_url),
           image_filename = COALESCE($7, image_filename),
           account_id = COALESCE($8, account_id),
           reason_mindset = COALESCE($9, reason_mindset),
           is_plan_compliant = COALESCE($10, is_plan_compliant),
           plan_notes = COALESCE($11, plan_notes),
           following_plan = COALESCE($12, following_plan),
           emotional_state = COALESCE($13, emotional_state),
           notes = COALESCE($14, notes),
           updated_at = NOW()
       WHERE id = $15
       RETURNING *`,
      [
        title || null,
        content || null,
        moodRating || null,
        tags ? JSON.stringify(tags) : null,
        isPrivate,
        imageUrl,
        imageFilename,
        accountId || null,
        reasonMindset,
        isPlanCompliant,
        planNotes,
        followingPlan != null ? followingPlan : null,
        emotionalState || null,
        notes || null,
        id
      ]
    );

    const updatedEntry = result.rows[0];

    res.json({
      message: 'Journal entry updated successfully',
      entry: {
        ...updatedEntry,
        tags: updatedEntry.tags || [],
        is_private: Boolean(updatedEntry.is_private)
      }
    });

  } catch (error) {
    console.error('Update entry error:', error);
    res.status(500).json({ error: 'Failed to update entry' });
  }
});

// Delete journal entry (user-scoped)
router.delete('/:id', async (req, res) => {
  try {
    const authId = req.user.id;
    const { id } = req.params;

    // Verify entry belongs to this user's accounts before deleting
    const ownerCheck = await getRow(
      `SELECT je.id FROM journal_entries je
       JOIN accounts a ON je.account_id = a.id
       WHERE je.id = $1 AND a.auth_id = $2`,
      [id, authId]
    );

    if (!ownerCheck) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    const result = await runQuery('DELETE FROM journal_entries WHERE id = $1', [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    res.json({ message: 'Journal entry deleted successfully' });

  } catch (error) {
    console.error('Delete entry error:', error);
    res.status(500).json({ error: 'Failed to delete entry' });
  }
});

module.exports = router;