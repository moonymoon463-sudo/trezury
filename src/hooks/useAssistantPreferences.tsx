import { useState, useEffect } from 'react';

export type AssistanceLevel = 'minimal' | 'helpful' | 'proactive';

interface AssistantPreferences {
  enabled: boolean;
  assistanceLevel: AssistanceLevel;
  showProactiveTips: boolean;
}

const DEFAULT_PREFERENCES: AssistantPreferences = {
  enabled: true,
  assistanceLevel: 'helpful',
  showProactiveTips: true,
};

const STORAGE_KEY = 'trezury_assistant_preferences';

export const useAssistantPreferences = () => {
  const [preferences, setPreferencesState] = useState<AssistantPreferences>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        return { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) };
      } catch {
        return DEFAULT_PREFERENCES;
      }
    }
    return DEFAULT_PREFERENCES;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  }, [preferences]);

  const setPreferences = (updates: Partial<AssistantPreferences>) => {
    setPreferencesState(prev => ({ ...prev, ...updates }));
  };

  const resetPreferences = () => {
    setPreferencesState(DEFAULT_PREFERENCES);
  };

  const clearConversationHistory = async () => {
    // This would clear conversation history from the database
    // For now, we'll just clear local storage
    localStorage.removeItem('trezury_ai_conversations');
  };

  return {
    preferences,
    setPreferences,
    resetPreferences,
    clearConversationHistory,
  };
};
