import { createContext, useContext, ReactNode } from 'react';
import { useTradingPassword } from '@/hooks/useTradingPassword';

interface TradingPasswordContextType {
  isUnlocked: boolean;
  unlock: (password: string) => void;
  lock: () => void;
  getPassword: () => string | null;
}

const TradingPasswordContext = createContext<TradingPasswordContextType | undefined>(undefined);

export const TradingPasswordProvider = ({ children }: { children: ReactNode }) => {
  const passwordState = useTradingPassword();

  return (
    <TradingPasswordContext.Provider value={passwordState}>
      {children}
    </TradingPasswordContext.Provider>
  );
};

export const useTradingPasswordContext = () => {
  const context = useContext(TradingPasswordContext);
  if (!context) {
    throw new Error('useTradingPasswordContext must be used within TradingPasswordProvider');
  }
  return context;
};
