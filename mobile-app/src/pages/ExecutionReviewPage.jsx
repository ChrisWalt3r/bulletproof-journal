import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IoArrowBack, IoImagesOutline } from 'react-icons/io5';
import PageHeader from '../components/PageHeader.jsx';
import LoadingScreen from '../components/LoadingScreen.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { useAccount } from '../context/AccountContext.jsx';
import { journalAPI } from '../services/api.js';
import { formatKampalaDateTime } from '../utils/dateUtils.js';
import {
  formatTradeDateTitle,
  getEntryTradeDate,
  isEntryInCustomDateRange,
  parseCustomDateInput,
} from '../utils/tradeDates.js';
import { getEntryOutcome, getEntryPair, getResultColor } from '../utils/tradeUtils.js';

export default function ExecutionReviewPage() {
  const navigate = useNavigate();
  const { currentAccount } = useAccount();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startDateInput, setStartDateInput] = useState('');
  const [endDateInput, setEndDateInput] = useState('');
  const [appliedStartDate, setAppliedStartDate] = useState(null);
  const [appliedEndDate, setAppliedEndDate] = useState(null);

  useEffect(() => {
    const loadExecutionImages = async () => {
      if (!currentAccount?.id) {
        setEntries([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        let page = 1;
        let totalPages = 1;
        const allEntries = [];

        do {
          const response = await journalAPI.getEntries(page, 100, '', currentAccount.id);
          allEntries.push(...(response.entries || []));
          totalPages = response.pagination?.pages || 1;
          page += 1;
        } while (page <= totalPages);

        setEntries(allEntries.filter((entry) => entry.execution_tf_image_url));
      } catch (error) {
        console.error('Failed to load execution review images', error);
        window.alert('Failed to load execution review entries.');
      } finally {
        setLoading(false);
      }
    };

    loadExecutionImages();
  }, [currentAccount?.id]);

  const filteredEntries = useMemo(
    () =>
      entries
        .filter((entry) => isEntryInCustomDateRange(entry, appliedStartDate, appliedEndDate))
        .sort((left, right) => {
          const leftDate = getEntryTradeDate(left) || new Date(left.created_at);
          const rightDate = getEntryTradeDate(right) || new Date(right.created_at);
          return rightDate - leftDate;
        }),
    [appliedEndDate, appliedStartDate, entries]
  );

  const openEntryImageViewer = (entryId) => {
    const imageEntries = filteredEntries
      .filter((entry) => Boolean(entry.execution_tf_image_url))
      .map((entry) => ({
        id: entry.id,
        src: entry.execution_tf_image_url,
        title: `${getEntryPair(entry)} execution image`,
        subtitle: formatTradeDateTitle(entry),
        dateTime: formatKampalaDateTime(entry.created_at),
      }));

    const currentIndex = Math.max(
      imageEntries.findIndex((item) => item.id === entryId),
      0
    );
    const currentEntry = imageEntries[currentIndex] || imageEntries[0];

    if (!currentEntry) {
      return;
    }

    navigate(
      `/image-viewer/${currentEntry.id}/execution?title=${encodeURIComponent(
        currentEntry.title
      )}`,
      {
        state: {
          from: '/execution-review',
          initialIndex: currentIndex,
          images: imageEntries,
          canOpenEntry: true,
        },
      }
    );
  };

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

  return (
    <div className="page">
      <PageHeader
        eyebrow="Execution Review"
        title="Execution timeframe gallery"
        subtitle="Browse all trades that include an execution timeframe image and narrow them by custom date range."
        actions={
          <button type="button" className="ghost-button" onClick={() => navigate(-1)}>
            <IoArrowBack size={18} />
            Back
          </button>
        }
      />

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

      <section className="surface-card">
        <div className="section-heading">
          <div>
            <span className="section-heading__eyebrow">Visible Images</span>
            <h2>{filteredEntries.length} matching trades</h2>
          </div>
        </div>

        {loading ? (
          <LoadingScreen message="Loading execution images..." compact />
        ) : filteredEntries.length > 0 ? (
          <div className="execution-grid">
            {filteredEntries.map((entry) => {
              const result = getEntryOutcome(entry);
              return (
                <button
                  key={entry.id}
                  type="button"
                  className="execution-card"
                  onClick={() => openEntryImageViewer(entry.id)}
                >
                  <img
                    src={entry.execution_tf_image_url}
                    alt={`Execution timeframe for ${getEntryPair(entry)}`}
                  />
                  <div className="execution-card__body">
                    <div className="execution-card__top">
                      <strong>{formatTradeDateTitle(entry)}</strong>
                      <span
                        className="result-pill"
                        style={{
                          '--result-background': `${getResultColor(result)}20`,
                          '--result-color': getResultColor(result),
                        }}
                      >
                        {result}
                      </span>
                    </div>
                    <p>{getEntryPair(entry)}</p>
                    <span>{formatKampalaDateTime(entry.created_at)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={<IoImagesOutline size={34} />}
            title="No execution images found"
            description="Either no trades have an execution timeframe image yet, or none match the selected date range."
          />
        )}
      </section>
    </div>
  );
}
