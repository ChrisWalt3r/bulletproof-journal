import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  RefreshControl,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { journalAPI } from '../services/api';
import { useAccount } from '../context/AccountContext';
import AccountHeader from '../components/AccountHeader';
import { useAccountChange } from '../context/useAccountChange';

const JournalListScreen = ({ navigation, route }) => {
  const { currentAccount, isLoading: accountLoading } = useAccount();
  const [entries, setEntries] = useState([]);
  const [filteredEntries, setFilteredEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Filters
  const [activeFilter, setActiveFilter] = useState(route.params?.filter || 'ALL');
  const [dateFilter, setDateFilter] = useState('ALL_TIME'); // 'ALL_TIME', 'TODAY', 'WEEK', 'MONTH'

  useEffect(() => {
    if (route.params?.filter) {
      setActiveFilter(route.params.filter);
    }
  }, [route.params?.filter]);

  useEffect(() => {
    if (currentAccount && !accountLoading) {
      loadEntries();
    }
  }, [currentAccount, accountLoading]);

  useEffect(() => {
    applyFilters();
  }, [entries, activeFilter, dateFilter, searchQuery]);

  const applyFilters = () => {
    let result = [...entries];

    // Apply Outcome Filter
    if (activeFilter !== 'ALL') {
      result = result.filter(entry => extractTradeResult(entry) === activeFilter);
    }

    // Apply Date Filter
    if (dateFilter && dateFilter !== 'ALL_TIME') {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      result = result.filter(entry => {
        const entryDate = extractContentDate(entry.content) || new Date(entry.created_at);

        if (dateFilter === 'TODAY') {
          return entryDate >= startOfDay;
        } else if (dateFilter === 'WEEK') {
          const startOfWeek = new Date(now);
          startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday as start
          startOfWeek.setHours(0, 0, 0, 0);
          return entryDate >= startOfWeek;
        } else if (dateFilter === 'MONTH') {
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          return entryDate >= startOfMonth;
        }
        return true;
      });
    }

    // Apply Search Filter (Client-side for now to work with other filters)
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(entry =>
        entry.title.toLowerCase().includes(query) ||
        entry.content.toLowerCase().includes(query) ||
        extractCurrencyPairs(entry.content).toLowerCase().includes(query)
      );
    }

    setFilteredEntries(result);
  };

  // Refresh data when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (currentAccount && !accountLoading) {
        loadEntries(1, searchQuery, true);
      }
    }, [currentAccount, accountLoading, searchQuery])
  );

  // Reload entries when account changes
  useAccountChange((newAccount, previousAccount) => {
    if (newAccount && newAccount.id !== previousAccount?.id) {
      console.log('JournalListScreen: Account changed from', previousAccount?.name, 'to', newAccount?.name);
      setEntries([]); // Clear existing entries
      setPage(1);
      setHasMore(true);
      loadEntries(1, searchQuery, true); // Refresh entries
    }
  });

  const loadEntries = async (pageNum = 1, search = '', isRefresh = false) => {
    if (loading && !isRefresh) return;
    if (!currentAccount) return;

    console.log('JournalListScreen: Loading entries for account:', currentAccount.name, 'ID:', currentAccount.id);
    setLoading(true);
    try {
      // Optional: import MT5 trades from backend into local DB
      if (pageNum === 1) {
        const syncResult = await journalAPI.syncMt5Entries(currentAccount.id);
        console.log('JournalListScreen: MT5 sync result:', syncResult);
      }
      const response = await journalAPI.getEntries(pageNum, 10, search, currentAccount.id);
      console.log('JournalListScreen: Found', response.entries.length, 'entries for account', currentAccount.name);

      if (isRefresh || pageNum === 1) {
        setEntries(response.entries);
      } else {
        setEntries(prev => [...prev, ...response.entries]);
      }

      setHasMore(response.pagination.page < response.pagination.pages);
      setPage(pageNum);
    } catch (error) {
      console.error('Error loading entries:', error);
      Alert.alert('Error', 'Failed to load journal entries');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadEntries(1, searchQuery, true);
  };

  const handleLoadMore = () => {
    if (hasMore && !loading) {
      loadEntries(page + 1, searchQuery);
    }
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
    if (query.length === 0 || query.length >= 2) {
      loadEntries(1, query, true);
    }
  };

  const formatDate = (dateString) => {
    try {
      // Parse the date string properly
      const date = new Date(dateString);

      // Check if date is valid
      if (isNaN(date.getTime())) {
        console.log('Invalid date:', dateString);
        return 'Invalid Date';
      }

      // Format for display with current date
      const now = new Date();
      const isToday = date.toDateString() === now.toDateString();
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const isYesterday = date.toDateString() === yesterday.toDateString();

      let dateLabel;
      if (isToday) {
        dateLabel = 'Today';
      } else if (isYesterday) {
        dateLabel = 'Yesterday';
      } else {
        dateLabel = date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });
      }

      // Add time
      const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return `${dateLabel} • ${time}`;
    } catch (error) {
      console.error('Date formatting error:', error, dateString);
      return 'Date Error';
    }
  };

  const extractContentDate = (content) => {
    if (!content || typeof content !== 'string') return null;
    const match = content.match(/^Date:\s*([A-Za-z]+),\s*([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/m);
    if (!match) return null;
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

  const extractCurrencyPairs = (content) => {
    // Extract currency pairs from content
    if (!content || typeof content !== 'string') return 'Unknown';
    const lines = content.split('\n');

    // Look for the checked currency pair under ### Pair: section
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
        // Extract the currency pair after [x]
        const match = line.match(/- \[x\]\s*([A-Z]+(?:USD|EUR|GBP|JPY|CHF|CAD|AUD|NZD|GOLD))/i);
        if (match) {
          return match[1];
        }
      }
    }

    // Fallback: try to extract from MT5 title format "MT5: BUY EURUSD" or "MT5 Exit: EURUSD"
    const titleMatch = content.match(/MT5(?:\s+Exit)?:\s+(?:BUY|SELL)?\s*([A-Z]+)/i);
    if (titleMatch) {
      return titleMatch[1];
    }

    return 'Unknown';
  };

  const extractTradeResult = (entry) => {
    const content = entry.content;
    // For MT5 entries, use pnl column directly
    if (entry.mt5_ticket) {
      if (entry.pnl == null) return 'OPEN';
      const pnl = Number(entry.pnl);
      if (pnl > 0.01) return 'WIN';
      if (pnl < -0.01) return 'LOSS';
      return 'BREAKEVEN';
    }
    if (!content || typeof content !== 'string') return 'UNKNOWN';
    if (content.includes('- [x] WIN')) return 'WIN';
    if (content.includes('- [x] LOSS')) return 'LOSS';
    if (content.includes('- [x] BREAKEVEN')) return 'BREAKEVEN';
    return 'UNKNOWN';
  };

  const getCardColor = (result) => {
    switch (result) {
      case 'WIN': return '#50C878'; // Green
      case 'LOSS': return '#FF6B6B'; // Red
      case 'BREAKEVEN': return '#4A90E2'; // Blue
      case 'OPEN': return '#FFA500'; // Orange
      default: return '#f0f0f0'; // Default gray
    }
  };

  const renderEntry = ({ item }) => {
    const currencyPairs = item.symbol || extractCurrencyPairs(item.content);
    const tradeResult = extractTradeResult(item);
    const cardColor = getCardColor(tradeResult);
    // Prefer the date embedded in entry.content for the display label
    const contentDateObj = extractContentDate(item.content);
    const displayDateLabel = contentDateObj
      ? (() => {
        const now = new Date();
        const isToday = contentDateObj.toDateString() === now.toDateString();
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const isYesterday = contentDateObj.toDateString() === yesterday.toDateString();
        if (isToday) return 'Today';
        if (isYesterday) return 'Yesterday';
        return contentDateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
      })()
      : formatDate(item.created_at);
    return (
      <TouchableOpacity
        style={[styles.entryCard, { borderLeftColor: cardColor, borderLeftWidth: 4 }]}
        onPress={() => navigation.navigate('EntryDetail', { entry: item })}
      >
        <View style={styles.entryHeader}>
          <View style={{ flex: 1, marginRight: 10 }}>
            <Text style={styles.entryTitle} numberOfLines={1}>
              {currencyPairs}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {item.mt5_ticket && (
                <View style={{ backgroundColor: '#E3F2FD', alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 4, marginRight: 6 }}>
                  <Text style={{ fontSize: 10, color: '#1976D2', fontWeight: 'bold' }}>MT5 AUTO</Text>
                </View>
              )}
              {item.is_plan_compliant && (
                <View style={{ backgroundColor: '#E8F5E9', alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 4 }}>
                  <Text style={{ fontSize: 10, color: '#2E7D32', fontWeight: 'bold' }}>PLAN WIN</Text>
                </View>
              )}
              {item.following_plan === true || item.following_plan === 'true' ? (
                <View style={{ backgroundColor: '#E8F5E9', alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 4, marginRight: 6 }}>
                  <Text style={{ fontSize: 10, color: '#2E7D32', fontWeight: 'bold' }}>ON PLAN</Text>
                </View>
              ) : item.following_plan === false || item.following_plan === 'false' ? (
                <View style={{ backgroundColor: '#FFEBEE', alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 4, marginRight: 6 }}>
                  <Text style={{ fontSize: 10, color: '#C62828', fontWeight: 'bold' }}>OFF PLAN</Text>
                </View>
              ) : (
                <View style={{ backgroundColor: '#FFF3E0', alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 4, marginRight: 6 }}>
                  <Text style={{ fontSize: 10, color: '#E65100', fontWeight: 'bold' }}>NEEDS REVIEW</Text>
                </View>
              )}
            </View>
          </View>
          <View style={styles.entryMeta}>
            <Text style={[styles.tradeResult, { color: cardColor }]}>
              {tradeResult}
            </Text>
            {item.pnl !== undefined && item.pnl !== null && (
              <Text style={{
                fontSize: 12,
                fontWeight: 'bold',
                color: Number(item.pnl) >= 0 ? '#50C878' : '#FF6B6B',
                marginTop: 2,
                textAlign: 'right'
              }}>
                {Number(item.pnl) >= 0 ? '+' : ''}${Number(item.pnl).toFixed(2)}
              </Text>
            )}
            <Text style={styles.entryDate}>
              {displayDateLabel}
            </Text>
          </View>
        </View>

        <Text style={styles.entryContent} numberOfLines={2}>
          {item.content ? item.content.split('\n')[0].replace('Date: ', '') : 'No content available'}
        </Text>

        <View style={styles.entryFooter}>
          <Ionicons name="chevron-forward" size={16} color="#ccc" />
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="book-outline" size={64} color="#ccc" />
      <Text style={styles.emptyTitle}>No entries yet</Text>
      <Text style={styles.emptySubtitle}>
        Place a trade in MetaTrader 5 to see it appear here automatically.
      </Text>
    </View>
  );

  // Show no accounts state
  if (!currentAccount && !accountLoading) {
    return (
      <View style={styles.container}>
        <AccountHeader
          title="Trading Journal"
          subtitle="Select an account to view entries"
        />

        <View style={styles.noAccountContainer}>
          <Ionicons name="wallet-outline" size={80} color="#ccc" />
          <Text style={styles.noAccountTitle}>No Account Selected</Text>
          <Text style={styles.noAccountText}>
            Create a trading account to start journaling your forex trades.
          </Text>
          <TouchableOpacity
            style={styles.createAccountButton}
            onPress={() => navigation.navigate('Settings')}
          >
            <Ionicons name="add-circle" size={20} color="#fff" />
            <Text style={styles.createAccountButtonText}>Create Account</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AccountHeader
        title="Trading Journal"
        subtitle="Your forex trading history"
      />

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search pair, notes..."
          value={searchQuery}
          onChangeText={handleSearch}
        />
      </View>

      {/* Filter Chips */}
      <View style={styles.filtersWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          {['ALL', 'WIN', 'LOSS', 'BREAKEVEN'].map(filter => (
            <TouchableOpacity
              key={filter}
              style={[
                styles.filterChip,
                activeFilter === filter && styles.activeFilterChip,
                activeFilter === filter && { backgroundColor: getCardColor(filter) === '#f0f0f0' ? '#667eea' : getCardColor(filter) }
              ]}
              onPress={() => setActiveFilter(filter)}
            >
              <Text style={[
                styles.filterText,
                activeFilter === filter && styles.activeFilterText
              ]}>
                {filter}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          {[
            { id: 'ALL_TIME', label: 'All Time' },
            { id: 'TODAY', label: 'Today' },
            { id: 'WEEK', label: 'This Week' },
            { id: 'MONTH', label: 'This Month' }
          ].map(filter => (
            <TouchableOpacity
              key={filter.id}
              style={[
                styles.filterChip,
                dateFilter === filter.id && styles.activeFilterChip,
                dateFilter === filter.id && { backgroundColor: '#667eea' }
              ]}
              onPress={() => setDateFilter(filter.id)}
            >
              <Text style={[
                styles.filterText,
                dateFilter === filter.id && styles.activeFilterText
              ]}>
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={filteredEntries}
        renderItem={renderEntry}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#4A90E2']}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.1}
        ListEmptyComponent={!loading ? renderEmptyState : null}
        showsVerticalScrollIndicator={false}
      />

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 15,
    paddingHorizontal: 15,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 15,
    fontSize: 16,
  },
  filtersWrapper: {
    marginBottom: 10,
  },
  filterScroll: {
    paddingHorizontal: 15,
    marginBottom: 10,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  activeFilterChip: {
    borderWidth: 0,
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  activeFilterText: {
    color: '#fff',
  },
  listContainer: {
    paddingHorizontal: 15,
    paddingBottom: 80, // Extra padding for FAB
  },
  entryCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  entryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    marginRight: 10,
  },
  entryMeta: {
    alignItems: 'flex-end',
  },
  tradeResult: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  entryDate: {
    fontSize: 12,
    color: '#666',
  },
  entryContent: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 15,
  },
  entryFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 10,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 24,
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4A90E2',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  noAccountContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  noAccountTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 10,
  },
  noAccountText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 30,
  },
  createAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4A90E2',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createAccountButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default JournalListScreen;