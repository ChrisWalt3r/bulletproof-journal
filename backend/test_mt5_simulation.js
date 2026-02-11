const fs = require('fs');
const path = require('path');
const http = require('http');
require('dotenv').config();

// Configuration
const API_URL = 'http://localhost:3000/api/mt5/webhook';
const SECRET = process.env.MT5_WEBHOOK_SECRET || 'BulletproofTrades2026!';
const TICKET_ID = Math.floor(Math.random() * 1000000);

// minimal 1x1 pixel transparent gif base64
const MOCK_IMAGE_BASE64 = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

// Helper function for POST requests using native http
function postRequest(data) {
    return new Promise((resolve, reject) => {
        const dataString = JSON.stringify(data);
        const url = new URL(API_URL);
        
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': dataString.length,
                'x-api-secret': SECRET
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve({ status: res.statusCode, data: JSON.parse(body || '{}') });
                } else {
                    reject({ status: res.statusCode, data: body });
                }
            });
        });

        req.on('error', (e) => reject(e));
        req.write(dataString);
        req.end();
    });
}

(async () => {
    // Wait for server to start
    await new Promise(r => setTimeout(r, 2000));

    try {
        console.log('Phase 1: Entry');
        const entryPayload = {
            action: 'ENTRY',
            ticket: TICKET_ID,
            symbol: 'EURUSD',
            type: 'BUY',
            volume: '0.1',
            price: '1.0850',
            comment: 'Automated Test Entry',
            accountId: 1,
            image_base64: MOCK_IMAGE_BASE64,
            image_filename: `test_trade_${TICKET_ID}.gif`
        };
        
        const entryRes = await postRequest(entryPayload);
        console.log('Entry Result:', entryRes);

        console.log('\nPhase 2: Exit');
        const exitPayload = {
            action: 'EXIT',
            ticket: TICKET_ID,
            symbol: 'EURUSD',
            type: 'BUY',
            volume: '0.1',
            price: '1.0870',
            profit: '20.00',
            commission: '-2.00',
            swap: '0.00',
            balance: '10018.00',
            comment: 'Automated Test Exit',
            image_base64: MOCK_IMAGE_BASE64,
            image_filename: `test_trade_exit_${TICKET_ID}.gif`
        };

        const exitRes = await postRequest(exitPayload);
        console.log('Exit Result:', exitRes);
        console.log('\n✅ Full Flow Test PASSED');
    } catch (err) {
        console.error('❌ Test Failed:', err);
        process.exit(1);
    }
})();
