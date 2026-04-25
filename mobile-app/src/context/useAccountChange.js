import { useEffect, useRef } from 'react';
import { useAccount } from './AccountContext.jsx';

export const useAccountChange = (callback, dependencies = []) => {
  const { currentAccount } = useAccount();
  const previousAccountRef = useRef(null);

  useEffect(() => {
    if (
      previousAccountRef.current &&
      previousAccountRef.current.id !== currentAccount?.id
    ) {
      callback?.(currentAccount, previousAccountRef.current);
    }

    previousAccountRef.current = currentAccount;
  }, [callback, currentAccount, ...dependencies]);

  return currentAccount;
};

export const useAccountRefresh = () => {
  const { currentAccount } = useAccount();
  return currentAccount ? `account-${currentAccount.id}` : 'no-account';
};
