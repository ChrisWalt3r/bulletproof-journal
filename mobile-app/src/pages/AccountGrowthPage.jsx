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
import { IoTrendingDown, IoTrendingUp } from 'react-icons/io5';
import PageHeader from '../components/PageHeader.jsx';
import LoadingScreen from '../components/LoadingScreen.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { useAccount } from '../context/AccountContext.jsx';
import { journalAPI } from '../services/api.js';
import { formatKampalaDateTime } from '../utils/dateUtils.js';

const TIME_FILTERS = [
  { key: 'WEEK', label: '1W' },
  { key: 'MONTH', label: '1M' },
  { key: 'YEAR', label: '1Y' },
  { key: 'ALL', label: 'All' },
];

const getFilterStartDate = (filterKey) => {
  const now = new Date();

  if (filterKey === 'WEEK') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
  }

  if (filterKey === 'MONTH') {
    return new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
  }

  if (filterKey === 'YEAR') {
    return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  }

  return null;
};

function GrowthTooltip({ active, payload }) {
  if (!active || !payload?.length) {
    return null;
  }

  const point = payload[0].payload;

  return (
    <div className="chart-tooltip">
      <strong>{point.symbol || 'Trade'}</strong>
      <span>{point.direction || 'Direction n/a'}</span>
      <span>{formatKampalaDateTime(point.updatedAt)}</span>
      <strong style={{ color: point.pnl >= 0 ? '#16a34a' : '#dc2626' }}>
        {point.pnl >= 0 ? '+' : ''}${point.pnl.toFixed(2)}
      </strong>
    </div>
  );
}

export default function AccountGrowthPage() {
  const { currentAccount } = useAccount();
  const [timeFilter, setTimeFilter] = useState('ALL');
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAllEntries = async () => {
      if (!currentAccount) {
        setEntries([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const response = await journalAPI.getEntries(1, 500, '', currentAccount.id);
        const sortedEntries = (response.entries || []).sort(
          (left, right) => new Date(left.updated_at) - new Date(right.updated_at)
        );
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

    const filterStart = getFilterStartDate(timeFilter);
    const preFilterTrades = filterStart
      ? closedTrades.filter((entry) => new Date(entry.updated_at) < filterStart)
      : [];
    const visibleTrades = filterStart
      ? closedTrades.filter((entry) => new Date(entry.updated_at) >= filterStart)
      : closedTrades;

    let runningBalance =
      startingBalance +
      preFilterTrades.reduce((sum, entry) => sum + (Number(entry.pnl) || 0), 0);

    const chartPoints = visibleTrades.map((entry) => {
      runningBalance += Number(entry.pnl) || 0;
      return {
        balance: Number(runningBalance.toFixed(2)),
        label: new Date(entry.updated_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          timeZone: 'Africa/Kampala',
        }),
        pnl: Number(entry.pnl) || 0,
        direction: entry.direction,
        symbol: entry.symbol,
        updatedAt: entry.updated_at,
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
  }, [currentAccount, entries, timeFilter]);

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
        <div className="section-heading">
          <div>
            <span className="section-heading__eyebrow">Chart</span>
            <h2>Equity curve</h2>
          </div>
          <div className="filter-row">
            {TIME_FILTERS.map((filter) => (
              <button
                key={filter.key}
                type="button"
                className={`filter-chip ${timeFilter === filter.key ? 'is-active' : ''}`}
                onClick={() => setTimeFilter(filter.key)}
              >
                {filter.label}
              </button>
            ))}
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
