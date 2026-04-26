import { parseBackendTimestamp } from './dateUtils.js';

const TRADE_DATE_REGEX =
  /^Date:\s*[A-Za-z]+,\s*([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})(?:,?\s*(?:at\s*)?(\d{1,2}):(\d{2}))?/im;

const MONTH_INDEX = {
  January: 0,
  February: 1,
  March: 2,
  April: 3,
  May: 4,
  June: 5,
  July: 6,
  August: 7,
  September: 8,
  October: 9,
  November: 10,
  December: 11,
};

export const extractTradeDateFromContent = (content) => {
  if (!content || typeof content !== 'string') {
    return null;
  }

  const match = content.match(TRADE_DATE_REGEX);
  if (!match) {
    return null;
  }

  const monthIndex = MONTH_INDEX[match[1]];
  if (monthIndex === undefined) {
    return null;
  }

  const day = Number(match[2]);
  const year = Number(match[3]);
  const hour = match[4] != null ? Number(match[4]) : 0;
  const minute = match[5] != null ? Number(match[5]) : 0;

  if (
    Number.isNaN(day) ||
    Number.isNaN(year) ||
    Number.isNaN(hour) ||
    Number.isNaN(minute)
  ) {
    return null;
  }

  return new Date(Date.UTC(year, monthIndex, day, hour, minute));
};

export const getEntryTradeDate = (entry) => {
  if (!entry) {
    return null;
  }

  return extractTradeDateFromContent(entry.content) || parseBackendTimestamp(entry.created_at);
};

export const formatTradeDateTitle = (entryOrDate) => {
  const date =
    entryOrDate instanceof Date ? entryOrDate : getEntryTradeDate(entryOrDate);
  if (!date) {
    return 'Unknown Date';
  }

  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Africa/Kampala',
  });
};

export const parseCustomDateInput = (value) => {
  if (!value || typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return undefined;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if ([year, month, day].some((part) => Number.isNaN(part))) {
    return undefined;
  }

  return new Date(Date.UTC(year, month - 1, day));
};

export const isEntryInCustomDateRange = (entry, startDate, endDate) => {
  const tradeDate = getEntryTradeDate(entry);

  if (!tradeDate) {
    return false;
  }

  if (startDate && tradeDate < startDate) {
    return false;
  }

  if (endDate) {
    const dayEnd = new Date(endDate.getTime());
    dayEnd.setUTCHours(23, 59, 59, 999);

    if (tradeDate > dayEnd) {
      return false;
    }
  }

  return true;
};