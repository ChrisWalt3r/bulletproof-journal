const express = require('express');
const { runQuery, getRow, getAllRows } = require('../database/connection');

const router = express.Router();

// Get all journal entries
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', accountId } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT id, title, content, mood_rating, tags, is_private, image_url, image_filename, account_id, reason_mindset, created_at, updated_at,
             mt5_ticket, before_image_url, after_image_url, pnl, commission, swap, entry_price, exit_price, balance, stop_loss, take_profit,
             is_plan_compliant, plan_notes, symbol, direction, volume, following_plan, emotional_state, notes
      FROM journal_entries 
    `;
    let params = [];
    let whereConditions = [];
    let paramCount = 1;

    // Filter by account if specified
    if (accountId) {
      whereConditions.push(`account_id = $${paramCount++}`);
      params.push(parseInt(accountId));
    }

    // Add search filter
    if (search) {
      whereConditions.push(`(title ILIKE $${paramCount} OR content ILIKE $${paramCount})`);
      params.push(`%${search}%`);
      paramCount++;
    }

    // Add WHERE clause if there are conditions
    if (whereConditions.length > 0) {
      query += ` WHERE ${whereConditions.join(' AND ')}`;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramCount++} OFFSET $${paramCount++}`;
    params.push(parseInt(limit), parseInt(offset));

    const entries = await getAllRows(query, params);

    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) as total FROM journal_entries';
    let countParams = [];
    let countParamIdx = 1;

    if (whereConditions.length > 0) {
      // Re-build conditions with fresh indexes strictly for count query to avoid index mismatch
      let countConditions = [];
      if (accountId) {
        countConditions.push(`account_id = $${countParamIdx++}`);
        countParams.push(parseInt(accountId));
      }
      if (search) {
        countConditions.push(`(title ILIKE $${countParamIdx} OR content ILIKE $${countParamIdx})`);
        countParams.push(`%${search}%`);
        countParamIdx++;
      }
      countQuery += ` WHERE ${countConditions.join(' AND ')}`;
    }

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

// Get single journal entry
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const entry = await getRow(
      `SELECT * FROM journal_entries WHERE id = $1`,
      [id]
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

// Create new journal entry
router.post('/', async (req, res) => {
  try {
    const {
      title, content, moodRating, tags = [], isPrivate = true,
      imageUrl, imageFilename, accountId = 1, reasonMindset,
      createdAt, isPlanCompliant, planNotes,
      followingPlan, emotionalState, notes
    } = req.body;

    if (!title || !content) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Title and content are required'
      });
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
        accountId,
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

// Update journal entry
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title, content, moodRating, tags, isPrivate,
      imageUrl, imageFilename, accountId, reasonMindset,
      isPlanCompliant, planNotes, followingPlan, emotionalState, notes
    } = req.body;

    const existingEntry = await getRow('SELECT id FROM journal_entries WHERE id = $1', [id]);

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

// Delete journal entry
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
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