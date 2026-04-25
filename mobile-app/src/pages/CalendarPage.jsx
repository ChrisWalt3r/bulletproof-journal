import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IoCalendarOutline,
  IoChevronBack,
  IoChevronForward,
  IoClipboardOutline,
  IoCashOutline,
} from 'react-icons/io5';
import PageHeader from '../components/PageHeader.jsx';
import EmptyState from '../components/EmptyState.jsx';
import LoadingScreen from '../components/LoadingScreen.jsx';
import { useAccount } from '../context/AccountContext.jsx';
import { journalAPI } from '../services/api.js';
import {
  extractContentDate,
  getEntryOutcome,
  getEntryPair,
  getPlanStatus,
  getPlanStatusColor,
  getResultColor,
} from '../utils/tradeUtils.js';
import { formatKampalaTime, getKampalaDateKey } from '../utils/dateUtils.js';

const monthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const formatDateKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;

const getDayColors = (dayEntries, viewMode) => {
  if (!dayEntries) {
    return [];
  }

  if (viewMode === 'PLAN') {
    return [...new Set(dayEntries.entries.map((entry) => getPlanStatusColor(getPlanStatus(entry))))];
  }

  return [...new Set(dayEntries.entries.map((entry) => getResultColor(getEntryOutcome(entry))))];
};

