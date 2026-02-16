# MT5 EA Setup Guide (Start to Finish)

This guide walks a new user through installing the MT5 Expert Advisor (EA), connecting it to the Bulletproof Journal backend, and verifying that trades appear in the mobile app.

## Overview
- The MT5 EA sends trade data + screenshots to the backend webhook.
- The mobile app reads those entries from the backend.
- You attach the EA to any single chart; it monitors all symbols on the account.

## Prerequisites
- MT5 desktop terminal installed (Windows)
- Bulletproof Journal mobile app installed (APK)
- Internet access from MT5 to the backend API
- Webhook secret value (ask the admin or check backend `.env`)

## Step 1: Install the EA in MT5
1. Open MT5.
2. Click **File -> Open Data Folder**.
3. Navigate to **MQL5 -> Experts**.
4. Copy this file into the folder:
   - [backend/integrations/mt5/AutoJournaler_v2.mq5](../backend/integrations/mt5/AutoJournaler_v2.mq5)
5. Open **MetaEditor** (Tools -> MetaQuotes Language Editor).
6. In MetaEditor, open `AutoJournaler_v2.mq5` and click **Compile**.

## Step 2: Allow WebRequest in MT5
1. In MT5, go to **Tools -> Options -> Expert Advisors**.
2. Check **Allow WebRequest for listed URL**.
3. Add the backend base URL:
   - `https://bulletproof-journal-1.onrender.com`
4. Click **OK**.

## Step 3: Attach the EA to a Chart
1. Open any chart in MT5 (any symbol/timeframe is fine).
2. In the **Navigator** panel, find **Expert Advisors -> AutoJournaler_v2**.
3. Drag it onto the chart.
4. In the inputs tab, set:
   - `InpApiUrl`: `https://bulletproof-journal-1.onrender.com/api/mt5/webhook`
   - `InpApiSecret`: use the value from backend `MT5_WEBHOOK_SECRET`
   - `InpAccountId`: leave as `1` (current backend assigns all MT5 trades to account id 1)
   - `InpWidth` / `InpHeight`: keep defaults or adjust if needed
5. Make sure **Allow Algo Trading** is enabled in MT5 (top toolbar).

## Step 4: Set Up the Mobile App
1. Install the APK on your Android phone.
2. Open the app and sign up or log in.
3. Create your primary trading account in the app (the first account created is id 1).
4. Keep the app connected to the internet.

## Step 5: Verify It Works
1. Place a small test trade in MT5.
2. In MT5, open the **Experts** tab and confirm you see:
   - `Success: Sent ENTRY...`
   - `Success: Sent EXIT...` when the trade closes
3. Open the app and go to your journal list.
4. You should see entries like:
   - `MT5: BUY EURUSD` or `MT5: SELL XAUUSD`
   - Screenshot attached (if upload succeeded)

## Troubleshooting
- **No entries in app**: confirm the backend URL and secret match. Check MT5 Experts tab for errors.
- **401 Unauthorized**: `InpApiSecret` does not match backend `MT5_WEBHOOK_SECRET`.
- **Error -1 on WebRequest**: the URL is not whitelisted in MT5 Options.
- **No screenshot**: image upload can fail without blocking the trade. Check backend logs.
- **Wrong account**: current backend maps all MT5 entries to account id 1.

## Notes
- The EA monitors all symbols for the logged-in MT5 account from a single chart.
- If your backend URL changes, update `InpApiUrl` and the WebRequest whitelist.
- This EA is optimized for MT5; it will not work on MT4 without changes.
