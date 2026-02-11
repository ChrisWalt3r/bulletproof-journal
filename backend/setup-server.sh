#!/bin/bash
# ============================================================
# Bulletproof Journal — EC2 Server Setup Script
# Run this ONCE on a fresh Amazon Linux 2023 / AL2 EC2 instance
# Usage:  chmod +x setup-server.sh && ./setup-server.sh
# ============================================================
set -e

echo "========================================="
echo " Bulletproof Journal — Server Setup"
echo "========================================="

# 1. System updates
echo "[1/7] Updating system packages..."
sudo dnf update -y

# 2. Install Node.js 20 LTS
echo "[2/7] Installing Node.js 20 LTS..."
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs git

echo "Node.js version: $(node -v)"
echo "npm version: $(npm -v)"

# 3. Install PM2 globally (process manager — keeps the server running)
echo "[3/7] Installing PM2 process manager..."
sudo npm install -g pm2

# 4. Create log directory
echo "[4/7] Setting up directories..."
mkdir -p /home/ec2-user/logs

# 5. Clone or copy your project (skip if already uploaded)
echo "[5/7] Setting up project..."
cd /home/ec2-user

if [ ! -d "bulletproof-journal" ]; then
  echo "  -> Creating project directory..."
  mkdir -p bulletproof-journal/backend
  echo "  -> Please upload your backend files to /home/ec2-user/bulletproof-journal/backend"
  echo "     Use: scp -i your-key.pem -r backend/* ec2-user@YOUR_IP:/home/ec2-user/bulletproof-journal/backend/"
else
  echo "  -> Project directory already exists."
fi

# 6. Install dependencies
echo "[6/7] Installing Node.js dependencies..."
cd /home/ec2-user/bulletproof-journal/backend
if [ -f "package.json" ]; then
  npm install --production
  echo "  -> Dependencies installed."
else
  echo "  -> WARNING: No package.json found. Upload your backend files first, then run:"
  echo "     cd /home/ec2-user/bulletproof-journal/backend && npm install --production"
fi

# 7. Setup PM2 to start on boot
echo "[7/7] Configuring PM2 startup..."
pm2 startup systemd -u ec2-user --hp /home/ec2-user
# This will output a command you need to run with sudo — copy & run it!

echo ""
echo "========================================="
echo " Setup complete!"
echo "========================================="
echo ""
echo "NEXT STEPS:"
echo "  1. Upload your backend files if not done:"
echo "     scp -i your-key.pem -r backend/* ec2-user@YOUR_IP:/home/ec2-user/bulletproof-journal/backend/"
echo ""
echo "  2. Create the .env file:"
echo "     nano /home/ec2-user/bulletproof-journal/backend/.env"
echo "     (paste your env vars from your local .env)"
echo ""
echo "  3. Start the server:"
echo "     cd /home/ec2-user/bulletproof-journal/backend"
echo "     pm2 start ecosystem.config.js"
echo "     pm2 save"
echo ""
echo "  4. Check it's running:"
echo "     curl http://localhost:3000/api/health"
echo ""
echo "  5. Check logs:"
echo "     pm2 logs"
echo ""
