const express = require('express');
const multer = require('multer');
const { runQuery, getRow, getAllRows } = require('../database/connection');
const { verifyWebhookSecret } = require('../middleware/auth');
const storageService = require('../services/storage');

const router = express.Router();

function parseMt5Number(value, fallback = null) {
    if (value === null || value === undefined || value === '') {
        return fallback;
    }

    const parsed = Number(String(value).replace(/,/g, '').trim());
    if (!Number.isFinite(parsed)) {
        return fallback;
    }

    return parsed;
}

function calculatePnlPercentage(pnl, balance) {
    const realizedPnl = parseMt5Number(pnl, null);
    const endingBalance = parseMt5Number(balance, null);

    if (!Number.isFinite(realizedPnl) || !Number.isFinite(endingBalance)) {
        return null;
    }

    const startingBalance = endingBalance - realizedPnl;
    if (!Number.isFinite(startingBalance) || Math.abs(startingBalance) < 0.000001) {
        return null;
    }

    return Number(((realizedPnl / startingBalance) * 100).toFixed(4));
}

// ============ Asset Classification ============
// Classifies MT5 symbols into asset types for filtering & analytics
function classifyAsset(symbol) {
    if (!symbol) return 'other';
    const s = symbol.toUpperCase();

    // Indices (US500, NAS100, US30, DE40, UK100, JP225, etc.)
    const indexPatterns = [
        'US500', 'US30', 'US100', 'NAS100', 'USTEC', 'SP500', 'SPX',
        'NDX', 'NQ100', 'DJI', 'DJ30',
        'DE40', 'DE30', 'DAX', 'GER40', 'GER30',
        'UK100', 'FTSE', 'FRA40', 'CAC',
        'JP225', 'JPN225', 'NIKKEI',
        'AUS200', 'HK50', 'HANG', 'CHINA',
        'EU50', 'STOXX', 'IBEX', 'SWI20',
        'VIX', 'DXY', 'DOLLAR'
    ];

    // Commodities (XAUUSD, XAGUSD, USOIL, UKOIL, etc.)
    const commodityPatterns = [
        'XAU', 'GOLD',
        'XAG', 'SILVER',
        'XPTUSD', 'PLATINUM',
        'XPDUSD', 'PALLADIUM',
        'OIL', 'BRENT', 'CRUDE', 'WTI', 'USOIL', 'UKOIL',
        'NATGAS', 'NGAS',
        'COPPER', 'XCUUSD',
        'COCOA', 'COFFEE', 'SUGAR', 'COTTON', 'WHEAT', 'CORN', 'SOYBEAN'
    ];

    // Crypto
    const cryptoPatterns = [
        'BTC', 'ETH', 'XRP', 'LTC', 'ADA', 'SOL', 'DOT', 'DOGE',
        'BNB', 'AVAX', 'MATIC', 'LINK', 'UNI', 'SHIB'
    ];

    // Stocks (individual equities — typically 1-5 chars or end with .US/.UK)
    const stockPatterns = [
        'AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'TSLA', 'META', 'NVDA',
        'NFLX', 'AMD', 'INTC', 'BABA', 'PYPL', 'DIS', 'BA', 'UBER',
        '.US', '.UK', '.DE', '.FR', '.HK'
    ];

    for (const p of indexPatterns) {
        if (s.includes(p)) return 'index';
    }
    for (const p of commodityPatterns) {
        if (s.includes(p)) return 'commodity';
    }
    for (const p of cryptoPatterns) {
        if (s.includes(p)) return 'crypto';
    }
    for (const p of stockPatterns) {
        if (s.includes(p)) return 'stock';
    }

    // Forex — major/minor/exotic pairs (6-7 char combos of currency codes)
    const currencies = ['EUR','USD','GBP','JPY','CHF','CAD','AUD','NZD','SEK','NOK','DKK','SGD','HKD','MXN','ZAR','TRY','PLN','CZK','HUF','RUB','CNY','INR','THB','TWD','KRW'];
    for (const c1 of currencies) {
        for (const c2 of currencies) {
            if (c1 !== c2 && s === c1 + c2) return 'forex';
        }
    }

    // If symbol is 6 chars and looks like a currency pair
    if (s.length === 6 || s.length === 7) {
        const base = s.substring(0, 3);
        const quote = s.substring(3, 6);
        if (currencies.includes(base) && currencies.includes(quote)) return 'forex';
    }

    return 'other';
}

// Expose for testing
router.classifyAsset = classifyAsset;

// Configure Multer for memory storage (for Supabase upload)
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

/**
 * POST /api/mt5/check-tickets
 * Accepts an array of deal tickets and returns which ones already exist.
 * Used by EA's catch-up sync to avoid re-sending known trades.
 * Secured by verifyWebhookSecret (same as webhook).
 */
