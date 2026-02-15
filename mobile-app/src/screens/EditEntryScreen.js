import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  StatusBar,
  ActivityIndicator,
  Dimensions,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { journalAPI, imageAPI } from '../services/api';
import { useAccount } from '../context/AccountContext';

const { width: screenWidth } = Dimensions.get('window');

const EditEntryScreen = ({ route, navigation }) => {
  const { entry } = route.params;
  const { currentAccount } = useAccount();
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Forex Trading Template State
  const [selectedPairs, setSelectedPairs] = useState([]);
  const [tradeDirection, setTradeDirection] = useState('');
  const [tradeResult, setTradeResult] = useState('');
  const [setupImage, setSetupImage] = useState(null);
  const [riskReward, setRiskReward] = useState('');
  const [notes, setNotes] = useState('');

  // Validation State
  const [isFollowingPlan, setIsFollowingPlan] = useState(false);
  const [emotionalState, setEmotionalState] = useState('');

  const pairs = ['EURUSD', 'GBPUSD', 'NZDUSD', 'AUDUSD', 'XAUUSD', 'USDJPY', 'USDCAD', 'USDCHF'];
  const tradeDirections = ['BUY', 'SELL'];
  const tradeResults = ['WIN', 'BREAKEVEN', 'LOSS'];

  useEffect(() => {
    if (entry && entry.content) {
      parseEntryContent(entry.content);
    }
    if (entry && entry.image_url) {
      setSetupImage(entry.image_url);
    }

    // Use DB columns for MT5 entries
    if (entry) {
      if (entry.symbol) setSelectedPairs([entry.symbol]);
      if (entry.direction) setTradeDirection(entry.direction);
      setIsFollowingPlan(!!entry.following_plan);
      setEmotionalState(entry.emotional_state || '');
      setNotes(entry.notes || '');

      // Determine trade result from pnl for MT5
      if (entry.mt5_ticket && entry.pnl != null) {
        const pnl = Number(entry.pnl);
        if (pnl > 0.01) setTradeResult('WIN');
        else if (pnl < -0.01) setTradeResult('LOSS');
        else setTradeResult('BREAKEVEN');
      }
    }
  }, [entry]);

  const parseEntryContent = (content) => {
    // Parse currency pairs
    const pairMatches = content.match(/- \[x\] ([A-Z]{6})/g);
    if (pairMatches) {
      const pairs = pairMatches.map(match => {
        const pairMatch = match.match(/- \[x\] ([A-Z]{6})/);
        return pairMatch ? pairMatch[1] : null;
      }).filter(Boolean);
      setSelectedPairs(pairs);
    }

    // Parse trade direction
    if (content.includes('- [x] BUY')) {
      setTradeDirection('BUY');
    } else if (content.includes('- [x] SELL')) {
      setTradeDirection('SELL');
    }

    // Parse trade result
    if (content.includes('- [x] WIN')) {
      setTradeResult('WIN');
    } else if (content.includes('- [x] LOSS')) {
      setTradeResult('LOSS');
    } else if (content.includes('- [x] BREAKEVEN')) {
      setTradeResult('BREAKEVEN');
    }

    // Parse risk reward
    const rrMatch = content.match(/##### RR > (.+?):/);
    if (rrMatch) {
      setRiskReward(rrMatch[1].replace('_', ''));
    }
  };

  const getCurrentDate = () => {
    const now = new Date();
    return now.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'Africa/Kampala'
    });
  };

  const togglePair = (pair) => {
    setSelectedPairs(prev =>
      prev.includes(pair)
        ? [] // Deselect if already selected
        : [pair] // Select only this pair (replace any previous selection)
    );
  };

  // Helper function to copy image immediately to permanent storage
  const copyImageToPermanentStorage = async (sourceUri) => {
    try {
      const timestamp = Date.now();
      const uriParts = sourceUri.split('.');
      const fileType = uriParts[uriParts.length - 1] || 'jpg';
      const filename = `temp_image_${timestamp}.${fileType}`;

      const directory = `${FileSystem.documentDirectory}images/`;

      // Create images directory if it doesn't exist
      const dirInfo = await FileSystem.getInfoAsync(directory);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
      }

      const newPath = `${directory}${filename}`;

      // Copy the image immediately to prevent cache expiration issues
      await FileSystem.copyAsync({
        from: sourceUri,
        to: newPath
      });

      console.log('EditEntry - Image copied to permanent storage:', newPath);
      return newPath;
    } catch (error) {
      console.error('EditEntry - Error copying image:', error);
      throw error;
    }
  };

  const pickImage = async () => {
    console.log('EditEntry - pickImage called');
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (permissionResult.granted === false) {
        Alert.alert("Permission Denied", "You need to grant camera roll permissions to upload images.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
        exif: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const imageUri = result.assets[0].uri;
        console.log('EditEntry - Copying image to permanent storage...');

        // Copy image immediately to prevent cache expiration
        const permanentUri = await copyImageToPermanentStorage(imageUri);

        console.log('EditEntry - Image copied:', permanentUri);
        setSetupImage(permanentUri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert("Error", `Failed to select image: ${error.message}. Please try again.`);
    }
  };

  const takePhoto = async () => {
    try {
      console.log('EditEntry - takePhoto called');

      // Request permission
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      console.log('EditEntry - Camera permission result:', permissionResult.granted);

      if (permissionResult.granted === false) {
        Alert.alert("Permission Denied", "You need to grant camera permissions to take photos.");
        return;
      }

      console.log('EditEntry - Launching camera...');
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      console.log('EditEntry - Camera result:', {
        canceled: result.canceled,
        hasAssets: result.assets?.length > 0,
        firstAssetUri: result.assets?.[0]?.uri?.substring(0, 50) + '...'
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const imageUri = result.assets[0].uri;
        console.log('EditEntry - Copying camera image to permanent storage...');

        // Copy image immediately to prevent cache expiration
        const permanentUri = await copyImageToPermanentStorage(imageUri);

        console.log('EditEntry - Camera image copied:', permanentUri);
        setSetupImage(permanentUri);
        console.log('EditEntry - Image state updated successfully');
      } else {
        console.log('EditEntry - Camera was canceled or no assets returned');
      }
    } catch (error) {
      console.error('EditEntry - Error taking photo:', error);
      console.error('EditEntry - Error stack:', error.stack);
      Alert.alert("Error", `Failed to take photo: ${error.message}. Please try again.`);
    }
  };

  const showImagePicker = () => {
    const options = [
      { text: "Camera", onPress: takePhoto },
      { text: "Gallery", onPress: pickImage },
    ];

    // Add remove option if there's an existing image
    if (setupImage) {
      options.push({
        text: "Remove Image", onPress: () => {
          console.log('EditEntry - Image removed');
          setSetupImage(null);
        }, style: "destructive"
      });
    }

    options.push({ text: "Cancel", style: "cancel" });

    Alert.alert(
      "Image Options",
      "Choose how you want to manage your setup image",
      options
    );
  };

  const generateJournalContent = () => {
    const date = getCurrentDate();

    let content = `Date: ${date}\n\n${setupImage ? 'SETUP IMAGE: [Image Attached]' : 'SETUP IMAGE: [No Image]'}\n\n### Pair:\n`;

    pairs.forEach(pair => {
      content += `- [${selectedPairs.includes(pair) ? 'x' : ' '}] ${pair}\n`;
    });

    content += `\nTrade:\n`;
    tradeDirections.forEach(direction => {
      content += `- [${tradeDirection === direction ? 'x' : ' '}] ${direction}\n`;
    });

    content += `\n##### RR > ${riskReward || '_'}:\n\n`;
    tradeResults.forEach(result => {
      content += `- [${tradeResult === result ? 'x' : ' '}] ${result}\n`;
    });

    return content;
  };

  const handleSave = async () => {
    if (isLoading) {
      return;
    }

    if (!tradeDirection) {
      Alert.alert('Missing Information', 'Please select a trade direction (BUY/SELL)');
      return;
    }

    if (!tradeResult) {
      Alert.alert('Missing Information', 'Please select a trade result (WIN/BREAKEVEN/LOSS)');
      return;
    }

    if (selectedPairs.length === 0) {
      Alert.alert('Missing Information', 'Please select a trading pair');
      return;
    }

    // New Validation Checks
    if (!isFollowingPlan) {
      Alert.alert('Validation Error', 'You must confirm that you are following your trading plan.');
      return;
    }

    if (!emotionalState.trim()) {
      Alert.alert('Validation Error', 'Please describe your emotional state.');
      return;
    }

    setIsLoading(true);

    try {
      let imageUrl = entry.image_url;
      let imageFilename = entry.image_filename;

      console.log('Edit Entry - Image processing:');
      console.log('Current setupImage:', setupImage ? setupImage.substring(0, 50) + '...' : 'null');
      console.log('Original entry.image_url:', entry.image_url ? entry.image_url.substring(0, 50) + '...' : 'null');

      // Handle image changes
      if (setupImage && setupImage.startsWith('file://')) {
        // Upload new image if one is selected and it's a local URI
        console.log('Uploading new local image...');
        setIsUploading(true);
        try {
          const uploadResult = await imageAPI.uploadImage(setupImage);
          console.log('Upload result:', uploadResult);
          if (uploadResult.imageUrl && uploadResult.filename) {
            imageUrl = uploadResult.imageUrl;
            imageFilename = uploadResult.filename;
            console.log('New image uploaded successfully:', imageUrl);
          } else {
            throw new Error('Image upload failed - no URL returned');
          }
        } catch (uploadError) {
          console.error('Image upload failed:', uploadError);
          Alert.alert('Upload Error', 'Failed to upload image. Entry will be saved without image.');
          imageUrl = null;
          imageFilename = null;
        } finally {
          setIsUploading(false);
        }
      } else if (!setupImage) {
        // Image was removed
        console.log('Removing image...');
        imageUrl = null;
        imageFilename = null;
      } else if (setupImage && setupImage.startsWith('http')) {
        // Existing image URL, keep it as is
        console.log('Keeping existing image:', setupImage);
        imageUrl = setupImage;
      }

      console.log('Final image data:', { imageUrl, imageFilename });

      const entryData = {
        content: entry.mt5_ticket ? entry.content : generateJournalContent(),
        imageUrl,
        imageFilename,
        accountId: currentAccount?.id || entry.account_id,
        followingPlan: isFollowingPlan,
        emotionalState,
        notes,
      };

      console.log('Updating entry with data:', entryData);

      const response = await journalAPI.updateEntry(entry.id, entryData);
      console.log('API Response:', response);

      if (response.entry && response.message) {
        console.log('Entry updated successfully!');
        Alert.alert(
          'Success!',
          'Your forex trading journal entry has been updated.',
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack()
            }
          ]
        );
      } else {
        console.error('Update failed:', response.error);
        Alert.alert('Error', response.error || 'Failed to update entry');
      }

    } catch (error) {
      console.error('Error updating entry:', error);
      Alert.alert('Error', 'Failed to update entry. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const getResultColor = (result) => {
    switch (result) {
      case 'WIN': return '#50C878';
      case 'BREAKEVEN': return '#4A90E2';
      case 'LOSS': return '#FF6B6B';
      default: return '#ddd';
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#667eea" />

      {/* Modern Gradient Header */}
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        style={styles.header}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>

        <View style={styles.headerContent}>
          <Text style={styles.title}>Edit Trade Entry</Text>
          <Text style={styles.subtitle}>Update your trading session</Text>
        </View>

        <View style={styles.headerSpacer} />
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Setup Image Section */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            <Ionicons name="camera" size={20} color="#4A90E2" /> Setup Analysis
          </Text>

          {entry.mt5_ticket && setupImage ? (
            <View style={styles.imageWrapper}>
              <Image source={{ uri: setupImage }} style={styles.setupImage} />
              <View style={styles.lockedBadgeOverlay}>
                <Text style={styles.lockedBadgeText}>AUTO</Text>
              </View>
            </View>
          ) : setupImage ? (
            <View style={styles.imageWrapper}>
              <Image source={{ uri: setupImage }} style={styles.setupImage} />
              <TouchableOpacity style={styles.imageOverlay} onPress={showImagePicker}>
                <Ionicons name="refresh" size={24} color="#fff" />
                <Text style={styles.overlayText}>Change Image</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.uploadCard} onPress={entry.mt5_ticket ? null : showImagePicker}>
              {entry.mt5_ticket ? (
                <Text style={{ color: '#999', textAlign: 'center' }}>No Image Provided by MT5</Text>
              ) : (
                <>
                  <View style={styles.uploadIcon}>
                    <Ionicons name="cloud-upload" size={32} color="#4A90E2" />
                  </View>
                  <Text style={styles.uploadTitle}>Add Setup Image</Text>
                  <Text style={styles.uploadSubtitle}>Take a photo or choose from gallery</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Trading Information */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            <Ionicons name="stats-chart" size={20} color="#4A90E2" /> Trading Information
          </Text>

          {/* Currency Pairs */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Currency Pair</Text>
            {entry.mt5_ticket ? (
              <View style={styles.lockedInput}>
                <Text style={styles.lockedText}>{selectedPairs.join(', ') || 'None'}</Text>
                <View style={styles.lockedBadge}>
                  <Text style={styles.lockedBadgeText}>AUTO</Text>
                </View>
              </View>
            ) : (
              <View style={styles.chipContainer}>
                {pairs.map((pair) => (
                  <TouchableOpacity
                    key={pair}
                    style={[
                      styles.chip,
                      selectedPairs.includes(pair) && styles.chipSelected
                    ]}
                    onPress={() => togglePair(pair)}
                  >
                    <Text style={[
                      styles.chipText,
                      selectedPairs.includes(pair) && styles.chipTextSelected
                    ]}>
                      {pair}
                    </Text>
                    {selectedPairs.includes(pair) && (
                      <Ionicons name="checkmark-circle" size={16} color="#fff" style={styles.chipIcon} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Trade Direction */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Trade Direction</Text>
            {entry.mt5_ticket ? (
              <View style={[styles.lockedInput, { borderColor: tradeDirection === 'BUY' ? '#50C878' : '#FF6B6B' }]}>
                <Ionicons
                  name={tradeDirection === 'BUY' ? 'trending-up' : 'trending-down'}
                  size={20}
                  color={tradeDirection === 'BUY' ? '#50C878' : '#FF6B6B'}
                />
                <Text style={styles.lockedText}>{tradeDirection}</Text>
                <View style={styles.lockedBadge}>
                  <Text style={styles.lockedBadgeText}>AUTO</Text>
                </View>
              </View>
            ) : (
              <View style={styles.segmentedControl}>
                {tradeDirections.map((direction) => (
                  <TouchableOpacity
                    key={direction}
                    style={[
                      styles.segmentButton,
                      tradeDirection === direction && styles.segmentButtonSelected
                    ]}
                    onPress={() => setTradeDirection(direction)}
                  >
                    <Ionicons
                      name={direction === 'BUY' ? 'trending-up' : 'trending-down'}
                      size={20}
                      color={tradeDirection === direction ? '#fff' : '#666'}
                    />
                    <Text style={[
                      styles.segmentText,
                      tradeDirection === direction && styles.segmentTextSelected
                    ]}>
                      {direction}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Risk Reward Ratio */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Risk : Reward Ratio</Text>
            {entry.mt5_ticket ? (
              <View style={styles.lockedInput}>
                <Text style={styles.lockedText}>1 : {riskReward || 'N/A'}</Text>
                <View style={styles.lockedBadge}>
                  <Text style={styles.lockedBadgeText}>AUTO</Text>
                </View>
              </View>
            ) : (
              <View style={styles.rrWrapper}>
                <View style={styles.rrContainer}>
                  <Text style={styles.rrPrefix}>1 :</Text>
                  <TextInput
                    style={styles.rrInput}
                    value={riskReward}
                    onChangeText={setRiskReward}
                    placeholder="2.5"
                    keyboardType="decimal-pad"
                    maxLength={4}
                  />
                </View>
                <Text style={styles.rrHint}>Your minimum risk-to-reward target</Text>
              </View>
            )}
          </View>
        </View>

        {/* Trade Outcome */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            <Ionicons name="pulse" size={20} color="#4A90E2" /> Trade Outcome
          </Text>

          {entry.mt5_ticket ? (
            <View style={[styles.lockedInput, { borderColor: getResultColor(tradeResult) }]}>
              <View style={[styles.resultIcon, { backgroundColor: getResultColor(tradeResult) }]}>
                <Ionicons
                  name={
                    tradeResult === 'WIN' ? 'trophy' :
                      tradeResult === 'BREAKEVEN' ? 'remove' : 'close'
                  }
                  size={24}
                  color="#fff"
                />
              </View>
              <Text style={[styles.lockedText, { color: getResultColor(tradeResult), fontWeight: 'bold' }]}>{tradeResult}</Text>
              <View style={styles.lockedBadge}>
                <Text style={styles.lockedBadgeText}>AUTO</Text>
              </View>
            </View>
          ) : (
            <View style={styles.resultGrid}>
              {tradeResults.map((result) => (
                <TouchableOpacity
                  key={result}
                  style={[
                    styles.resultCard,
                    tradeResult === result && [styles.resultCardSelected, { borderColor: getResultColor(result) }]
                  ]}
                  onPress={() => setTradeResult(result)}
                >
                  <View style={[styles.resultIcon, { backgroundColor: getResultColor(result) }]}>
                    <Ionicons
                      name={
                        result === 'WIN' ? 'trophy' :
                          result === 'BREAKEVEN' ? 'remove' : 'close'
                      }
                      size={24}
                      color="#fff"
                    />
                  </View>
                  <Text style={[
                    styles.resultText,
                    tradeResult === result && { color: getResultColor(result) }
                  ]}>
                    {result}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Pre-Trade Validation */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            <Ionicons name="shield-checkmark" size={20} color="#4A90E2" /> Trade Validation
          </Text>

          {/* Following Plan */}
          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => setIsFollowingPlan(!isFollowingPlan)}
          >
            <View style={[styles.checkbox, isFollowingPlan && styles.checkboxChecked]}>
              {isFollowingPlan && <Ionicons name="checkmark" size={16} color="#fff" />}
            </View>
            <Text style={styles.checkboxLabel}>Am I following my trading plan?</Text>
          </TouchableOpacity>

          {/* Emotional State */}
          <View style={styles.validationGroup}>
            <Text style={styles.validationLabel}>Emotional State</Text>
            <TextInput
              style={styles.input}
              value={emotionalState}
              onChangeText={setEmotionalState}
              placeholder="How are you feeling right now?"
              placeholderTextColor="#999"
            />
          </View>
        </View>

        {/* Notes */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            <Ionicons name="document-text" size={20} color="#4A90E2" /> Notes
          </Text>

          <View style={styles.textAreaWrapper}>
            <TextInput
              style={styles.textArea}
              value={notes}
              onChangeText={setNotes}
              placeholder="Any additional notes about this trade..."
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, (isLoading || isUploading) && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isLoading || isUploading}
        >
          <LinearGradient
            colors={(isLoading || isUploading) ? ['#ccc', '#999'] : ['#667eea', '#764ba2']}
            style={styles.saveButtonGradient}
          >
            <View style={styles.saveButtonContent}>
              {isLoading || isUploading ? (
                <>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={styles.saveButtonText}>
                    {isUploading ? 'Uploading...' : 'Updating...'}
                  </Text>
                </>
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  <Text style={styles.saveButtonText}>Update Trading Journal</Text>
                </>
              )}
            </View>
          </LinearGradient>
        </TouchableOpacity>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    paddingTop: 50,
    paddingBottom: 25,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  backButton: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  headerSpacer: {
    width: 50,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Image Upload Styles
  uploadCard: {
    borderWidth: 2,
    borderColor: '#e9ecef',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  uploadIcon: {
    backgroundColor: '#e3f2fd',
    borderRadius: 30,
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  uploadTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  uploadSubtitle: {
    fontSize: 14,
    color: '#777',
    textAlign: 'center',
    lineHeight: 20,
  },
  imageWrapper: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
  },
  setupImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  imageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  overlayText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
  },

  // Field Group Styles
  fieldGroup: {
    marginBottom: 24,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },

  // Chip Styles (Currency Pairs)
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  chip: {
    backgroundColor: '#f1f3f4',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    flexDirection: 'row',
    alignItems: 'center',
  },
  chipSelected: {
    backgroundColor: '#4A90E2',
    borderColor: '#4A90E2',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
  },
  chipTextSelected: {
    color: '#fff',
  },
  chipIcon: {
    marginLeft: 6,
  },

  // Segmented Control (Direction)
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#f1f3f4',
    borderRadius: 12,
    padding: 4,
  },
  segmentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  segmentButtonSelected: {
    backgroundColor: '#4A90E2',
  },
  segmentText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginLeft: 8,
  },
  segmentTextSelected: {
    color: '#fff',
  },

  // Risk Reward Styles
  rrWrapper: {
    alignItems: 'center',
  },
  rrContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  rrPrefix: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginRight: 12,
  },
  rrInput: {
    fontSize: 24,
    fontWeight: '600',
    color: '#4A90E2',
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#dee2e6',
    minWidth: 80,
    textAlign: 'center',
  },
  rrHint: {
    fontSize: 12,
    color: '#6c757d',
    marginTop: 8,
    fontStyle: 'italic',
  },

  // Result Cards (Trade Outcome)
  resultGrid: {
    flexDirection: 'column',
    gap: 10,
  },
  resultCard: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e9ecef',
  },
  resultCardSelected: {
    backgroundColor: '#fff',
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  resultIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 0,
  },
  resultText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#495057',
  },

  // Text Area Styles
  textAreaWrapper: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e9ecef',
  },
  textArea: {
    fontSize: 16,
    color: '#495057',
    paddingHorizontal: 16,
    paddingVertical: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },

  // Validation Styles
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#4A90E2',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  checkboxChecked: {
    backgroundColor: '#4A90E2',
  },
  checkboxLabel: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  validationGroup: {
    marginBottom: 16,
  },
  validationLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    color: '#333',
  },

  // Save Button Styles
  saveButton: {
    borderRadius: 16,
    marginHorizontal: 4,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  saveButtonGradient: {
    padding: 18,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 8,
  },
  bottomSpacer: {
    height: 30,
  },
  // Locked Field Styles
  lockedInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e9ecef',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ced4da',
  },
  lockedText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#495057',
    marginLeft: 8,
  },
  lockedBadge: {
    backgroundColor: '#cfe2ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  lockedBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#084298',
  },
  lockedBadgeOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#cfe2ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
});


export default EditEntryScreen;