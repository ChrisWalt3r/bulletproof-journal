//+------------------------------------------------------------------+
//|                                           AutoJournaler_v2.mq5   |
//|                                  Copyright 2024, Bulletproof     |
//|                                  https://yourjournalapp.com      |
//+------------------------------------------------------------------+
#property copyright "Bulletproof Journal"
#property link      "https://yourjournalapp.com"
#property version   "3.01"
#property description "Universal Auto-Journaler: captures ALL trades across all"
#property description "symbols (forex, indices, commodities, etc.) from a single"
#property description "chart. Attach to any ONE chart — it monitors the entire account."
#property strict

// --- INPUTS ---
input string   InpApiUrl      = "https://bulletproof-journal-1.onrender.com/api/mt5/webhook"; // API Webhook URL
input string   InpApiSecret   = "BulletproofTrades2026!";                 // Webhook Secret
input int      InpAccountId   = 1;                                // Journal Account ID
input int      InpWidth       = 1366;                             // Screenshot Width
input int      InpHeight      = 768;                              // Screenshot Height

// --- GLOBALS ---
const string msg_base64_table = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   Print("============================================");
   Print("  AutoJournaler v3.01 (Universal) Started");
   Print("  Webhook: ", InpApiUrl);
   Print("  Account ID: ", InpAccountId);
   Print("  Monitoring: ALL symbols on this account");
   Print("  Attach to ONE chart only — it captures");
   Print("  forex, indices, commodities, crypto, etc.");
   Print("============================================");
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Trade Transaction function — fires for ALL deals on the account  |
//+------------------------------------------------------------------+
void OnTradeTransaction(const MqlTradeTransaction& trans,
                        const MqlTradeRequest& request,
                        const MqlTradeResult& result)
{
   // Debug: log every transaction type we receive
   Print("OnTradeTransaction fired: type=", EnumToString(trans.type),
         " deal=", trans.deal, " order=", trans.order,
         " symbol=", trans.symbol, " deal_type=", trans.deal_type);

   if(trans.type == TRADE_TRANSACTION_DEAL_ADD)
   {
      ulong deal_ticket = trans.deal;
      Print("DEAL_ADD received. Ticket: ", deal_ticket);
      
      // CRITICAL: Load deal history into cache before accessing deal details.
      // Without this, HistoryDealSelect() silently fails on many MT5 builds.
      if(!HistorySelect(0, TimeCurrent()))
      {
         Print("WARNING: HistorySelect() failed. Error: ", GetLastError());
      }
      
      // Retry logic — the deal may not be immediately available
      bool dealFound = false;
      for(int attempt = 0; attempt < 5; attempt++)
      {
         if(HistoryDealSelect(deal_ticket))
         {
            dealFound = true;
            break;
         }
         Print("HistoryDealSelect attempt ", attempt + 1, " failed for ticket ", deal_ticket, ". Retrying...");
         Sleep(200);
         HistorySelect(0, TimeCurrent()); // Refresh history cache
      }
      
      if(!dealFound)
      {
         Print("ERROR: Could not select deal ", deal_ticket, " after 5 attempts. Error: ", GetLastError());
         return;
      }
      
      long type = HistoryDealGetInteger(deal_ticket, DEAL_TYPE);
      long entry = HistoryDealGetInteger(deal_ticket, DEAL_ENTRY);
      string symbol = HistoryDealGetString(deal_ticket, DEAL_SYMBOL);
      
      Print("Deal details — symbol: ", symbol, " type: ", type,
            " entry: ", entry, " (IN=", DEAL_ENTRY_IN,
            " OUT=", DEAL_ENTRY_OUT, " OUT_BY=", DEAL_ENTRY_OUT_BY, ")");
      
      // Only process Buy or Sell deals
      if(type == DEAL_TYPE_BUY || type == DEAL_TYPE_SELL)
      {
         if(entry == DEAL_ENTRY_IN)
         {
            Print(">>> Entry Deal Detected: ", deal_ticket, " ", symbol);
            CaptureAndSend(deal_ticket, "ENTRY");
         }
         else if(entry == DEAL_ENTRY_OUT || entry == DEAL_ENTRY_OUT_BY)
         {
            Print(">>> Exit Deal Detected: ", deal_ticket, " ", symbol);
            CaptureAndSend(deal_ticket, "EXIT");
         }
         else
         {
            Print("Deal is BUY/SELL but entry type not IN/OUT: entry=", entry);
         }
      }
      else
      {
         Print("Deal type is not BUY/SELL: type=", type,
               " (BUY=", DEAL_TYPE_BUY, " SELL=", DEAL_TYPE_SELL, ")");
      }
   }
}

