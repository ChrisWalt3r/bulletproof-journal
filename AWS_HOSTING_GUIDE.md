# Bulletproof Journal — AWS Free Tier Hosting Guide

> **Time required:** ~30-45 minutes  
> **Cost:** $0/month (AWS Free Tier — 750 hours/month of t2.micro for 12 months)  
> **What you're hosting:** The Express.js backend API only. Your database (Supabase) is already cloud-hosted.

---

## Architecture Overview

```
Mobile App  ──────►  EC2 (Express.js API)  ──────►  Supabase PostgreSQL
MT5 EA      ──────►  on port 3000                    Supabase Storage
```

- **EC2 t2.micro**: Runs your Node.js backend for free
- **Supabase**: Already handles your database + auth + image storage (no change)
- **No nginx needed**: We'll run Express directly on port 3000 for simplicity

---

## STEP 1: Create an AWS Account

1. Go to **https://aws.amazon.com/free/**
2. Click **"Create a Free Account"**
3. Enter your email, password, and account name
4. Select **"Personal"** account type
5. Enter your card details (you will NOT be charged — it's for verification only)
6. Complete phone verification
7. Select the **"Basic Support - Free"** plan
8. Wait for account activation (usually instant, sometimes up to 24 hours)

---

## STEP 2: Launch an EC2 Instance

### 2a. Navigate to EC2

1. Log into the **AWS Console**: https://console.aws.amazon.com/
2. In the search bar at the top, type **"EC2"** and click on it
3. Make sure your **region** (top-right corner) is set to one close to you:
   - If in Middle East/Africa → **eu-west-1 (Ireland)** or **me-south-1 (Bahrain)**
   - If in Europe → **eu-west-1 (Ireland)**
   - If in US → **us-east-1 (N. Virginia)**

### 2b. Launch the Instance

1. Click the orange **"Launch Instance"** button

2. **Name:** `bulletproof-journal-api`

3. **Application and OS Image:**
   - Select **"Amazon Linux"** (it's already selected by default)
   - Keep **Amazon Linux 2023 AMI** (Free tier eligible)
   - Architecture: **64-bit (x86)**

4. **Instance type:**
   - Select **t2.micro** (it says "Free tier eligible" next to it)

5. **Key pair (login):**
   - Click **"Create new key pair"**
   - Name: `bulletproof-key`
   - Type: **RSA**
   - Format: **.pem**
   - Click **"Create key pair"**
   - ⚠️ **SAVE THE DOWNLOADED `bulletproof-key.pem` FILE — YOU CANNOT DOWNLOAD IT AGAIN**
   - Move it somewhere safe, like `C:\Users\YourName\bulletproof-key.pem`

6. **Network settings:** Click **"Edit"**
   - Keep VPC and subnet as default
   - **Auto-assign public IP:** Enable
   - **Security group:** Create a new one
   - Security group name: `bulletproof-api-sg`
   - Add the following rules:

   | Type | Port Range | Source | Description |
   |------|-----------|--------|-------------|
   | SSH | 22 | My IP | SSH access |
   | Custom TCP | 3000 | 0.0.0.0/0 | API access (anywhere) |

   The SSH rule "My IP" restricts SSH to your current IP only. The port 3000 rule allows your mobile app and MT5 EA to reach the API from anywhere.

7. **Storage:**
   - 8 GiB gp3 (default — free tier gives you up to 30 GiB)

8. Click **"Launch Instance"**

9. You'll see "Successfully initiated launch" — click **"View Instances"**

10. Wait until **Instance state** shows **"Running"** and **Status check** shows **"2/2 checks passed"** (takes 1-2 minutes)

11. Click on your instance, and note the **Public IPv4 address** (e.g., `13.42.56.78`)
    - This is your server's IP address — you'll need it throughout the rest of this guide

---

## STEP 3: Connect to Your Server via SSH

### On Windows (PowerShell):

```powershell
# Fix .pem file permissions (REQUIRED - SSH won't work without this)
icacls "C:\Users\YourName\bulletproof-key.pem" /inheritance:r /grant:r "$($env:USERNAME):R"

# Connect to your server
ssh -i "C:\Users\YourName\bulletproof-key.pem" ec2-user@YOUR_EC2_PUBLIC_IP
```

Replace `C:\Users\YourName\bulletproof-key.pem` with wherever you saved the key file, and `YOUR_EC2_PUBLIC_IP` with your instance's public IP.

When it asks "Are you sure you want to continue connecting?", type `yes`.

You should see:
```
   ,     #_
   ~\_  ####_        Amazon Linux 2023
  ~~  \_#####\
  ~~     \###|
  ~~       \#/ ___
   ~~       V~' '->
    ~~~         /
      ~~._.   _/
         _/ _/
       _/m/'
[ec2-user@ip-172-31-xx-xx ~]$
```

**You're now inside your AWS server!**

---

## STEP 4: Set Up the Server

### Option A: Run the setup script (recommended)

While SSH'd into the server:

```bash
# Create directory structure
mkdir -p bulletproof-journal/backend

# We'll upload the setup script first, then run it
# Exit SSH for now
exit
```

Back on your local machine (PowerShell):

```powershell
# Upload the setup script to the server
scp -i "C:\Users\YourName\bulletproof-key.pem" "D:\FULL STACK DEVELOPMENT\Self-done projects\Complex projects\Bulletproof journal\backend\setup-server.sh" ec2-user@YOUR_EC2_PUBLIC_IP:/home/ec2-user/
```

SSH back in and run it:

```bash
ssh -i "C:\Users\YourName\bulletproof-key.pem" ec2-user@YOUR_EC2_PUBLIC_IP

chmod +x setup-server.sh
./setup-server.sh
```

### Option B: Manual setup

If the script has issues, run these commands manually while SSH'd in:

```bash
# Update system
sudo dnf update -y

# Install Node.js 20
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs git

# Verify
node -v   # Should show v20.x.x
npm -v    # Should show 10.x.x

# Install PM2 (keeps your server running 24/7)
sudo npm install -g pm2

# Create directories
mkdir -p /home/ec2-user/bulletproof-journal/backend
mkdir -p /home/ec2-user/logs
```

---

## STEP 5: Upload Your Backend Code

**Exit SSH** (type `exit`) and run this from your local PowerShell:

```powershell
# Navigate to your project
cd "D:\FULL STACK DEVELOPMENT\Self-done projects\Complex projects\Bulletproof journal"

# Upload ALL backend files (excluding node_modules)
scp -i "C:\Users\YourName\bulletproof-key.pem" -r backend/server.js backend/package.json backend/package-lock.json backend/ecosystem.config.js ec2-user@YOUR_EC2_PUBLIC_IP:/home/ec2-user/bulletproof-journal/backend/

scp -i "C:\Users\YourName\bulletproof-key.pem" -r backend/src ec2-user@YOUR_EC2_PUBLIC_IP:/home/ec2-user/bulletproof-journal/backend/
```

---

## STEP 6: Configure Environment Variables

SSH back into the server:

```bash
ssh -i "C:\Users\YourName\bulletproof-key.pem" ec2-user@YOUR_EC2_PUBLIC_IP
```

Create the `.env` file:

```bash
nano /home/ec2-user/bulletproof-journal/backend/.env
```

Paste these contents (same as your local `.env` but with NODE_ENV=production):

```
PORT=3000
NODE_ENV=production
DATABASE_URL=postgresql://postgres.pjiishvyrepvltrklyjw:Aldanmali%4021@aws-1-eu-west-1.pooler.supabase.com:5432/postgres
SUPABASE_URL=https://pjiishvyrepvltrklyjw.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqaWlzaHZ5cmVwdmx0cmtseWp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2OTAwNTksImV4cCI6MjA4NTI2NjA1OX0.2AIRP7XchehlUQEy93973iICILWS4Cg2CQnHkHH93Lg
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqaWlzaHZ5cmVwdmx0cmtseWp3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTY5MDA1OSwiZXhwIjoyMDg1MjY2MDU5fQ.WoyIERoGJ1LvHu6zI1ZsOFEu6QgZliy32tASVNW4BAA
MT5_WEBHOOK_SECRET=BulletproofTrades2026!
```

Save: `Ctrl+O`, `Enter`, then exit: `Ctrl+X`

---

## STEP 7: Install Dependencies & Start the Server

Still SSH'd in:

```bash
cd /home/ec2-user/bulletproof-journal/backend

# Install production dependencies
npm install --production

# Start with PM2
pm2 start ecosystem.config.js

# Verify it's running
pm2 status
# Should show: bulletproof-journal-api │ online

# Check the health endpoint
curl http://localhost:3000/api/health
# Should return: {"status":"ok","timestamp":"...","environment":"production","uptime":...}

# Check logs if something is wrong
pm2 logs

# Save PM2 process list (so it restarts on reboot)
pm2 save

# Set PM2 to start on boot
# PM2 will print a command you need to run — copy and execute it
pm2 startup
# It will output something like:
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ec2-user --hp /home/ec2-user
# Copy that entire line and run it
```

---

## STEP 8: Test From Outside

From your **local machine** (PowerShell), test the API:

```powershell
# Replace with your actual EC2 IP
curl http://YOUR_EC2_PUBLIC_IP:3000/api/health
```

You should get back:
```json
{"status":"ok","timestamp":"2026-02-09T...","environment":"production","uptime":...}
```

**If this works, your backend is live on the internet!**

---

## STEP 9: Update Your Mobile App

Open `mobile-app/src/config/index.js` and change the IP:

```javascript
const PRODUCTION_API_URL = 'http://YOUR_EC2_PUBLIC_IP:3000/api';
```

The file has already been updated with a `USE_PRODUCTION` toggle — just replace `YOUR_EC2_PUBLIC_IP` with your actual EC2 public IP, and make sure `USE_PRODUCTION = true`.

Then rebuild your app:
```powershell
cd "D:\FULL STACK DEVELOPMENT\Self-done projects\Complex projects\Bulletproof journal\mobile-app"
npx expo start
```

---

## STEP 10: Update Your MT5 EA

Open MetaEditor and update the webhook URL in `AutoJournaler_v2.mq5`:

```cpp
input string InpApiUrl = "http://YOUR_EC2_PUBLIC_IP:3000/api/mt5/webhook";
```

Also add the EC2 IP to MT5's allowed URLs:
1. **Tools** → **Options** → **Expert Advisors** tab
2. Check ✅ **"Allow WebRequest for listed URL"**
3. Add: `http://YOUR_EC2_PUBLIC_IP:3000`
4. Click **OK**
5. Recompile (F7) and re-attach the EA

---

## Useful Commands Reference

```bash
# SSH into your server
ssh -i "C:\Users\YourName\bulletproof-key.pem" ec2-user@YOUR_EC2_PUBLIC_IP

# Check server status
pm2 status

# View live logs
pm2 logs

# Restart server (after code changes)
pm2 restart bulletproof-journal-api

# Stop server
pm2 stop bulletproof-journal-api

# Check memory/CPU usage
pm2 monit

# Update backend code (from local machine):
# 1. Upload new files via scp
# 2. SSH in → pm2 restart bulletproof-journal-api
```

---

## Troubleshooting

### "Connection refused" when testing from outside
- Check Security Group: EC2 Console → Instances → Click your instance → Security tab → Inbound rules → Must have port 3000 open to 0.0.0.0/0
- Check PM2 is running: `pm2 status`

### "Connection timed out"
- Your EC2 instance might not have a public IP. Go to EC2 Console → Instances → Check "Public IPv4 address" column
- Security group might not have port 3000 open

### Server crashes or won't start
```bash
# Check logs
pm2 logs --lines 50

# Try running directly to see errors
cd /home/ec2-user/bulletproof-journal/backend
node server.js
```

### SSH "Permission denied"
```powershell
# Fix key file permissions on Windows
icacls "C:\Users\YourName\bulletproof-key.pem" /inheritance:r /grant:r "$($env:USERNAME):R"
```

### "ECONNREFUSED" from Supabase
- Check your `.env` has the correct `DATABASE_URL`
- EC2 security group outbound rules should allow all traffic (default)

---

## Cost Alert Prevention

The t2.micro free tier gives 750 hours/month — enough for ONE instance running 24/7. To avoid charges:

1. **Only run ONE t2.micro instance** at a time
2. **Set a billing alarm:**
   - Go to AWS Console → Billing → Budgets
   - Create a budget → "Zero spend budget"
   - This emails you if ANYTHING charges your account
3. Free tier expires after **12 months** from account creation

---

## Future Improvements (Optional)

- **Custom domain**: Buy a domain, create an A record pointing to your EC2 IP
- **HTTPS**: Use Caddy or Certbot to add SSL (free with Let's Encrypt)
- **Elastic IP**: Assign a static IP so it doesn't change on reboot (free if attached to a running instance)
