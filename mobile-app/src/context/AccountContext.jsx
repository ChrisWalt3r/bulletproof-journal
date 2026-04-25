import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { accountsAPI, journalAPI } from '../services/api.js';
import { useAuth } from './AuthContext.jsx';

const STORAGE_KEY = 'bpj.currentAccountId';

const AccountContext = createContext(null);

export const useAccount = () => {
  const context = useContext(AccountContext);

  if (!context) {
    throw new Error('useAccount must be used within an AccountProvider');
  }

  return context;
};

const readSavedAccountId = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
};

const persistAccountId = (value) => {
  if (typeof window === 'undefined') {
    return;
  }

  if (value == null) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, String(value));
};

export const AccountProvider = ({ children }) => {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [currentAccount, setCurrentAccount] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const activeUserIdRef = useRef(userId);
  const fetchPromiseRef = useRef(null);
  const fetchPromiseUserIdRef = useRef(null);

  useEffect(() => {
    activeUserIdRef.current = userId;
  }, [userId]);

  const fetchAccounts = useCallback(async () => {
    if (!userId) {
      fetchPromiseRef.current = null;
      fetchPromiseUserIdRef.current = null;
      setAccounts([]);
      setCurrentAccount(null);
      setIsLoading(false);
      persistAccountId(null);
      return [];
    }

    if (
      fetchPromiseRef.current &&
      fetchPromiseUserIdRef.current === userId
    ) {
      return fetchPromiseRef.current;
    }

    setIsLoading(true);

    const request = (async () => {
      try {
        const response = await accountsAPI.getAccounts();
        const nextAccounts = response.data || [];
        const savedId = readSavedAccountId();
        const resolvedAccount =
          nextAccounts.find((account) => account.id === savedId) ||
          nextAccounts[0] ||
          null;

        if (activeUserIdRef.current !== userId) {
          return [];
        }

        setAccounts(nextAccounts);
        startTransition(() => {
          setCurrentAccount(resolvedAccount);
        });
        persistAccountId(resolvedAccount?.id ?? null);

        return nextAccounts;
      } catch (error) {
        if (activeUserIdRef.current !== userId) {
          return [];
        }

        if (error?.status !== 401) {
          console.error('AccountContext: failed to fetch accounts', error);
        }

        setAccounts([]);
        setCurrentAccount(null);
        persistAccountId(null);
        return [];
      } finally {
        if (activeUserIdRef.current === userId) {
          setIsLoading(false);
        }
        fetchPromiseRef.current = null;
        fetchPromiseUserIdRef.current = null;
      }
    })();

    fetchPromiseRef.current = request;
    fetchPromiseUserIdRef.current = userId;
    return request;
  }, [userId]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const value = useMemo(
    () => ({
      currentAccount,
      accounts,
      isLoading,
      async switchAccount(account) {
        startTransition(() => {
          setCurrentAccount(account);
        });
        persistAccountId(account?.id ?? null);
      },
      async deactivateAccount() {
        startTransition(() => {
          setCurrentAccount(null);
        });
        persistAccountId(null);
      },
      async createAccount(accountData) {
        try {
          const response = await accountsAPI.createAccount(accountData);
          await fetchAccounts();

          if (response.data) {
            startTransition(() => {
              setCurrentAccount(response.data);
            });
            persistAccountId(response.data.id);
          }

          return { success: true, account: response.data };
        } catch (error) {
          console.error('AccountContext: failed to create account', error);
          return {
            success: false,
            error: error?.data?.error || 'Failed to create account',
          };
        }
      },
      async updateAccount(accountId, accountData) {
        try {
          await accountsAPI.updateAccount(accountId, accountData);
          const nextAccounts = await fetchAccounts();

          if (currentAccount?.id === Number(accountId)) {
            const updated =
              nextAccounts.find((account) => account.id === Number(accountId)) ||
              null;
            startTransition(() => {
              setCurrentAccount(updated);
            });
          }

          return { success: true };
        } catch (error) {
          console.error('AccountContext: failed to update account', error);
          return {
            success: false,
            error: error?.data?.error || 'Failed to update account',
          };
        }
      },
      async deleteAccount(accountId) {
        try {
          await accountsAPI.deleteAccount(accountId);
          const nextAccounts = await fetchAccounts();

          if (currentAccount?.id === Number(accountId)) {
            startTransition(() => {
              setCurrentAccount(nextAccounts[0] || null);
            });
            persistAccountId(nextAccounts[0]?.id ?? null);
          }

          return { success: true };
        } catch (error) {
          console.error('AccountContext: failed to delete account', error);
          return {
            success: false,
            error: error?.data?.error || 'Failed to delete account',
          };
        }
      },
      fetchAccounts,
      async getAccountStats(accountId) {
        try {
          const response = await journalAPI.getEntries(1, 10000, '', accountId);
          const entries = response.entries || [];

          const totalTrades = entries.length;
          const wins = entries.filter((entry) => Number(entry.pnl) > 0).length;
          const losses = entries.filter((entry) => Number(entry.pnl) < 0).length;
          const breakevens = totalTrades - wins - losses;
          const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;

          return {
            success: true,
            stats: {
              totalTrades,
              wins,
              losses,
              breakevens,
              winRate,
            },
          };
        } catch (error) {
          console.error('AccountContext: failed to compute account stats', error);
          return {
            success: false,
            error: 'Failed to fetch account statistics',
          };
        }
      },
    }),
    [accounts, currentAccount, fetchAccounts, isLoading]
  );

  return (
    <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
  );
};

export default AccountContext;
