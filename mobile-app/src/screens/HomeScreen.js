import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { journalAPI } from '../services/api';
import { useAccount } from '../context/AccountContext';
import { useAccountChange } from '../context/useAccountChange';
import { parseBackendTimestamp } from '../utils/dateUtils';

const { width: screenWidth } = Dimensions.get('window');

const HomeScreen = ({ navigation }) => {
  const { currentAccount, accounts, isLoading: accountLoading } = useAccount();
  const [analytics, setAnalytics] = useState({
    totalTrades: 0,
    winRate: 0,
    thisWeekTrades: 0,
    wins: 0,
    losses: 0,
    breakevens: 0,
    recentTrades: [],
  });
  const [loading, setLoading] = useState(true);

  // Debug logging
  useEffect(() => {
    console.log('HomeScreen: State update - accountLoading:', accountLoading, 'loading:', loading, 'currentAccount:', currentAccount?.name);
  }, [accountLoading, loading, currentAccount]);

  useEffect(() => {
    console.log('HomeScreen: useEffect triggered - currentAccount:', currentAccount?.name, 'accountLoading:', accountLoading);
    if (currentAccount && !accountLoading) {
      console.log('HomeScreen: Calling loadAnalytics');
      loadAnalytics();
    } else if (!accountLoading) {
      console.log('HomeScreen: No current account, setting loading to false');
      setLoading(false);
    }
  }, [currentAccount, accountLoading]);

  // Refresh data when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      console.log('HomeScreen: useFocusEffect triggered');
      if (currentAccount && !accountLoading) {
        console.log('HomeScreen: Focus effect calling loadAnalytics');
        loadAnalytics();
      } else if (!accountLoading) {
        console.log('HomeScreen: Focus effect setting loading to false');
        setLoading(false);
      }
    }, [currentAccount, accountLoading])
  );

  // Reload analytics when account changes
  useAccountChange((newAccount, previousAccount) => {
    if (newAccount && newAccount.id !== previousAccount?.id) {
      console.log('HomeScreen: Account changed from', previousAccount?.name, 'to', newAccount?.name);
      setAnalytics({
        totalTrades: 0,
        winRate: 0,
        thisWeekTrades: 0,
        wins: 0,
        losses: 0,
        breakevens: 0,
        recentTrades: [],
      });
      loadAnalytics();
    }
  });

  const loadAnalytics = async () => {
    if (!currentAccount) return;

    console.log('HomeScreen: Loading analytics for account:', currentAccount.name, 'ID:', currentAccount.id);
    setLoading(true);
    try {
      // Optional: import MT5 trades from backend into local DB
      const syncResult = await journalAPI.syncMt5Entries(currentAccount.id);
      console.log('HomeScreen: MT5 sync result:', syncResult);
      const response = await journalAPI.getEntries(1, 100, '', currentAccount.id); // Get all recent entries for current account
      const entries = response.entries;
      console.log('HomeScreen: Found', entries.length, 'entries for account', currentAccount.name);

      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      let wins = 0, losses = 0, breakevens = 0;
      let thisWeekCount = 0;
      const recentTrades = [];

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

      entries.forEach(entry => {
        const tradeResult = extractTradeResult(entry);

        if (tradeResult === 'WIN') wins++;
        else if (tradeResult === 'LOSS') losses++;
        else if (tradeResult === 'BREAKEVEN') breakevens++;

        const contentDate = extractContentDate(entry.content);
        const entryDate = contentDate || parseBackendTimestamp(entry.created_at);
        if (entryDate && entryDate >= weekAgo) thisWeekCount++;

        if (recentTrades.length < 5) {
          recentTrades.push({
            id: entry.id,
            currencyPair: entry.symbol || extractCurrencyPairs(entry.content),
            result: tradeResult,
            date: entryDate,
            fullEntry: entry,
          });
        }
      });

      const totalTrades = wins + losses + breakevens;
      const winRate = totalTrades > 0 ? ((wins / totalTrades) * 100) : 0;

      setAnalytics({
        totalTrades,
        winRate: Math.round(winRate),
        thisWeekTrades: thisWeekCount,
        wins,
        losses,
        breakevens,
        recentTrades,
      });

      console.log('HomeScreen: Analytics loaded successfully');
    } catch (error) {
      console.error('Error loading analytics:', error);
      Alert.alert('Error', 'Failed to load trading analytics');
    } finally {
      console.log('HomeScreen: Setting loading to false');
      setLoading(false);
    }
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
        const match = line.match(/- \[x\]\s*(GOLD|[A-Z]{6,7})/i);
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

  const getResultColor = (result) => {
    switch (result) {
      case 'WIN': return '#50C878';
      case 'LOSS': return '#FF6B6B';
      case 'BREAKEVEN': return '#4A90E2';
      default: return '#666';
    }
  };

  const dashboardItems = [
    {
      title: 'Account Growth',
      subtitle: 'Visualize capital growth',
      icon: 'trending-up',
      colors: ['#667eea', '#764ba2'],
      onPress: () => navigation.navigate('Settings', { screen: 'AccountGrowth' }),
    },
    {
      title: 'View All Trades',
      subtitle: 'Review trading history',
      icon: 'list',
      colors: ['#f093fb', '#f5576c'],
      onPress: () => navigation.navigate('Journal'),
    },
    {
      title: 'Trading Calendar',
      subtitle: 'Track daily performance',
      icon: 'calendar',
      colors: ['#4facfe', '#00f2fe'],
      onPress: () => navigation.navigate('Settings', { screen: 'Calendar' }),
    },
  ];

  console.log('HomeScreen: Render check - loading:', loading, 'accountLoading:', accountLoading, 'currentAccount:', currentAccount?.name);

  if (loading || accountLoading) {
    console.log('HomeScreen: Showing loading screen because loading:', loading, 'accountLoading:', accountLoading);
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient
          colors={['#667eea', '#764ba2']}
          style={styles.loadingGradient}
        >
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Loading trading analytics...</Text>
        </LinearGradient>
      </View>
    );
  }

  // Show no accounts state or no active account state
  if (!currentAccount) {
    const hasAccounts = accounts && accounts.length > 0;

    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#667eea" />
        <LinearGradient
          colors={['#667eea', '#764ba2']}
          style={styles.header}
        >
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.greeting}>
                Forex Trading Journal
              </Text>
              <Text style={styles.subGreeting}>
                {hasAccounts ? 'Select an account to continue' : 'Professional trading analytics'}
              </Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.noAccountContainer}>
          <View style={styles.noAccountIconContainer}>
            <Ionicons name={hasAccounts ? "checkmark-circle-outline" : "trending-up"} size={60} color="#667eea" />
          </View>
          <Text style={styles.noAccountTitle}>
            {hasAccounts ? 'Choose Active Account' : 'Start Your Trading Journey'}
          </Text>
          <Text style={styles.noAccountText}>
            {hasAccounts
              ? 'You have existing accounts but none are currently active. Please select an account from Settings to view your trading data.'
              : 'Create your first trading account and begin tracking your forex trades with professional analytics and insights.'
            }
          </Text>

          {hasAccounts && (
            <View style={styles.existingAccountsList}>
              <Text style={styles.existingAccountsTitle}>Available Accounts:</Text>
              {accounts.map(account => (
                <Text key={account.id} style={styles.existingAccountItem}>
                  • {account.name}
                </Text>
              ))}
            </View>
          )}

          <TouchableOpacity
            style={styles.createAccountButton}
            onPress={() => navigation.navigate('Settings')}
          >
            <LinearGradient
              colors={['#667eea', '#764ba2']}
              style={styles.createAccountGradient}
            >
              <Ionicons name={hasAccounts ? "settings" : "add-circle"} size={20} color="#fff" />
              <Text style={styles.createAccountButtonText}>
                {hasAccounts ? 'Open Settings' : 'Create Account'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#667eea" />
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Modern Header with Gradient */}
        <LinearGradient
          colors={['#667eea', '#764ba2']}
          style={styles.header}
        >
          <View style={styles.headerTop}>
            <View style={styles.headerLeft}>
              <Text style={styles.greeting}>
                Trading Dashboard
              </Text>
              <Text style={styles.subGreeting}>
                Monitor your forex performance
              </Text>
            </View>
            {currentAccount && (
              <View style={styles.accountIndicator}>
                <View style={[styles.accountDot, { backgroundColor: currentAccount.color || '#fff' }]} />
                <Text style={styles.accountName}>{currentAccount.name}</Text>
              </View>
            )}
          </View>
        </LinearGradient>

        {/* Enhanced Performance Cards */}
        <View style={styles.performanceSection}>
          <Text style={styles.sectionTitle}>Performance Overview</Text>

          {/* Main Stats Row */}
          <View style={styles.statsRow}>
            <View style={styles.primaryStatCard}>
              <LinearGradient
                colors={['#667eea', '#764ba2']}
                style={styles.statCardGradient}
              >
                <Ionicons name="trending-up" size={24} color="#fff" />
                <Text style={styles.primaryStatNumber}>{analytics.totalTrades}</Text>
                <Text style={styles.primaryStatLabel}>Total Trades</Text>
              </LinearGradient>
            </View>

            <View style={styles.primaryStatCard}>
              <LinearGradient
                colors={analytics.winRate >= 60 ? ['#00b09b', '#96c93d'] : analytics.winRate >= 40 ? ['#f093fb', '#f5576c'] : ['#ff5858', '#ff093c']}
                style={styles.statCardGradient}
              >
                <Ionicons name="trophy" size={24} color="#fff" />
                <Text style={styles.primaryStatNumber}>{analytics.winRate}%</Text>
                <Text style={styles.primaryStatLabel}>Win Rate</Text>
              </LinearGradient>
            </View>
          </View>

          {/* This Week Card */}
          <View style={styles.weekCard}>
            <View style={styles.weekCardHeader}>
              <Ionicons name="calendar" size={20} color="#667eea" />
              <Text style={styles.weekCardTitle}>This Week Activity</Text>
            </View>
            <Text style={styles.weekCardNumber}>{analytics.thisWeekTrades}</Text>
            <Text style={styles.weekCardLabel}>trades completed</Text>
          </View>
        </View>

        {/* Modern Trade Breakdown */}
        <View style={styles.breakdownSection}>
          <Text style={styles.sectionTitle}>Trade Analysis</Text>
          <View style={styles.breakdownContainer}>
            <TouchableOpacity
              style={styles.breakdownItem}
              onPress={() => navigation.navigate('Journal', { screen: 'JournalList', params: { filter: 'WIN' } })}
            >
              <View style={[styles.breakdownIcon, { backgroundColor: '#00b09b' }]}>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
              </View>
              <Text style={styles.breakdownNumber}>{analytics.wins}</Text>
              <Text style={styles.breakdownLabel}>Wins</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.breakdownItem}
              onPress={() => navigation.navigate('Journal', { screen: 'JournalList', params: { filter: 'LOSS' } })}
            >
              <View style={[styles.breakdownIcon, { backgroundColor: '#ff5858' }]}>
                <Ionicons name="close-circle" size={20} color="#fff" />
              </View>
              <Text style={styles.breakdownNumber}>{analytics.losses}</Text>
              <Text style={styles.breakdownLabel}>Losses</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.breakdownItem}
              onPress={() => navigation.navigate('Journal', { screen: 'JournalList', params: { filter: 'BREAKEVEN' } })}
            >
              <View style={[styles.breakdownIcon, { backgroundColor: '#4facfe' }]}>
                <Ionicons name="remove-circle" size={20} color="#fff" />
              </View>
              <Text style={styles.breakdownNumber}>{analytics.breakevens}</Text>
              <Text style={styles.breakdownLabel}>Breakeven</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Enhanced Quick Actions */}
        <View style={styles.quickActions}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          {dashboardItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.actionCard}
              onPress={item.onPress}
            >
              <LinearGradient
                colors={item.colors}
                style={styles.actionIconContainer}
              >
                <Ionicons name={item.icon} size={24} color="#fff" />
              </LinearGradient>
              <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>{item.title}</Text>
                <Text style={styles.actionSubtitle}>{item.subtitle}</Text>
              </View>
              <View style={styles.actionArrow}>
                <Ionicons name="chevron-forward" size={20} color="#c1c1c1" />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Enhanced Recent Trades */}
        {analytics.recentTrades.length > 0 && (
          <View style={styles.recentSection}>
            <View style={styles.recentHeader}>
              <Text style={styles.sectionTitle}>Recent Trades</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Journal')}>
                <Text style={styles.viewAllText}>View All</Text>
              </TouchableOpacity>
            </View>
            {analytics.recentTrades.map((trade, index) => (
              <TouchableOpacity
                key={trade.id}
                style={styles.modernTradeCard}
                onPress={() => navigation.navigate('Journal', { screen: 'EntryDetail', params: { entry: trade.fullEntry } })}
              >
                <View style={styles.tradeCardLeft}>
                  <View style={[styles.tradeIcon, { backgroundColor: getResultColor(trade.result) + '20' }]}>
                    <Ionicons
                      name={trade.result === 'WIN' ? 'trending-up' : trade.result === 'LOSS' ? 'trending-down' : 'remove'}
                      size={16}
                      color={getResultColor(trade.result)}
                    />
                  </View>
                  <View style={styles.tradeInfo}>
                    <View>
                      <Text style={styles.modernTradePair}>{trade.currencyPair}</Text>
                      {trade.fullEntry.mt5_ticket && (
                        <Text style={{ fontSize: 10, color: '#1976D2', fontWeight: 'bold', marginTop: 2 }}>MT5 AUTO</Text>
                      )}
                    </View>
                    <Text style={styles.modernTradeDate}>
                      {trade.date ? trade.date.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZone: 'Africa/Kampala'
                      }) : 'No Date'}
                    </Text>
                  </View>
                </View>
                <View style={[styles.modernTradeResult, { backgroundColor: getResultColor(trade.result), alignItems: 'flex-end', paddingRight: 8 }]}>
                  <Text style={styles.modernTradeResultText}>{trade.result}</Text>
                  {trade.fullEntry.pnl != null && (
                    <Text style={{ fontSize: 11, color: '#fff', fontWeight: 'bold' }}>
                      {Number(trade.fullEntry.pnl) >= 0 ? '+' : ''}${Number(trade.fullEntry.pnl).toFixed(2)}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Enhanced Inspiration Section */}
        <View style={styles.inspirationSection}>
          <View style={styles.quoteCard}>
            <LinearGradient
              colors={['#667eea', '#764ba2']}
              style={styles.quoteGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="bulb-outline" size={24} color="rgba(255,255,255,0.8)" />
              <Text style={styles.quote}>
                "The key to trading success is emotional discipline."
              </Text>
              <Text style={styles.quoteAuthor}>- Victor Sperandeo</Text>
            </LinearGradient>
          </View>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
  },
  loadingGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
  header: {
    paddingTop: 50,
    paddingBottom: 30,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    flex: 1,
  },
  accountIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginLeft: 16,
  },
  accountDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  accountName: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  greeting: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  subGreeting: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '400',
  },

  // Performance Section
  performanceSection: {
    padding: 20,
    paddingTop: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a202c',
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 20,
  },
  primaryStatCard: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  statCardGradient: {
    padding: 20,
    alignItems: 'center',
    minHeight: 120,
    justifyContent: 'center',
  },
  primaryStatNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 8,
    marginBottom: 4,
  },
  primaryStatLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
  },
  weekCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  weekCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  weekCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4a5568',
    marginLeft: 8,
  },
  weekCardNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#667eea',
    marginBottom: 4,
  },
  weekCardLabel: {
    fontSize: 14,
    color: '#718096',
  },

  // Breakdown Section
  breakdownSection: {
    padding: 20,
    paddingTop: 0,
  },
  breakdownContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    justifyContent: 'space-between',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  breakdownItem: {
    alignItems: 'center',
    flex: 1,
  },
  breakdownIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  breakdownNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a202c',
    marginBottom: 4,
  },
  breakdownLabel: {
    fontSize: 12,
    color: '#718096',
    fontWeight: '500',
  },

  // Quick Actions
  quickActions: {
    padding: 20,
    paddingTop: 0,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  actionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a202c',
    marginBottom: 2,
  },
  actionSubtitle: {
    fontSize: 14,
    color: '#718096',
  },
  actionArrow: {
    padding: 4,
  },

  // Recent Trades
  recentSection: {
    padding: 20,
    paddingTop: 0,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  viewAllText: {
    fontSize: 14,
    color: '#667eea',
    fontWeight: '600',
  },
  modernTradeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  tradeCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  tradeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  tradeInfo: {
    flex: 1,
  },
  modernTradePair: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a202c',
    marginBottom: 2,
  },
  modernTradeDate: {
    fontSize: 12,
    color: '#718096',
  },
  modernTradeResult: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  modernTradeResultText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },

  // Inspiration Section
  inspirationSection: {
    padding: 20,
    paddingTop: 0,
  },
  quoteCard: {
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  quoteGradient: {
    padding: 24,
  },
  quote: {
    fontSize: 16,
    fontStyle: 'italic',
    color: '#fff',
    lineHeight: 24,
    marginTop: 12,
    marginBottom: 16,
  },
  quoteAuthor: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'right',
    fontWeight: '500',
  },

  // No Account State
  noAccountContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  noAccountIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(102, 126, 234, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  noAccountTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a202c',
    marginBottom: 12,
    textAlign: 'center',
  },
  noAccountText: {
    fontSize: 16,
    color: '#718096',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  existingAccountsList: {
    backgroundColor: '#f7fafc',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    width: '100%',
  },
  existingAccountsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: 8,
  },
  existingAccountItem: {
    fontSize: 14,
    color: '#4a5568',
    marginBottom: 4,
  },
  createAccountButton: {
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  createAccountGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  createAccountButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  bottomPadding: {
    height: 20,
  },
});

export default HomeScreen;