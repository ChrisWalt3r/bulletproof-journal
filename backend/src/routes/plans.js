const express = require('express');
const { runQuery, getRow, getAllRows } = require('../database/connection');

const router = express.Router();

// ===================== TRADING PLANS =====================

// GET /api/plans - Get all trading plans for the authenticated user
router.get('/', async (req, res) => {
  try {
    const authId = req.user.id;
    const plans = await getAllRows(
      `SELECT id, name, created_at, updated_at
       FROM trading_plans
       WHERE auth_id = $1
       ORDER BY created_at ASC`,
      [authId]
    );
    res.json({ success: true, data: plans });
  } catch (error) {
    console.error('Error fetching trading plans:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch trading plans' });
  }
});

// POST /api/plans - Create a new trading plan
router.post('/', async (req, res) => {
  try {
    const authId = req.user.id;
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Plan name is required' });
    }

    const result = await runQuery(
      `INSERT INTO trading_plans (auth_id, name)
       VALUES ($1, $2)
       RETURNING *`,
      [authId, name.trim()]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error creating trading plan:', error);
    res.status(500).json({ success: false, error: 'Failed to create trading plan' });
  }
});

// PUT /api/plans/:id - Rename a trading plan
router.put('/:id', async (req, res) => {
  try {
    const authId = req.user.id;
    const planId = req.params.id;
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Plan name is required' });
    }

    const result = await runQuery(
      `UPDATE trading_plans
       SET name = $1, updated_at = NOW()
       WHERE id = $2 AND auth_id = $3
       RETURNING *`,
      [name.trim(), planId, authId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Plan not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error renaming trading plan:', error);
    res.status(500).json({ success: false, error: 'Failed to rename trading plan' });
  }
});

// DELETE /api/plans/:id - Delete a trading plan (cascades to criteria)
router.delete('/:id', async (req, res) => {
  try {
    const authId = req.user.id;
    const planId = req.params.id;

    const result = await runQuery(
      `DELETE FROM trading_plans WHERE id = $1 AND auth_id = $2 RETURNING id`,
      [planId, authId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Plan not found' });
    }

    res.json({ success: true, message: 'Plan deleted' });
  } catch (error) {
    console.error('Error deleting trading plan:', error);
    res.status(500).json({ success: false, error: 'Failed to delete trading plan' });
  }
});

// ===================== CRITERIA =====================

// GET /api/plans/:planId/criteria - Get all criteria for a plan
router.get('/:planId/criteria', async (req, res) => {
  try {
    const authId = req.user.id;
    const planId = req.params.planId;

    // Verify plan belongs to user
    const plan = await getRow(
      `SELECT id FROM trading_plans WHERE id = $1 AND auth_id = $2`,
      [planId, authId]
    );
    if (!plan) {
      return res.status(404).json({ success: false, error: 'Plan not found' });
    }

    const criteria = await getAllRows(
      `SELECT id, plan_id, text, checked, position, created_at, updated_at
       FROM plan_criteria
       WHERE plan_id = $1
       ORDER BY position ASC, created_at ASC`,
      [planId]
    );

    res.json({ success: true, data: criteria });
  } catch (error) {
    console.error('Error fetching criteria:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch criteria' });
  }
});

// POST /api/plans/:planId/criteria - Add a criterion to a plan
router.post('/:planId/criteria', async (req, res) => {
  try {
    const authId = req.user.id;
    const planId = req.params.planId;
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, error: 'Criterion text is required' });
    }

    // Verify plan belongs to user
    const plan = await getRow(
      `SELECT id FROM trading_plans WHERE id = $1 AND auth_id = $2`,
      [planId, authId]
    );
    if (!plan) {
      return res.status(404).json({ success: false, error: 'Plan not found' });
    }

    // Get next position
    const maxRow = await getRow(
      `SELECT COALESCE(MAX(position), -1) as max_pos FROM plan_criteria WHERE plan_id = $1`,
      [planId]
    );
    const nextPos = (parseInt(maxRow?.max_pos) || 0) + 1;

    const result = await runQuery(
      `INSERT INTO plan_criteria (plan_id, text, checked, position)
       VALUES ($1, $2, false, $3)
       RETURNING *`,
      [planId, text.trim(), nextPos]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error adding criterion:', error);
    res.status(500).json({ success: false, error: 'Failed to add criterion' });
  }
});