//+------------------------------------------------------------------+
//| Find an open chart for the given symbol, or open a new one       |
//| Returns the chart ID (> 0) or 0 on failure                      |
//+------------------------------------------------------------------+
long FindOrOpenChart(string symbol)
{
   // First, check if we're already on the right chart
   if(ChartSymbol(0) == symbol)
      return 0; // chart 0 is this chart, use it directly
   
   // Search existing open charts
   long chartId = ChartFirst();
   while(chartId >= 0)
   {
      if(ChartSymbol(chartId) == symbol)
         return chartId;
      chartId = ChartNext(chartId);
   }
   
   // No chart found — open a temporary one
   long newChart = ChartOpen(symbol, PERIOD_M15);
   if(newChart > 0)
   {
      // Wait for chart data to load
      Sleep(2000);
      // Apply clean template if available (optional)
      ChartRedraw(newChart);
      Print("Opened temporary chart for ", symbol, " (ID: ", newChart, ")");
   }
   else
   {
      Print("WARNING: Could not open chart for ", symbol, ". Error: ", GetLastError());
   }
   return newChart;
}

//+------------------------------------------------------------------+
//| Take screenshot from the correct chart for the traded symbol     |
//+------------------------------------------------------------------+
string CaptureChartScreenshot(ulong deal_ticket, string symbol)
{
   string filename = "journal_" + IntegerToString(deal_ticket) + ".png";
   
   long chartId = FindOrOpenChart(symbol);
   bool tempChart = false;
   
   // If chartId == 0, the current chart matches the symbol
   // If chartId > 0, it's either an existing or newly opened chart
   if(chartId == 0)
   {
      // Current chart matches — use chart 0
      ChartScreenShot(0, filename, InpWidth, InpHeight, ALIGN_RIGHT);
   }
   else if(chartId > 0)
   {
      // Different chart — check if we opened it (temp) or it was already there
      // We'll mark it temp if it wasn't found in the first search pass
      long searchId = ChartFirst();
      bool wasExisting = false;
      while(searchId >= 0 && searchId != chartId)
      {
         searchId = ChartNext(searchId);
      }
      // If we just opened it, we'll close it after screenshot
      // For simplicity — never close charts that were open before
      // We track temp charts by checking if ChartOpen was the source
      
      ChartScreenShot(chartId, filename, InpWidth, InpHeight, ALIGN_RIGHT);
      
      // Close if this was a newly opened temporary chart
      // We know it's temp if it was just created by us
      // Simple heuristic: if the chart has no EA/indicator, it's likely ours
      // For safety, we won't auto-close — MT5 users may want to keep charts open
   }
   else
   {
      // Failed to find or open chart — take screenshot of current chart anyway
      Print("Taking screenshot of current chart as fallback for ", symbol);
      ChartScreenShot(0, filename, InpWidth, InpHeight, ALIGN_RIGHT);
   }
   
   Sleep(500);
   
   // Read & encode
   string base64Image = "";
   int handle = FileOpen(filename, FILE_READ|FILE_BIN);
   if(handle != INVALID_HANDLE)
   {
      uchar file_buffer[];
      FileReadArray(handle, file_buffer);
      FileClose(handle);
      
      base64Image = Base64Encode(file_buffer);
      FileDelete(filename);
      Print("Screenshot captured for ", symbol, ". Base64 size: ", StringLen(base64Image));
   }
   else
   {
      Print("Failed to read screenshot file: ", GetLastError());
   }
   
   return base64Image;
}

