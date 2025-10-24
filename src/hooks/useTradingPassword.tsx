import { useState, useCallback } from 'react';

interface TradingPasswordState {
  password: string | null;
  isUnlocked: boolean;
  unlockTime: number | null;
}

const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

export const useTradingPassword = () => {
  const [state, setState] = useState<TradingPasswordState>({
    password: null,
    isUnlocked: false,
    unlockTime: null,
  });

  const unlock = useCallback((password: string) => {
    setState({
      password,
      isUnlocked: true,
      unlockTime: Date.now(),
    });

    // Auto-lock after session timeout
    setTimeout(() => {
      lock();
    }, SESSION_TIMEOUT);
  }, []);

  const lock = useCallback(() => {
    setState({
      password: null,
      isUnlocked: false,
      unlockTime: null,
    });
  }, []);

  const isSessionValid = useCallback(() => {
    if (!state.isUnlocked || !state.unlockTime) return false;
    return Date.now() - state.unlockTime < SESSION_TIMEOUT;
  }, [state]);

  const getPassword = useCallback((): string | null => {
    if (!isSessionValid()) {
      lock();
      return null;
    }
    return state.password;
  }, [state, isSessionValid, lock]);

  return {
    isUnlocked: state.isUnlocked && isSessionValid(),
    unlock,
    lock,
    getPassword,
  };
};
