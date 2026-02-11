const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const { verifyToken } = require('./middleware/auth');

// Import routes
const journalRoutes = require('./routes/journal');
const accountsRoutes = require('./routes/accounts');
const imagesRoutes = require('./routes/images');
const mt5Routes = require('./routes/mt5');

const app = express();

// Production middleware
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1); // Trust first proxy (nginx/ALB)
  app.use(helmet());         // Security headers
  app.use(morgan('combined')); // HTTP request logging
} else {
  app.use(morgan('dev'));
}

// CORS — allow mobile app + any origin for now
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static files (legacy local uploads - kept for backwards compatibility)
// New images are stored in Supabase Storage
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Public Routes
app.get('/', (req, res) => {
  res.status(200).json({
    message: '🚀 Bulletproof Journal API is running!',
    docs: 'Connect via mobile app or check /api/health'
  });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date(),
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime()
  });
});

// MT5 Webhook (Secured internally via Secret Header, not JWT)
app.use('/api/mt5', mt5Routes);

// Protected Routes (Require Supabase JWT)
// app.use('/api/auth', authRoutes);
app.use('/api/journal', verifyToken, journalRoutes);
app.use('/api/accounts', verifyToken, accountsRoutes);
app.use('/api/images', imagesRoutes); // Images routes handle auth internally
// app.use('/api/stats', verifyToken, statsRoutes);

// Error handling
app.use((err, req, res, next) => {
  console.error('Global error handler:', err.message);
  console.error('Error type:', err.type || 'unknown');
  console.error('Request URL:', req.originalUrl);
  console.error('Stack:', err.stack);
  res.status(500).json({ error: 'Something went wrong!', details: err.message });
});

module.exports = app;