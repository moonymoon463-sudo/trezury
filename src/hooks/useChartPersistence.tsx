import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export interface ChartSettings {
  indicators: string[];
  drawings: Array<{
    type: string;
    points: Array<{ time: number; value: number }>;
    color?: string;
    lineWidth?: number;
  }>;
  viewport: {
    from?: number;
    to?: number;
  };
  liveMode: boolean;
}

const DEFAULT_SETTINGS: ChartSettings = {
  indicators: ['MA20', 'MA50', 'MA200'],
  drawings: [],
  viewport: {},
  liveMode: true,
};

export const useChartPersistence = (market: string, resolution: string) => {
  const [settings, setSettings] = useState<ChartSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  // Load settings on mount
  useEffect(() => {
    if (!user || !market || !resolution) {
      setLoading(false);
      return;
    }

    const loadSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('user_chart_settings')
          .select('*')
          .eq('user_id', user.id)
          .eq('market', market)
          .eq('resolution', resolution)
          .single();

        if (error && error.code !== 'PGRST116') { // Not found is OK
          console.error('[useChartPersistence] Load error:', error);
          return;
        }

        if (data) {
          setSettings({
            indicators: Array.isArray(data.indicators) ? (data.indicators as string[]) : DEFAULT_SETTINGS.indicators,
            drawings: Array.isArray(data.drawings) ? (data.drawings as ChartSettings['drawings']) : DEFAULT_SETTINGS.drawings,
            viewport: (data.viewport as ChartSettings['viewport']) || DEFAULT_SETTINGS.viewport,
            liveMode: data.live_mode ?? DEFAULT_SETTINGS.liveMode,
          });
        }
      } catch (err) {
        console.error('[useChartPersistence] Error loading settings:', err);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [user, market, resolution]);

  // Save settings with debounce
  const saveSettings = useCallback(async (newSettings: Partial<ChartSettings>) => {
    if (!user || !market || !resolution) return;

    const updatedSettings = { ...settings, ...newSettings };
    setSettings(updatedSettings);
    setSaving(true);

    try {
      const { error } = await supabase
        .from('user_chart_settings')
        .upsert({
          user_id: user.id,
          market,
          resolution,
          indicators: updatedSettings.indicators,
          drawings: updatedSettings.drawings,
          viewport: updatedSettings.viewport,
          live_mode: updatedSettings.liveMode,
        }, {
          onConflict: 'user_id,market,resolution',
        });

      if (error) {
        console.error('[useChartPersistence] Save error:', error);
        toast({
          variant: 'destructive',
          title: 'Failed to save chart settings',
          description: error.message,
        });
      }
    } catch (err) {
      console.error('[useChartPersistence] Error saving settings:', err);
    } finally {
      setSaving(false);
    }
  }, [user, market, resolution, settings, toast]);

  const updateIndicators = useCallback((indicators: string[]) => {
    saveSettings({ indicators });
  }, [saveSettings]);

  const updateDrawings = useCallback((drawings: ChartSettings['drawings']) => {
    saveSettings({ drawings });
  }, [saveSettings]);

  const updateViewport = useCallback((viewport: ChartSettings['viewport']) => {
    saveSettings({ viewport });
  }, [saveSettings]);

  const toggleLiveMode = useCallback(() => {
    saveSettings({ liveMode: !settings.liveMode });
  }, [settings.liveMode, saveSettings]);

  return {
    settings,
    loading,
    saving,
    updateIndicators,
    updateDrawings,
    updateViewport,
    toggleLiveMode,
  };
};
