import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  Modal,
  Dimensions,
  StatusBar,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { journalAPI } from '../services/api';
import { formatKampalaDate } from '../utils/dateUtils';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const EntryDetailScreen = ({ route, navigation }) => {
  const { entry: initialEntry } = route.params;
  const [entry, setEntry] = useState(initialEntry);
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [loading, setLoading] = useState(false);

  // Refresh entry data when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      const refreshEntry = async () => {
        try {
          setLoading(true);
          console.log('EntryDetailScreen: Refreshing entry with ID:', entry.id);
          const response = await journalAPI.getEntry(entry.id);
          console.log('EntryDetailScreen: Refresh response:', response);

          // Check if response has the entry directly or nested
          if (response && (response.entry || response.id)) {
            const updatedEntry = response.entry || response;
            console.log('EntryDetailScreen: Setting updated entry:', updatedEntry);
            setEntry(updatedEntry);
          } else {
            console.log('EntryDetailScreen: Unexpected response structure:', response);
          }
        } catch (error) {
          console.error('Error refreshing entry:', error);
        } finally {
          setLoading(false);
        }
      };

      if (entry && entry.id) {
        refreshEntry();
      }
    }, [entry.id])
  );

  // Safety check for entry
  if (!entry) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Entry Not Found</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Entry data not available</Text>
        </View>
      </View>
    );
  }

  const handleDeleteEntry = () => {
    Alert.alert(
      'Delete Trade Entry',
      'Are you sure you want to delete this trade entry? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: confirmDelete,
        },
      ]
    );
  };

  const confirmDelete = async () => {
    setIsDeleting(true);
    try {
      await journalAPI.deleteEntry(entry.id);
      Alert.alert(
        'Success',
        'Trade entry deleted successfully.',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      console.error('Error deleting entry:', error);
      Alert.alert(
        'Error',
        'Failed to delete the trade entry. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEditEntry = () => {
    navigation.navigate('EditEntry', { entry });
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Invalid Date';
    try {
      const formatted = formatKampalaDate(dateString, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      return formatted || 'Invalid Date';
    } catch (error) {
      return 'Invalid Date';
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
    if (content.includes('- [x] NO OUTCOME')) return 'NO OUTCOME';
    return 'UNKNOWN';
  };

  const extractCurrencyPair = (content) => {
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

  const extractRiskReward = (content) => {
    if (!content || typeof content !== 'string') return 'Unknown';
    const lines = content.split('\n');

    for (const line of lines) {
      const rrMatch = line.match(/#{1,5}\s*RR\s*>\s*([0-9.]+)/i);
      if (rrMatch) {
        return `1:${rrMatch[1]}`;
      }
    }
    return null;
  };

  const calculateRiskReward = (entry) => {
    // For MT5 entries, calculate from entry_price, stop_loss, take_profit
    if (entry.mt5_ticket && entry.entry_price && entry.stop_loss && entry.take_profit) {
      const entryP = Number(entry.entry_price);
      const sl = Number(entry.stop_loss);
      const tp = Number(entry.take_profit);
      const risk = Math.abs(entryP - sl);
      const reward = Math.abs(tp - entryP);
      if (risk > 0) {
        return `1:${(reward / risk).toFixed(1)}`;
      }
    }
    // Fallback to content parsing
    return extractRiskReward(entry.content) || 'Unknown';
  };

  const getResultColor = (result) => {
    switch (result) {
      case 'WIN': return '#50C878';
      case 'LOSS': return '#FF6B6B';
      case 'BREAKEVEN': return '#4A90E2';
      case 'OPEN': return '#FFA500';
      case 'NO OUTCOME': return '#95a5a6';
      default: return '#666';
    }
  };

  const filterCheckedContent = (content) => {
    if (!content || typeof content !== 'string') return '';

    const lines = content.split('\n');
    const filteredLines = [];
    let currentSection = '';

    for (const line of lines) {
      // Skip the setup image line and date line
      if (line.includes('SETUP IMAGE:') || line.includes('Date:')) {
        continue;
      }

      // Detect section headers
      if (line.includes('### Pair:')) {
        currentSection = 'Currency Pair';
        continue;
      } else if (line.includes('Trade:')) {
        currentSection = 'Trade Direction';
        continue;
      } else if (line.includes('##### RR >')) {
        currentSection = 'Trade Result';
        continue;
      } else if (line.includes('What have I learnt')) {
        currentSection = 'Lesson Learned';
        filteredLines.push('\n**Lesson Learned:**');
        continue;
      }

      // Only include checked items or lesson content
      if (line.includes('- [x]')) {
        const checkedItem = line.replace('- [x]', '').trim();
        if (currentSection && checkedItem) {
          if (currentSection === 'Currency Pair') {
            filteredLines.push(`**${currentSection}:** ${checkedItem}`);
          } else if (currentSection === 'Trade Direction') {
            filteredLines.push(`**${currentSection}:** ${checkedItem}`);
          } else if (currentSection === 'Trade Result') {
            filteredLines.push(`**${currentSection}:** ${checkedItem}`);
          }
        }
      } else if (currentSection === 'Lesson Learned' && line.trim() && !line.includes('[') && !line.includes('#')) {
        // Include lesson content
        filteredLines.push(line.trim());
      }
    }

    return filteredLines.join('\n');
  };

  const tradeResult = extractTradeResult(entry);
  const currencyPair = entry.symbol || extractCurrencyPair(entry.content);
  const tradeDirection = entry.direction || null;
  const riskReward = calculateRiskReward(entry);
  const resultColor = getResultColor(tradeResult);
  const filteredContent = filterCheckedContent(entry.content);
  const contentDateObj = extractContentDate(entry.content);
  const displayDate = contentDateObj
    ? contentDateObj.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : formatDate(entry.created_at);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#667eea" />
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
        <Text style={styles.headerTitle}>Trade Analysis</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleEditEntry}
          >
            <Ionicons name="create-outline" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleDeleteEntry}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="trash-outline" size={24} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Trade Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <View>
              <Text style={styles.currencyPairText}>{currencyPair}</Text>
              {entry.mt5_ticket && (
                <Text style={{ fontSize: 12, color: '#4A90E2', fontWeight: 'bold' }}>AUTOMATED (MT5)</Text>
              )}
            </View>
            <View style={[styles.resultBadge, { backgroundColor: resultColor }]}>
              <Text style={styles.resultBadgeText}>{tradeResult}</Text>
            </View>
          </View>
          <Text style={styles.dateText}>
            {displayDate}
          </Text>
          {tradeDirection && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
              <Ionicons
                name={tradeDirection === 'BUY' ? 'trending-up' : 'trending-down'}
                size={18}
                color={tradeDirection === 'BUY' ? '#50C878' : '#FF6B6B'}
              />
              <Text style={{ fontSize: 16, fontWeight: '700', color: tradeDirection === 'BUY' ? '#50C878' : '#FF6B6B', marginLeft: 6 }}>
                {tradeDirection}
              </Text>
            </View>
          )}
        </View>

        {/* Setup Image Section */}
        {(entry.before_image_url || entry.image_url) && (
          <View style={styles.imageCard}>
            <Text style={styles.cardTitle}>
              {entry.after_image_url ? 'Trade Execution' : 'Setup Analysis'}
            </Text>

            {entry.before_image_url && entry.after_image_url ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <TouchableOpacity
                  onPress={() => {
                    setSelectedImageUrl(entry.before_image_url);
                    setImageModalVisible(true);
                  }}
                  style={[styles.imageContainer, { width: 300, marginRight: 15 }]}
                  activeOpacity={0.8}
                >
                  <Image
                    source={{ uri: entry.before_image_url }}
                    style={styles.setupImage}
                    resizeMode="cover"
                  />
                  <View style={styles.imageOverlay}>
                    <Text style={styles.overlayText}>BEFORE</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    setSelectedImageUrl(entry.after_image_url);
                    setImageModalVisible(true);
                  }}
                  style={[styles.imageContainer, { width: 300 }]}
                  activeOpacity={0.8}
                >
                  <Image
                    source={{ uri: entry.after_image_url }}
                    style={styles.setupImage}
                    resizeMode="cover"
                  />
                  <View style={styles.imageOverlay}>
                    <Text style={styles.overlayText}>AFTER</Text>
                  </View>
                </TouchableOpacity>
              </ScrollView>
            ) : (
              <TouchableOpacity
                onPress={() => {
                  setSelectedImageUrl(entry.before_image_url || entry.image_url);
                  setImageModalVisible(true);
                }}
                style={styles.imageContainer}
                activeOpacity={0.8}
              >
                <Image
                  source={{ uri: entry.before_image_url || entry.image_url }}
                  style={styles.setupImage}
                  resizeMode="cover"
                />
                <View style={styles.imageOverlay}>
                  <Ionicons name="expand-outline" size={28} color="#fff" />
                  <Text style={styles.overlayText}>Tap to enlarge</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Trading Details Section */}
        <View style={styles.detailsCard}>
          <Text style={styles.cardTitle}>Trade Details</Text>
          <View style={styles.detailsContent}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Risk : Reward</Text>
              <Text style={styles.detailValue}>{riskReward}</Text>
            </View>

            {entry.pnl != null && (
              <>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>P&L</Text>
                  <Text style={[styles.detailValue, { color: Number(entry.pnl) >= 0 ? '#50C878' : '#FF6B6B' }]}>
                    ${Number(entry.pnl).toFixed(2)}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Commission</Text>
                  <Text style={styles.detailValue}>${Number(entry.commission || 0).toFixed(2)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Swap</Text>
                  <Text style={styles.detailValue}>${Number(entry.swap || 0).toFixed(2)}</Text>
                </View>
              </>
            )}

            {filteredContent.split('\n').map((line, index) => {
              if (line.startsWith('**') && line.endsWith(':**')) {
                return (
                  <View key={index} style={styles.detailRow}>
                    <Text style={styles.detailLabel}>
                      {line.replace(/\*\*/g, '').replace(':', '')}
                    </Text>
                  </View>
                );
              } else if (line.startsWith('**') && line.includes(':**')) {
                const [label, value] = line.split(':**');
                const cleanLabel = label.replace(/\*\*/g, '');
                // Skip Currency Pair and Trade Result since we're showing them separately
                if (cleanLabel === 'Currency Pair' || cleanLabel === 'Trade Result') return null;

                return (
                  <View key={index} style={styles.detailRow}>
                    <Text style={styles.detailLabel}>
                      {cleanLabel}
                    </Text>
                    <Text style={styles.detailValue}>{value.trim()}</Text>
                  </View>
                );
              } else if (line.trim()) {
                return (
                  <Text key={index} style={styles.lessonText}>
                    {line.trim()}
                  </Text>
                );
              }
              return null;
            })}
          </View>
        </View>

        {/* Trade Validation Section */}
        <View style={styles.detailsCard}>
          <Text style={styles.cardTitle}>Trade Validation</Text>
          <View style={styles.detailsContent}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Following Plan</Text>
              <View style={styles.validationBadge}>
                <Ionicons
                  name={entry.following_plan ? "checkmark-circle" : "close-circle"}
                  size={20}
                  color={entry.following_plan ? "#50C878" : "#FF6B6B"}
                />
                <Text style={[styles.validationText, { color: entry.following_plan ? "#50C878" : "#FF6B6B" }]}>
                  {entry.following_plan ? "Yes" : "No"}
                </Text>
              </View>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Emotional State</Text>
            </View>
            <Text style={styles.emotionalStateText}>
              {entry.emotional_state || "Not recorded"}
            </Text>
          </View>
        </View>

        {/* Notes Section */}
        {entry.notes ? (
          <View style={styles.detailsCard}>
            <Text style={styles.cardTitle}>Notes</Text>
            <Text style={styles.emotionalStateText}>
              {entry.notes}
            </Text>
          </View>
        ) : null}

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Full Screen Image Modal */}
      <Modal
        visible={imageModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setImageModalVisible(false)}
        statusBarTranslucent={true}
      >
        <View style={styles.modalContainer}>
          <StatusBar barStyle="light-content" backgroundColor="rgba(0,0,0,0.9)" />
          <TouchableOpacity
            style={styles.modalCloseButton}
            onPress={() => setImageModalVisible(false)}
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
          >
            <Ionicons name="close" size={32} color="#fff" />
          </TouchableOpacity>

          <View style={styles.modalImageContainer}>
            <Image
              source={{ uri: selectedImageUrl }}
              style={styles.fullScreenImage}
              resizeMode="contain"
            />
          </View>

          <TouchableOpacity
            style={styles.modalBackground}
            onPress={() => setImageModalVisible(false)}
            activeOpacity={1}
          />
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 80,
  },
  headerButton: {
    padding: 8,
    marginLeft: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  currencyPairText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1a1a1a',
    letterSpacing: 1,
  },
  resultBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  resultBadgeText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  dateText: {
    fontSize: 16,
    color: '#6c757d',
    fontWeight: '500',
  },
  imageCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  imageContainer: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  setupImage: {
    width: '100%',
    height: 220,
  },
  imageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
    marginTop: 8,
  },
  detailsCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  detailsContent: {
    marginTop: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f3f4',
  },
  detailLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#495057',
    flex: 1,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    textAlign: 'right',
    flex: 1,
  },
  validationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  validationText: {
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 6,
  },
  emotionalStateText: {
    fontSize: 16,
    color: '#495057',
    fontStyle: 'italic',
    marginTop: 4,
    marginBottom: 8,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#667eea',
  },
  lessonText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#495057',
    marginTop: 16,
    fontStyle: 'italic',
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#4A90E2',
  },
  bottomPadding: {
    height: 30,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorText: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
  },

  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 1000,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImageContainer: {
    width: screenWidth,
    height: screenHeight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenImage: {
    width: screenWidth - 40,
    height: screenHeight - 200,
    maxWidth: screenWidth - 40,
    maxHeight: screenHeight - 200,
  },
  modalBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: -1,
  },
});

export default EntryDetailScreen;