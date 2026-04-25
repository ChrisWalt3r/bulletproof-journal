import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { IoArrowBack, IoSearch } from 'react-icons/io5';
import PageHeader from '../components/PageHeader.jsx';
import LoadingScreen from '../components/LoadingScreen.jsx';
import EmptyState from '../components/EmptyState.jsx';
import TradeEntryCard from '../components/TradeEntryCard.jsx';
import { useAccount } from '../context/AccountContext.jsx';
import { journalAPI } from '../services/api.js';
import { getEntryOutcome } from '../utils/tradeUtils.js';

export default function AccountJournalPage() {
  const navigate = useNavigate();
  const { accountId } = useParams();
  const { accounts, currentAccount, isLoading: accountLoading } = useAccount();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const deferredSearch = useDeferredValue(searchQuery);
  const account = useMemo(
    () => accounts.find((item) => item.id === Number(accountId)) || null,
    [accountId, accounts]
  );

  const stats = useMemo(() => {
    let wins = 0;
    let losses = 0;
    let breakevens = 0;

    entries.forEach((entry) => {
      const result = getEntryOutcome(entry);
      if (result === 'WIN') wins += 1;
      if (result === 'LOSS') losses += 1;
      if (result === 'BREAKEVEN') breakevens += 1;
    });

    const totalTrades = wins + losses + breakevens;
    const winRate = totalTrades > 0 ? Math.round((wins / totalTrades) * 100) : 0;

    return { totalTrades, wins, losses, breakevens, winRate };
  }, [entries]);

  useEffect(() => {
    const shouldSearch =
      deferredSearch.trim().length === 0 || deferredSearch.trim().length >= 2;

    if (!accountLoading && account && shouldSearch) {
      loadEntries(1, deferredSearch, true);
    }
  }, [account, accountLoading, deferredSearch]);

  async function loadEntries(pageNumber = 1, search = '', refresh = false) {
    if (!account) {
      return;
    }

    if (loading && !refresh) {
      return;
    }

    setLoading(true);

    try {
      const response = await journalAPI.getEntries(pageNumber, 20, search, account.id);
      const nextEntries = response.entries || [];
      setEntries((current) =>
        pageNumber === 1 ? nextEntries : [...current, ...nextEntries]
      );
      setHasMore(response.pagination.page < response.pagination.pages);
      setPage(pageNumber);
    } catch (error) {
      console.error('Failed to load account journal', error);
      window.alert('Failed to load account journal.');
    } finally {
      setLoading(false);
    }
  }

  if (accountLoading) {
    return <LoadingScreen message="Loading account journal..." compact />;
  }

  if (!account) {
    return (
      <div className="page">
        <PageHeader
          eyebrow="Account Journal"
          title="Account not found"
          subtitle="The requested account could not be found in your current workspace."
        />
        <EmptyState
          title="Unknown account"
          description="Return to settings and open one of the accounts from there."
        />
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Account Journal"
        title={account.name}
        subtitle={account.description || 'Trading account'}
        actions={
          <Link className="ghost-button" to="/settings">
            <IoArrowBack size={18} />
            Back to Settings
          </Link>
        }
      />

      <section className="dashboard-hero">
        <article className="hero-card">
          <span>Total Trades</span>
          <strong>{stats.totalTrades}</strong>
          <p>Entries currently loaded for this account.</p>
        </article>
        <article className="hero-card hero-card--success">
          <span>Win Rate</span>
          <strong>{stats.winRate}%</strong>
          <p>{stats.wins} wins and {stats.losses} losses.</p>
        </article>
        <article className="hero-card">
          <span>Status</span>
          <strong>{currentAccount?.id === account.id ? 'Active' : 'Inactive'}</strong>
          <p>Activate it from Settings if you want it to drive the global pages.</p>
        </article>
      </section>

      <section className="surface-card">
        <label className="search-field">
          <IoSearch size={18} />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search pair or notes..."
          />
        </label>
      </section>

      <section className="surface-card">
        {loading && page === 1 ? (
          <LoadingScreen message="Loading entries..." compact />
        ) : entries.length > 0 ? (
          <>
            <div className="trade-card-list">
              {entries.map((entry) => (
                <TradeEntryCard
                  key={entry.id}
                  entry={entry}
                  onClick={() => navigate(`/journal/${entry.id}`)}
                />
              ))}
            </div>

            {hasMore ? (
              <div className="load-more-row">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => loadEntries(page + 1, deferredSearch)}
                  disabled={loading}
                >
                  {loading ? 'Loading more...' : 'Load More'}
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <EmptyState
            title="No trades yet"
            description={`Trades for ${account.name} will appear here as soon as they are journaled.`}
          />
        )}
      </section>
    </div>
  );
}