router.post('/check-tickets', verifyWebhookSecret, async (req, res) => {
    try {
        const { tickets, accountId: rawAccountId } = req.body;

        if (!tickets || !Array.isArray(tickets) || tickets.length === 0) {
            return res.status(400).json({ error: 'tickets array is required' });
        }

        // Resolve the real account ID (same fallback logic as webhook)
        let resolvedAccountId = parseInt(rawAccountId) || 1;
        const accountCheck = await getRow('SELECT id FROM accounts WHERE id = $1', [resolvedAccountId]);
        if (!accountCheck) {
            const fallback = await getRow('SELECT id FROM accounts ORDER BY created_at DESC LIMIT 1');
            if (fallback) resolvedAccountId = fallback.id;
        }

        // Query which of these tickets already exist — scoped to this account only
        // Also check mt5_exit_ticket so EXIT deals aren't re-sent every sync
        const placeholders = tickets.map((_, i) => `$${i + 1}`).join(',');
        const existingRows = await getAllRows(
            `SELECT mt5_ticket, mt5_position_id, mt5_exit_ticket FROM journal_entries 
             WHERE account_id = $${tickets.length + 1}
               AND (mt5_ticket::text IN (${placeholders}) 
                OR mt5_position_id IN (${placeholders})
                OR mt5_exit_ticket::text IN (${placeholders}))`,
            [...tickets.map(String), resolvedAccountId]
        );

        const existingTickets = new Set();
        existingRows.forEach(row => {
            if (row.mt5_ticket) existingTickets.add(String(row.mt5_ticket));
            if (row.mt5_position_id) existingTickets.add(String(row.mt5_position_id));
            if (row.mt5_exit_ticket) existingTickets.add(String(row.mt5_exit_ticket));
        });

        // Also check deleted_mt5_entries table so deleted trades aren't re-synced
        const deletedRows = await getAllRows(
            `SELECT mt5_ticket, mt5_position_id, mt5_exit_ticket FROM deleted_mt5_entries
             WHERE account_id = $${tickets.length + 1}
               AND (mt5_ticket::text IN (${placeholders})
                OR mt5_position_id IN (${placeholders})
                OR mt5_exit_ticket::text IN (${placeholders}))`,
            [...tickets.map(String), resolvedAccountId]
        );

        deletedRows.forEach(row => {
            if (row.mt5_ticket) existingTickets.add(String(row.mt5_ticket));
            if (row.mt5_position_id) existingTickets.add(String(row.mt5_position_id));
            if (row.mt5_exit_ticket) existingTickets.add(String(row.mt5_exit_ticket));
        });

        // Return which tickets are missing (need to be synced)
        const missingTickets = tickets.filter(t => !existingTickets.has(String(t)));

        res.json({
            success: true,
            total: tickets.length,
            existing: tickets.length - missingTickets.length,
            missing: missingTickets
        });

    } catch (error) {
        console.error('Check tickets error:', error);
        res.status(500).json({ error: 'Failed to check tickets' });
    }
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
            image_filename,
            dealTime, // Actual deal execution time from MT5 (format: "YYYY.MM.DD HH:MM:SS")
            accountId: rawAccountId // Sent by EA as "Journal Account ID"
        } = req.body;

        const imageFile = req.file;

        const normalizedPrice = parseMt5Number(price, null);
        const normalizedSl = parseMt5Number(sl, null);
        const normalizedTp = parseMt5Number(tp, null);
        const normalizedVolume = parseMt5Number(volume, null);
        const normalizedProfit = parseMt5Number(profit, 0);
        const normalizedCommission = parseMt5Number(commission, 0);
        const normalizedSwap = parseMt5Number(swap, 0);
        const normalizedBalance = parseMt5Number(balance, null);

        if (!ticket || !action) {
            return res.status(400).json({ error: 'Missing required fields: ticket or action' });
        }

        // Use the account ID sent by the EA (user configures this in EA inputs)
        let accountId = parseInt(rawAccountId) || 1;

        // Verify the account exists in our database
        let accountCheck = await getRow('SELECT id FROM accounts WHERE id = $1', [accountId]);
        if (!accountCheck) {
            // Fallback: use the most recently created account regardless of is_active
            // This handles the case where the account was deleted and recreated (new auto-incremented ID)
            const fallbackAccount = await getRow('SELECT id FROM accounts ORDER BY created_at DESC LIMIT 1');
            if (!fallbackAccount) {
                return res.status(404).json({ error: `Account ID ${accountId} not found. Create it in the app first.` });
            }
            console.log(`Account ID ${accountId} not found, falling back to account ID ${fallbackAccount.id}`);
            accountId = fallbackAccount.id;
        }

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

            // Parse deal time from MT5 (format: "YYYY.MM.DD HH:MM:SS") or fall back to now
            let entryTimestamp = new Date();
            if (dealTime) {
                // MT5 sends "YYYY.MM.DD HH:MM:SS" — convert dots to dashes for ISO parsing
                const isoStr = dealTime.replace(/\./g, '-').replace(' ', 'T') + 'Z';
                const parsed = new Date(isoStr);
                if (!isNaN(parsed.getTime())) {
                    entryTimestamp = parsed;
                }
            }

            const title = `MT5: ${type} ${symbol}`;
            const content = `Automated Entry: ${type} ${symbol} @ ${normalizedPrice ?? price}`;
            const assetType = classifyAsset(symbol);

            if (existing?.id) {
                await runQuery(`
                    UPDATE journal_entries SET
                        title = $1,
                        updated_at = NOW(),
                        before_image_url = COALESCE($2, before_image_url),
                        entry_price = COALESCE($3, entry_price),
                        stop_loss = COALESCE($4, stop_loss),
                        take_profit = COALESCE($5, take_profit),
                        mt5_position_id = COALESCE($6, mt5_position_id),
                        asset_type = COALESCE($8, asset_type),
                        created_at = COALESCE($9, created_at)
                    WHERE id = $7
                `, [
                    title,
                    imageUrl,
                    normalizedPrice,
                    normalizedSl,
                    normalizedTp,
                    positionId || null,
                    existing.id,
                    assetType,
                    dealTime ? entryTimestamp.toISOString() : null
                ]);

                return res.status(200).json({ success: true, message: 'Trade entry updated', entryId: existing.id });
            }

            const result = await runQuery(`
                INSERT INTO journal_entries (
                    title, content, tags, is_private, account_id,
                    mt5_ticket, mt5_position_id, symbol, direction, volume, 
                    entry_price, stop_loss, take_profit, before_image_url,
                    asset_type, following_plan, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $17)
                RETURNING id
            `, [
                title,
                content,
                JSON.stringify(['MT5', 'Automated', symbol, assetType]),
                true,
                accountId,
                ticket,
                positionId || ticket,
                symbol,
                type,
                normalizedVolume,
                normalizedPrice,
                normalizedSl,
                normalizedTp,
                imageUrl,
                assetType,
                null,
                entryTimestamp.toISOString()
            ]);

            res.status(201).json({ success: true, message: 'Trade entry recorded', entryId: result.rows[0].id, accountId });

        } else if (action === 'EXIT') {
            const totalPnL = normalizedProfit + normalizedCommission + normalizedSwap;
            const pnlPercentage = calculatePnlPercentage(totalPnL, normalizedBalance);

            // Parse deal time from MT5 for orphaned exits
            let exitTimestamp = new Date();
            if (dealTime) {
                const isoStr = dealTime.replace(/\./g, '-').replace(' ', 'T') + 'Z';
                const parsed = new Date(isoStr);
                if (!isNaN(parsed.getTime())) {
                    exitTimestamp = parsed;
                }
            }

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
                    const assetType = classifyAsset(symbol);
                    const result = await runQuery(`
                        INSERT INTO journal_entries (
                            title, content, tags, is_private, account_id,
                        mt5_ticket, mt5_position_id, symbol, direction, after_image_url, 
                            exit_price, pnl, pnl_percentage, commission, swap, balance,
                            asset_type, following_plan, mt5_exit_ticket, created_at, updated_at
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $20)
                        RETURNING id
                    `, [
                        `MT5 Exit: ${type} ${symbol}`,
                        `Orphaned Exit: ${type} ${symbol} @ ${price}. PnL: ${totalPnL}`,
                        JSON.stringify(['MT5', 'Automated', 'Orphaned', symbol, assetType]),
                        true,
                        accountId,
                        ticket,
                        positionId || ticket,
                        symbol,
                        type,
                        imageUrl,
                        normalizedPrice,
                        totalPnL,
                        pnlPercentage,
                        normalizedCommission,
                        normalizedSwap,
                        normalizedBalance,
                        assetType,
                        null,
                        ticket,
                        exitTimestamp.toISOString()
                    ]);
                    return res.status(200).json({ success: true, message: 'Orphaned exit recorded', entryId: result.rows[0].id });
                }

                // Found via ticket fallback — update it (preserve user review data)
                await runQuery(`
                    UPDATE journal_entries SET 
                      after_image_url = COALESCE($1, after_image_url),
                      exit_price = $2,
                      pnl = $3,
                      pnl_percentage = COALESCE($4, pnl_percentage),
                      commission = $5,
                      swap = $6,
                      balance = $7,
                      mt5_position_id = COALESCE($8, mt5_position_id),
                      mt5_exit_ticket = $10,
                      updated_at = NOW()
                    WHERE id = $9
                `, [
                    imageUrl,
                    normalizedPrice,
                    totalPnL,
                    pnlPercentage,
                    normalizedCommission,
                    normalizedSwap,
                    normalizedBalance,
                    positionId || null,
                    fallback.id,
                    ticket
                ]);

                return res.status(200).json({ success: true, message: 'Trade exit recorded' });
            }

            // Update existing entry matched by position ID (preserve user review data)
            await runQuery(`
                UPDATE journal_entries SET 
                  after_image_url = COALESCE($1, after_image_url),
                  exit_price = $2,
                  pnl = $3,
                  pnl_percentage = COALESCE($4, pnl_percentage),
                  commission = $5,
                  swap = $6,
                  balance = $7,
                  mt5_exit_ticket = $9,
                  updated_at = NOW()
                WHERE id = $8
            `, [
                imageUrl,
                normalizedPrice,
                totalPnL,
                pnlPercentage,
                normalizedCommission,
                normalizedSwap,
                normalizedBalance,
                existing.id,
                ticket
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
