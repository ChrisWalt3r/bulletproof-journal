// PM2 Ecosystem file — manages the Node.js process in production
module.exports = {
  apps: [{
    name: 'bulletproof-journal-api',
    script: 'server.js',
    cwd: '/home/ec2-user/bulletproof-journal/backend',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '300M',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
    },
    // Logs
    error_file: '/home/ec2-user/logs/pm2-error.log',
    out_file: '/home/ec2-user/logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
  }]
};
