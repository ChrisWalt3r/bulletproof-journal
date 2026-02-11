const app = require('./src/app');
const { initializeDatabase } = require('./src/database/init');

const PORT = process.env.PORT || 3000;

// Initialize database and start server
async function startServer() {
  try {
    await initializeDatabase();
    console.log('Database initialized successfully');

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Bulletproof Journal API server running on port ${PORT}`);
      console.log(`📱 Health check: http://localhost:${PORT}/api/health`);
      // Dynamically get local IP for external access info
      const nets = require('os').networkInterfaces();
      let localIp = 'localhost';
      for (const iface of Object.values(nets)) {
        for (const cfg of iface) {
          if (cfg.family === 'IPv4' && !cfg.internal && cfg.address.startsWith('10.')) {
            localIp = cfg.address;
            break;
          }
        }
      }
      console.log(`🔗 External access: http://${localIp}:${PORT}/api/health`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}


// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION! 💥 Shutting down...');
  console.error(err.name, err.message);
  console.error(err.stack);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.error(err.name, err.message);
  console.error(err.stack);
  process.exit(1);
});

startServer();

