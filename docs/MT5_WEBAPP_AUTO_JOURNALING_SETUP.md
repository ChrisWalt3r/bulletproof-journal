# MT5 + Web App Automatic Journaling Setup

This guide explains how to set up automatic journaling from MetaTrader 5 (MT5) to this web app.

## Overview

The flow is:

1. MT5 EA sends ENTRY and EXIT events to backend webhook.
2. Backend validates webhook secret and stores journal data.
3. Web app reads the same backend data for Journal, Calendar, Equity Curve, and Execution Review pages.

Webhook endpoint used by the EA:

- POST /api/mt5/webhook
- POST /api/mt5/check-tickets (catch-up sync optimization)

## Prerequisites

- MT5 desktop installed on Windows.
- Backend running and reachable from MT5.
- Web app configured to use the same backend base URL.
- A journal account created in the app (you need its numeric account ID).
- A strong shared secret for MT5 webhook auth.

## 1) Backend Configuration

Create or update backend .env with at least:

```env
PORT=3000
NODE_ENV=production
DATABASE_URL=postgresql://user:password@host:5432/database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
MT5_WEBHOOK_SECRET=change-me-to-a-long-random-secret
CORS_ORIGIN=http://localhost:5173,https://web-journal-2r5u.onrender.com
FRONTEND_URL=https://web-journal-2r5u.onrender.com
```

Notes:

- MT5 webhook route uses header x-api-secret via verifyWebhookSecret middleware.
- MT5_WEBHOOK_SECRET in backend must exactly match EA input InpApiSecret.

## 2) Web App Configuration

In mobile-app .env (or deployment env vars), set:

```env
VITE_API_URL=https://web-journal-2r5u.onrender.com/api
```

If running locally, use your local backend base URL instead.

## 3) Create/Select App Account

In the web app:

1. Go to Settings.
2. Create or select the trading account you want MT5 to write to.
3. Note the account ID.

That ID goes into EA input InpAccountId.

## 4) Install EA in MT5

EA source in repo:

- backend/integrations/mt5/AutoJournaler_v2.mq5

Steps:

1. MT5 -> File -> Open Data Folder.
2. Copy AutoJournaler_v2.mq5 into MQL5/Experts.
3. Open MetaEditor and compile.

## 5) MT5 WebRequest Allowlist

In MT5:

1. Tools -> Options -> Expert Advisors.
2. Enable Allow WebRequest for listed URL.
3. Add backend base domain (not full path), for example:

- https://web-journal-2r5u.onrender.com

Without this, MT5 cannot call webhook (WebRequest errors).

## 6) EA Inputs

Attach EA to one chart only and configure inputs:

- InpApiUrl = https://web-journal-2r5u.onrender.com/api/mt5/webhook
- InpApiSecret = same as backend MT5_WEBHOOK_SECRET
- InpAccountId = your app account ID
- InpWidth = 1366
- InpHeight = 768
- InpSyncDays = 7

Enable Algo Trading.

## 7) Validate End-to-End

Recommended quick validation:

1. Start backend.
2. Open one small test position in MT5.
3. Confirm ENTRY appears in app Journal.
4. Close position.
5. Confirm EXIT updates same entry with pnl and pnl_percentage.

Optional local simulation script:

- backend/test_mt5_simulation.js

Run:

```bash
cd backend
node test_mt5_simulation.js
```

Expected result:

- Phase 1: Entry -> HTTP 201 trade entry recorded
- Phase 2: Exit -> HTTP 200 trade exit recorded

## 8) Troubleshooting

401 Unauthorized

- Secret mismatch between EA InpApiSecret and backend MT5_WEBHOOK_SECRET.

No entries arriving

- Wrong InpApiUrl, backend down, or WebRequest allowlist missing.
- Algo Trading disabled in MT5.

Wrong account receiving trades

- Incorrect InpAccountId.
- Use account ID from app Settings.

Images missing but entries exist

- Storage upload can fail independently; check backend logs and Supabase storage config.

## Operational Checklist

1. Backend healthy at /api/health.
2. App account selected and ID confirmed.
3. EA attached to exactly one chart.
4. Algo Trading enabled.
5. WebRequest allowlist contains backend domain.
6. Secret matches on both sides.
