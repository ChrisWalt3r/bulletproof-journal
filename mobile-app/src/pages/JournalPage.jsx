import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  IoRefresh,
  IoSearch,
  IoSettingsOutline,
  IoWalletOutline,
} from 'react-icons/io5';
import PageHeader from '../components/PageHeader.jsx';
import LoadingScreen from '../components/LoadingScreen.jsx';
import EmptyState from '../components/EmptyState.jsx';
import TradeEntryCard from '../components/TradeEntryCard.jsx';
import { useAccount } from '../context/AccountContext.jsx';
import { journalAPI } from '../services/api.js';
import { extractContentDate, getEntryOutcome } from '../utils/tradeUtils.js';
import { parseBackendTimestamp } from '../utils/dateUtils.js';

const FILTER_OPTIONS = ['ALL', 'WIN', 'LOSS', 'BREAKEVEN'];
const DATE_FILTERS = [
  { id: 'ALL_TIME', label: 'All Time' },
  { id: 'TODAY', label: 'Today' },
  { id: 'WEEK', label: 'This Week' },
  { id: 'MONTH', label: 'This Month' },
];

export default function JournalPage() {
  const navigate = useNavigate();
  const { currentAccount, isLoading: accountLoading } = useAccount();
  const [searchParams, setSearchParams] = useSearchParams();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [dateFilter, setDateFilter] = useState('ALL_TIME');

  const deferredSearch = useDeferredValue(searchQuery);
  const activeFilter = searchParams.get('filter') || 'ALL';

  useEffect(() => {
    const shouldSearch =
      deferredSearch.trim().length === 0 || deferredSearch.trim().length >= 2;

    if (!accountLoading && currentAccount && shouldSearch) {
      loadEntries(1, deferredSearch, true);
    }
  }, [accountLoading, currentAccount, deferredSearch]);

  const filteredEntries = useMemo(() => {
    let result = [...entries];

    if (activeFilter !== 'ALL') {
      result = result.filter((entry) => getEntryOutcome(entry) === activeFilter);
    }

    if (dateFilter !== 'ALL_TIME') {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      result = result.filter((entry) => {
        const entryDate =
          extractContentDate(entry.content) || parseBackendTimestamp(entry.created_at);

        if (!entryDate) {
          return false;
        }

        if (dateFilter === 'TODAY') {
          return entryDate >= startOfDay;
        }

        if (dateFilter === 'WEEK') {
          const weekStart = new Date(now);
          weekStart.setDate(now.getDate() - now.getDay());
          weekStart.setHours(0, 0, 0, 0);
          return entryDate >= weekStart;
        }

        if (dateFilter === 'MONTH') {
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
          return entryDate >= monthStart;
        }

        return true;
      });
    }

    return result;
  }, [activeFilter, dateFilter, entries]);

  async function loadEntries(pageNumber = 1, search = '', isRefresh = false) {
    if (!currentAccount) {
      return;
    }

    if (loading && !isRefresh) {
      return;
    }

    setLoading(true);

    try {
      if (pageNumber === 1) {
        await journalAPI.syncMt5Entries(currentAccount.id);
      }

      const response = await journalAPI.getEntries(
        pageNumber,
        20,
        search,
        currentAccount.id
      );
      const nextEntries = response.entries || [];

      setEntries((existing) =>
        pageNumber === 1 ? nextEntries : [...existing, ...nextEntries]
      );
      setHasMore(response.pagination.page < response.pagination.pages);
      setPage(pageNumber);
    } catch (error) {
      console.error('Failed to load journal entries', error);
      window.alert('Failed to load journal entries.');
    } finally {
      setLoading(false);
    }
  }

  const setOutcomeFilter = (filter) => {
    const next = new URLSearchParams(searchParams);

    if (filter === 'ALL') {
      next.delete('filter');
    } else {
      next.set('filter', filter);
    }

    setSearchParams(next, { replace: true });
  };

  if (accountLoading) {
    return <LoadingScreen message="Loading journal..." compact />;
  }

  if (!currentAccount) {
    return (
      <div className="page page--journal">
        <PageHeader
          eyebrow="Journal"
          title="Trading journal"
          subtitle="Select an account first so we know which entries to show."
        />
        <EmptyState
          icon={<IoWalletOutline size={34} />}
          title="No account selected"
          description="Create or activate an account from Settings to browse your journal entries."
          action={
            <button
              type="button"
              className="primary-button"
              onClick={() => navigate('/settings')}
            >
              <IoSettingsOutline size={18} />
              Open Settings
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="page page--journal">
      <PageHeader
        eyebrow="Journal"
        title="Trading Journal"
        subtitle="Your forex trading history"
        variant="hero"
        aside={
          <div className="account-indicator" style={{ '--account-color': currentAccount.color || '#4a90e2' }}>
            <span className="account-indicator__dot" />
            <span>{currentAccount.name}</span>
          </div>
        }
        actions={
          <div className="button-row">
            <button
              type="button"
              className="secondary-button"
              onClick={() => loadEntries(1, deferredSearch, true)}
            >
              <IoRefresh size={18} />
              Refresh
            </button>
          </div>
        }
      />

      <section className="surface-card journal-toolbar">
        <label className="search-field">
          <IoSearch size={18} />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search pair or notes..."
          />
        </label>

        <div className="filter-row">
          {FILTER_OPTIONS.map((filter) => (
            <button
              key={filter}
              type="button"
              className={`filter-chip ${activeFilter === filter ? 'is-active' : ''}`}
              onClick={() => setOutcomeFilter(filter)}
            >
              {filter}
            </button>
          ))}
        </div>

        <div className="filter-row">
          {DATE_FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              className={`filter-chip ${dateFilter === filter.id ? 'is-active' : ''}`}
              onClick={() => setDateFilter(filter.id)}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </section>

      <section className="surface-card">
        {loading && page === 1 ? (
          <LoadingScreen message="Loading entries..." compact />
        ) : filteredEntries.length > 0 ? (
          <>
            <div className="trade-card-list">
              {filteredEntries.map((entry) => (
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
                  disabled={loading}
                  onClick={() => loadEntries(page + 1, deferredSearch)}
                >
                  {loading ? 'Loading more...' : 'Load More'}
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <EmptyState
            title="No entries yet"
            description="Trades imported from your MT5 expert adviser will appear here automatically."
          />
        )}
      </section>
    </div>
  );
}
