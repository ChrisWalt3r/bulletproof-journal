#!/bin/bash
# ============================================================
# Deploy latest backend code to EC2
# Run from your LOCAL machine (Windows: use Git Bash or WSL)
# Usage: bash deploy.sh
# ============================================================

# === CONFIGURE THESE ===
EC2_HOST="YOUR_EC2_PUBLIC_IP"          # e.g., 13.42.56.78
KEY_FILE="$HOME/bulletproof-key.pem"   # Path to your .pem key file
REMOTE_USER="ec2-user"
REMOTE_DIR="/home/ec2-user/bulletproof-journal/backend"
# =======================

echo "🚀 Deploying Bulletproof Journal Backend to $EC2_HOST..."

# Upload backend files (excluding node_modules, .env, uploads)
echo "[1/3] Uploading files..."
scp -i "$KEY_FILE" -r \
  server.js package.json package-lock.json ecosystem.config.js \
  src/ \
  "$REMOTE_USER@$EC2_HOST:$REMOTE_DIR/"

# SSH in, install deps, restart
echo "[2/3] Installing dependencies and restarting..."
ssh -i "$KEY_FILE" "$REMOTE_USER@$EC2_HOST" << 'EOF'
  cd /home/ec2-user/bulletproof-journal/backend
  npm install --production
  pm2 restart bulletproof-journal-api || pm2 start ecosystem.config.js
  pm2 save
  echo "Health check:"
  sleep 2
  curl -s http://localhost:3000/api/health
  echo ""
EOF

echo "[3/3] ✅ Deployment complete!"
echo "API: http://$EC2_HOST:3000/api/health"
