import { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { IoArrowBack, IoTrendingDown, IoTrendingUp } from 'react-icons/io5';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import LoadingScreen from '../components/LoadingScreen.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { useAccount } from '../context/AccountContext.jsx';
import { journalAPI } from '../services/api.js';
import { APP_TIME_ZONE, formatKampalaDateTime } from '../utils/dateUtils.js';
import {
  getEntryTradeDate,
  isEntryInCustomDateRange,
  parseCustomDateInput,
} from '../utils/tradeDates.js';

function GrowthTooltip({ active, payload }) {
  if (!active || !payload?.length) {
    return null;
  }

  const point = payload[0].payload;

  return (
    <div className="chart-tooltip">
      <strong>{point.symbol || 'Trade'}</strong>
      <span>{point.direction || 'Direction n/a'}</span>
      <span>{formatKampalaDateTime(point.tradeDateValue)}</span>
      <strong style={{ color: point.pnl >= 0 ? '#16a34a' : '#dc2626' }}>
        {point.pnl >= 0 ? '+' : ''}${point.pnl.toFixed(2)}
      </strong>
    </div>
  );
}

export default function AccountGrowthPage() {
  const navigate = useNavigate();
  const { currentAccount } = useAccount();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startDateInput, setStartDateInput] = useState('');
  const [endDateInput, setEndDateInput] = useState('');
  const [appliedStartDate, setAppliedStartDate] = useState(null);
  const [appliedEndDate, setAppliedEndDate] = useState(null);

  useEffect(() => {
    const fetchAllEntries = async () => {
      if (!currentAccount) {
        setEntries([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const allEntries = [];
        let page = 1;
        let totalPages = 1;

        do {
          const response = await journalAPI.getEntries(page, 100, '', currentAccount.id);
          allEntries.push(...(response.entries || []));
          totalPages = response.pagination?.pages || 1;
          page += 1;
        } while (page <= totalPages);

        const sortedEntries = allEntries.sort((left, right) => {
          const leftDate = getEntryTradeDate(left) || new Date(left.created_at);
          const rightDate = getEntryTradeDate(right) || new Date(right.created_at);
          return leftDate - rightDate;
        });
        setEntries(sortedEntries);
      } catch (error) {
        console.error('Failed to load growth data', error);
        window.alert('Failed to load account growth data.');
      } finally {
        setLoading(false);
      }
    };

    fetchAllEntries();
  }, [currentAccount]);

  const computed = useMemo(() => {
    const startingBalance = Number(currentAccount?.starting_balance) || 0;
    const closedTrades = entries.filter(
      (entry) => entry.pnl !== null && entry.pnl !== undefined
    );
    const totalPnL = closedTrades.reduce(
      (sum, entry) => sum + (Number(entry.pnl) || 0),
      0
    );
    const currentBalance = startingBalance + totalPnL;
    const growthPercentage =
      startingBalance > 0 ? (totalPnL / startingBalance) * 100 : 0;

    const visibleTrades = closedTrades.filter((entry) =>
      isEntryInCustomDateRange(entry, appliedStartDate, appliedEndDate)
    );

    const preFilterTrades = closedTrades.filter((entry) => {
      if (!appliedStartDate) {
        return false;
      }

      const tradeDate = getEntryTradeDate(entry);
      return tradeDate ? tradeDate < appliedStartDate : false;
    });

    let runningBalance =
      startingBalance +
      preFilterTrades.reduce((sum, entry) => sum + (Number(entry.pnl) || 0), 0);

    const chartPoints = visibleTrades.map((entry) => {
      const tradeDate = getEntryTradeDate(entry) || new Date(entry.created_at);
      runningBalance += Number(entry.pnl) || 0;
      return {
        balance: Number(runningBalance.toFixed(2)),
        label: tradeDate.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          timeZone: APP_TIME_ZONE,
        }),
        pnl: Number(entry.pnl) || 0,
        direction: entry.direction,
        symbol: entry.symbol,
        tradeDateValue: tradeDate.toISOString(),
      };
    });

    const wins = visibleTrades.filter((entry) => Number(entry.pnl) > 0).length;
    const losses = visibleTrades.filter((entry) => Number(entry.pnl) < 0).length;
    const totalTrades = visibleTrades.length;

    return {
      chartPoints,
      stats: {
        startBalance: startingBalance,
        currentBalance,
        netProfit: totalPnL,
        growthPercentage,
        totalTrades,
        winRate: totalTrades > 0 ? (wins / totalTrades) * 100 : 0,
        wins,
        losses,
      },
    };
  }, [appliedEndDate, appliedStartDate, currentAccount, entries]);

  const applyFilter = () => {
    const startDate = parseCustomDateInput(startDateInput);
    const endDate = parseCustomDateInput(endDateInput);

    if (startDateInput.trim() && startDate === undefined) {
      window.alert('Use YYYY-MM-DD for the start date.');
      return;
    }

    if (endDateInput.trim() && endDate === undefined) {
      window.alert('Use YYYY-MM-DD for the end date.');
      return;
    }

    if (startDate && endDate && startDate > endDate) {
      window.alert('Start date must be before end date.');
      return;
    }

    setAppliedStartDate(startDate || null);
    setAppliedEndDate(endDate || null);
  };

  if (loading) {
    return <LoadingScreen message="Loading growth curve..." compact />;
  }

  if (!currentAccount) {
    return (
      <div className="page">
        <PageHeader
          eyebrow="Equity Curve"
          title="Account growth"
          subtitle="Activate an account to load its closed-trade balance history."
        />
        <EmptyState
          title="No active account"
          description="Select an account in settings first, then revisit this page."
        />
      </div>
    );
  }

  const { stats, chartPoints } = computed;

  return (
    <div className="page">
      <PageHeader
        eyebrow="Equity Curve"
        title="Account growth"
        subtitle="Review your equity curve with responsive filters and hoverable trade detail."
        actions={
          <button type="button" className="ghost-button" onClick={() => navigate(-1)}>
            <IoArrowBack size={18} />
            Back
          </button>
        }
      />

      <section className="dashboard-hero">
        <article className="hero-card hero-card--primary">
          <div className="hero-card__icon">
            {stats.growthPercentage >= 0 ? <IoTrendingUp size={24} /> : <IoTrendingDown size={24} />}
          </div>
          <span>Current Balance</span>
          <strong>${stats.currentBalance.toFixed(2)}</strong>
          <p>
            {stats.growthPercentage >= 0 ? '+' : ''}
            {stats.growthPercentage.toFixed(2)}% from starting balance
          </p>
        </article>

        <article className="hero-card">
          <div className="hero-card__icon">
            <IoTrendingUp size={24} />
          </div>
          <span>Net Profit</span>
          <strong
            style={{ color: stats.netProfit >= 0 ? '#16a34a' : '#dc2626' }}
          >
            {stats.netProfit >= 0 ? '+' : ''}${stats.netProfit.toFixed(2)}
          </strong>
          <p>All closed trades for the active account.</p>
        </article>

        <article className="hero-card">
          <div className="hero-card__icon">
            <IoTrendingUp size={24} />
          </div>
          <span>Win Rate</span>
          <strong>{stats.winRate.toFixed(1)}%</strong>
          <p>
            {stats.wins} wins / {stats.losses} losses across {stats.totalTrades} trades.
          </p>
        </article>
      </section>

      <section className="surface-card">
        <div className="filter-grid">
          <label className="field">
            <span>From</span>
            <input
              type="date"
              value={startDateInput}
              onChange={(event) => setStartDateInput(event.target.value)}
            />
          </label>
          <label className="field">
            <span>To</span>
            <input
              type="date"
              value={endDateInput}
              onChange={(event) => setEndDateInput(event.target.value)}
            />
          </label>
          <div className="button-row">
            <button type="button" className="primary-button" onClick={applyFilter}>
              Apply Filter
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={() => {
                setStartDateInput('');
                setEndDateInput('');
                setAppliedStartDate(null);
                setAppliedEndDate(null);
              }}
            >
              Clear
            </button>
          </div>
        </div>
      </section>

      <section className="surface-card chart-panel">
        <div className="section-heading">
          <div>
            <span className="section-heading__eyebrow">Chart</span>
            <h2>Equity curve</h2>
            <p className="chart-panel__subtitle">
              View realized balance movement for your selected custom date range.
            </p>
          </div>
          <div className="chart-panel__summary">
            <span>Starting balance</span>
            <strong>${stats.startBalance.toFixed(2)}</strong>
          </div>
        </div>

        {chartPoints.length > 0 ? (
          <div className="chart-shell">
            <ResponsiveContainer width="100%" height={360}>
              <LineChart data={chartPoints}>
                <CartesianGrid strokeDasharray="4 4" stroke="rgba(19, 34, 56, 0.08)" />
                <XAxis dataKey="label" stroke="#7a8798" tickLine={false} axisLine={false} />
                <YAxis
                  stroke="#7a8798"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `$${value}`}
                />
                <Tooltip content={<GrowthTooltip />} />
                <Line
                  type="monotone"
                  dataKey="balance"
                  stroke={stats.netProfit >= 0 ? '#22c55e' : '#ef4444'}
                  strokeWidth={3}
                  dot={{ r: 4, strokeWidth: 0 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState
            title="No closed trades yet"
            description="This chart appears once the selected account has trades with realized PnL."
          />
        )}
      </section>
    </div>
  );
}
