import {
  getEntryOutcome,
  getEntryPair,
  getEntrySummary,
  getPlanStatus,
  getPlanStatusColor,
  getPlanStatusLabel,
  getResultColor,
} from '../utils/tradeUtils.js';
import { formatKampalaSmartDate } from '../utils/dateUtils.js';

export default function TradeEntryCard({
  entry,
  onClick,
  className = '',
  showPnl = true,
}) {
  const result = getEntryOutcome(entry);
  const pair = getEntryPair(entry);
  const planStatus = getPlanStatus(entry);

  return (
    <button
      type="button"
      className={`trade-card ${className}`.trim()}
      style={{ '--trade-accent': getResultColor(result) }}
      onClick={onClick}
    >
      <div className="trade-card__content">
        <div className="trade-card__main">
          <div className="trade-card__title-row">
            <h3>{pair}</h3>
            {entry?.mt5_ticket ? <span className="badge badge--mt5">MT5 Auto</span> : null}
            <span
              className="badge"
              style={{
                '--badge-background': `${getPlanStatusColor(planStatus)}20`,
                '--badge-color': getPlanStatusColor(planStatus),
              }}
            >
              {getPlanStatusLabel(planStatus)}
            </span>
          </div>
          <p>{getEntrySummary(entry)}</p>
        </div>
        <div className="trade-card__meta">
          <span
            className="result-pill"
            style={{
              '--result-background': `${getResultColor(result)}20`,
              '--result-color': getResultColor(result),
            }}
          >
            {result}
          </span>
          {showPnl && entry?.pnl != null ? (
            <strong
              className="trade-card__pnl"
              style={{ color: Number(entry.pnl) >= 0 ? '#16a34a' : '#dc2626' }}
            >
              {Number(entry.pnl) >= 0 ? '+' : ''}${Number(entry.pnl).toFixed(2)}
            </strong>
          ) : null}
          <span className="trade-card__date">
            {formatKampalaSmartDate(entry?.created_at)}
          </span>
        </div>
      </div>
    </button>
  );
}
