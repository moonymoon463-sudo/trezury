import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

export type PageContext = {
  page: string;
  pageTitle: string;
  quickActions: string[];
  helpTopic: string;
};

type AssistantContextType = {
  currentContext: PageContext;
  isAssistantOpen: boolean;
  openAssistant: () => void;
  closeAssistant: () => void;
  toggleAssistant: () => void;
  showProactiveTip: boolean;
  dismissProactiveTip: () => void;
  proactiveTipMessage: string | null;
};

const AssistantContext = createContext<AssistantContextType | undefined>(undefined);

const getPageContext = (pathname: string): PageContext => {
  const contexts: Record<string, PageContext> = {
    '/': {
      page: 'home',
      pageTitle: 'Home',
      quickActions: [
        'How do I get started?',
        'What can I buy?',
        'Show me my portfolio',
        'Explain gold-backed tokens'
      ],
      helpTopic: 'Getting started with Trezury'
    },
    '/portfolio': {
      page: 'portfolio',
      pageTitle: 'Portfolio',
      quickActions: [
        'Analyze my portfolio',
        'How am I performing?',
        'Rebalancing advice',
        'Explain my holdings'
      ],
      helpTopic: 'Understanding your portfolio'
    },
    '/buy-gold': {
      page: 'buy',
      pageTitle: 'Buy Gold',
      quickActions: [
        'How do I buy gold?',
        'What are the fees?',
        'How long does it take?',
        'What payment methods are available?'
      ],
      helpTopic: 'Buying gold-backed tokens'
    },
    '/sell-gold': {
      page: 'sell',
      pageTitle: 'Sell Gold',
      quickActions: [
        'How do I sell gold?',
        'When will I receive my money?',
        'What are the selling fees?',
        'Explain the selling process'
      ],
      helpTopic: 'Selling your gold-backed tokens'
    },
    '/swap': {
      page: 'swap',
      pageTitle: 'Swap',
      quickActions: [
        'How does swapping work?',
        'What are swap fees?',
        'Explain slippage',
        'Best practices for swapping'
      ],
      helpTopic: 'Swapping between assets'
    },
    '/transactions': {
      page: 'transactions',
      pageTitle: 'Transactions',
      quickActions: [
        'What are these transactions?',
        'How do I find a specific transaction?',
        'Transaction statuses explained',
        'Download transaction history'
      ],
      helpTopic: 'Understanding your transaction history'
    },
    '/settings': {
      page: 'settings',
      pageTitle: 'Settings',
      quickActions: [
        'How do I secure my account?',
        'Change my settings',
        'Privacy options',
        'Notification preferences'
      ],
      helpTopic: 'Managing your account settings'
    },
    '/wallet': {
      page: 'wallet',
      pageTitle: 'Wallet',
      quickActions: [
        'How does my wallet work?',
        'Is my wallet secure?',
        'Backup my wallet',
        'Wallet recovery options'
      ],
      helpTopic: 'Managing your crypto wallet'
    },
    '/auto-invest': {
      page: 'auto-invest',
      pageTitle: 'Auto-Invest',
      quickActions: [
        'How does auto-invest work?',
        'Set up recurring purchases',
        'Manage my auto-invest plans',
        'Benefits of auto-investing'
      ],
      helpTopic: 'Automated investing'
    }
  };

  return contexts[pathname] || {
    page: 'other',
    pageTitle: 'Trezury',
    quickActions: [
      'How can I help you?',
      'Navigate the app',
      'Account help',
      'General questions'
    ],
    helpTopic: 'General assistance'
  };
};

export const AssistantProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const location = useLocation();
  const [currentContext, setCurrentContext] = useState<PageContext>(getPageContext(location.pathname));
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [showProactiveTip, setShowProactiveTip] = useState(false);
  const [proactiveTipMessage, setProactiveTipMessage] = useState<string | null>(null);
  const [pageVisitTime, setPageVisitTime] = useState<number>(Date.now());
  const [visitCounts, setVisitCounts] = useState<Record<string, number>>({});

  // Update context when route changes
  useEffect(() => {
    const newContext = getPageContext(location.pathname);
    setCurrentContext(newContext);
    setPageVisitTime(Date.now());
    
    // Track visit counts
    setVisitCounts(prev => ({
      ...prev,
      [newContext.page]: (prev[newContext.page] || 0) + 1
    }));

    // Reset proactive tip on route change
    setShowProactiveTip(false);
  }, [location.pathname]);

  // Proactive assistance logic
  useEffect(() => {
    // Don't show tips on auth pages or if assistant is already open
    if (location.pathname.includes('/auth') || isAssistantOpen) {
      return;
    }

    // First-time user detection (no visits recorded)
    const isNewUser = Object.keys(visitCounts).length === 0;
    if (isNewUser && currentContext.page === 'home') {
      const timer = setTimeout(() => {
        setProactiveTipMessage("👋 Hi! I'm your Trezury assistant. Want a quick tour of the app?");
        setShowProactiveTip(true);
      }, 3000);
      return () => clearTimeout(timer);
    }

    // User staying on page for 30+ seconds without opening assistant
    const inactivityTimer = setTimeout(() => {
      if (!isAssistantOpen) {
        setProactiveTipMessage(`Need help with ${currentContext.pageTitle.toLowerCase()}? I'm here to assist! 💡`);
        setShowProactiveTip(true);
      }
    }, 30000);

    // User returning to same page multiple times
    const currentPageVisits = visitCounts[currentContext.page] || 0;
    if (currentPageVisits >= 3 && currentPageVisits % 3 === 0) {
      const timer = setTimeout(() => {
        setProactiveTipMessage(`I noticed you're checking ${currentContext.pageTitle} often. Have questions? 🤔`);
        setShowProactiveTip(true);
      }, 5000);
      return () => clearTimeout(timer);
    }

    return () => clearTimeout(inactivityTimer);
  }, [currentContext, visitCounts, isAssistantOpen, location.pathname]);

  const openAssistant = () => {
    setIsAssistantOpen(true);
    setShowProactiveTip(false);
  };

  const closeAssistant = () => {
    setIsAssistantOpen(false);
  };

  const toggleAssistant = () => {
    setIsAssistantOpen(prev => !prev);
    if (!isAssistantOpen) {
      setShowProactiveTip(false);
    }
  };

  const dismissProactiveTip = () => {
    setShowProactiveTip(false);
  };

  return (
    <AssistantContext.Provider
      value={{
        currentContext,
        isAssistantOpen,
        openAssistant,
        closeAssistant,
        toggleAssistant,
        showProactiveTip,
        dismissProactiveTip,
        proactiveTipMessage
      }}
    >
      {children}
    </AssistantContext.Provider>
  );
};

export const useAssistant = () => {
  const context = useContext(AssistantContext);
  if (!context) {
    throw new Error('useAssistant must be used within AssistantProvider');
  }
  return context;
};