// PUT /api/plans/:planId/criteria/:criterionId - Update criterion text
router.put('/:planId/criteria/:criterionId', async (req, res) => {
  try {
    const authId = req.user.id;
    const { planId, criterionId } = req.params;
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, error: 'Criterion text is required' });
    }

    // Verify plan belongs to user
    const plan = await getRow(
      `SELECT id FROM trading_plans WHERE id = $1 AND auth_id = $2`,
      [planId, authId]
    );
    if (!plan) {
      return res.status(404).json({ success: false, error: 'Plan not found' });
    }

    const result = await runQuery(
      `UPDATE plan_criteria
       SET text = $1, updated_at = NOW()
       WHERE id = $2 AND plan_id = $3
       RETURNING *`,
      [text.trim(), criterionId, planId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Criterion not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error updating criterion:', error);
    res.status(500).json({ success: false, error: 'Failed to update criterion' });
  }
});

// PATCH /api/plans/:planId/criteria/:criterionId/toggle - Toggle checked
router.patch('/:planId/criteria/:criterionId/toggle', async (req, res) => {
  try {
    const authId = req.user.id;
    const { planId, criterionId } = req.params;
    const { checked } = req.body;

    // Verify plan belongs to user
    const plan = await getRow(
      `SELECT id FROM trading_plans WHERE id = $1 AND auth_id = $2`,
      [planId, authId]
    );
    if (!plan) {
      return res.status(404).json({ success: false, error: 'Plan not found' });
    }

    const result = await runQuery(
      `UPDATE plan_criteria
       SET checked = $1, updated_at = NOW()
       WHERE id = $2 AND plan_id = $3
       RETURNING *`,
      [checked, criterionId, planId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Criterion not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error toggling criterion:', error);
    res.status(500).json({ success: false, error: 'Failed to toggle criterion' });
  }
});

// DELETE /api/plans/:planId/criteria/:criterionId - Delete a criterion
router.delete('/:planId/criteria/:criterionId', async (req, res) => {
  try {
    const authId = req.user.id;
    const { planId, criterionId } = req.params;

    // Verify plan belongs to user
    const plan = await getRow(
      `SELECT id FROM trading_plans WHERE id = $1 AND auth_id = $2`,
      [planId, authId]
    );
    if (!plan) {
      return res.status(404).json({ success: false, error: 'Plan not found' });
    }

    const result = await runQuery(
      `DELETE FROM plan_criteria WHERE id = $1 AND plan_id = $2 RETURNING id`,
      [criterionId, planId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Criterion not found' });
    }

    res.json({ success: true, message: 'Criterion deleted' });
  } catch (error) {
    console.error('Error deleting criterion:', error);
    res.status(500).json({ success: false, error: 'Failed to delete criterion' });
  }
});

// POST /api/plans/:planId/criteria/reorder - Reorder all criteria for a plan
router.post('/:planId/criteria/reorder', async (req, res) => {
  try {
    const authId = req.user.id;
    const planId = req.params.planId;
    const { order } = req.body; // Array of { id, position }

    if (!Array.isArray(order)) {
      return res.status(400).json({ success: false, error: 'Order array is required' });
    }

    // Verify plan belongs to user
    const plan = await getRow(
      `SELECT id FROM trading_plans WHERE id = $1 AND auth_id = $2`,
      [planId, authId]
    );
    if (!plan) {
      return res.status(404).json({ success: false, error: 'Plan not found' });
    }

    // Update each criterion's position
    for (const item of order) {
      await runQuery(
        `UPDATE plan_criteria SET position = $1, updated_at = NOW() WHERE id = $2 AND plan_id = $3`,
        [item.position, item.id, planId]
      );
    }

    // Return updated criteria
    const criteria = await getAllRows(
      `SELECT * FROM plan_criteria WHERE plan_id = $1 ORDER BY position ASC`,
      [planId]
    );

    res.json({ success: true, data: criteria });
  } catch (error) {
    console.error('Error reordering criteria:', error);
    res.status(500).json({ success: false, error: 'Failed to reorder criteria' });
  }
});

// POST /api/plans/:planId/criteria/reset - Reset (uncheck) all criteria for a plan
router.post('/:planId/criteria/reset', async (req, res) => {
  try {
    const authId = req.user.id;
    const planId = req.params.planId;

    // Verify plan belongs to user
    const plan = await getRow(
      `SELECT id FROM trading_plans WHERE id = $1 AND auth_id = $2`,
      [planId, authId]
    );
    if (!plan) {
      return res.status(404).json({ success: false, error: 'Plan not found' });
    }

    await runQuery(
      `UPDATE plan_criteria SET checked = false, updated_at = NOW() WHERE plan_id = $1`,
      [planId]
    );

    const criteria = await getAllRows(
      `SELECT * FROM plan_criteria WHERE plan_id = $1 ORDER BY position ASC`,
      [planId]
    );

    res.json({ success: true, data: criteria });
  } catch (error) {
    console.error('Error resetting criteria:', error);
    res.status(500).json({ success: false, error: 'Failed to reset criteria' });
  }
});

module.exports = router;
