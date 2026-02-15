import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { accountsAPI, journalAPI } from '../services/api';
import { useAuth } from './AuthContext';

const AccountContext = createContext();

export const useAccount = () => {
  const context = useContext(AccountContext);
  if (!context) {
    throw new Error('useAccount must be used within an AccountProvider');
  }
  return context;
};

export const AccountProvider = ({ children }) => {
  const { user } = useAuth();
  const [currentAccount, setCurrentAccount] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Only fetch accounts when a user is logged in
  useEffect(() => {
    if (user) {
      initializeAccounts();
    } else {
      // Reset state when logged out
      setAccounts([]);
      setCurrentAccount(null);
      setIsLoading(false);
    }
  }, [user]);

  const initializeAccounts = async () => {
    try {
      console.log('AccountContext: Loading accounts from cloud...');
      await fetchAccounts();
    } catch (error) {
      console.error('AccountContext: Failed to initialize accounts:', error);
      setIsLoading(false);
    }
  };

  const loadSavedAccountId = async () => {
    try {
      const savedAccountId = await AsyncStorage.getItem('currentAccountId');
      return savedAccountId ? parseInt(savedAccountId) : null;
    } catch (error) {
      console.error('Error loading saved account:', error);
      return null;
    }
  };

  const fetchAccounts = async () => {
    try {
      setIsLoading(true);
      console.log('AccountContext: Fetching accounts from API');

      const response = await accountsAPI.getAccounts();
      const accountsList = response.data || [];
      console.log('AccountContext: Found accounts:', accountsList.length);

      setAccounts(accountsList);

      // Set current account
      const savedAccountId = await loadSavedAccountId();
      if (savedAccountId) {
        const savedAccount = accountsList.find(acc => acc.id === savedAccountId);
        if (savedAccount) {
          setCurrentAccount(savedAccount);
        } else if (accountsList.length > 0) {
          setCurrentAccount(accountsList[0]);
        } else {
          setCurrentAccount(null);
        }
      } else if (accountsList.length > 0) {
        setCurrentAccount(accountsList[0]);
      } else {
        setCurrentAccount(null);
      }
    } catch (error) {
      console.error('Error fetching accounts:', error);
      setAccounts([]);
      setCurrentAccount(null);
    } finally {
      setIsLoading(false);
    }
  };

  const switchAccount = async (account) => {
    try {
      console.log('AccountContext: Switching to', account.name);
      setCurrentAccount(account);
      await AsyncStorage.setItem('currentAccountId', account.id.toString());
    } catch (error) {
      console.error('Error saving account selection:', error);
    }
  };

  const deactivateAccount = async () => {
    try {
      setCurrentAccount(null);
      await AsyncStorage.removeItem('currentAccountId');
    } catch (error) {
      console.error('Error deactivating account:', error);
    }
  };

  const createAccount = async (accountData) => {
    try {
      const response = await accountsAPI.createAccount(accountData);
      await fetchAccounts();
      return { success: true, account: response.data };
    } catch (error) {
      console.error('Error creating account:', error);
      return { success: false, error: 'Failed to create account' };
    }
  };

  const updateAccount = async (accountId, accountData) => {
    try {
      await accountsAPI.updateAccount(accountId, accountData);
      await fetchAccounts();

      if (currentAccount && currentAccount.id === accountId) {
        const response = await accountsAPI.getAccount(accountId);
        setCurrentAccount(response.data);
      }

      return { success: true };
    } catch (error) {
      console.error('Error updating account:', error);
      return { success: false, error: 'Failed to update account' };
    }
  };

  const deleteAccount = async (accountId) => {
    try {
      await accountsAPI.deleteAccount(accountId);

      if (currentAccount && currentAccount.id === accountId) {
        const remainingAccounts = accounts.filter(acc => acc.id !== accountId);
        if (remainingAccounts.length > 0) {
          await switchAccount(remainingAccounts[0]);
        } else {
          setCurrentAccount(null);
          await AsyncStorage.removeItem('currentAccountId');
        }
      }

      await fetchAccounts();
      return { success: true };
    } catch (error) {
      console.error('Error deleting account:', error);
      return { success: false, error: 'Failed to delete account' };
    }
  };

  const getAccountStats = async (accountId) => {
    try {
      const response = await journalAPI.getEntries(1, 10000, '', accountId);
      const entries = response.entries || [];

      const totalTrades = entries.length;
      const wins = entries.filter(e => (parseFloat(e.pnl) || 0) > 0).length;
      const losses = entries.filter(e => (parseFloat(e.pnl) || 0) < 0).length;
      const breakevens = totalTrades - wins - losses;
      const winRate = totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(2) : 0;

      return {
        success: true,
        stats: {
          totalTrades,
          wins,
          losses,
          breakevens,
          winRate: parseFloat(winRate)
        }
      };
    } catch (error) {
      console.error('Error fetching account stats:', error);
      return { success: false, error: 'Failed to fetch account statistics' };
    }
  };

  const value = {
    currentAccount,
    accounts,
    isLoading,
    switchAccount,
    deactivateAccount,
    createAccount,
    updateAccount,
    deleteAccount,
    fetchAccounts,
    getAccountStats,
  };

  return (
    <AccountContext.Provider value={value}>
      {children}
    </AccountContext.Provider>
  );
};

export default AccountContext;