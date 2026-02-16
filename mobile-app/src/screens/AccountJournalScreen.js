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
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { journalAPI } from '../services/api';

const AccountJournalScreen = ({ route, navigation }) => {
  const { account } = route.params;
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [accountStats, setAccountStats] = useState({
    totalTrades: 0,
    wins: 0,
    losses: 0,
    breakevens: 0,
    winRate: 0,
  });

  useEffect(() => {
    loadEntries();
  }, []);

  const loadEntries = async (pageNum = 1, search = '', isRefresh = false) => {
    if (loading && !isRefresh) return;

    setLoading(true);
    try {
      const response = await journalAPI.getEntries(pageNum, 10, search, account.id);

      // Filter entries for this specific account (for now, show all entries)
      // In a real implementation, you'd filter by account ID
      const accountEntries = response.entries;

      if (isRefresh || pageNum === 1) {
        setEntries(accountEntries);
      } else {
        setEntries(prev => [...prev, ...accountEntries]);
      }

      // Calculate account-specific stats
      calculateAccountStats(accountEntries);

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

  const calculateAccountStats = (entries) => {
    let wins = 0, losses = 0, breakevens = 0;

    entries.forEach(entry => {
      const result = extractTradeResult(entry);
      if (result === 'WIN') wins++;
      else if (result === 'LOSS') losses++;
      else if (result === 'BREAKEVEN') breakevens++;
    });

    const totalTrades = wins + losses + breakevens;
    const winRate = totalTrades > 0 ? Math.round((wins / totalTrades) * 100) : 0;

    setAccountStats({ totalTrades, wins, losses, breakevens, winRate });
  };

  const handleRefresh = () => {
    setRefreshing(true);
    setPage(1);
    setHasMore(true);
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
      setPage(1);
      setHasMore(true);
      loadEntries(1, query, true);
    }
  };

  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);

      if (isNaN(date.getTime())) {
        return 'Invalid Date';
      }

      const now = new Date();
      const isToday = date.toDateString() === now.toDateString();
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const isYesterday = date.toDateString() === yesterday.toDateString();

      if (isToday) {
        return 'Today';
      } else if (isYesterday) {
        return 'Yesterday';
      } else {
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });
      }
    } catch (error) {
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
        const match = line.match(/- \[x\]\s*([A-Z]+(?:USD|EUR|GBP|JPY|CHF|CAD|AUD|NZD|GOLD))/);
        if (match) {
          return match[1];
        }
      }
    }
    return 'Unknown';
  };

  const extractTradeResult = (entry) => {
    // For MT5 entries, use pnl column directly
    if (entry.mt5_ticket) {
      if (entry.pnl == null) return 'OPEN';
      const pnl = Number(entry.pnl);
      if (pnl > 0.01) return 'WIN';
      if (pnl < -0.01) return 'LOSS';
      return 'BREAKEVEN';
    }
    const content = entry.content;
    if (!content || typeof content !== 'string') return 'UNKNOWN';
    if (content.includes('- [x] WIN')) return 'WIN';
    if (content.includes('- [x] LOSS')) return 'LOSS';
    if (content.includes('- [x] BREAKEVEN')) return 'BREAKEVEN';
    return 'UNKNOWN';
  };

  const getCardColor = (result) => {
    switch (result) {
      case 'WIN': return '#50C878';
      case 'LOSS': return '#FF6B6B';
      case 'BREAKEVEN': return '#4A90E2';
      default: return '#f0f0f0';
    }
  };

  const renderEntry = ({ item }) => {
    const currencyPairs = item.symbol || extractCurrencyPairs(item.content);
    const tradeResult = extractTradeResult(item);
    const cardColor = getCardColor(tradeResult);
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
            <Text style={styles.entryDate}>
              {displayDateLabel}
            </Text>
          </View>
        </View>

        <Text style={styles.entryContent} numberOfLines={2}>
          {item.content.split('\n')[0].replace('Date: ', '')}
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
      <Text style={styles.emptyTitle}>No trades yet</Text>
      <Text style={styles.emptySubtitle}>
        Trades for {account.name} will appear here automatically from MetaTrader 5.
      </Text>
    </View>
  );

  const renderFooter = () => {
    if (!loading) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color="#4A90E2" />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.title}>{account.name}</Text>
          <Text style={styles.subtitle}>
            {account.description || 'Trading Account'}
          </Text>
          <Text style={styles.balance}>
            Balance: {account.currency || 'USD'} {(account.balance || 0).toLocaleString()}
          </Text>
        </View>
        <View style={styles.headerSpacer} />
      </LinearGradient>

      {/* Account Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{accountStats.totalTrades}</Text>
          <Text style={styles.statLabel}>Total Trades</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: accountStats.winRate >= 60 ? '#50C878' : '#FF6B6B' }]}>
            {accountStats.winRate}%
          </Text>
          <Text style={styles.statLabel}>Win Rate</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: '#50C878' }]}>{accountStats.wins}</Text>
          <Text style={styles.statLabel}>Wins</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: '#FF6B6B' }]}>{accountStats.losses}</Text>
          <Text style={styles.statLabel}>Losses</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search your trades..."
          value={searchQuery}
          onChangeText={handleSearch}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            onPress={() => handleSearch('')}
            style={styles.clearButton}
          >
            <Ionicons name="close-circle" size={20} color="#999" />
          </TouchableOpacity>
        )}
      </View>

      {/* Journal Entries */}
      <FlatList
        data={entries}
        renderItem={renderEntry}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={[
          styles.listContainer,
          entries.length === 0 && styles.emptyContainer
        ]}
        ListEmptyComponent={!loading ? renderEmptyState : null}
        ListFooterComponent={renderFooter}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.1}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#4A90E2',
    paddingTop: 50,
    paddingBottom: 20,
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
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#E6F3FF',
    marginBottom: 4,
    textAlign: 'center',
  },
  balance: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
    textAlign: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 20,
    paddingHorizontal: 10,
    justifyContent: 'space-around',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4A90E2',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 20,
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  clearButton: {
    marginLeft: 10,
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  entryCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
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
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  entryDate: {
    fontSize: 12,
    color: '#999',
  },
  entryContent: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 8,
  },
  entryFooter: {
    alignItems: 'flex-end',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
    paddingHorizontal: 40,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4A90E2',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  footer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4A90E2',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
});

export default AccountJournalScreen;