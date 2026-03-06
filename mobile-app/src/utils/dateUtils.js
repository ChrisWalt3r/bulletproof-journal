const KAMPALA_TIME_ZONE = 'Africa/Kampala';

const safeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
};

/**
 * Parses a backend timestamp into a proper Date object.
 * Backend stores TIMESTAMPTZ in Postgres (UTC). Timestamps arrive as ISO strings
 * like "2026-03-05T14:30:00.000Z" or "2026-03-05 14:30:00".
 * We parse them correctly so that timezone-aware display functions can convert to Kampala time.
 * @param {string|Date} timestamp
 * @returns {Date|null}
 */
export const parseBackendTimestamp = (timestamp) => {
  if (!timestamp) return null;
  if (timestamp instanceof Date) return new Date(timestamp.getTime());

  const raw = String(timestamp).trim();
  if (!raw) return null;

  // Try native ISO parsing first (handles "2026-03-05T14:30:00.000Z" correctly)
  const nativeParsed = new Date(raw);
  if (!isNaN(nativeParsed.getTime())) {
    return nativeParsed;
  }

  // Fallback: manual parsing for non-standard formats like "2026-03-05 14:30:00"
  const normalized = raw.replace('T', ' ').replace(/Z$/, '').split('.')[0];
  const [datePart, timePart = '00:00:00'] = normalized.split(' ');
  if (!datePart) return null;

  const [yearStr, monthStr, dayStr] = datePart.split('-');
  if (!yearStr || !monthStr || !dayStr) return null;

  const [hourStr = '00', minuteStr = '00', secondStr = '00'] = timePart.split(':');

  const year = safeNumber(yearStr);
  const month = safeNumber(monthStr) - 1;
  const day = safeNumber(dayStr);
  const hour = safeNumber(hourStr);
  const minute = safeNumber(minuteStr);
  const second = safeNumber(secondStr);

  if ([year, month, day].some((value) => Number.isNaN(value))) {
    return null;
  }

  // If the original string had no timezone indicator, treat as UTC
  // (backend Postgres TIMESTAMPTZ always stores/returns UTC)
  return new Date(Date.UTC(year, month, day, hour, minute, second));
};

/**
 * Formats a timestamp as time in Kampala timezone (Africa/Kampala, UTC+3).
 * Example output: "02:30 PM"
 * @param {string|Date} timestamp
 * @param {Intl.DateTimeFormatOptions} [options]
 * @returns {string}
 */
export const formatKampalaTime = (timestamp, options = {}) => {
  const date = parseBackendTimestamp(timestamp);
  if (!date) return '';
  const formatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: KAMPALA_TIME_ZONE,
    ...options,
  };
  return date.toLocaleTimeString('en-US', formatOptions);
};

/**
 * Formats a timestamp as date in Kampala timezone (Africa/Kampala, UTC+3).
 * Example output: "March 5, 2026"
 * @param {string|Date} timestamp
 * @param {Intl.DateTimeFormatOptions} [options]
 * @returns {string}
 */
export const formatKampalaDate = (timestamp, options = {}) => {
  const date = parseBackendTimestamp(timestamp);
  if (!date) return '';
  const formatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: KAMPALA_TIME_ZONE,
    ...options,
  };
  return date.toLocaleDateString('en-US', formatOptions);
};

/**
 * Formats a timestamp as date + time in Kampala timezone.
 * Example output: "Mar 5, 2026 • 02:30 PM"
 * @param {string|Date} timestamp
 * @returns {string}
 */
export const formatKampalaDateTime = (timestamp) => {
  const date = parseBackendTimestamp(timestamp);
  if (!date) return '';
  const dateStr = date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: KAMPALA_TIME_ZONE,
  });
  const timeStr = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: KAMPALA_TIME_ZONE,
  });
  return `${dateStr} • ${timeStr}`;
};

/**
 * Formats a timestamp as a smart relative date + time in Kampala timezone.
 * Returns "Today • 02:30 PM", "Yesterday • 10:15 AM", or "Mar 5, 2026 • 02:30 PM"
 * @param {string|Date} timestamp
 * @returns {string}
 */
export const formatKampalaSmartDate = (timestamp) => {
  const date = parseBackendTimestamp(timestamp);
  if (!date) return '';

  // Get "today" and "yesterday" in Kampala timezone
  const now = new Date();
  const kampalaDateStr = now.toLocaleDateString('en-US', { timeZone: KAMPALA_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
  const entryDateStr = date.toLocaleDateString('en-US', { timeZone: KAMPALA_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });

  const yesterday = new Date(now.getTime() - 86400000);
  const yesterdayStr = yesterday.toLocaleDateString('en-US', { timeZone: KAMPALA_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });

  const timeStr = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: KAMPALA_TIME_ZONE,
  });

  if (entryDateStr === kampalaDateStr) {
    return `Today • ${timeStr}`;
  } else if (entryDateStr === yesterdayStr) {
    return `Yesterday • ${timeStr}`;
  } else {
    const dateLabel = date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: KAMPALA_TIME_ZONE,
    });
    return `${dateLabel} • ${timeStr}`;
  }
};

/**
 * Gets the Kampala-timezone date key (YYYY-MM-DD) for a timestamp.
 * Used by CalendarScreen to group entries by Kampala date.
 * @param {string|Date} timestamp
 * @returns {string|null}
 */
export const getKampalaDateKey = (timestamp) => {
  const date = parseBackendTimestamp(timestamp);
  if (!date) return null;
  // Get year/month/day in Kampala timezone
  const year = parseInt(date.toLocaleDateString('en-US', { year: 'numeric', timeZone: KAMPALA_TIME_ZONE }));
  const month = parseInt(date.toLocaleDateString('en-US', { month: '2-digit', timeZone: KAMPALA_TIME_ZONE }));
  const day = parseInt(date.toLocaleDateString('en-US', { day: '2-digit', timeZone: KAMPALA_TIME_ZONE }));
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

export const getKampalaDate = (timestamp) => parseBackendTimestamp(timestamp);

export { KAMPALA_TIME_ZONE };
