import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IoCalendarOutline,
  IoCheckmarkCircle,
  IoCloseCircle,
  IoList,
  IoRemoveCircle,
  IoTrophy,
  IoTrendingUp,
  IoWalletOutline,
} from 'react-icons/io5';
import PageHeader from '../components/PageHeader.jsx';
import LoadingScreen from '../components/LoadingScreen.jsx';
import EmptyState from '../components/EmptyState.jsx';
import TradeEntryCard from '../components/TradeEntryCard.jsx';
import { useAccount } from '../context/AccountContext.jsx';
import { journalAPI } from '../services/api.js';
import {
  extractContentDate,
  getEntryOutcome,
  getEntryPair,
} from '../utils/tradeUtils.js';
import { parseBackendTimestamp } from '../utils/dateUtils.js';

const initialAnalytics = {
  totalTrades: 0,
  winRate: 0,
  thisWeekTrades: 0,
  wins: 0,
  losses: 0,
  breakevens: 0,
  recentTrades: [],
};

export default function HomePage() {
  const navigate = useNavigate();
  const { currentAccount, accounts, isLoading: accountLoading } = useAccount();
  const [analytics, setAnalytics] = useState(initialAnalytics);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAnalytics = async () => {
      if (!currentAccount) {
        setAnalytics(initialAnalytics);
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        await journalAPI.syncMt5Entries(currentAccount.id);
        const response = await journalAPI.getEntries(1, 100, '', currentAccount.id);
        const entries = response.entries || [];
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        let wins = 0;
        let losses = 0;
        let breakevens = 0;
        let thisWeekTrades = 0;

        entries.forEach((entry) => {
          const result = getEntryOutcome(entry);
          if (result === 'WIN') wins += 1;
          if (result === 'LOSS') losses += 1;
          if (result === 'BREAKEVEN') breakevens += 1;

          const entryDate =
            extractContentDate(entry.content) || parseBackendTimestamp(entry.created_at);
          if (entryDate && entryDate >= weekAgo) {
            thisWeekTrades += 1;
          }
        });

        const totalTrades = wins + losses + breakevens;
        const winRate = totalTrades > 0 ? Math.round((wins / totalTrades) * 100) : 0;

        setAnalytics({
          totalTrades,
          winRate,
          thisWeekTrades,
          wins,
          losses,
          breakevens,
          recentTrades: entries.slice(0, 5),
        });
      } catch (error) {
        console.error('Failed to load home analytics', error);
        window.alert('Failed to load trading analytics.');
      } finally {
        setLoading(false);
      }
    };

    if (!accountLoading) {
      loadAnalytics();
    }
  }, [accountLoading, currentAccount]);

  if (loading || accountLoading) {
    return <LoadingScreen message="Loading trading analytics..." compact />;
  }

  if (!currentAccount) {
    const hasAccounts = accounts.length > 0;

    return (
      <div className="page page--home">
        <PageHeader
          eyebrow="Dashboard"
          title="Forex trading dashboard"
          subtitle={
            hasAccounts
              ? 'You already have accounts. Activate one from settings to load your trading data.'
              : 'Create your first trading account to unlock analytics, journaling, and review pages.'
          }
        />

        <EmptyState
          icon={<IoWalletOutline size={34} />}
          title={hasAccounts ? 'Choose an active account' : 'Start your trading journey'}
          description={
            hasAccounts
              ? 'Select one of your saved accounts in Settings, then the dashboard will populate with your latest stats.'
              : 'Create an account in Settings so the web app can mirror your trading journal and analytics.'
          }
          action={
            <button
              type="button"
              className="primary-button"
              onClick={() => navigate('/settings')}
            >
              {hasAccounts ? 'Open Settings' : 'Create Account'}
            </button>
          }
        />
      </div>
    );
  }

  const quickActions = [
    {
      title: 'Equity Curve',
      description: 'Visualize capital growth over closed trades.',
      icon: <IoTrendingUp size={20} />,
      to: '/account-growth',
    },
    {
      title: 'View All Trades',
      description: 'Search, filter, and review every journal entry.',
      icon: <IoList size={20} />,
      to: '/journal',
    },
    {
      title: 'Trading Calendar',
      description: 'Track outcomes and plan adherence by day.',
      icon: <IoCalendarOutline size={20} />,
      to: '/calendar',
    },
  ];

  const breakdown = [
    {
      label: 'Wins',
      count: analytics.wins,
      icon: <IoCheckmarkCircle size={18} />,
      filter: 'WIN',
      color: '#22c55e',
    },
    {
      label: 'Losses',
      count: analytics.losses,
      icon: <IoCloseCircle size={18} />,
      filter: 'LOSS',
      color: '#ef4444',
    },
    {
      label: 'Breakeven',
      count: analytics.breakevens,
      icon: <IoRemoveCircle size={18} />,
      filter: 'BREAKEVEN',
      color: '#3b82f6',
    },
  ];

  return (
    <div className="page page--home">
      <PageHeader
        eyebrow="Dashboard"
        title="Trading Dashboard"
        subtitle="Monitor your forex performance"
        variant="hero"
        aside={
          <div className="account-indicator" style={{ '--account-color': currentAccount.color || '#4a90e2' }}>
            <span className="account-indicator__dot" />
            <span>{currentAccount.name}</span>
          </div>
        }
      />

      <section className="dashboard-hero">
        <article className="hero-card hero-card--primary">
          <div className="hero-card__icon">
            <IoTrendingUp size={24} />
          </div>
          <span>Total Trades</span>
          <strong>{analytics.totalTrades}</strong>
        </article>

        <article className="hero-card hero-card--success">
          <div className="hero-card__icon">
            <IoTrophy size={24} />
          </div>
          <span>Win Rate</span>
          <strong>{analytics.winRate}%</strong>
        </article>

        <article className="hero-card">
          <div className="hero-card__icon">
            <IoCalendarOutline size={24} />
          </div>
          <span>This Week</span>
          <strong>{analytics.thisWeekTrades}</strong>
        </article>
      </section>

      <section className="dashboard-grid">
        <article className="surface-card surface-card--analysis">
          <div className="section-heading">
            <div>
              <span className="section-heading__eyebrow">Trade Analysis</span>
              <h2>Outcome breakdown</h2>
            </div>
          </div>

          <div className="breakdown-grid">
            {breakdown.map((item) => (
              <button
                key={item.label}
                type="button"
                className="breakdown-card"
                onClick={() => navigate(`/journal?filter=${item.filter}`)}
              >
                <span
                  className="breakdown-card__icon"
                  style={{ background: `${item.color}18`, color: item.color }}
                >
                  {item.icon}
                </span>
                <strong>{item.count}</strong>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </article>

        <article className="surface-card">
          <div className="section-heading">
            <div>
              <span className="section-heading__eyebrow">Quick Actions</span>
              <h2>Quick actions</h2>
            </div>
          </div>

          <div className="quick-actions">
            {quickActions.map((action) => (
              <button
                key={action.title}
                type="button"
                className="quick-action-card"
                onClick={() => navigate(action.to)}
              >
                <span className="quick-action-card__icon">{action.icon}</span>
                <div>
                  <strong>{action.title}</strong>
                  <p>{action.description}</p>
                </div>
              </button>
            ))}
          </div>
        </article>
      </section>

      <section className="surface-card">
        <div className="section-heading">
          <div>
            <span className="section-heading__eyebrow">Recent Trades</span>
            <h2>Recent trades</h2>
          </div>
          <button
            type="button"
            className="secondary-button"
            onClick={() => navigate('/journal')}
          >
            View All
          </button>
        </div>

        {analytics.recentTrades.length > 0 ? (
          <div className="trade-card-list">
            {analytics.recentTrades.map((entry) => (
              <TradeEntryCard
                key={entry.id}
                entry={{
                  ...entry,
                  symbol: entry.symbol || getEntryPair(entry),
                }}
                onClick={() => navigate(`/journal/${entry.id}`)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No trades yet"
            description="As soon as trades land in the journal, your most recent entries will show up here."
          />
        )}
      </section>
    </div>
  );
}
