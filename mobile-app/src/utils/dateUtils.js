const KAMPALA_TIME_ZONE = 'Africa/Kampala';

const safeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
};

/**
 * Parses a backend timestamp (stored as "YYYY-MM-DD HH:mm:ss" in Kampala time) as a local Date instance.
 * The backend now stores timestamps directly in Kampala time, so we parse them as-is without UTC conversion.
 * @param {string|Date} timestamp
 * @returns {Date|null}
 */
export const parseBackendTimestamp = (timestamp) => {
  if (!timestamp) return null;
  if (timestamp instanceof Date) return new Date(timestamp.getTime());

  const raw = String(timestamp).trim();
  if (!raw) return null;

  const normalized = raw
    .replace('T', ' ')
    .replace(/Z$/, '')
    .split('.')[0];

  const [datePart, timePart = '00:00:00'] = normalized.split(' ');
  if (!datePart) return null;

  const [yearStr, monthStr, dayStr] = datePart.split('-');
  if (!yearStr || !monthStr || !dayStr) return null;

  const [hourStr = '00', minuteStr = '00', secondStr = '00'] = timePart.split(':');

  const year = safeNumber(yearStr);
  const month = safeNumber(monthStr) - 1; // JS months are 0-indexed
  const day = safeNumber(dayStr);
  const hour = safeNumber(hourStr);
  const minute = safeNumber(minuteStr);
  const second = safeNumber(secondStr);

  if ([year, month, day].some((value) => Number.isNaN(value))) {
    const fallbackDate = new Date(raw);
    return Number.isNaN(fallbackDate.getTime()) ? null : fallbackDate;
  }

  // Parse as local time (Kampala time) since backend now stores in Kampala time directly
  return new Date(year, month, day, hour, minute, second);
};

/**
 * Formats a timestamp into Kampala time using toLocaleTimeString.
 * Since timestamps are now stored in Kampala time, we just format them directly.
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
    ...options,
  };
  return date.toLocaleTimeString('en-US', formatOptions);
};

/**
 * Formats a timestamp into Kampala date using toLocaleDateString.
 * Since timestamps are now stored in Kampala time, we just format them directly.
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
    ...options,
  };
  return date.toLocaleDateString('en-US', formatOptions);
};

export const getKampalaDate = (timestamp) => parseBackendTimestamp(timestamp);

export { KAMPALA_TIME_ZONE };
