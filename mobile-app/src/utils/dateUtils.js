const KAMPALA_TIME_ZONE = 'Africa/Kampala';

const safeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
};

export const parseBackendTimestamp = (timestamp) => {
  if (!timestamp) {
    return null;
  }

  if (timestamp instanceof Date) {
    return new Date(timestamp.getTime());
  }

  const raw = String(timestamp).trim();

  if (!raw) {
    return null;
  }

  const nativeParsed = new Date(raw);
  if (!Number.isNaN(nativeParsed.getTime())) {
    return nativeParsed;
  }

  const normalized = raw.replace('T', ' ').replace(/Z$/, '').split('.')[0];
  const [datePart, timePart = '00:00:00'] = normalized.split(' ');

  if (!datePart) {
    return null;
  }

  const [yearStr, monthStr, dayStr] = datePart.split('-');
  const [hourStr = '00', minuteStr = '00', secondStr = '00'] =
    timePart.split(':');

  const year = safeNumber(yearStr);
  const month = safeNumber(monthStr) - 1;
  const day = safeNumber(dayStr);
  const hour = safeNumber(hourStr);
  const minute = safeNumber(minuteStr);
  const second = safeNumber(secondStr);

  if ([year, month, day].some((value) => Number.isNaN(value))) {
    return null;
  }

  return new Date(Date.UTC(year, month, day, hour, minute, second));
};

export const formatKampalaTime = (timestamp, options = {}) => {
  const date = parseBackendTimestamp(timestamp);
  if (!date) {
    return '';
  }

  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: KAMPALA_TIME_ZONE,
    ...options,
  });
};

export const formatKampalaDate = (timestamp, options = {}) => {
  const date = parseBackendTimestamp(timestamp);
  if (!date) {
    return '';
  }

  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: KAMPALA_TIME_ZONE,
    ...options,
  });
};

export const formatKampalaDateTime = (timestamp) => {
  const date = parseBackendTimestamp(timestamp);
  if (!date) {
    return '';
  }

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

  return `${dateStr} | ${timeStr}`;
};

export const formatKampalaSmartDate = (timestamp) => {
  const date = parseBackendTimestamp(timestamp);
  if (!date) {
    return '';
  }

  const now = new Date();
  const today = now.toLocaleDateString('en-US', {
    timeZone: KAMPALA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const entryDate = date.toLocaleDateString('en-US', {
    timeZone: KAMPALA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const yesterday = new Date(now.getTime() - 86400000).toLocaleDateString(
    'en-US',
    {
      timeZone: KAMPALA_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }
  );

  const timeStr = formatKampalaTime(date);

  if (entryDate === today) {
    return `Today | ${timeStr}`;
  }

  if (entryDate === yesterday) {
    return `Yesterday | ${timeStr}`;
  }

  const label = date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: KAMPALA_TIME_ZONE,
  });

  return `${label} | ${timeStr}`;
};

export const getKampalaDateKey = (timestamp) => {
  const date = parseBackendTimestamp(timestamp);
  if (!date) {
    return null;
  }

  const formatter = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: KAMPALA_TIME_ZONE,
  });

  return formatter.format(date);
};

export const getKampalaDate = (timestamp) => parseBackendTimestamp(timestamp);

export { KAMPALA_TIME_ZONE };
