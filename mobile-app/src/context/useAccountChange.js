import { useEffect, useRef } from 'react';
import { useAccount } from './AccountContext';

// Custom hook to detect account changes and trigger callbacks
export const useAccountChange = (callback, dependencies = []) => {
  const { currentAccount } = useAccount();
  const previousAccountRef = useRef(null);

  useEffect(() => {
    // If account has changed (and it's not the initial load)
    if (previousAccountRef.current && 
        previousAccountRef.current.id !== currentAccount?.id) {
      
      // Call the callback when account changes
      if (callback && typeof callback === 'function') {
        callback(currentAccount, previousAccountRef.current);
      }
    }
    
    // Update the ref with current account
    previousAccountRef.current = currentAccount;
  }, [currentAccount, callback, ...dependencies]);

  return currentAccount;
};

// Custom hook to get account-specific refresh trigger
export const useAccountRefresh = () => {
  const { currentAccount } = useAccount();
  
  // Return a unique key that changes when account changes
  // This can be used as a key prop to force component remounts
  return currentAccount ? `account-${currentAccount.id}` : 'no-account';
};