import { APP_TIME_ZONE, formatKampalaDateTime } from './dateUtils.js';
import { extractTradeDateFromContent } from './tradeDates.js';

export const PAIRS = [
  'EURUSD',
  'GBPUSD',
  'NZDUSD',
  'AUDUSD',
  'XAUUSD',
  'USDJPY',
  'USDCAD',
  'USDCHF',
];

export const TRADE_DIRECTIONS = ['BUY', 'SELL'];
export const TRADE_RESULTS = ['WIN', 'BREAKEVEN', 'LOSS'];

export const getCurrentKampalaDateLabel = () =>
  new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: APP_TIME_ZONE,
  });

export const formatManualTradeDateLabel = (value) => {
  const parsed = value ? new Date(value) : new Date();
  const date = Number.isNaN(parsed.getTime()) ? new Date() : parsed;

  return date.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: APP_TIME_ZONE,
  });
};

export const extractContentDate = (content) =>
  extractTradeDateFromContent(content);

const extractLabeledValue = (content, label) => {
  if (!content || typeof content !== 'string') {
    return '';
  }

  const pattern = new RegExp(`^${label}\\s*:\\s*(.+)$`, 'im');
  return content.match(pattern)?.[1]?.trim() || '';
};

export const getEntryPair = (entryOrContent, symbol) => {
  if (typeof entryOrContent === 'object' && entryOrContent !== null) {
    if (entryOrContent.symbol) {
      return entryOrContent.symbol;
    }
    return getEntryPair(entryOrContent.content || '', entryOrContent.symbol);
  }

  if (symbol) {
    return symbol;
  }

  const content = entryOrContent;
  if (!content || typeof content !== 'string') {
    return 'Unknown';
  }

  const labeledPair = extractLabeledValue(content, 'Pair');
  if (labeledPair) {
    return labeledPair;
  }

  const lines = content.split('\n');
  let inPairSection = false;

  for (const line of lines) {
    if (line.includes('### Pair:')) {
      inPairSection = true;
      continue;
    }

    if (inPairSection && line.includes('Trade:')) {
      break;
    }

    if (inPairSection && line.includes('- [x]')) {
      const match = line.match(/- \[x\]\s*(GOLD|[A-Z]{6,7})/i);
      if (match) {
        return match[1];
      }
    }
  }

  const titleMatch = content.match(/MT5(?:\s+Exit)?:\s+(?:BUY|SELL)?\s*([A-Z]+)/i);
  if (titleMatch) {
    return titleMatch[1];
  }

  return 'Unknown';
};

export const getEntryOutcome = (entry) => {
  if (entry?.pnl != null && entry?.pnl !== '') {
    const pnl = Number(entry.pnl);
    if (!Number.isFinite(pnl)) {
      return 'UNKNOWN';
    }

    if (pnl > 0.01) {
      return 'WIN';
    }
    if (pnl < -0.01) {
      return 'LOSS';
    }
    return 'BREAKEVEN';
  }

  if (entry?.mt5_ticket) {
    return 'OPEN';
  }

  const content = entry?.content;
  if (!content || typeof content !== 'string') {
    return 'UNKNOWN';
  }

  const labeledOutcome = extractLabeledValue(content, 'Outcome').toUpperCase();
  if (['WIN', 'LOSS', 'BREAKEVEN'].includes(labeledOutcome)) {
    return labeledOutcome;
  }

  if (content.includes('- [x] WIN')) {
    return 'WIN';
  }
  if (content.includes('- [x] LOSS')) {
    return 'LOSS';
  }
  if (content.includes('- [x] BREAKEVEN')) {
    return 'BREAKEVEN';
  }
  return 'UNKNOWN';
};

export const getResultColor = (result) => {
  switch (result) {
    case 'WIN':
      return '#50c878';
    case 'LOSS':
      return '#ff6b6b';
    case 'BREAKEVEN':
      return '#4a90e2';
    case 'OPEN':
      return '#ff9f43';
    default:
      return '#6b7280';
  }
};

export const getPlanStatus = (entry) => {
  if (entry?.following_plan === true || entry?.following_plan === 'true') {
    return 'FOLLOWED';
  }

  if (entry?.following_plan === false || entry?.following_plan === 'false') {
    return 'NOT_FOLLOWED';
  }

  return 'NOT_RECORDED';
};