//+------------------------------------------------------------------+
//| Capture Chart and Send to API                                    |
//+------------------------------------------------------------------+
void CaptureAndSend(ulong deal_ticket, string action)
{
   // 1. Get Trade Details
   string symbol = HistoryDealGetString(deal_ticket, DEAL_SYMBOL);
   long typeLong = HistoryDealGetInteger(deal_ticket, DEAL_TYPE);
   string type = (typeLong == DEAL_TYPE_BUY) ? "BUY" : "SELL";
   double volume = HistoryDealGetDouble(deal_ticket, DEAL_VOLUME);
   double price = HistoryDealGetDouble(deal_ticket, DEAL_PRICE);
   double profit = HistoryDealGetDouble(deal_ticket, DEAL_PROFIT);
   double commission = HistoryDealGetDouble(deal_ticket, DEAL_COMMISSION);
   double swap = HistoryDealGetDouble(deal_ticket, DEAL_SWAP);
   string comment = HistoryDealGetString(deal_ticket, DEAL_COMMENT);
   long positionId = HistoryDealGetInteger(deal_ticket, DEAL_POSITION_ID);

   // Get SL/TP from the open position (only available while position is open)
   double sl = 0, tp = 0;
   if(PositionSelectByTicket(positionId)) {
      sl = PositionGetDouble(POSITION_SL);
      tp = PositionGetDouble(POSITION_TP);
   }

   // 2. Take screenshot of the CORRECT chart for this symbol
   string base64Image = CaptureChartScreenshot(deal_ticket, symbol);
   string filename = "journal_" + IntegerToString(deal_ticket) + ".png";

   // 3. Determine price digits for the symbol  
   int digits = (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS);
   if(digits <= 0) digits = 5;

   // 4. Construct JSON Payload
   string json = "{";
   json += "\"action\":\"" + action + "\",";
   json += "\"ticket\":\"" + IntegerToString(deal_ticket) + "\",";
   json += "\"positionId\":\"" + IntegerToString(positionId) + "\",";
   json += "\"symbol\":\"" + symbol + "\",";
   json += "\"type\":\"" + type + "\",";
   json += "\"volume\":\"" + DoubleToString(volume, 2) + "\",";
   json += "\"price\":\"" + DoubleToString(price, digits) + "\",";
   json += "\"accountId\":\"" + IntegerToString(InpAccountId) + "\",";
   json += "\"profit\":\"" + DoubleToString(profit, 2) + "\",";
   json += "\"commission\":\"" + DoubleToString(commission, 2) + "\",";
   json += "\"swap\":\"" + DoubleToString(swap, 2) + "\",";
   json += "\"balance\":\"" + DoubleToString(AccountInfoDouble(ACCOUNT_BALANCE), 2) + "\",";
   json += "\"sl\":\"" + DoubleToString(sl, digits) + "\",";
   json += "\"tp\":\"" + DoubleToString(tp, digits) + "\",";
   json += "\"comment\":\"" + EscapeJsonString(comment) + "\",";
   json += "\"image_filename\":\"" + filename + "\",";
   json += "\"image_base64\":\"data:image/png;base64," + base64Image + "\"";
   json += "}";

   // 5. Send Request
   string headers = "Content-Type: application/json\r\n";
   if(InpApiSecret != "") {
      headers += "x-api-secret: " + InpApiSecret + "\r\n";
   }
   
   uchar body[];
   StringToCharArray(json, body, 0, WHOLE_ARRAY);
   // Remove the null terminator byte that MQL5 always appends
   int bodySize = ArraySize(body);
   if(bodySize > 0 && body[bodySize - 1] == 0)
      ArrayResize(body, bodySize - 1);
   
   char result_data[];
   string result_headers;
   
   Print("Sending ", action, " for ", symbol, " (ticket: ", deal_ticket, ") to API...");
   int res = WebRequest("POST", InpApiUrl, headers, 10000, body, result_data, result_headers);
   
   if(res == 200 || res == 201)
   {
      Print("Success: Sent ", action, " for ", symbol, " ticket ", deal_ticket);
   }
   else
   {
      Print("Error sending request: ", res);
      string result_str = CharArrayToString(result_data);
      Print("Server Response: ", result_str);
      
      if(res == -1) Print("Check: Is 'Allow WebRequest' enabled in Tools -> Options -> Expert Advisors?");
      if(res == 401) Print("Check: Does InpApiSecret match backend .env MT5_WEBHOOK_SECRET?");
   }
}

//+------------------------------------------------------------------+
//| Helper: Base64 Encode                                            |
//+------------------------------------------------------------------+
string Base64Encode(uchar &data[])
{
   string res = "";
   int len = ArraySize(data);
   int i = 0;
   
   while(i < len)
   {
      int b1 = (i < len) ? data[i++] : 0;
      int b2 = (i < len) ? data[i++] : 0;
      int b3 = (i < len) ? data[i++] : 0;
      
      int pad_count = 0;
      if (i > len) { pad_count = i - len; }
      
      int c1 = b1 >> 2;
      int c2 = ((b1 & 0x3) << 4) | (b2 >> 4);
      int c3 = ((b2 & 0xF) << 2) | (b3 >> 6);
      int c4 = b3 & 0x3F;
      
      res += StringSubstr(msg_base64_table, c1, 1);
      res += StringSubstr(msg_base64_table, c2, 1);
      res += (pad_count >= 2) ? "=" : StringSubstr(msg_base64_table, c3, 1);
      res += (pad_count >= 1) ? "=" : StringSubstr(msg_base64_table, c4, 1);
   }
   return res;
}

//+------------------------------------------------------------------+
//| Helper: Escape JSON String                                       |
//+------------------------------------------------------------------+
string EscapeJsonString(string str) {
   StringReplace(str, "\\", "\\\\");
   StringReplace(str, "\"", "\\\"");
   StringReplace(str, "\n", "\\n");
   StringReplace(str, "\r", "");
   StringReplace(str, "\t", "\\t");
   return str;
}
