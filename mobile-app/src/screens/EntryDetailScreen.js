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
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { journalAPI, imageAPI } from '../services/api';
import { useAccount } from '../context/AccountContext';
import { formatKampalaDate } from '../utils/dateUtils';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const EntryDetailScreen = ({ route, navigation }) => {
  const { entry: initialEntry } = route.params;
  const { currentAccount } = useAccount();
  const [entry, setEntry] = useState(initialEntry);
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [loading, setLoading] = useState(false);

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Editable fields
  const [selectedPairs, setSelectedPairs] = useState([]);
  const [tradeDirection, setTradeDirection] = useState('');
  const [tradeResultEdit, setTradeResultEdit] = useState('');
  const [setupImage, setSetupImage] = useState(null);
  const [riskReward, setRiskReward] = useState('');
  const [notes, setNotes] = useState('');
  const [isFollowingPlan, setIsFollowingPlan] = useState(false);
  const [emotionalState, setEmotionalState] = useState('');

  const pairsList = ['EURUSD', 'GBPUSD', 'NZDUSD', 'AUDUSD', 'XAUUSD', 'USDJPY', 'USDCAD', 'USDCHF'];
  const tradeDirections = ['BUY', 'SELL'];
  const tradeResultOptions = ['WIN', 'BREAKEVEN', 'LOSS'];

  // Populate editable fields from entry
  useEffect(() => {
    if (entry) {
      setNotes(entry.notes || '');
      setIsFollowingPlan(!!entry.following_plan);
      setEmotionalState(entry.emotional_state || '');
      setSetupImage(entry.before_image_url || entry.image_url || null);

      if (entry.symbol) setSelectedPairs([entry.symbol]);
      if (entry.direction) setTradeDirection(entry.direction);

      if (!entry.mt5_ticket && entry.content) {
        parseEntryContent(entry.content);
      }

      if (entry.mt5_ticket && entry.pnl != null) {
        const pnl = Number(entry.pnl);
        if (pnl > 0.01) setTradeResultEdit('WIN');
        else if (pnl < -0.01) setTradeResultEdit('LOSS');
        else setTradeResultEdit('BREAKEVEN');
      } else if (entry.content) {
        if (entry.content.includes('- [x] WIN')) setTradeResultEdit('WIN');
        else if (entry.content.includes('- [x] LOSS')) setTradeResultEdit('LOSS');
        else if (entry.content.includes('- [x] BREAKEVEN')) setTradeResultEdit('BREAKEVEN');
      }

      if (entry.content) {
        const rrMatch = entry.content.match(/##### RR > (.+?):/);
        if (rrMatch) setRiskReward(rrMatch[1].replace('_', ''));
      }
    }
  }, [entry]);

  const parseEntryContent = (content) => {
    const pairMatches = content.match(/- \[x\] ([A-Z]{6,})/g);
    if (pairMatches) {
      const parsedPairs = pairMatches.map(m => {
        const r = m.match(/- \[x\] ([A-Z]{6,})/);
        return r ? r[1] : null;
      }).filter(Boolean);
      if (parsedPairs.length > 0) setSelectedPairs(parsedPairs);
    }
    if (content.includes('- [x] BUY')) setTradeDirection('BUY');
    else if (content.includes('- [x] SELL')) setTradeDirection('SELL');
  };

  // Refresh entry on focus
  useFocusEffect(
    React.useCallback(() => {
      const refreshEntry = async () => {
        try {
          setLoading(true);
          const response = await journalAPI.getEntry(entry.id);
          if (response && (response.entry || response.id)) {
            setEntry(response.entry || response);
          }
        } catch (error) {
          console.error('Error refreshing entry:', error);
        } finally {
          setLoading(false);
        }
      };
      if (entry?.id) refreshEntry();
    }, [entry.id])
  );

  if (!entry) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
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

  // ---- Delete ----
  const handleDeleteEntry = () => {
    Alert.alert('Delete Trade Entry', 'Are you sure? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: confirmDelete },
    ]);
  };

  const confirmDelete = async () => {
    setIsDeleting(true);
    try {
      await journalAPI.deleteEntry(entry.id);
      Alert.alert('Success', 'Trade entry deleted.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (error) {
      Alert.alert('Error', 'Failed to delete entry.');
    } finally {
      setIsDeleting(false);
    }
  };

  // ---- Image handling ----
  const copyImageToPermanentStorage = async (sourceUri) => {
    const timestamp = Date.now();
    const ext = sourceUri.split('.').pop() || 'jpg';
    const directory = `${FileSystem.documentDirectory}images/`;
    const dirInfo = await FileSystem.getInfoAsync(directory);
    if (!dirInfo.exists) await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
    const newPath = `${directory}temp_image_${timestamp}.${ext}`;
    await FileSystem.copyAsync({ from: sourceUri, to: newPath });
    return newPath;
  };

  const pickImage = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { Alert.alert('Permission Denied', 'Grant gallery permissions.'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 0.8 });
      if (!result.canceled && result.assets?.length > 0) {
        setSetupImage(await copyImageToPermanentStorage(result.assets[0].uri));
      }
    } catch (e) { Alert.alert('Error', e.message); }
  };

  const takePhoto = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) { Alert.alert('Permission Denied', 'Grant camera permissions.'); return; }
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.8 });
      if (!result.canceled && result.assets?.length > 0) {
        setSetupImage(await copyImageToPermanentStorage(result.assets[0].uri));
      }
    } catch (e) { Alert.alert('Error', e.message); }
  };

  const showImagePicker = () => {
    const opts = [{ text: 'Camera', onPress: takePhoto }, { text: 'Gallery', onPress: pickImage }];
    if (setupImage) opts.push({ text: 'Remove Image', onPress: () => setSetupImage(null), style: 'destructive' });
    opts.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('Image Options', 'Choose how to manage your setup image', opts);
  };

  // ---- Save ----
  const generateJournalContent = () => {
    const date = new Date().toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Africa/Kampala',
    });
    let content = `Date: ${date}\n\n${setupImage ? 'SETUP IMAGE: [Image Attached]' : 'SETUP IMAGE: [No Image]'}\n\n### Pair:\n`;
    pairsList.forEach(p => { content += `- [${selectedPairs.includes(p) ? 'x' : ' '}] ${p}\n`; });
    content += `\nTrade:\n`;
    tradeDirections.forEach(d => { content += `- [${tradeDirection === d ? 'x' : ' '}] ${d}\n`; });
    content += `\n##### RR > ${riskReward || '_'}:\n\n`;
    tradeResultOptions.forEach(r => { content += `- [${tradeResultEdit === r ? 'x' : ' '}] ${r}\n`; });
    return content;
  };

  const togglePair = (pair) => setSelectedPairs(prev => prev.includes(pair) ? [] : [pair]);

  const handleSave = async () => {
    if (isSaving) return;
    if (!entry.mt5_ticket) {
      if (!tradeDirection) { Alert.alert('Missing', 'Select a trade direction'); return; }
      if (!tradeResultEdit) { Alert.alert('Missing', 'Select a trade result'); return; }
      if (selectedPairs.length === 0) { Alert.alert('Missing', 'Select a trading pair'); return; }
    }

    setIsSaving(true);
    try {
      let imageUrl = entry.image_url;
      let imageFilename = entry.image_filename;

      if (setupImage && setupImage.startsWith('file://')) {
        setIsUploading(true);
        try {
          const up = await imageAPI.uploadImage(setupImage);
          if (up.imageUrl && up.filename) { imageUrl = up.imageUrl; imageFilename = up.filename; }
        } catch (e) {
          console.error('Upload failed:', e);
          imageUrl = null; imageFilename = null;
        } finally { setIsUploading(false); }
      } else if (!setupImage) {
        imageUrl = null; imageFilename = null;
      } else if (setupImage?.startsWith('http')) {
        imageUrl = setupImage;
      }

      const response = await journalAPI.updateEntry(entry.id, {
        content: entry.mt5_ticket ? entry.content : generateJournalContent(),
        imageUrl, imageFilename,
        accountId: currentAccount?.id || entry.account_id,
        followingPlan: isFollowingPlan,
        emotionalState,
        notes,
      });

      if (response.entry && response.message) {
        setEntry(response.entry);
        setIsEditing(false);
        Alert.alert('Success!', 'Journal entry updated.');
      } else {
        Alert.alert('Error', response.error || 'Failed to update entry');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update entry. Please try again.');
    } finally { setIsSaving(false); }
  };

  // ---- Helpers ----
  const formatDate = (dateString) => {
    if (!dateString) return 'Invalid Date';
    try { return formatKampalaDate(dateString, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) || 'Invalid Date'; }
    catch { return 'Invalid Date'; }
  };

  const extractContentDate = (content) => {
    if (!content || typeof content !== 'string') return null;
    const match = content.match(/^Date:\s*([A-Za-z]+),\s*([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/m);
    if (!match) return null;
    const months = { January: 0, February: 1, March: 2, April: 3, May: 4, June: 5, July: 6, August: 7, September: 8, October: 9, November: 10, December: 11 };
    const mi = months[match[2]];
    if (mi === undefined) return null;
    return new Date(parseInt(match[4]), mi, parseInt(match[3]));
  };

  const extractTradeResult = (e) => {
    if (e.mt5_ticket) {
      if (e.pnl == null) return 'OPEN';
      const pnl = Number(e.pnl);
      if (pnl > 0.01) return 'WIN';
      if (pnl < -0.01) return 'LOSS';
      return 'BREAKEVEN';
    }
    const c = e.content;
    if (!c || typeof c !== 'string') return 'UNKNOWN';
    if (c.includes('- [x] WIN')) return 'WIN';
    if (c.includes('- [x] LOSS')) return 'LOSS';
    if (c.includes('- [x] BREAKEVEN')) return 'BREAKEVEN';
    return 'UNKNOWN';
  };

  const extractCurrencyPair = (content) => {
    if (!content || typeof content !== 'string') return 'Unknown';
    const lines = content.split('\n');
    let inPairSection = false;
    for (const line of lines) {
      if (line.includes('### Pair:')) { inPairSection = true; continue; }
      if (inPairSection && line.includes('Trade:')) break;
      if (inPairSection && line.includes('- [x]')) {
        const m = line.match(/- \[x\]\s*([A-Z]+)/);
        if (m) return m[1];
      }
    }
    return 'Unknown';
  };

  const calculateRiskReward = (e) => {
    if (e.mt5_ticket && e.entry_price && e.stop_loss && e.take_profit) {
      const ep = Number(e.entry_price), sl = Number(e.stop_loss), tp = Number(e.take_profit);
      const risk = Math.abs(ep - sl), reward = Math.abs(tp - ep);
      if (risk > 0) return `1:${(reward / risk).toFixed(1)}`;
    }
    if (e.content) {
      const m = e.content.match(/#{1,5}\s*RR\s*>\s*([0-9.]+)/i);
      if (m) return `1:${m[1]}`;
    }
    return 'Unknown';
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

  // Computed values
  const tradeResult = extractTradeResult(entry);
  const currencyPair = entry.symbol || extractCurrencyPair(entry.content);
  const displayDirection = entry.direction || null;
  const computedRR = calculateRiskReward(entry);
  const resultColor = getResultColor(tradeResult);
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
        <TouchableOpacity style={styles.backButton} onPress={() => {
          if (isEditing) setIsEditing(false);
          else navigation.goBack();
        }}>
          <Ionicons name={isEditing ? 'close' : 'arrow-back'} size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEditing ? 'Edit Trade' : 'Trade Analysis'}</Text>
        <View style={styles.headerRight}>
          {!isEditing && (
            <TouchableOpacity style={styles.headerButton} onPress={() => setIsEditing(true)}>
              <Ionicons name="create-outline" size={24} color="#fff" />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.headerButton} onPress={handleDeleteEntry} disabled={isDeleting}>
            {isDeleting ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="trash-outline" size={24} color="#fff" />}
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="none"
        >
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
            <Text style={styles.dateText}>{displayDate}</Text>
            {displayDirection && (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                <Ionicons
                  name={displayDirection === 'BUY' ? 'trending-up' : 'trending-down'}
                  size={18}
                  color={displayDirection === 'BUY' ? '#50C878' : '#FF6B6B'}
                />
                <Text style={{ fontSize: 16, fontWeight: '700', color: displayDirection === 'BUY' ? '#50C878' : '#FF6B6B', marginLeft: 6 }}>
                  {displayDirection}
                </Text>
              </View>
            )}
          </View>

          {/* Setup Image — edit mode (manual entries) */}
          {isEditing && !entry.mt5_ticket ? (
            <View style={styles.editCard}>
              <Text style={styles.cardTitle}>
                <Ionicons name="camera" size={20} color="#4A90E2" /> Setup Image
              </Text>
              {setupImage ? (
                <View style={styles.imageWrapper}>
                  <Image source={{ uri: setupImage }} style={styles.editSetupImage} />
                  <TouchableOpacity style={styles.changeImageOverlay} onPress={showImagePicker}>
                    <Ionicons name="refresh" size={24} color="#fff" />
                    <Text style={styles.changeImageText}>Change Image</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.uploadCard} onPress={showImagePicker}>
                  <View style={styles.uploadIcon}>
                    <Ionicons name="cloud-upload" size={32} color="#4A90E2" />
                  </View>
                  <Text style={styles.uploadTitle}>Add Setup Image</Text>
                  <Text style={styles.uploadSubtitle}>Take a photo or choose from gallery</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (entry.before_image_url || entry.image_url) ? (
            <View style={styles.imageCard}>
              <Text style={styles.cardTitle}>
                {entry.after_image_url ? 'Trade Execution' : 'Setup Analysis'}
              </Text>
              {entry.before_image_url && entry.after_image_url ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <TouchableOpacity
                    onPress={() => { setSelectedImageUrl(entry.before_image_url); setImageModalVisible(true); }}
                    style={[styles.imageContainer, { width: 300, marginRight: 15 }]}
                    activeOpacity={0.8}
                  >
                    <Image source={{ uri: entry.before_image_url }} style={styles.setupImage} resizeMode="cover" />
                    <View style={styles.imageOverlay}><Text style={styles.overlayText}>BEFORE</Text></View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => { setSelectedImageUrl(entry.after_image_url); setImageModalVisible(true); }}
                    style={[styles.imageContainer, { width: 300 }]}
                    activeOpacity={0.8}
                  >
                    <Image source={{ uri: entry.after_image_url }} style={styles.setupImage} resizeMode="cover" />
                    <View style={styles.imageOverlay}><Text style={styles.overlayText}>AFTER</Text></View>
                  </TouchableOpacity>
                </ScrollView>
              ) : (
                <TouchableOpacity
                  onPress={() => { setSelectedImageUrl(entry.before_image_url || entry.image_url); setImageModalVisible(true); }}
                  style={styles.imageContainer}
                  activeOpacity={0.8}
                >
                  <Image source={{ uri: entry.before_image_url || entry.image_url }} style={styles.setupImage} resizeMode="cover" />
                  <View style={styles.imageOverlay}>
                    <Ionicons name="expand-outline" size={28} color="#fff" />
                    <Text style={styles.overlayText}>Tap to enlarge</Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>
          ) : null}

          {/* Edit Mode: Trading Info (manual entries only) */}
          {isEditing && !entry.mt5_ticket && (
            <View style={styles.editCard}>
              <Text style={styles.cardTitle}>
                <Ionicons name="stats-chart" size={20} color="#4A90E2" /> Trading Information
              </Text>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Currency Pair</Text>
                <View style={styles.chipContainer}>
                  {pairsList.map(pair => (
                    <TouchableOpacity
                      key={pair}
                      style={[styles.chip, selectedPairs.includes(pair) && styles.chipSelected]}
                      onPress={() => togglePair(pair)}
                    >
                      <Text style={[styles.chipText, selectedPairs.includes(pair) && styles.chipTextSelected]}>{pair}</Text>
                      {selectedPairs.includes(pair) && <Ionicons name="checkmark-circle" size={16} color="#fff" style={{ marginLeft: 6 }} />}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Trade Direction</Text>
                <View style={styles.segmentedControl}>
                  {tradeDirections.map(dir => (
                    <TouchableOpacity
                      key={dir}
                      style={[styles.segmentButton, tradeDirection === dir && styles.segmentButtonSelected]}
                      onPress={() => setTradeDirection(dir)}
                    >
                      <Ionicons name={dir === 'BUY' ? 'trending-up' : 'trending-down'} size={20} color={tradeDirection === dir ? '#fff' : '#666'} />
                      <Text style={[styles.segmentText, tradeDirection === dir && styles.segmentTextSelected]}>{dir}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Risk : Reward Ratio</Text>
                <View style={styles.rrContainer}>
                  <Text style={styles.rrPrefix}>1 :</Text>
                  <TextInput style={styles.rrInput} value={riskReward} onChangeText={setRiskReward} placeholder="2.5" keyboardType="decimal-pad" maxLength={4} />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Trade Outcome</Text>
                <View style={styles.resultGrid}>
                  {tradeResultOptions.map(result => (
                    <TouchableOpacity
                      key={result}
                      style={[styles.resultOption, tradeResultEdit === result && [styles.resultOptionSelected, { borderColor: getResultColor(result) }]]}
                      onPress={() => setTradeResultEdit(result)}
                    >
                      <View style={[styles.resultIconSmall, { backgroundColor: getResultColor(result) }]}>
                        <Ionicons name={result === 'WIN' ? 'trophy' : result === 'BREAKEVEN' ? 'remove' : 'close'} size={20} color="#fff" />
                      </View>
                      <Text style={[styles.resultOptionText, tradeResultEdit === result && { color: getResultColor(result) }]}>{result}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          )}

          {/* Needs Review Banner */}
          {!isEditing && entry.following_plan == null && !entry.emotional_state && (
            <TouchableOpacity
              style={styles.reviewBanner}
              onPress={() => setIsEditing(true)}
              activeOpacity={0.8}
            >
              <View style={styles.reviewBannerContent}>
                <Ionicons name="warning" size={22} color="#E65100" />
                <View style={styles.reviewBannerTextWrap}>
                  <Text style={styles.reviewBannerTitle}>Trade Validation Needed</Text>
                  <Text style={styles.reviewBannerSubtitle}>Tap to record plan adherence & emotional state</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#E65100" />
              </View>
            </TouchableOpacity>
          )}

          {/* Trade Details (always visible, read-only) */}
          <View style={styles.detailsCard}>
            <Text style={styles.cardTitle}>Trade Details</Text>
            <View style={styles.detailsContent}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Risk : Reward</Text>
                <Text style={styles.detailValue}>{computedRR}</Text>
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

              {entry.entry_price && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Entry Price</Text>
                  <Text style={styles.detailValue}>{Number(entry.entry_price).toFixed(5)}</Text>
                </View>
              )}
              {entry.exit_price && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Exit Price</Text>
                  <Text style={styles.detailValue}>{Number(entry.exit_price).toFixed(5)}</Text>
                </View>
              )}
              {entry.volume && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Volume</Text>
                  <Text style={styles.detailValue}>{entry.volume}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Trade Validation */}
          <View style={styles.detailsCard}>
            <Text style={styles.cardTitle}>Trade Validation</Text>
            <View style={styles.detailsContent}>
              {isEditing ? (
                <>
                  <TouchableOpacity style={styles.checkboxRow} onPress={() => setIsFollowingPlan(!isFollowingPlan)}>
                    <View style={[styles.checkbox, isFollowingPlan && styles.checkboxChecked]}>
                      {isFollowingPlan && <Ionicons name="checkmark" size={16} color="#fff" />}
                    </View>
                    <Text style={styles.checkboxLabel}>Am I following my trading plan?</Text>
                  </TouchableOpacity>
                  <View style={styles.editFieldGroup}>
                    <Text style={styles.editFieldLabel}>Emotional State</Text>
                    <TextInput
                      style={styles.editInput}
                      value={emotionalState}
                      onChangeText={setEmotionalState}
                      placeholder="How are you feeling right now?"
                      placeholderTextColor="#999"
                    />
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Following Plan</Text>
                    <View style={styles.validationBadge}>
                      {entry.following_plan === true ? (
                        <>
                          <Ionicons name="checkmark-circle" size={20} color="#50C878" />
                          <Text style={[styles.validationText, { color: '#50C878' }]}>Yes</Text>
                        </>
                      ) : entry.following_plan === false ? (
                        <>
                          <Ionicons name="close-circle" size={20} color="#FF6B6B" />
                          <Text style={[styles.validationText, { color: '#FF6B6B' }]}>No</Text>
                        </>
                      ) : (
                        <>
                          <Ionicons name="help-circle" size={20} color="#FFA500" />
                          <Text style={[styles.validationText, { color: '#FFA500' }]}>Not Recorded</Text>
                        </>
                      )}
                    </View>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Emotional State</Text>
                  </View>
                  <Text style={styles.emotionalStateText}>
                    {entry.emotional_state || 'Not recorded'}
                  </Text>
                </>
              )}
            </View>
          </View>

          {/* Notes */}
          <View style={styles.detailsCard}>
            <Text style={styles.cardTitle}>Notes</Text>
            {isEditing ? (
              <View style={styles.textAreaWrapper}>
                <TextInput
                  style={styles.textArea}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Any additional notes about this trade..."
                  placeholderTextColor="#999"
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>
            ) : (
              <Text style={styles.emotionalStateText}>
                {entry.notes || 'No notes recorded'}
              </Text>
            )}
          </View>

          {/* Save Button */}
          {isEditing && (
            <TouchableOpacity
              style={[styles.saveButton, (isSaving || isUploading) && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={isSaving || isUploading}
            >
              <LinearGradient
                colors={(isSaving || isUploading) ? ['#ccc', '#999'] : ['#667eea', '#764ba2']}
                style={styles.saveButtonGradient}
              >
                <View style={styles.saveButtonContent}>
                  {isSaving || isUploading ? (
                    <>
                      <ActivityIndicator size="small" color="#fff" />
                      <Text style={styles.saveButtonText}>{isUploading ? 'Uploading...' : 'Saving...'}</Text>
                    </>
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={20} color="#fff" />
                      <Text style={styles.saveButtonText}>Save Changes</Text>
                    </>
                  )}
                </View>
              </LinearGradient>
            </TouchableOpacity>
          )}

          <View style={styles.bottomPadding} />
        </ScrollView>
      </KeyboardAvoidingView>

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
            <Image source={{ uri: selectedImageUrl }} style={styles.fullScreenImage} resizeMode="contain" />
          </View>
          <TouchableOpacity style={styles.modalBackground} onPress={() => setImageModalVisible(false)} activeOpacity={1} />
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 50, paddingBottom: 20, paddingHorizontal: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 5,
  },
  backButton: { padding: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#fff', flex: 1, textAlign: 'center' },
  headerRight: { flexDirection: 'row', alignItems: 'center', width: 80 },
  headerButton: { padding: 8, marginLeft: 8 },
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  summaryCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 24, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4,
  },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  currencyPairText: { fontSize: 28, fontWeight: '800', color: '#1a1a1a', letterSpacing: 1 },
  resultBadge: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3,
  },
  resultBadgeText: { color: '#fff', fontWeight: '700', fontSize: 14, letterSpacing: 0.5 },
  dateText: { fontSize: 16, color: '#6c757d', fontWeight: '500' },

  // Image section
  imageCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4,
  },
  cardTitle: { fontSize: 20, fontWeight: '700', color: '#1a1a1a', marginBottom: 16 },
  imageContainer: { position: 'relative', borderRadius: 12, overflow: 'hidden' },
  setupImage: { width: '100%', height: 220 },
  imageOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center',
  },
  overlayText: { color: '#fff', fontWeight: '600', fontSize: 14, marginTop: 8 },

  // Details
  detailsCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4,
  },
  detailsContent: { marginTop: 8 },
  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f3f4',
  },
  detailLabel: { fontSize: 16, fontWeight: '600', color: '#495057', flex: 1 },
  detailValue: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', textAlign: 'right', flex: 1 },
  validationBadge: { flexDirection: 'row', alignItems: 'center' },
  validationText: { fontSize: 16, fontWeight: '700', marginLeft: 6 },
  emotionalStateText: {
    fontSize: 16, color: '#495057', fontStyle: 'italic', marginTop: 4, marginBottom: 8,
    padding: 12, backgroundColor: '#f8f9fa', borderRadius: 8, borderLeftWidth: 3, borderLeftColor: '#667eea',
  },
  bottomPadding: { height: 40 },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  errorText: { fontSize: 18, color: '#666', textAlign: 'center' },

  // Review banner
  reviewBanner: {
    backgroundColor: '#FFF3E0',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FFE0B2',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  reviewBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reviewBannerTextWrap: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  reviewBannerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#E65100',
  },
  reviewBannerSubtitle: {
    fontSize: 12,
    color: '#EF6C00',
    marginTop: 2,
  },

  // Edit card
  editCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 24, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
  },
  imageWrapper: { position: 'relative', borderRadius: 12, overflow: 'hidden' },
  editSetupImage: { width: '100%', height: 200, borderRadius: 12 },
  changeImageOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', flexDirection: 'row',
  },
  changeImageText: { color: '#fff', fontWeight: '600', marginLeft: 8 },
  uploadCard: {
    borderWidth: 2, borderColor: '#e9ecef', borderStyle: 'dashed', borderRadius: 12,
    padding: 40, alignItems: 'center', backgroundColor: '#f8f9fa',
  },
  uploadIcon: {
    backgroundColor: '#e3f2fd', borderRadius: 30, width: 60, height: 60,
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  uploadTitle: { fontSize: 18, fontWeight: '600', color: '#333', marginBottom: 8 },
  uploadSubtitle: { fontSize: 14, color: '#777', textAlign: 'center', lineHeight: 20 },

  // Form fields
  fieldGroup: { marginBottom: 24 },
  fieldLabel: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 12 },
  chipContainer: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  chip: {
    backgroundColor: '#f1f3f4', borderRadius: 20, paddingVertical: 8, paddingHorizontal: 16,
    marginRight: 8, marginBottom: 8, borderWidth: 1, borderColor: '#e0e0e0', flexDirection: 'row', alignItems: 'center',
  },
  chipSelected: { backgroundColor: '#4A90E2', borderColor: '#4A90E2' },
  chipText: { fontSize: 14, fontWeight: '600', color: '#555' },
  chipTextSelected: { color: '#fff' },
  segmentedControl: { flexDirection: 'row', backgroundColor: '#f1f3f4', borderRadius: 12, padding: 4 },
  segmentButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 8 },
  segmentButtonSelected: { backgroundColor: '#4A90E2' },
  segmentText: { fontSize: 16, fontWeight: '600', color: '#666', marginLeft: 8 },
  segmentTextSelected: { color: '#fff' },
  rrContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8f9fa',
    borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#e9ecef',
  },
  rrPrefix: { fontSize: 24, fontWeight: '700', color: '#333', marginRight: 12 },
  rrInput: {
    fontSize: 24, fontWeight: '600', color: '#4A90E2', backgroundColor: '#fff',
    borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12,
    borderWidth: 1, borderColor: '#dee2e6', minWidth: 80, textAlign: 'center',
  },
  resultGrid: { flexDirection: 'column', gap: 10 },
  resultOption: {
    flexDirection: 'row', backgroundColor: '#f8f9fa', borderRadius: 12, padding: 16,
    alignItems: 'center', borderWidth: 2, borderColor: '#e9ecef',
  },
  resultOptionSelected: { backgroundColor: '#fff', borderWidth: 2, elevation: 3 },
  resultIconSmall: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  resultOptionText: { fontSize: 16, fontWeight: '600', color: '#495057' },

  // Validation edit fields
  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, paddingVertical: 8 },
  checkbox: {
    width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: '#4A90E2',
    marginRight: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff',
  },
  checkboxChecked: { backgroundColor: '#4A90E2' },
  checkboxLabel: { fontSize: 16, color: '#333', fontWeight: '500' },
  editFieldGroup: { marginBottom: 8 },
  editFieldLabel: { fontSize: 16, fontWeight: '600', color: '#495057', marginBottom: 8 },
  editInput: {
    backgroundColor: '#f8f9fa', borderWidth: 1, borderColor: '#e9ecef',
    borderRadius: 12, padding: 12, fontSize: 16, color: '#333',
  },
  textAreaWrapper: { backgroundColor: '#f8f9fa', borderRadius: 12, borderWidth: 2, borderColor: '#e9ecef' },
  textArea: { fontSize: 16, color: '#495057', paddingHorizontal: 16, paddingVertical: 16, minHeight: 120, textAlignVertical: 'top' },

  // Save button
  saveButton: {
    borderRadius: 16, marginHorizontal: 4, overflow: 'hidden', elevation: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8,
  },
  saveButtonGradient: { padding: 18 },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  saveButtonText: { color: '#fff', fontSize: 18, fontWeight: '700', marginLeft: 8 },

  // Modal
  modalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  modalCloseButton: {
    position: 'absolute', top: 60, right: 20, zIndex: 1000,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 25, width: 50, height: 50, justifyContent: 'center', alignItems: 'center',
  },
  modalImageContainer: { width: screenWidth, height: screenHeight, justifyContent: 'center', alignItems: 'center' },
  fullScreenImage: { width: screenWidth - 40, height: screenHeight - 200 },
  modalBackground: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: -1 },
});

export default EntryDetailScreen;
