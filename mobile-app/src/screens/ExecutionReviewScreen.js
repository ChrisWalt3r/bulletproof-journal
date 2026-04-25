import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  TextInput,
  Alert,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { journalAPI } from '../services/api';
import { useAccount } from '../context/AccountContext';
import { formatKampalaDateTime } from '../utils/dateUtils';
import { formatTradeDateTitle, getEntryTradeDate, isEntryInCustomDateRange, parseCustomDateInput } from '../utils/tradeDates';

const getCurrencyPair = (content, symbol) => {
  if (symbol) return symbol;
  if (!content || typeof content !== 'string') return 'Unknown';

  const lines = content.split('\n');
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
      const match = line.match(/- \[x\]\s*(GOLD|[A-Z]{6,7})/i);
      if (match) {
        return match[1];
      }
    }
  }

  const titleMatch = content.match(/MT5(?:\s+Exit)?:\s+(?:BUY|SELL)?\s*([A-Z]+)/i);
  if (titleMatch) return titleMatch[1];

  return 'Unknown';
};

const getTradeResult = (entry) => {
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

const getResultColor = (result) => {
  switch (result) {
    case 'WIN': return '#50C878';
    case 'LOSS': return '#FF6B6B';
    case 'BREAKEVEN': return '#4A90E2';
    case 'OPEN': return '#FFA500';
    default: return '#666';
  }
};

const ExecutionReviewScreen = ({ navigation }) => {
  const { currentAccount } = useAccount();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startDateInput, setStartDateInput] = useState('');
  const [endDateInput, setEndDateInput] = useState('');
  const [appliedStartDate, setAppliedStartDate] = useState(null);
  const [appliedEndDate, setAppliedEndDate] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadExecutionImages = useCallback(async () => {
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
      console.error('Error loading execution review entries:', error);
      Alert.alert('Error', 'Failed to load execution review images');
      setEntries([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentAccount?.id]);

  useFocusEffect(
    useCallback(() => {
      loadExecutionImages();
    }, [loadExecutionImages])
  );

  const filteredEntries = useMemo(() => {
    return entries
      .filter((entry) => isEntryInCustomDateRange(entry, appliedStartDate, appliedEndDate))
      .sort((a, b) => {
        const left = getEntryTradeDate(b)?.getTime?.() || 0;
        const right = getEntryTradeDate(a)?.getTime?.() || 0;
        return left - right;
      });
  }, [entries, appliedStartDate, appliedEndDate]);

  const handleApplyFilter = () => {
    const startDate = parseCustomDateInput(startDateInput);
    const endDate = parseCustomDateInput(endDateInput);

    if (startDateInput.trim() && startDate === undefined) {
      Alert.alert('Invalid Date', 'Use YYYY-MM-DD for the start date.');
      return;
    }

    if (endDateInput.trim() && endDate === undefined) {
      Alert.alert('Invalid Date', 'Use YYYY-MM-DD for the end date.');
      return;
    }

    if (startDate && endDate && startDate > endDate) {
      Alert.alert('Invalid Range', 'Start date must be before end date.');
      return;
    }

    setAppliedStartDate(startDate || null);
    setAppliedEndDate(endDate || null);
  };

  const handleClearFilter = () => {
    setStartDateInput('');
    setEndDateInput('');
    setAppliedStartDate(null);
    setAppliedEndDate(null);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadExecutionImages();
  };

  const renderItem = ({ item }) => {
    const tradeResult = getTradeResult(item);
    const currencyPair = getCurrencyPair(item.content, item.symbol);
    const tradeDateTitle = formatTradeDateTitle(item);
    const tradeTime = item.created_at ? formatKampalaDateTime(item.created_at) : '';

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('EntryDetail', { entry: item })}
      >
        <Image source={{ uri: item.execution_tf_image_url }} style={styles.thumbnail} />
        <View style={styles.cardBody}>
          <View style={styles.cardTopRow}>
            <Text style={styles.cardTitle}>{tradeDateTitle}</Text>
            <View style={[styles.resultBadge, { backgroundColor: getResultColor(tradeResult) }]}>
              <Text style={styles.resultText}>{tradeResult}</Text>
            </View>
          </View>
          <Text style={styles.cardSubtitle}>{currencyPair}</Text>
          <Text style={styles.cardMeta}>{tradeTime || 'Trade date not available'}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#B0B7C3" />
      </TouchableOpacity>
    );
  };

  const emptyStateText = () => {
    if (loading) return 'Loading execution images...';
    if (!currentAccount?.id) return 'Select a trading account to view execution images.';
    if (entries.length === 0) return 'No trades have an execution timeframe image yet.';
    return 'No execution images match the selected date range.';
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#667eea" />
      <LinearGradient colors={['#667eea', '#764ba2']} style={styles.header}>
        <Text style={styles.title}>Execution Review</Text>
        <Text style={styles.subtitle}>Browse execution timeframe images and open the exact trade.</Text>
      </LinearGradient>

      <FlatList
        data={filteredEntries}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        ListHeaderComponent={(
          <View>
            <View style={styles.filterCard}>
              <Text style={styles.sectionTitle}>Custom Time Filter</Text>
              <Text style={styles.sectionSubtitle}>Use YYYY-MM-DD and leave either side blank if needed.</Text>

              <View style={styles.filterRow}>
                <View style={styles.filterField}>
                  <Text style={styles.filterLabel}>From</Text>
                  <TextInput
                    style={styles.filterInput}
                    value={startDateInput}
                    onChangeText={setStartDateInput}
                    placeholder="2026-04-01"
                    placeholderTextColor="#98A2B3"
                    autoCapitalize="none"
                    keyboardType="numbers-and-punctuation"
                  />
                </View>
                <View style={styles.filterField}>
                  <Text style={styles.filterLabel}>To</Text>
                  <TextInput
                    style={styles.filterInput}
                    value={endDateInput}
                    onChangeText={setEndDateInput}
                    placeholder="2026-04-30"
                    placeholderTextColor="#98A2B3"
                    autoCapitalize="none"
                    keyboardType="numbers-and-punctuation"
                  />
                </View>
              </View>

              <View style={styles.filterActions}>
                <TouchableOpacity style={styles.applyButton} onPress={handleApplyFilter}>
                  <Text style={styles.applyButtonText}>Apply Filter</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.clearButton} onPress={handleClearFilter}>
                  <Text style={styles.clearButtonText}>Clear</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Visible Images</Text>
              <Text style={styles.summaryValue}>{filteredEntries.length}</Text>
              <Text style={styles.summaryMeta}>
                {entries.length} total execution images in {currentAccount?.name || 'the selected account'}
              </Text>
            </View>
          </View>
        )}
        ListEmptyComponent={(
          <View style={styles.emptyState}>
            {loading ? <ActivityIndicator size="large" color="#667eea" /> : <Ionicons name="images-outline" size={48} color="#CBD5E1" />}
            <Text style={styles.emptyTitle}>{loading ? 'Loading...' : 'No Images Found'}</Text>
            <Text style={styles.emptySubtitle}>{emptyStateText()}</Text>
          </View>
        )}
        ListFooterComponent={(
          <View style={styles.footerSpacer} />
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F8FC',
  },
  header: {
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 22,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
  },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    color: 'rgba(255,255,255,0.88)',
    lineHeight: 20,
  },
  listContent: {
    padding: 16,
  },
  filterCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#101828',
  },
  sectionSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: '#667085',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
  },
  filterField: {
    flex: 1,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#344054',
    marginBottom: 6,
  },
  filterInput: {
    borderWidth: 1,
    borderColor: '#D0D5DD',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    color: '#101828',
    backgroundColor: '#fff',
  },
  filterActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  applyButton: {
    flex: 1,
    backgroundColor: '#667eea',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  applyButtonText: {
    color: '#fff',
    fontWeight: '800',
  },
  clearButton: {
    borderWidth: 1,
    borderColor: '#D0D5DD',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearButtonText: {
    color: '#344054',
    fontWeight: '700',
  },
  summaryCard: {
    backgroundColor: '#0F172A',
    borderRadius: 18,
    padding: 16,
    marginBottom: 18,
  },
  summaryLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  summaryValue: {
    marginTop: 8,
    color: '#fff',
    fontSize: 30,
    fontWeight: '800',
  },
  summaryMeta: {
    marginTop: 6,
    color: '#CBD5E1',
    fontSize: 12,
    lineHeight: 18,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  thumbnail: {
    width: 88,
    height: 88,
    borderRadius: 14,
    backgroundColor: '#E2E8F0',
  },
  cardBody: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: '#101828',
  },
  resultBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  resultText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  cardSubtitle: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: '700',
    color: '#344054',
  },
  cardMeta: {
    marginTop: 4,
    fontSize: 12,
    color: '#667085',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: '800',
    color: '#101828',
  },
  emptySubtitle: {
    marginTop: 6,
    fontSize: 13,
    color: '#667085',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 18,
  },
  footerSpacer: {
    height: 20,
  },
});

export default ExecutionReviewScreen;