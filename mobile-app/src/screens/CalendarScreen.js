import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { journalAPI } from '../services/api';
import { useAccount } from '../context/AccountContext';
import AccountHeader from '../components/AccountHeader';
import { useAccountChange } from '../context/useAccountChange';
import { formatKampalaTime } from '../utils/dateUtils';

const { width } = Dimensions.get('window');
const CALENDAR_WIDTH = width - 40;
const DAY_WIDTH = CALENDAR_WIDTH / 7;

const CalendarScreen = ({ navigation }) => {
  const { currentAccount, isLoading: accountLoading } = useAccount();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [journalEntries, setJournalEntries] = useState({});
  const [loading, setLoading] = useState(false);
  const [selectedDateEntries, setSelectedDateEntries] = useState([]);
  const [viewMode, setViewMode] = useState('OUTCOME'); // 'OUTCOME' or 'PLAN'

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  useEffect(() => {
    if (currentAccount && !accountLoading) {
      loadMonthEntries();
    }
  }, [currentDate, currentAccount, accountLoading]);

  useEffect(() => {
    if (currentAccount && !accountLoading) {
      loadSelectedDateEntries();
    }
  }, [selectedDate, currentAccount, accountLoading, journalEntries]);

  // Reload calendar when account changes
  useAccountChange((newAccount, previousAccount) => {
    if (newAccount && newAccount.id !== previousAccount?.id) {
      setJournalEntries({}); // Clear existing entries
      setSelectedDateEntries([]);
      loadMonthEntries(); // Refresh calendar data
    }
  });

  // Refresh data when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (currentAccount && !accountLoading) {
        loadMonthEntries();
      }
    }, [currentAccount, accountLoading, currentDate])
  );

  const loadMonthEntries = async () => {
    if (!currentAccount) return;

    setLoading(true);
    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1; // JavaScript months are 0-indexed

      // Get all entries for this month for current account
      const response = await journalAPI.getEntries(1, 100, '', currentAccount.id); // Get enough entries
      const entriesByDate = {};

      response.entries.forEach(entry => {
        // Prefer the date embedded in the entry content (created by the app)
        // Fallback to parsing the created_at timestamp if content date is missing
        let entryDateObj = null;

        const contentDate = extractContentDate(entry.content);
        if (contentDate) {
          entryDateObj = contentDate;
        } else if (entry.created_at) {
          // Handle both "YYYY-MM-DD HH:mm:ss" and ISO "YYYY-MM-DDTHH:mm:ss.sssZ" formats
          const createdAtStr = String(entry.created_at);
          // Split on either 'T' or ' ' to get the date part
          const datePart = createdAtStr.split(/[T ]/)[0]; // Get "YYYY-MM-DD" part
          const [entryYear, entryMonth, entryDay] = datePart.split('-').map(Number);
          if (!isNaN(entryYear) && !isNaN(entryMonth) && !isNaN(entryDay)) {
            entryDateObj = new Date(entryYear, entryMonth - 1, entryDay);
          }
        }

        if (!entryDateObj) return;

        const entryYear = entryDateObj.getFullYear();
        const entryMonth = entryDateObj.getMonth() + 1;
        const entryDay = entryDateObj.getDate();

        console.log('Calendar: Entry date:', entry.created_at, '-> Parsed:', entryYear, entryMonth, entryDay);

        if (entryYear === year && entryMonth === month) {
          const localDate = new Date(entryYear, entryMonth - 1, entryDay);
          const dateKey = formatDateKey(localDate);

          if (!entriesByDate[dateKey]) {
            entriesByDate[dateKey] = {
              entries: [],
              trades: { WIN: 0, LOSS: 0, BREAKEVEN: 0, OPEN: 0 },
              plan: { FOLLOWED: 0, NOT_FOLLOWED: 0 }
            };
          }
          entriesByDate[dateKey].entries.push(entry);

          // Extract trade result from DB columns
          const tradeResult = getEntryOutcome(entry);
          if (entriesByDate[dateKey].trades[tradeResult] !== undefined) {
            entriesByDate[dateKey].trades[tradeResult]++;
          }

          // Track plan adherence
          if (entry.following_plan === true || entry.following_plan === 'true') {
            entriesByDate[dateKey].plan.FOLLOWED++;
          } else {
            entriesByDate[dateKey].plan.NOT_FOLLOWED++;
          }
        }
      });

      setJournalEntries(entriesByDate);
    } catch (error) {
      console.error('Error loading month entries:', error);
      Alert.alert('Error', 'Failed to load calendar entries');
    } finally {
      setLoading(false);
    }
  };

  const extractContentDate = (content) => {
    if (!content || typeof content !== 'string') return null;

    // The content starts with a line like: "Date: Saturday, November 1, 2025"
    const match = content.match(/^Date:\s*([A-Za-z]+),\s*([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/m);
    if (!match) return null;

    // match[2] = month name, match[3] = day, match[4] = year
    const monthName = match[2];
    const day = parseInt(match[3], 10);
    const year = parseInt(match[4], 10);

    const months = {
      January: 0, February: 1, March: 2, April: 3, May: 4, June: 5,
      July: 6, August: 7, September: 8, October: 9, November: 10, December: 11
    };

    const monthIndex = months[monthName];
    if (monthIndex === undefined) return null;

    return new Date(year, monthIndex, day);
  };

  const loadSelectedDateEntries = async () => {
    const dateKey = formatDateKey(selectedDate);
    const dayEntries = journalEntries[dateKey];
    setSelectedDateEntries(dayEntries ? dayEntries.entries : []);
  };

  const getEntryOutcome = (entry) => {
    const pnl = parseFloat(entry.pnl);
    if (isNaN(pnl) || entry.pnl === null || entry.pnl === undefined) return 'OPEN';
    if (pnl > 0) return 'WIN';
    if (pnl < 0) return 'LOSS';
    return 'BREAKEVEN';
  };

  const getEntryPair = (entry) => {
    // Use DB column first
    if (entry.symbol) return entry.symbol;
    // Fallback to content parsing for older manual entries
    if (!entry.content || typeof entry.content !== 'string') return 'Unknown';

    const checkedPairMatches = entry.content.match(/- \[x\] ([A-Z]{6})/g);
    if (checkedPairMatches && checkedPairMatches.length > 0) {
      const pairs = checkedPairMatches.map(match => {
        const pairMatch = match.match(/- \[x\] ([A-Z]{6})/);
        return pairMatch ? pairMatch[1] : null;
      }).filter(Boolean);
      if (pairs.length > 0) return pairs.join(', ');
    }

    return 'Unknown';
  };

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // Add all days of the current month only
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }

    // Fill remaining cells to complete exactly 6 weeks (42 total cells)
    // These will be empty cells to maintain consistent layout
    const totalCells = 42; // 6 weeks × 7 days
    while (days.length < totalCells) {
      days.push(null);
    }

    return days;
  };

  const formatDateKey = (date) => {
    if (!date) return '';
    // Use local date to avoid timezone issues
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const isToday = (date) => {
    if (!date) return false;

    // Get today's date - since backend now stores in EAT, we compare directly
    const today = new Date();

    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  };

  const isSelected = (date) => {
    return date &&
      date.getDate() === selectedDate.getDate() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getFullYear() === selectedDate.getFullYear();
  };

  const goToPreviousMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() - 1);
    setCurrentDate(newDate);
  };

  const goToNextMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + 1);
    setCurrentDate(newDate);
  };

  const handleDatePress = (date) => {
    if (date) {
      // Only set selected date if it's from the current month being displayed
      if (date.getMonth() === currentDate.getMonth() &&
        date.getFullYear() === currentDate.getFullYear()) {
        setSelectedDate(date);
      }
    }
  };

  const getDateIndicatorStyle = (dayEntries) => {
    if (!dayEntries || dayEntries.entries.length === 0) return null;

    if (viewMode === 'PLAN') {
      const { plan } = dayEntries;
      const hasFollowed = plan.FOLLOWED > 0;
      const hasNotFollowed = plan.NOT_FOLLOWED > 0;

      const types = [];
      if (hasFollowed) types.push({ color: '#50C878' });    // Green - followed plan
      if (hasNotFollowed) types.push({ color: '#FF6B6B' }); // Red - didn't follow

      if (types.length === 2) {
        return { type: 'mixed', primaryColor: types[0].color, secondaryColor: types[1].color };
      } else if (types.length === 1) {
        return { type: 'single', primaryColor: types[0].color };
      }
      return null;
    }

    // OUTCOME mode
    const { trades } = dayEntries;
    const hasWin = trades.WIN > 0;
    const hasLoss = trades.LOSS > 0;
    const hasBreakeven = trades.BREAKEVEN > 0;
    const hasOpen = trades.OPEN > 0;

    // Collect all present outcome types with their colors
    const types = [];
    if (hasWin) types.push({ color: '#50C878' }); // Green
    if (hasLoss) types.push({ color: '#FF6B6B' }); // Red
    if (hasBreakeven) types.push({ color: '#4A90E2' }); // Blue
    if (hasOpen) types.push({ color: '#FFA500' }); // Orange

    // Determine indicator style based on number of distinct outcomes
    if (types.length >= 3) {
      return {
        type: 'triple',
        primaryColor: types[0].color,
        secondaryColor: types[1].color,
        tertiaryColor: types[2].color,
      };
    } else if (types.length === 2) {
      return {
        type: 'mixed',
        primaryColor: types[0].color,
        secondaryColor: types[1].color,
      };
    } else if (types.length === 1) {
      return {
        type: 'single',
        primaryColor: types[0].color,
      };
    }

    return null;
  };

  const getTradeResultColor = (dayEntries) => {
    if (!dayEntries || dayEntries.entries.length === 0) return '#f0f0f0';

    if (viewMode === 'PLAN') {
      const { plan } = dayEntries;
      if (plan.FOLLOWED > 0 && plan.NOT_FOLLOWED === 0) return '#50C878'; // All followed
      if (plan.NOT_FOLLOWED > 0 && plan.FOLLOWED === 0) return '#FF6B6B'; // None followed
      if (plan.FOLLOWED > 0 && plan.NOT_FOLLOWED > 0) return '#FFA500'; // Mixed
      return '#f0f0f0';
    }

    const { trades } = dayEntries;
    if (trades.WIN > 0) return '#50C878'; // Green for wins
    if (trades.BREAKEVEN > 0) return '#4A90E2'; // Blue for breakeven
    if (trades.LOSS > 0) return '#FF6B6B'; // Red for losses
    if (trades.OPEN > 0) return '#FFA500'; // Orange for open
    return '#f0f0f0';
  };

  const getDateEntryInfo = (date) => {
    const dateKey = formatDateKey(date);
    return journalEntries[dateKey] || null;
  };

  const renderCalendarDay = (date, index) => {
    if (!date) {
      return <View key={index} style={[styles.dayCell, styles.emptyDay]} />;
    }

    const dayEntries = getDateEntryInfo(date);
    const hasEntries = dayEntries && dayEntries.entries.length > 0;
    const indicatorStyle = getDateIndicatorStyle(dayEntries);

    return (
      <TouchableOpacity
        key={index}
        style={[
          styles.dayCell,
          isToday(date) && styles.todayCell,
          isSelected(date) && styles.selectedCell,
        ]}
        onPress={() => handleDatePress(date)}
      >
        <Text style={[
          styles.dayText,
          isToday(date) && styles.todayText,
          isSelected(date) && styles.selectedText,
        ]}>
          {date.getDate()}
        </Text>

        {hasEntries && indicatorStyle && (
          <View style={styles.entryIndicators}>
            {/* Main entry indicator */}
            {indicatorStyle.type === 'triple' ? (
              <View style={[
                styles.entryDot,
                styles.tripleIndicator,
                { borderColor: indicatorStyle.primaryColor }
              ]}>
                <View style={[
                  styles.middleRing,
                  { backgroundColor: indicatorStyle.secondaryColor }
                ]}>
                  <View style={[
                    styles.centerDot,
                    { backgroundColor: indicatorStyle.tertiaryColor }
                  ]} />
                </View>
              </View>
            ) : indicatorStyle.type === 'mixed' ? (
              <View style={[
                styles.entryDot,
                styles.mixedIndicator,
                { borderColor: indicatorStyle.primaryColor }
              ]}>
                <View style={[
                  styles.innerIndicator,
                  { backgroundColor: indicatorStyle.secondaryColor }
                ]} />
              </View>
            ) : (
              <View style={[
                styles.entryDot,
                { backgroundColor: indicatorStyle.primaryColor }
              ]} />
            )}

            {/* Entry count for multiple entries */}
            {dayEntries.entries.length > 1 && (
              <View style={styles.entryCountBadge}>
                <Text style={styles.entryCountText}>{dayEntries.entries.length}</Text>
              </View>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const getSelectedDateInfo = () => {
    const selectedDateString = selectedDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'Africa/Kampala'
    });

    return { selectedDateString };
  };

  const days = getDaysInMonth(currentDate);
  const { selectedDateString } = getSelectedDateInfo();

  return (
    <View style={styles.container}>
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#4A90E2" />
        </View>
      )}

      <LinearGradient
        colors={['#667eea', '#764ba2']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>

          <View style={styles.titleContainer}>
            <Text style={styles.headerTitle}>Trading Calendar</Text>
            <Text style={styles.headerSubtitle}>Track your trading performance</Text>
          </View>

          {currentAccount && (
            <View style={styles.accountIndicator}>
              <View style={[styles.accountDot, { backgroundColor: currentAccount.color || '#fff' }]} />
              <Text style={styles.accountName}>{currentAccount.name}</Text>
            </View>
          )}
        </View>
      </LinearGradient>

      <ScrollView style={styles.content}>
        {/* View Mode Toggle */}
        <View style={styles.modeToggleContainer}>
          <TouchableOpacity
            style={[styles.modeToggleBtn, viewMode === 'OUTCOME' && styles.modeToggleBtnActive]}
            onPress={() => setViewMode('OUTCOME')}
          >
            <Ionicons name="cash-outline" size={16} color={viewMode === 'OUTCOME' ? '#fff' : '#667eea'} />
            <Text style={[styles.modeToggleText, viewMode === 'OUTCOME' && styles.modeToggleTextActive]}>
              Outcome
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeToggleBtn, viewMode === 'PLAN' && styles.modeToggleBtnActive]}
            onPress={() => setViewMode('PLAN')}
          >
            <Ionicons name="clipboard-outline" size={16} color={viewMode === 'PLAN' ? '#fff' : '#667eea'} />
            <Text style={[styles.modeToggleText, viewMode === 'PLAN' && styles.modeToggleTextActive]}>
              Plan
            </Text>
          </TouchableOpacity>
        </View>

        {/* Calendar Header */}
        <View style={styles.calendarHeader}>
          <TouchableOpacity onPress={goToPreviousMonth} style={styles.navButton}>
            <Ionicons name="chevron-back" size={24} color="#4A90E2" />
          </TouchableOpacity>

          <Text style={styles.monthYearText}>
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </Text>

          <TouchableOpacity onPress={goToNextMonth} style={styles.navButton}>
            <Ionicons name="chevron-forward" size={24} color="#4A90E2" />
          </TouchableOpacity>
        </View>

        {/* Day Names Header */}
        <View style={styles.dayNamesRow}>
          {dayNames.map((dayName, index) => (
            <View key={index} style={styles.dayNameCell}>
              <Text style={styles.dayNameText}>{dayName}</Text>
            </View>
          ))}
        </View>

        {/* Calendar Grid */}
        <View
          key={`${currentDate.getFullYear()}-${currentDate.getMonth()}`}
          style={styles.calendarGrid}
        >
          {/* Render exactly 6 weeks (rows) */}
          {[0, 1, 2, 3, 4, 5].map(weekIndex => (
            <View key={weekIndex} style={styles.calendarRow}>
              {[0, 1, 2, 3, 4, 5, 6].map(dayIndex => {
                const cellIndex = weekIndex * 7 + dayIndex;
                const date = days[cellIndex];
                return renderCalendarDay(date, cellIndex);
              })}
            </View>
          ))}
        </View>

        {/* Selected Date Info */}
        <View style={styles.selectedDateInfo}>
          <Text style={styles.selectedDateTitle}>{selectedDateString}</Text>

          {selectedDateEntries.length > 0 ? (
            <View>
              <View style={styles.tradesOverview}>
                <Ionicons name="trending-up" size={20} color="#4A90E2" />
                <Text style={styles.tradesOverviewText}>
                  {selectedDateEntries.length} trade{selectedDateEntries.length === 1 ? '' : 's'}
                </Text>
              </View>

              {selectedDateEntries.map((entry, index) => {
                const outcome = getEntryOutcome(entry);
                const pair = getEntryPair(entry);
                const planFollowed = entry.following_plan === true || entry.following_plan === 'true';

                // Badge info depends on view mode
                let badgeText, badgeColor;
                if (viewMode === 'PLAN') {
                  badgeText = planFollowed ? 'FOLLOWED' : 'NOT FOLLOWED';
                  badgeColor = planFollowed ? '#50C878' : '#FF6B6B';
                } else {
                  badgeText = outcome;
                  badgeColor = outcome === 'WIN' ? '#50C878' : outcome === 'LOSS' ? '#FF6B6B' : outcome === 'BREAKEVEN' ? '#4A90E2' : '#FFA500';
                }

                return (
                  <TouchableOpacity
                    key={entry.id}
                    style={styles.entryItem}
                    onPress={() => navigation.navigate('EntryDetail', { entry })}
                  >
                    <View style={styles.entryItemHeader}>
                      <Text style={styles.entryItemTitle}>
                        {pair}
                      </Text>
                      <View style={[styles.resultBadge, { backgroundColor: badgeColor }]}>
                        <Text style={styles.resultBadgeText}>
                          {badgeText}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.entryItemTime}>
                      {entry.pnl !== null && entry.pnl !== undefined ? `P&L: $${parseFloat(entry.pnl).toFixed(2)}` : 'Open Trade'} • {formatKampalaTime(entry.created_at)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <View style={styles.noEntryCard}>
              <Ionicons name="information-circle-outline" size={24} color="#ccc" />
              <Text style={styles.noEntryText}>No trades recorded for this day</Text>
              <Text style={{ fontSize: 13, color: '#999', textAlign: 'center', marginTop: 8 }}>
                Trades from MetaTrader 5 will appear here automatically.
              </Text>
            </View>
          )}
        </View>

        {/* Legend */}
        <View style={styles.legend}>
          <Text style={styles.legendTitle}>
            {viewMode === 'OUTCOME' ? 'Trade Outcome Legend' : 'Plan Adherence Legend'}
          </Text>
          <View style={styles.legendItems}>
            {viewMode === 'OUTCOME' ? (
              <>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#50C878' }]} />
                  <Text style={styles.legendText}>Winning Trades</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#FF6B6B' }]} />
                  <Text style={styles.legendText}>Losing Trades</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#4A90E2' }]} />
                  <Text style={styles.legendText}>Breakeven Trades</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#FFA500' }]} />
                  <Text style={styles.legendText}>Open Trades</Text>
                </View>
              </>
            ) : (
              <>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#50C878' }]} />
                  <Text style={styles.legendText}>Followed Plan</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#FF6B6B' }]} />
                  <Text style={styles.legendText}>Didn't Follow Plan</Text>
                </View>
              </>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#4A90E2',
    paddingTop: 50,
    paddingBottom: 30,
    paddingHorizontal: 20,
  },
  backButton: {
    padding: 8,
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#E6F3FF',
    textAlign: 'center',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  modeToggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 4,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  modeToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  modeToggleBtnActive: {
    backgroundColor: '#667eea',
  },
  modeToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#667eea',
  },
  modeToggleTextActive: {
    color: '#fff',
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
  },
  navButton: {
    padding: 5,
  },
  monthYearText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  dayNamesRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    paddingVertical: 10,
  },
  dayNameCell: {
    width: DAY_WIDTH,
    alignItems: 'center',
  },
  dayNameText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  calendarGrid: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    paddingBottom: 10,
  },
  calendarRow: {
    flexDirection: 'row',
    height: 50,
  },
  dayCell: {
    width: DAY_WIDTH,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  emptyDay: {
    // Empty cell for spacing
  },
  todayCell: {
    backgroundColor: '#E6F3FF',
    borderRadius: 8,
    margin: 2,
  },
  selectedCell: {
    backgroundColor: '#4A90E2',
    borderRadius: 8,
    margin: 2,
  },
  dayText: {
    fontSize: 16,
    color: '#333',
  },
  todayText: {
    fontWeight: 'bold',
    color: '#4A90E2',
  },
  selectedText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  entryIndicators: {
    position: 'absolute',
    bottom: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  entryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 2,
  },
  mixedIndicator: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    width: 8,
    height: 8,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tripleIndicator: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    width: 10,
    height: 10,
    borderRadius: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  middleRing: {
    width: 6,
    height: 6,
    borderRadius: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerDot: {
    width: 2.5,
    height: 2.5,
    borderRadius: 1.25,
  },
  innerIndicator: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },
  entryCountBadge: {
    backgroundColor: '#667eea',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
    marginLeft: 2,
  },
  entryCountText: {
    fontSize: 8,
    color: '#fff',
    fontWeight: 'bold',
  },
  entryCount: {
    fontSize: 10,
    color: '#666',
    fontWeight: 'bold',
  },
  selectedDateInfo: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    marginTop: 20,
  },
  selectedDateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  entryInfoCard: {
    padding: 15,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  entryInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  entryInfoText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 8,
  },
  moodInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  moodText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  noEntryCard: {
    alignItems: 'center',
    padding: 20,
  },
  noEntryText: {
    fontSize: 16,
    color: '#666',
    marginVertical: 10,
  },
  createEntryButton: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 10,
  },
  createEntryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  legend: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    marginTop: 20,
    marginBottom: 20,
  },
  legendTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  legendItems: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '48%', // Create a 2-column grid
    marginBottom: 8,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 5,
  },
  legendText: {
    fontSize: 12,
    color: '#666',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  tradesOverview: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    padding: 15,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  tradesOverviewText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 8,
    fontWeight: '500',
  },
  entryItem: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#4A90E2',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  entryItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  entryItemTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  resultBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  resultBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  entryItemTime: {
    fontSize: 12,
    color: '#666',
  },
  backButtonOverlay: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 1000,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 20,
    padding: 8,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 15,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  titleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#E6F3FF',
  },
  accountIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginLeft: 10,
  },
  accountDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  accountName: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '500',
    maxWidth: 80,
  },
});

export default CalendarScreen;