export const getPlanStatusLabel = (status) => {
  switch (status) {
    case 'FOLLOWED':
      return 'On Plan';
    case 'NOT_FOLLOWED':
      return 'Off Plan';
    default:
      return 'Needs Review';
  }
};

export const getPlanStatusColor = (status) => {
  switch (status) {
    case 'FOLLOWED':
      return '#22c55e';
    case 'NOT_FOLLOWED':
      return '#ef4444';
    default:
      return '#f59e0b';
  }
};

export const normalizeGalleryImages = (value) => {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
};

export const parseManualEntryContent = (content) => {
  if (!content || typeof content !== 'string') {
    return {
      selectedPair: '',
      tradeDirection: '',
      tradeResult: '',
      riskReward: '',
      pnl: '',
      pnlPercentage: '',
      planStatus: '',
      emotionalState: '',
      notes: '',
    };
  }

  const selectedPair = getEntryPair(content);
  const tradeDirectionLabel = extractLabeledValue(content, 'Direction').toUpperCase();
  const tradeResultLabel = extractLabeledValue(content, 'Outcome').toUpperCase();
  const tradeDirection = ['BUY', 'SELL'].includes(tradeDirectionLabel)
    ? tradeDirectionLabel
    : content.includes('- [x] BUY')
    ? 'BUY'
    : content.includes('- [x] SELL')
      ? 'SELL'
      : '';
  const tradeResult = ['WIN', 'LOSS', 'BREAKEVEN'].includes(tradeResultLabel)
    ? tradeResultLabel
    : content.includes('- [x] WIN')
    ? 'WIN'
    : content.includes('- [x] LOSS')
      ? 'LOSS'
      : content.includes('- [x] BREAKEVEN')
        ? 'BREAKEVEN'
        : '';
  const labeledRiskReward = extractLabeledValue(content, 'Risk : Reward');
  const riskRewardMatch = content.match(/#####\s*RR\s*>\s*([^:\n]+?)\s*:/i);
  const labeledPnl = extractLabeledValue(content, 'P&L');
  const labeledPnlPercentage = extractLabeledValue(content, 'P&L %').replace('%', '');
  const labeledPlanStatus = extractLabeledValue(content, 'Plan Status').toUpperCase();
  const labeledEmotionalState = extractLabeledValue(content, 'Emotional State');
  const notesMatch = content.match(/Notes:\n>\s*([\s\S]*)$/);

  return {
    selectedPair,
    tradeDirection,
    tradeResult,
    riskReward:
      labeledRiskReward || riskRewardMatch?.[1]?.replace(/_/g, '').trim() || '',
    pnl: labeledPnl,
    pnlPercentage: labeledPnlPercentage,
    planStatus: labeledPlanStatus,
    emotionalState: labeledEmotionalState,
    notes: notesMatch?.[1]?.trim() || '',
  };
};

export const buildManualEntryContent = ({
  selectedPair,
  tradeDirection,
  tradeResult,
  riskReward,
  pnl,
  pnlPercentage,
  planStatus,
  emotionalState,
  notes,
  tradeDateTime,
  hasSetupImage,
  hasExecutionImage,
  additionalImageCount,
}) => {
  const normalizedPair = selectedPair?.trim() || 'Unknown';
  const normalizedPnl = pnl == null || pnl === '' ? '_' : String(pnl).trim();
  const normalizedPnlPercentage =
    pnlPercentage == null || pnlPercentage === '' ? '_' : String(pnlPercentage).trim();
  const normalizedPlanStatus = planStatus || '_';
  const normalizedEmotionalState = emotionalState?.trim() || '_';
  const normalizedAdditionalImages = Number(additionalImageCount) || 0;

  let content = `Date: ${formatManualTradeDateLabel(tradeDateTime)}\n`;
  content += `Pair: ${normalizedPair}\n`;
  content += `Direction: ${tradeDirection || '_'}\n`;
  content += `Outcome: ${tradeResult || '_'}\n`;
  content += `Risk : Reward: ${riskReward || '_'}\n`;
  content += `P&L: ${normalizedPnl}\n`;
  content += `P&L %: ${normalizedPnlPercentage}%\n`;
  content += `Plan Status: ${normalizedPlanStatus}\n`;
  content += `Emotional State: ${normalizedEmotionalState}\n`;
  content += `SETUP IMAGE: ${hasSetupImage ? '[Image Attached]' : '[No Image]'}\n`;
  content += `EXECUTION TF IMAGE: ${hasExecutionImage ? '[Image Attached]' : '[No Image]'}\n`;
  content += `ADDITIONAL IMAGES: ${normalizedAdditionalImages}\n\n`;

  content += '### Pair:\n';

  PAIRS.forEach((pair) => {
    content += `- [${normalizedPair.toUpperCase() === pair ? 'x' : ' '}] ${pair}\n`;
  });

  content += '\nTrade:\n';

  TRADE_DIRECTIONS.forEach((direction) => {
    content += `- [${tradeDirection === direction ? 'x' : ' '}] ${direction}\n`;
  });

  content += `\n##### RR > ${riskReward || '_'}:\n\n`;

  TRADE_RESULTS.forEach((result) => {
    content += `- [${tradeResult === result ? 'x' : ' '}] ${result}\n`;
  });

  if (notes?.trim()) {
    content += `\nNotes:\n> ${notes.trim()}\n`;
  }

  return content;
};

export const getEntrySummary = (entry) => {
  if (!entry?.content) {
    return 'No content available';
  }

  const firstLine = entry.content.split('\n')[0]?.replace('Date: ', '').trim();
  if (entry?.mt5_ticket && firstLine?.startsWith('Automated Entry:')) {
    return firstLine.replace('Automated Entry:', 'Auto Entry:').trim();
  }

  return firstLine || formatKampalaDateTime(entry.created_at);
};

export const formatMoney = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return '$0.00';
  }

  return `${number >= 0 ? '+' : '-'}$${Math.abs(number).toFixed(2)}`;
};

