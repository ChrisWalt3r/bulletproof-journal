const express = require('express');
const multer = require('multer');
const { runQuery, getRow } = require('../database/connection');
const { verifyWebhookSecret } = require('../middleware/auth');
const storageService = require('../services/storage');

const router = express.Router();

// Configure Multer for memory storage (for Supabase upload)
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

/**
 * POST /api/mt5/webhook
 * Handles incoming trade data from MT5 EA.
 * Secured by verifyWebhookSecret (checks x-api-secret header)
 */
router.post('/webhook', verifyWebhookSecret, upload.single('image'), async (req, res) => {
    try {
        const {
            action, // 'ENTRY' or 'EXIT'
            ticket,
            positionId,
            symbol,
            type, // 'BUY' or 'SELL'
            volume,
            price,
            comment,
            profit,
            commission,
            swap,
            balance,
            sl,
            tp,
            image_base64,
            image_filename
        } = req.body;

        const imageFile = req.file;

        if (!ticket || !action) {
            return res.status(400).json({ error: 'Missing required fields: ticket or action' });
        }

        // Hardcode account_id to 1 for now, or look up based on some logic if multi-user
        // In the future, we could map MT5 Account Number to App Account ID via `accounts` table
        const accountId = 1;

        // Handle Image
        let imageUrl = null;
        
        try {
            // Case 1: File uploaded via multipart/form-data
            if (imageFile) {
                console.log('Processing multipart image upload for MT5...');
                // Use Admin upload to bypass RLS (since this is server-to-server)
                const filename = `mt5-${accountId}/${Date.now()}-${imageFile.originalname}`;
                
                const result = await storageService.uploadImageAdmin(
                    imageFile.buffer,
                    filename,
                    imageFile.mimetype
                );
                
                if (result.success) {
                    imageUrl = result.imageUrl;
                    console.log('MT5 Image uploaded to Supabase:', imageUrl);
                } else {
                    console.error('Supabase upload failed:', result.error);
                }
            } 
            // Case 2: Base64 image provided in JSON body
            else if (image_base64) {
                console.log('Processing base64 image upload for MT5...');
                // Clean base64 string
                const b64 = image_base64.replace(/^data:image\/[a-zA-Z]+;base64,/, '');
                const buffer = Buffer.from(b64, 'base64');
                const fname = image_filename || `mt5_trade_${ticket}.png`;
                // Construct path
                const filename = `mt5-${accountId}/${Date.now()}-${fname}`;
                
                // Detect MIME type from data URI or filename
                let mimeType = 'image/png';
                if (image_base64.startsWith('data:image/gif')) mimeType = 'image/gif';
                else if (image_base64.startsWith('data:image/jpeg')) mimeType = 'image/jpeg';

                const result = await storageService.uploadImageAdmin(
                    buffer,
                    filename,
                    mimeType
                );

                if (result.success) {
                    imageUrl = result.imageUrl;
                    console.log('MT5 Base64 Image uploaded to Supabase:', imageUrl);
                } else {
                    console.error('Supabase upload failed:', result.error);
                }
            }
        } catch (err) {
            console.error('Image processing error:', err);
            // Don't fail the whole request if image fails, just log it
        }

        if (action === 'ENTRY') {
            // Check existence by position ID first, then by ticket
            const existing = await getRow(
                'SELECT id FROM journal_entries WHERE mt5_position_id = $1 OR mt5_ticket = $1::bigint',
                [positionId || ticket]
            );

            const now = new Date();
            const title = `MT5: ${type} ${symbol}`;
            const content = `Automated Entry: ${type} ${symbol} @ ${price}`;

            if (existing?.id) {
                await runQuery(`
                    UPDATE journal_entries SET
                        title = $1,
                        updated_at = NOW(),
                        before_image_url = COALESCE($2, before_image_url),
                        entry_price = COALESCE($3, entry_price),
                        stop_loss = COALESCE($4, stop_loss),
                        take_profit = COALESCE($5, take_profit),
                        mt5_position_id = COALESCE($6, mt5_position_id)
                    WHERE id = $7
                `, [
                    title,
                    imageUrl,
                    price,
                    sl || null,
                    tp || null,
                    positionId || null,
                    existing.id
                ]);

                return res.status(200).json({ success: true, message: 'Trade entry updated', entryId: existing.id });
            }

            const result = await runQuery(`
                INSERT INTO journal_entries (
                    title, content, tags, is_private, account_id,
                    mt5_ticket, mt5_position_id, symbol, direction, volume, 
                    entry_price, stop_loss, take_profit, before_image_url,
                    created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
                RETURNING id
            `, [
                title,
                content,
                JSON.stringify(['MT5', 'Automated', symbol]),
                true,
                accountId,
                ticket,
                positionId || ticket,
                symbol,
                type,
                volume,
                price,
                sl || null,
                tp || null,
                imageUrl
            ]);

            res.status(201).json({ success: true, message: 'Trade entry recorded', entryId: result.rows[0].id });

        } else if (action === 'EXIT') {
            const totalPnL = parseFloat(profit || 0) + parseFloat(commission || 0) + parseFloat(swap || 0);

            // Match by position ID (same for entry and exit deals), fallback to ticket
            const matchId = positionId || ticket;
            const existing = await getRow(
                'SELECT id, content, direction FROM journal_entries WHERE mt5_position_id = $1',
                [matchId]
            );

            if (!existing) {
                // Try matching by mt5_ticket as fallback for older entries
                const fallback = await getRow(
                    'SELECT id, content, direction FROM journal_entries WHERE mt5_ticket = $1',
                    [matchId]
                );

                if (!fallback) {
                    // Orphaned exit — create new entry with all available data
                    const result = await runQuery(`
                        INSERT INTO journal_entries (
                            title, content, tags, is_private, account_id,
                            mt5_ticket, mt5_position_id, symbol, direction, after_image_url, 
                            exit_price, pnl, commission, swap, balance,
                            created_at, updated_at
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())
                        RETURNING id
                    `, [
                        `MT5 Exit: ${type} ${symbol}`,
                        `Orphaned Exit: ${type} ${symbol} @ ${price}. PnL: ${totalPnL}`,
                        JSON.stringify(['MT5', 'Automated', 'Orphaned', symbol]),
                        true,
                        accountId,
                        ticket,
                        positionId || ticket,
                        symbol,
                        type,
                        imageUrl,
                        price,
                        totalPnL,
                        commission || 0,
                        swap || 0,
                        balance || 0
                    ]);
                    return res.status(200).json({ success: true, message: 'Orphaned exit recorded', entryId: result.rows[0].id });
                }

                // Found via ticket fallback — update it
                await runQuery(`
                    UPDATE journal_entries SET 
                      after_image_url = COALESCE($1, after_image_url),
                      exit_price = $2,
                      pnl = $3,
                      commission = $4,
                      swap = $5,
                      balance = $6,
                      mt5_position_id = COALESCE($7, mt5_position_id),
                      updated_at = NOW()
                    WHERE id = $8
                `, [
                    imageUrl,
                    price,
                    totalPnL,
                    commission || 0,
                    swap || 0,
                    balance || 0,
                    positionId || null,
                    fallback.id
                ]);

                return res.status(200).json({ success: true, message: 'Trade exit recorded' });
            }

            // Update existing entry matched by position ID
            await runQuery(`
                UPDATE journal_entries SET 
                  after_image_url = COALESCE($1, after_image_url),
                  exit_price = $2,
                  pnl = $3,
                  commission = $4,
                  swap = $5,
                  balance = $6,
                  updated_at = NOW()
                WHERE id = $7
            `, [
                imageUrl,
                price,
                totalPnL,
                commission || 0,
                swap || 0,
                balance || 0,
                existing.id
            ]);

            res.status(200).json({ success: true, message: 'Trade exit recorded' });
        } else {
            res.status(400).json({ error: 'Invalid action type' });
        }

    } catch (error) {
        console.error('MT5 Webhook Error:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

module.exports = router;