export default function CalendarPage() {
  const navigate = useNavigate();
  const { currentAccount, isLoading: accountLoading } = useAccount();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [journalEntries, setJournalEntries] = useState({});
  const [selectedDateEntries, setSelectedDateEntries] = useState([]);
  const [viewMode, setViewMode] = useState('OUTCOME');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadMonthEntries = async () => {
      if (!currentAccount) {
        return;
      }

      setLoading(true);
      try {
        const response = await journalAPI.getEntries(1, 300, '', currentAccount.id);
        const nextEntriesByDate = {};
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;

        (response.entries || []).forEach((entry) => {
          let entryYear = null;
          let entryMonth = null;
          let entryDay = null;

          const contentDate = extractContentDate(entry.content);
          if (contentDate) {
            entryYear = contentDate.getFullYear();
            entryMonth = contentDate.getMonth() + 1;
            entryDay = contentDate.getDate();
          } else {
            const dateKey = getKampalaDateKey(entry.created_at);
            if (dateKey) {
              const [parsedYear, parsedMonth, parsedDay] = dateKey.split('-').map(Number);
              entryYear = parsedYear;
              entryMonth = parsedMonth;
              entryDay = parsedDay;
            }
          }

          if (!entryYear || !entryMonth || !entryDay) {
            return;
          }

          if (entryYear !== year || entryMonth !== month) {
            return;
          }

          const key = formatDateKey(new Date(entryYear, entryMonth - 1, entryDay));
          if (!nextEntriesByDate[key]) {
            nextEntriesByDate[key] = { entries: [] };
          }
          nextEntriesByDate[key].entries.push(entry);
        });

        setJournalEntries(nextEntriesByDate);
      } catch (error) {
        console.error('Failed to load calendar entries', error);
        window.alert('Failed to load calendar entries.');
      } finally {
        setLoading(false);
      }
    };

    if (!accountLoading) {
      loadMonthEntries();
    }
  }, [accountLoading, currentAccount, currentDate]);

  useEffect(() => {
    const dateKey = formatDateKey(selectedDate);
    setSelectedDateEntries(journalEntries[dateKey]?.entries || []);
  }, [journalEntries, selectedDate]);

  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days = [];

    for (let index = 0; index < firstDay.getDay(); index += 1) {
      days.push(null);
    }

    for (let day = 1; day <= lastDay.getDate(); day += 1) {
      days.push(new Date(year, month, day));
    }

    while (days.length < 42) {
      days.push(null);
    }

    return days;
  }, [currentDate]);

  if (accountLoading) {
    return <LoadingScreen message="Loading calendar..." compact />;
  }

  if (!currentAccount) {
    return (
      <div className="page">
        <PageHeader
          eyebrow="Calendar"
          title="Trading calendar"
          subtitle="Activate an account first to inspect outcomes and plan adherence by day."
        />
        <EmptyState
          icon={<IoCalendarOutline size={34} />}
          title="No active account"
          description="The calendar needs an account context before it can group journal entries by date."
        />
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Calendar"
        title="Trading calendar"
        subtitle="Switch between outcome and plan adherence views, then drill into trades for the selected date."
      />

      <section className="surface-card">
        <div className="calendar-toolbar">
          <button
            type="button"
            className="icon-button"
            onClick={() =>
              setCurrentDate(
                (current) => new Date(current.getFullYear(), current.getMonth() - 1, 1)
              )
            }
          >
            <IoChevronBack size={18} />
          </button>

          <div className="calendar-toolbar__title">
            <strong>
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </strong>
            <span>{currentAccount.name}</span>
          </div>

          <button
            type="button"
            className="icon-button"
            onClick={() =>
              setCurrentDate(
                (current) => new Date(current.getFullYear(), current.getMonth() + 1, 1)
              )
            }
          >
            <IoChevronForward size={18} />
          </button>
        </div>

        <div className="calendar-mode-toggle">
          <button
            type="button"
            className={`segment-button ${viewMode === 'OUTCOME' ? 'is-selected' : ''}`}
            onClick={() => setViewMode('OUTCOME')}
          >
            <IoCashOutline size={18} />
            Outcome
          </button>
          <button
            type="button"
            className={`segment-button ${viewMode === 'PLAN' ? 'is-selected' : ''}`}
            onClick={() => setViewMode('PLAN')}
          >
            <IoClipboardOutline size={18} />
            Plan
          </button>
        </div>

        <div className="calendar-grid">
          {dayNames.map((dayName) => (
            <div key={dayName} className="calendar-grid__day-name">
              {dayName}
            </div>
          ))}

          {calendarDays.map((day, index) => {
            if (!day) {
              return <div key={`empty-${index}`} className="calendar-day calendar-day--empty" />;
            }

            const dateKey = formatDateKey(day);
            const dayEntries = journalEntries[dateKey];
            const colors = getDayColors(dayEntries, viewMode).slice(0, 3);
            const isSelected = dateKey === formatDateKey(selectedDate);
            const isToday = dateKey === formatDateKey(new Date());

            return (
              <button
                key={dateKey}
                type="button"
                className={`calendar-day ${isSelected ? 'is-selected' : ''} ${
                  isToday ? 'is-today' : ''
                }`}
                onClick={() => setSelectedDate(day)}
              >
                <span className="calendar-day__number">{day.getDate()}</span>
                <span className="calendar-day__count">
                  {dayEntries?.entries.length || 0}
                </span>
                <span className="calendar-day__dots">
                  {colors.map((color) => (
                    <span
                      key={`${dateKey}-${color}`}
                      className="calendar-day__dot"
                      style={{ background: color }}
                    />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="surface-card">
        <div className="section-heading">
          <div>
            <span className="section-heading__eyebrow">
              {monthNames[selectedDate.getMonth()]} {selectedDate.getDate()}
            </span>
            <h2>Trades on selected date</h2>
          </div>
        </div>

        {loading ? (
          <LoadingScreen message="Loading selected date..." compact />
        ) : selectedDateEntries.length > 0 ? (
          <div className="calendar-entry-list">
            {selectedDateEntries.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className="calendar-entry-card"
                onClick={() => navigate(`/journal/${entry.id}`)}
              >
                <div>
                  <strong>{getEntryPair(entry)}</strong>
                  <p>{formatKampalaTime(entry.created_at)}</p>
                </div>
                <span
                  className="result-pill"
                  style={{
                    '--result-background': `${getResultColor(getEntryOutcome(entry))}20`,
                    '--result-color': getResultColor(getEntryOutcome(entry)),
                  }}
                >
                  {viewMode === 'PLAN' ? getPlanStatus(entry).replaceAll('_', ' ') : getEntryOutcome(entry)}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No trades on this date"
            description="Pick another day in the month grid to inspect its journal entries."
          />
        )}
      </section>
    </div>
  );
}
