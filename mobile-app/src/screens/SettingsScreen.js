import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAccount } from '../context/AccountContext';
import { useAuth } from '../context/AuthContext';

const SettingsScreen = ({ navigation, route }) => {
  const {
    currentAccount,
    accounts,
    switchAccount,
    deactivateAccount,
    createAccount,
    updateAccount,
    deleteAccount,
    fetchAccounts,
    isLoading: accountLoading
  } = useAccount();
  const { signOut, user } = useAuth();

  const [showAddAccount, setShowAddAccount] = useState(false);
  const [newAccount, setNewAccount] = useState({
    name: '',
    description: '',
    color: '#4A90E2',
    starting_balance: '',
  });

  useEffect(() => {
    // Refresh accounts when component mounts
    fetchAccounts();
  }, []);

  const addAccount = async () => {
    if (!newAccount.name.trim()) {
      Alert.alert('Error', 'Please enter an account name');
      return;
    }

    const result = await createAccount(newAccount);

    if (result.success) {
      setNewAccount({ name: '', description: '', color: '#4A90E2', starting_balance: '' });
      setShowAddAccount(false);
      Alert.alert('Success', 'Account added successfully');
    } else {
      Alert.alert('Error', result.error || 'Failed to create account');
    }
  };

  const setActiveAccount = async (accountId) => {
    // If clicking on already active account, deactivate it
    if (currentAccount?.id === accountId) {
      await deactivateAccount();
      Alert.alert('Success', 'Account deactivated');
      return;
    }

    // Otherwise, switch to the selected account
    const account = accounts.find(acc => acc.id === accountId);
    if (account) {
      console.log('SettingsScreen: Switching to account:', account.name, 'ID:', account.id);
      await switchAccount(account);
      Alert.alert('Success', `Switched to ${account.name}`);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            const { error } = await signOut();
            if (error) {
              Alert.alert('Error', 'Failed to log out. Please try again.');
            }
          }
        }
      ]
    );
  };

  const handleDeleteAccount = async (accountId) => {
    const account = accounts.find(acc => acc.id === accountId);
    const accountName = account ? account.name : 'this account';
    const entryCount = account ? account.entryCount || 0 : 0;

    Alert.alert(
      'Delete Account',
      `Are you sure you want to delete "${accountName}"?\n\nThis will permanently delete:\n• The account\n• All ${entryCount} journal entries\n• All associated data\n\nThis action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const result = await deleteAccount(accountId);
            if (result.success) {
              Alert.alert('Success', `Account and all associated data deleted successfully.`);
            } else {
              Alert.alert('Error', result.error || 'Failed to delete account');
            }
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>
          Manage your trading accounts and preferences
        </Text>
      </LinearGradient>

      <ScrollView style={styles.content}>
        {/* Quick Access */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Access</Text>
          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={() => navigation.navigate('Calendar')}
          >
            <Ionicons name="calendar" size={24} color="#4A90E2" />
            <Text style={styles.quickActionText}>Trading Calendar</Text>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickActionCard, { marginTop: 15 }]}
            onPress={() => navigation.navigate('AccountGrowth')}
          >
            <Ionicons name="trending-up" size={24} color="#50C878" />
            <Text style={styles.quickActionText}>Account Growth</Text>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>
        </View>

        {/* Trading Accounts */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Trading Accounts</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setShowAddAccount(true)}
            >
              <Ionicons name="add" size={20} color="#4A90E2" />
              <Text style={styles.addButtonText}>Add</Text>
            </TouchableOpacity>
          </View>

          {accountLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#4A90E2" />
              <Text style={styles.loadingText}>Loading accounts...</Text>
            </View>
          ) : accounts.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="wallet-outline" size={48} color="#ccc" />
              <Text style={styles.emptyTitle}>No Trading Accounts</Text>
              <Text style={styles.emptySubtitle}>Add your first trading account to get started</Text>
            </View>
          ) : (
            accounts.map(account => (
              <TouchableOpacity
                key={account.id}
                style={[
                  styles.accountCard,
                  currentAccount?.id === account.id && styles.activeAccount
                ]}
                onPress={() => navigation.navigate('AccountJournal', { account })}
              >
                <View style={styles.accountHeader}>
                  <View style={styles.accountInfo}>
                    <Text style={styles.accountName}>
                      {account.name}
                      {currentAccount?.id === account.id && (
                        <Text style={styles.activeLabel}> (Active)</Text>
                      )}
                    </Text>
                    <Text style={styles.accountDetails}>
                      {account.description || 'Trading Account'}
                    </Text>
                    <Text style={styles.accountBalance}>
                      {account.entryCount || 0} journal entries
                    </Text>
                  </View>
                  <View style={styles.accountActions}>
                    <TouchableOpacity
                      style={[
                        styles.selectButton,
                        currentAccount?.id === account.id && styles.selectedButton
                      ]}
                      onPress={(e) => {
                        e.stopPropagation();
                        setActiveAccount(account.id);
                      }}
                    >
                      <Ionicons
                        name={currentAccount?.id === account.id ? "checkmark-circle" : "radio-button-off"}
                        size={20}
                        color={currentAccount?.id === account.id ? "#50C878" : "#666"}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleDeleteAccount(account.id);
                      }}
                    >
                      <Ionicons name="trash-outline" size={20} color="#FF6B6B" />
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* App Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App Information</Text>

          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Bulletproof Forex Journal</Text>
            <Text style={styles.infoVersion}>Version 1.0.0</Text>
            <Text style={styles.infoDescription}>
              Professional forex trading journal designed to help you track your trades, analyze performance, and develop disciplined trading habits.
            </Text>
          </View>
        </View>

        {/* Account & Logout */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          {user && (
            <Text style={styles.userEmail}>{user.email}</Text>
          )}
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={22} color="#fff" />
            <Text style={styles.logoutButtonText}>Log Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Add Account Modal */}
      <Modal
        visible={showAddAccount}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddAccount(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Account</Text>
              <TouchableOpacity onPress={() => setShowAddAccount(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Account Name *</Text>
              <TextInput
                style={styles.input}
                value={newAccount.name}
                onChangeText={(text) => setNewAccount({ ...newAccount, name: text })}
                placeholder="e.g., ICT Live Account"
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                style={styles.input}
                value={newAccount.description}
                onChangeText={(text) => setNewAccount({ ...newAccount, description: text })}
                placeholder="e.g., Exness MT5 Account"
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Starting Balance ($)</Text>
              <TextInput
                style={styles.input}
                value={newAccount.starting_balance}
                onChangeText={(text) => setNewAccount({ ...newAccount, starting_balance: text })}
                placeholder="e.g., 3000"
                placeholderTextColor="#999"
                keyboardType="numeric"
              />
            </View>

            <View style={styles.colorContainer}>
              <Text style={styles.inputLabel}>Account Color</Text>
              <View style={styles.colorOptions}>
                {['#4A90E2', '#50C878', '#FF6B6B', '#FFB347', '#9370DB', '#20B2AA'].map(color => (
                  <TouchableOpacity
                    key={color}
                    style={[
                      styles.colorOption,
                      { backgroundColor: color },
                      newAccount.color === color && styles.selectedColor
                    ]}
                    onPress={() => setNewAccount({ ...newAccount, color })}
                  />
                ))}
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowAddAccount(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.addAccountButton}
                onPress={addAccount}
              >
                <Text style={styles.addAccountButtonText}>Add Account</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#E6F3FF',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 30,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E6F3FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  addButtonText: {
    color: '#4A90E2',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  quickActionCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  quickActionText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
    marginLeft: 15,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 10,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 5,
  },
  accountCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  activeAccount: {
    borderLeftWidth: 4,
    borderLeftColor: '#50C878',
    backgroundColor: '#f0f9f0',
  },
  accountHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  accountInfo: {
    flex: 1,
  },
  accountName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  activeLabel: {
    color: '#50C878',
    fontSize: 14,
    fontWeight: '600',
  },
  accountDetails: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  accountBalance: {
    fontSize: 12,
    color: '#999',
  },
  accountActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectButton: {
    padding: 8,
    marginRight: 5,
  },
  selectedButton: {
    backgroundColor: '#f0f9f0',
    borderRadius: 20,
  },
  deleteButton: {
    padding: 8,
  },
  infoCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  infoVersion: {
    fontSize: 14,
    color: '#4A90E2',
    marginBottom: 10,
  },
  infoDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
  },
  backButton: {
    padding: 8,
    marginRight: 15,
  },
  calendarHeaderTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
  },
  headerSpacer: {
    width: 34,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  inputContainer: {
    marginBottom: 15,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
  },
  colorContainer: {
    marginBottom: 20,
  },
  colorOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  colorOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  selectedColor: {
    borderColor: '#333',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelButton: {
    flex: 1,
    padding: 15,
    marginRight: 10,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  addAccountButton: {
    flex: 1,
    padding: 15,
    marginLeft: 10,
    borderRadius: 8,
    backgroundColor: '#4A90E2',
    alignItems: 'center',
  },
  addAccountButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF4444',
    paddingVertical: 14,
    borderRadius: 10,
    shadowColor: '#FF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
});

export default SettingsScreen;