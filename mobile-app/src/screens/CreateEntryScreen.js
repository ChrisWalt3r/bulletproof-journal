import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  Image,
  StatusBar,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { journalAPI, imageAPI } from '../services/api';
import { useAccount } from '../context/AccountContext';
import AccountHeader from '../components/AccountHeader';

const { width: screenWidth } = Dimensions.get('window');

const CreateEntryScreen = ({ navigation }) => {
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

  // Reset form when screen comes into focus (handles second+ entries)
  useFocusEffect(
    React.useCallback(() => {
      console.log('CreateEntryScreen focused - resetting form');
      try {
        // Reset all form fields to initial state
        setIsLoading(false);
        setIsUploading(false);
        setSelectedPairs([]);
        setTradeDirection('');
        setTradeResult('');
        setSetupImage(null);
        setRiskReward('');
        setNotes('');

        // Reset validation fields
        setIsFollowingPlan(false);
        setEmotionalState('');

        console.log('CreateEntryScreen - Form reset completed successfully');
      } catch (error) {
        console.error('CreateEntryScreen - Error during form reset:', error);
        console.error('CreateEntryScreen - Reset error stack:', error.stack);
      }
    }, [])
  );

  const getCurrentDate = () => {
    // Get current date in Ugandan time (EAT - UTC+3)
    const now = new Date();

    // Create date formatter for Ugandan timezone
    const ugandanDateString = now.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'Africa/Kampala'
    });

    return ugandanDateString;
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

      console.log('CreateEntry - Image copied to permanent storage:', newPath);
      return newPath;
    } catch (error) {
      console.error('CreateEntry - Error copying image:', error);
      throw error;
    }
  };

  const pickImage = async () => {
    try {
      console.log('CreateEntry - pickImage called');

      // Request permission
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      console.log('CreateEntry - Gallery permission result:', permissionResult.granted);

      if (permissionResult.granted === false) {
        Alert.alert("Permission Denied", "You need to grant camera roll permissions to upload images.");
        return;
      }

      console.log('CreateEntry - Launching image library...');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false, // Don't crop - take full image
        quality: 0.8,
        exif: false, // Don't include EXIF data to reduce file size
      });

      console.log('CreateEntry - Gallery result:', {
        canceled: result.canceled,
        hasAssets: result.assets?.length > 0,
        firstAssetUri: result.assets?.[0]?.uri?.substring(0, 50) + '...'
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const imageUri = result.assets[0].uri;
        console.log('CreateEntry - Copying image to permanent storage...');

        // Copy image immediately to prevent cache expiration
        const permanentUri = await copyImageToPermanentStorage(imageUri);

        console.log('CreateEntry - Setting permanent image URI:', permanentUri);
        setSetupImage(permanentUri);
        console.log('CreateEntry - Image state updated successfully');
      } else {
        console.log('CreateEntry - Gallery was canceled or no assets returned');
      }
    } catch (error) {
      console.error('CreateEntry - Error picking image:', error);
      console.error('CreateEntry - Error stack:', error.stack);
      Alert.alert("Error", `Failed to pick image: ${error.message}. Please try again.`);
    }
  };

  const takePhoto = async () => {
    try {
      console.log('CreateEntry - takePhoto called');

      // Request permission
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      console.log('CreateEntry - Camera permission result:', permissionResult.granted);

      if (permissionResult.granted === false) {
        Alert.alert("Permission Denied", "You need to grant camera permissions to take photos.");
        return;
      }

      console.log('CreateEntry - Launching camera...');
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      console.log('CreateEntry - Camera result:', {
        canceled: result.canceled,
        hasAssets: result.assets?.length > 0,
        firstAssetUri: result.assets?.[0]?.uri?.substring(0, 50) + '...'
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const imageUri = result.assets[0].uri;
        console.log('CreateEntry - Copying camera image to permanent storage...');

        // Copy image immediately to prevent cache expiration
        const permanentUri = await copyImageToPermanentStorage(imageUri);

        console.log('CreateEntry - Setting permanent camera image URI:', permanentUri);
        setSetupImage(permanentUri);
        console.log('CreateEntry - Image state updated successfully');
      } else {
        console.log('CreateEntry - Camera was canceled or no assets returned');
      }
    } catch (error) {
      console.error('CreateEntry - Error taking photo:', error);
      console.error('CreateEntry - Error stack:', error.stack);
      Alert.alert("Error", `Failed to take photo: ${error.message}. Please try again.`);
    }
  };

  const showImagePicker = () => {
    Alert.alert(
      "Select Image",
      "Choose how you want to add your setup image",
      [
        { text: "Camera", onPress: takePhoto },
        { text: "Gallery", onPress: pickImage },
        { text: "Cancel", style: "cancel" }
      ]
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

    if (notes) {
      content += `\nNotes:\n> ${notes}\n\n`;
    }

    return content;
  };

  const handleSave = async () => {
    // Prevent multiple simultaneous save attempts
    if (isLoading) {
      console.log('Save already in progress, ignoring duplicate request');
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
      let imageUrl = null;
      let imageFilename = null;

      // Upload image if one is selected
      if (setupImage) {
        setIsUploading(true);
        try {
          console.log('Starting image upload...');
          const uploadResult = await imageAPI.uploadImage(setupImage);
          console.log('Image upload successful:', uploadResult);
          imageUrl = uploadResult.imageUrl;
          imageFilename = uploadResult.filename;
        } catch (error) {
          console.error('Image upload failed:', error);

          const errorMessage = error.message || 'Failed to upload image';

          const buttons = [
            {
              text: 'Cancel', style: 'cancel', onPress: () => {
                setIsLoading(false);
                setIsUploading(false);
              }
            },
            {
              text: 'Continue Without Image', onPress: () => {
                setIsUploading(false);
                proceedWithSave(null, null);
              }
            },
            {
              text: 'Try Again',
              onPress: () => {
                setIsLoading(false);
                setIsUploading(false);
                // Small delay to prevent immediate retry
                setTimeout(() => handleSave(), 1000);
              }
            }
          ];

          Alert.alert('Image Upload Failed', errorMessage, buttons);
          return;
        } finally {
          setIsUploading(false);
        }
      }

      await proceedWithSave(imageUrl, imageFilename);

    } catch (error) {
      console.error('Error creating entry:', error);
      Alert.alert('Error', 'Failed to save journal entry. Please try again.');
      setIsLoading(false);
      setIsUploading(false);
    }
  };

  const proceedWithSave = async (imageUrl, imageFilename) => {
    try {
      const content = generateJournalContent();
      const title = `Forex Trade - ${getCurrentDate()}`;

      // Determine mood rating based on trade result
      let moodRating = 5; // Default neutral
      if (tradeResult === 'WIN') moodRating = 8;
      else if (tradeResult === 'BREAKEVEN') moodRating = 6;
      else if (tradeResult === 'LOSS') moodRating = 3;

      // Get current device time and format it as YYYY-MM-DD HH:MM:SS
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      const timestamp = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

      const entryData = {
        title,
        content,
        moodRating,
        tags: ['forex', 'trading', tradeResult.toLowerCase(), ...selectedPairs.map(p => p.toLowerCase())],
        imageUrl,
        imageFilename,
        accountId: currentAccount?.id || 1,
        followingPlan: isFollowingPlan,
        emotionalState,
        notes,
        createdAt: timestamp // Send device time to backend
      };

      const response = await journalAPI.createEntry(entryData);
      console.log('CreateEntry - Entry created successfully:', response);

      console.log('CreateEntry - Showing success alert and navigating back');
      Alert.alert(
        'Success!',
        'Your forex trading journal entry has been saved.',
        [
          {
            text: 'OK',
            onPress: () => {
              console.log('CreateEntry - User pressed OK, navigating to Journal tab');
              // Navigate to the Journal tab (which is JournalListScreen)
              navigation.navigate('Journal');
            }
          }
        ]
      );

      // Form will be reset by useFocusEffect when returning to this screen

    } catch (saveError) {
      console.error('CreateEntry - Error in proceedWithSave:', saveError);
      console.error('CreateEntry - Save error stack:', saveError.stack);
      Alert.alert('Error', 'Failed to save journal entry. Please try again.');
    } finally {
      console.log('CreateEntry - Setting loading to false');
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
          <Text style={styles.title}>New Trade Entry</Text>
          <Text style={styles.subtitle}>Record your trading session</Text>
        </View>

        <View style={styles.headerSpacer} />
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Setup Image Section */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            <Ionicons name="camera" size={20} color="#4A90E2" /> Setup Analysis
          </Text>

          {setupImage ? (
            <View style={styles.imageWrapper}>
              <Image source={{ uri: setupImage }} style={styles.setupImage} />
              <TouchableOpacity style={styles.imageOverlay} onPress={showImagePicker}>
                <Ionicons name="refresh" size={24} color="#fff" />
                <Text style={styles.overlayText}>Change Image</Text>
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

        {/* Trading Information */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            <Ionicons name="stats-chart" size={20} color="#4A90E2" /> Trading Information
          </Text>

          {/* Currency Pairs */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Currency Pair</Text>
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
          </View>

          {/* Trade Direction */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Trade Direction</Text>
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
          </View>

          {/* Risk Reward Ratio */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Risk : Reward Ratio</Text>
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
          </View>
        </View>

        {/* Trade Outcome */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            <Ionicons name="pulse" size={20} color="#4A90E2" /> Trade Outcome
          </Text>

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
              placeholder="Any notes about this trade..."
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              placeholderTextColor="#999"
            />
          </View>
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

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isLoading}
        >
          <LinearGradient
            colors={isLoading ? ['#a0a0a0', '#808080'] : ['#667eea', '#764ba2']}
            style={styles.saveButtonGradient}
          >
            <View style={styles.saveButtonContent}>
              {isLoading ? (
                <Ionicons name="hourglass" size={20} color="#fff" />
              ) : (
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
              )}
              <Text style={styles.saveButtonText}>
                {isUploading ? 'Uploading Image...' :
                  isLoading ? 'Saving Entry...' :
                    'Save Trading Journal'}
              </Text>
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
    color: '#1a1a1a',
    marginBottom: 8,
  },
  uploadSubtitle: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
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
  },
  overlayText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
    marginTop: 8,
  },

  // Field Group Styles
  fieldGroup: {
    marginBottom: 24,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 12,
  },

  // Chip Styles (Currency Pairs)
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderWidth: 1.5,
    borderColor: '#e9ecef',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    margin: 4,
    minWidth: (screenWidth - 80) / 3,
    justifyContent: 'center',
  },
  chipSelected: {
    backgroundColor: '#4A90E2',
    borderColor: '#4A90E2',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
  },
  chipTextSelected: {
    color: '#fff',
  },
  chipIcon: {
    marginLeft: 6,
  },

  // Segmented Control (Trade Direction)
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 4,
  },
  segmentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  segmentButtonSelected: {
    backgroundColor: '#4A90E2',
    shadowColor: '#4A90E2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderWidth: 2,
    borderColor: '#e9ecef',
    minWidth: 150,
  },
  rrPrefix: {
    fontSize: 18,
    fontWeight: '700',
    color: '#495057',
    marginRight: 12,
  },
  rrInput: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4A90E2',
    textAlign: 'center',
    minWidth: 50,
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#dee2e6',
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
});

export default CreateEntryScreen;