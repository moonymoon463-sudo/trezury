import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useGoldPrice } from "@/hooks/useGoldPrice";

export interface RealTimeRate {
  asset: string;
  chain: string;
  supplyRate: number;
  borrowRate: number;
  utilization: number;
  lastUpdated: string;
}

export interface EnhancedHealthFactor {
  healthFactor: number;
  totalCollateralUsd: number;
  totalDebtUsd: number;
  ltv: number;
  riskLevel: 'safe' | 'warning' | 'danger' | 'liquidation';
  availableBorrowUsd: number;
  lastCalculated: string;
}

export interface RiskAlert {
  id: string;
  alertType: string;
  severity: string;
  message: string;
  acknowledged: boolean;
  createdAt: string;
  metadata?: any;
}

export function useRealTimeLending() {
  const { user } = useAuth();
  const { price: goldPrice } = useGoldPrice();
  
  const [realTimeRates, setRealTimeRates] = useState<RealTimeRate[]>([]);
  const [enhancedHealthFactor, setEnhancedHealthFactor] = useState<EnhancedHealthFactor | null>(null);
  const [riskAlerts, setRiskAlerts] = useState<RiskAlert[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch real-time rates
  const fetchRealTimeRates = useCallback(async () => {
    try {
      const { data: poolReserves } = await supabase
        .from('pool_reserves')
        .select('*')
        .eq('is_active', true)
        .order('last_update_timestamp', { ascending: false });

      if (poolReserves) {
        const rates: RealTimeRate[] = poolReserves.map(pool => ({
          asset: pool.asset,
          chain: pool.chain,
          supplyRate: pool.supply_rate || 0,
          borrowRate: pool.borrow_rate_variable || 0,
          utilization: pool.utilization_rate || 0,
          lastUpdated: pool.last_update_timestamp || pool.updated_at
        }));
        setRealTimeRates(rates);
      }
    } catch (error) {
      console.error('Error fetching real-time rates:', error);
    }
  }, []);

  // Fetch enhanced health factor
  const fetchEnhancedHealthFactor = useCallback(async () => {
    if (!user) return;

    try {
      const { data: healthData } = await supabase
        .from('user_health_factors')
        .select('*')
        .eq('user_id', user.id)
        .eq('chain', 'ethereum')
        .single();

      if (healthData) {
        // Determine risk level based on health factor
        let riskLevel: EnhancedHealthFactor['riskLevel'] = 'safe';
        if (healthData.health_factor < 1.0) {
          riskLevel = 'liquidation';
        } else if (healthData.health_factor < 1.1) {
          riskLevel = 'danger';
        } else if (healthData.health_factor < 1.3) {
          riskLevel = 'warning';
        }

        setEnhancedHealthFactor({
          healthFactor: healthData.health_factor,
          totalCollateralUsd: healthData.total_collateral_usd,
          totalDebtUsd: healthData.total_debt_usd,
          ltv: healthData.ltv,
          riskLevel,
          availableBorrowUsd: healthData.available_borrow_usd,
          lastCalculated: healthData.last_calculated_at
        });
      }
    } catch (error) {
      console.error('Error fetching enhanced health factor:', error);
    }
  }, [user]);

  // Fetch risk alerts
  const fetchRiskAlerts = useCallback(async () => {
    if (!user) return;

    try {
      const { data: alerts } = await supabase
        .from('risk_alerts')
        .select('*')
        .eq('user_id', user.id)
        .eq('acknowledged', false)
        .order('created_at', { ascending: false })
        .limit(10);

      if (alerts) {
        const riskAlerts: RiskAlert[] = alerts.map(alert => ({
          id: alert.id,
          alertType: alert.alert_type,
          severity: alert.severity,
          message: alert.message,
          acknowledged: alert.acknowledged,
          createdAt: alert.created_at,
          metadata: alert.metadata
        }));
        setRiskAlerts(riskAlerts);
      }
    } catch (error) {
      console.error('Error fetching risk alerts:', error);
    }
  }, [user]);

  // Acknowledge risk alert
  const acknowledgeAlert = useCallback(async (alertId: string) => {
    try {
      await supabase
        .from('risk_alerts')
        .update({ acknowledged: true, acknowledged_at: new Date().toISOString() })
        .eq('id', alertId);
      
      setRiskAlerts(prev => prev.filter(alert => alert.id !== alertId));
    } catch (error) {
      console.error('Error acknowledging alert:', error);
    }
  }, []);

  // Trigger rate updates
  const triggerRateUpdate = useCallback(async () => {
    try {
      await supabase.functions.invoke('real-time-rates');
      // Fetch updated rates after a short delay
      setTimeout(fetchRealTimeRates, 2000);
    } catch (error) {
      console.error('Error triggering rate update:', error);
    }
  }, [fetchRealTimeRates]);

  // Trigger health factor update
  const triggerHealthFactorUpdate = useCallback(async () => {
    try {
      await supabase.functions.invoke('health-factor-monitor');
      // Fetch updated data after a short delay
      setTimeout(() => {
        fetchEnhancedHealthFactor();
        fetchRiskAlerts();
      }, 2000);
    } catch (error) {
      console.error('Error triggering health factor update:', error);
    }
  }, [fetchEnhancedHealthFactor, fetchRiskAlerts]);

  // Get current rate for specific asset
  const getAssetRate = useCallback((asset: string, chain: string = 'ethereum') => {
    return realTimeRates.find(rate => rate.asset === asset && rate.chain === chain);
  }, [realTimeRates]);

  // Calculate USD value using current gold price
  const calculateUsdValue = useCallback((amount: number, asset: string) => {
    if (asset === 'XAUT' && goldPrice) {
      return amount * goldPrice.usd_per_oz;
    }
    // For stablecoins, assume 1:1 USD
    if (['USDC', 'USDT', 'DAI'].includes(asset)) {
      return amount;
    }
    // For AURU, use mock price
    if (asset === 'AURU') {
      return amount * 150;
    }
    return amount;
  }, [goldPrice]);

  // Set up real-time subscriptions
  useEffect(() => {
    if (!user) return;

    const setupSubscriptions = async () => {
      setLoading(true);
      
      // Initial data fetch
      await Promise.all([
        fetchRealTimeRates(),
        fetchEnhancedHealthFactor(),
        fetchRiskAlerts()
      ]);

      // Set up real-time subscriptions
      const ratesSubscription = supabase
        .channel('pool_reserves_changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'pool_reserves' },
          () => fetchRealTimeRates()
        )
        .subscribe();

      const healthSubscription = supabase
        .channel('health_factors_changes')
        .on(
          'postgres_changes',
          { 
            event: '*', 
            schema: 'public', 
            table: 'user_health_factors',
            filter: `user_id=eq.${user.id}`
          },
          () => fetchEnhancedHealthFactor()
        )
        .subscribe();

      const alertsSubscription = supabase
        .channel('risk_alerts_changes')
        .on(
          'postgres_changes',
          { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'risk_alerts',
            filter: `user_id=eq.${user.id}`
          },
          () => fetchRiskAlerts()
        )
        .subscribe();

      setLoading(false);

      return () => {
        ratesSubscription.unsubscribe();
        healthSubscription.unsubscribe();
        alertsSubscription.unsubscribe();
      };
    };

    setupSubscriptions();
  }, [user, fetchRealTimeRates, fetchEnhancedHealthFactor, fetchRiskAlerts]);

  // Set up periodic updates
  useEffect(() => {
    const rateUpdateInterval = setInterval(() => {
      fetchRealTimeRates();
    }, 30000); // Update rates every 30 seconds

    const healthUpdateInterval = setInterval(() => {
      if (user) {
        triggerHealthFactorUpdate();
      }
    }, 60000); // Update health factor every minute

    return () => {
      clearInterval(rateUpdateInterval);
      clearInterval(healthUpdateInterval);
    };
  }, [user, fetchRealTimeRates, triggerHealthFactorUpdate]);

  return {
    // Data
    realTimeRates,
    enhancedHealthFactor,
    riskAlerts,
    loading,
    
    // Utilities
    getAssetRate,
    calculateUsdValue,
    
    // Actions
    acknowledgeAlert,
    triggerRateUpdate,
    triggerHealthFactorUpdate,
    
    // Refresh functions
    refreshRates: fetchRealTimeRates,
    refreshHealthFactor: fetchEnhancedHealthFactor,
    refreshAlerts: fetchRiskAlerts
  };
}