const parseNumericString = (value) => {
  if (value == null) {
    return null;
  }

  const cleaned = String(value).replace(/[$,%\s,]/g, '').trim();
  if (!cleaned || cleaned === '_') {
    return null;
  }

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
};

export const getPnlValue = (entry) => {
  if (!entry) {
    return null;
  }

  const directPnl = parseNumericString(entry.pnl);
  if (directPnl !== null) {
    return directPnl;
  }

  const parsedContent = parseManualEntryContent(entry.content || '');
  return parseNumericString(parsedContent.pnl);
};

export const getPnlPercentageValue = (entry) => {
  if (!entry) {
    return null;
  }

  if (
    entry.pnl_percentage !== null &&
    entry.pnl_percentage !== undefined &&
    entry.pnl_percentage !== ''
  ) {
    const stored = parseNumericString(entry.pnl_percentage);
    if (stored !== null) {
      return stored;
    }
  }

  const parsedContent = parseManualEntryContent(entry.content || '');
  const labeledPercentage = parseNumericString(parsedContent.pnlPercentage);
  if (labeledPercentage !== null) {
    return labeledPercentage;
  }

  const pnl = getPnlValue(entry);
  const balance = Number(entry.balance);

  if (!Number.isFinite(pnl) || !Number.isFinite(balance)) {
    return null;
  }

  const priorBalance = balance - pnl;
  if (!Number.isFinite(priorBalance) || Math.abs(priorBalance) < 0.000001) {
    return null;
  }

  return (pnl / priorBalance) * 100;
};

export const formatPnlPercentage = (entry) => {
  const value = getPnlPercentageValue(entry);
  if (!Number.isFinite(value)) {
    return 'N/A';
  }

  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
};

export const getRiskRewardValue = (entry) => {
  const parsed = parseManualEntryContent(entry?.content || '');
  if (parsed.riskReward) {
    return parsed.riskReward;
  }

  const structuredRiskReward =
    entry?.risk_reward_ratio ?? entry?.risk_reward ?? entry?.rr ?? null;
  if (structuredRiskReward !== null && structuredRiskReward !== undefined) {
    const normalized = String(structuredRiskReward).trim();
    if (normalized) {
      return normalized;
    }
  }

  const entryPrice = Number(entry?.entry_price);
  const stopLoss = Number(entry?.stop_loss);
  const takeProfit = Number(entry?.take_profit);

  if (
    !Number.isFinite(entryPrice) ||
    !Number.isFinite(stopLoss) ||
    !Number.isFinite(takeProfit)
  ) {
    return '';
  }

  const direction = entry?.direction || parsed.tradeDirection;
  const reward =
    direction === 'SELL' ? entryPrice - takeProfit : takeProfit - entryPrice;
  const risk =
    direction === 'SELL' ? stopLoss - entryPrice : entryPrice - stopLoss;

  if (risk <= 0) {
    return '';
  }

  return (reward / risk).toFixed(2);
};
