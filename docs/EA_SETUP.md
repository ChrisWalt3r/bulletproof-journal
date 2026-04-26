# MT5 Auto-Journaling Setup Guide

This guide covers the complete setup for automatic trade journaling from MetaTrader 5 desktop into Bulletproof Journal.

## What the integration does

- The MT5 expert adviser watches the trading account from one chart.
- Every new entry and exit deal is sent to `POST /api/mt5/webhook`.
- The backend stores the trade in the selected Bulletproof Journal account.
- The journal, dashboard, calendar, and review pages update from the same backend data.
- When MT5 starts again, the EA can catch up missed deals from recent history.

## Files already prepared in this repo

- EA source: [backend/integrations/mt5/AutoJournaler_v2.mq5](/d:/FULL%20STACK%20DEVELOPMENT/Self-done%20projects/Complex%20projects/Bulletproof%20journal/backend/integrations/mt5/AutoJournaler_v2.mq5)
- Backend webhook route: [backend/src/routes/mt5.js](/d:/FULL%20STACK%20DEVELOPMENT/Self-done%20projects/Complex%20projects/Bulletproof%20journal/backend/src/routes/mt5.js)
- Backend env template: [backend/.env.example](/d:/FULL%20STACK%20DEVELOPMENT/Self-done%20projects/Complex%20projects/Bulletproof%20journal/backend/.env.example)

## Before you start

You need:

- MT5 desktop installed on Windows
- Your Bulletproof Journal backend running and reachable from MT5
- One trading account created in Bulletproof Journal
- The numeric account ID you want MT5 to write into
- A strong webhook secret that exists in both the backend env and the EA inputs

## 1. Configure the backend

Set these values in `backend/.env`:

```env
PORT=3000
NODE_ENV=production
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
DATABASE_URL=your-postgres-connection-string
MT5_WEBHOOK_SECRET=use-a-long-random-secret-here
```

Important:

- `MT5_WEBHOOK_SECRET` must be strong and private.
- The EA now ships with a blank secret on purpose. You must fill it in manually.
- If you change the secret later, update MT5 too.

If your backend is deployed, redeploy or restart it after changing env values.

## 2. Confirm the backend URL you will use in MT5

The EA needs the full webhook URL:

```text
https://your-backend-domain/api/mt5/webhook
```

MT5 also needs the base domain in its WebRequest allowlist:

```text
https://your-backend-domain
```

If you are using the current web app defaults from this repo, the app already expects:

```text
https://web-journal-2r5u.onrender.com/api
```

So the MT5 webhook would be:

```text
https://web-journal-2r5u.onrender.com/api/mt5/webhook
```

## 3. Create or choose the journal account in the app

In Bulletproof Journal:

1. Open `Settings`.
2. Create the trading account if it does not exist yet.
3. Make that account active.
4. Note the numeric `Journal Account ID` shown in the MT5 setup section of Settings.

Use that exact ID in the EA input `InpAccountId`.

## 4. Install the EA in MT5

1. Open MT5.
2. Go to `File -> Open Data Folder`.
3. Open `MQL5 -> Experts`.
4. Copy `AutoJournaler_v2.mq5` into that folder.
5. Open `Tools -> MetaQuotes Language Editor`.
6. Open `AutoJournaler_v2.mq5`.
7. Click `Compile`.

If compile fails, make sure the file was copied into the MT5 data folder and opened from there.

## 5. Allow WebRequest in MT5

1. In MT5, open `Tools -> Options -> Expert Advisors`.
2. Check `Allow WebRequest for listed URL`.
3. Add your backend base URL only, for example:
   `https://web-journal-2r5u.onrender.com`
4. Click `OK`.

Without this, MT5 returns `WebRequest = -1`.

## 6. Attach the EA to one chart

The EA watches the whole MT5 account from a single chart, so do not attach it to multiple charts.

1. Open any chart in MT5.
2. In `Navigator -> Expert Advisors`, find `AutoJournaler_v2`.
3. Drag it onto the chart.
4. In the `Inputs` tab, set:

```text
InpApiUrl    = https://your-backend-domain/api/mt5/webhook
InpApiSecret = the same value as backend MT5_WEBHOOK_SECRET
InpAccountId = your Bulletproof Journal account ID
InpWidth     = 1366
InpHeight    = 768
InpSyncDays  = 7
```

5. Make sure `Allow Algo Trading` is enabled in MT5.
6. Keep MT5 running while you want live journaling.

## 7. Test the integration

Use a small test trade first.

1. Open a trade in MT5.
2. Check the `Experts` tab in MT5.
3. You should see logs showing the detected entry deal and a successful send.
4. Close the trade.
5. Check the `Experts` tab again for the exit send.
6. Open Bulletproof Journal and go to `Journal`.

Expected result:

- A new entry appears automatically.
- The journal card shows `MT5 Auto`.
- When the position closes, the same entry gets exit price and PnL data.
- If screenshot upload succeeds, the trade images are stored with the entry.

## 8. How catch-up sync works

When MT5 starts and the EA loads:

- It scans recent trade history for the last `InpSyncDays`.
- It asks the backend which MT5 tickets are missing.
- It sends only missing deals.
- Deleted MT5 journal entries are remembered so they do not come back on the next sync.

This helps if the computer or MT5 terminal was off when a trade was placed or closed.

## Troubleshooting

### No trade appears in the journal

- Confirm the backend is running.
- Confirm the webhook URL is correct.
- Confirm the account ID exists in the app.
- Confirm MT5 `Allow Algo Trading` is enabled.
- Check the MT5 `Experts` tab for send errors.

### `401 Unauthorized`

- `InpApiSecret` does not match `MT5_WEBHOOK_SECRET`.
- Update one side so both values match exactly.

### `WebRequest = -1`

- The backend base URL is not whitelisted in MT5 Options.
- Add the base domain in `Tools -> Options -> Expert Advisors`.

### Trades go into the wrong journal account

- The wrong `InpAccountId` was entered in MT5.
- Open app Settings and confirm the account ID shown there.
- Update the EA input and reattach or reload the EA if needed.

### Screenshots are missing

- Screenshot upload is best-effort and does not block journaling.
- If the trade entry exists but the image is missing, check backend logs and storage configuration.

### Entry arrives but exit data does not update

- Check that the trade close also appears in the MT5 `Experts` tab.
- Make sure the position close was a normal deal event and not blocked by MT5 permissions or connectivity.

## Recommended operating checklist

Use this flow for reliable day-to-day operation:

1. Start the backend.
2. Open Bulletproof Journal and verify the correct account is active.
3. Start MT5 desktop.
4. Confirm the EA smiley face is visible on the attached chart.
5. Confirm `Allow Algo Trading` is on.
6. Trade normally.
7. Check the journal after the first trade of the session.

## Security note

The EA source in this repo no longer includes a live webhook secret by default. Keep your real `MT5_WEBHOOK_SECRET` out of source control and rotate it if it was previously shared.
