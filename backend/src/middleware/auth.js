const { supabase } = require('../config/supabase');
require('dotenv').config();

const verifyToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({ error: 'No authorization header' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        req.user = user;
        next();
    } catch (error) {
        console.error('Auth error:', error);
        return res.status(500).json({ error: 'Authentication failed' });
    }
};

const verifyWebhookSecret = (req, res, next) => {
    // Check for secret in Header (preferred) or Query Param (fallback for simple clients)
    const secret = req.headers['x-api-secret'] || req.query.secret;

    if (!secret || secret !== process.env.MT5_WEBHOOK_SECRET) {
        console.warn('Unauthorized Webhook Attempt');
        return res.status(401).json({ error: 'Unauthorized: Invalid Secret' });
    }

    next();
};

module.exports = {
    verifyToken,
    verifyWebhookSecret
};
