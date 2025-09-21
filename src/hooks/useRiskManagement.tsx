import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { LiquidationService, RiskAlert } from "@/services/liquidationService";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface RiskMetrics {
  healthFactor: number | null;
  riskLevel: 'safe' | 'warning' | 'danger' | 'critical';
  liquidationRisk: number;
  totalDebt: number;
  totalCollateral: number;
  availableBorrow: number;
}

export function useRiskManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [riskMetrics, setRiskMetrics] = useState<RiskMetrics>({
    healthFactor: null,
    riskLevel: 'safe',
    liquidationRisk: 0,
    totalDebt: 0,
    totalCollateral: 0,
    availableBorrow: 0
  });
  
  const [riskAlerts, setRiskAlerts] = useState<RiskAlert[]>([]);
  const [positionLimits, setPositionLimits] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRiskMetrics = async (chain: string = 'ethereum') => {
    if (!user) return;

    try {
      setLoading(true);
      
      // Get user health factor and risk assessment
      const healthData = await LiquidationService.checkUserHealth(user.id, chain);
      
      if (healthData.success && healthData.health_factor !== null) {
        const riskAssessment = LiquidationService.calculateLiquidationRisk(healthData.health_factor);
        
        setRiskMetrics({
          healthFactor: healthData.health_factor,
          riskLevel: riskAssessment.riskLevel,
          liquidationRisk: riskAssessment.riskPercentage,
          totalDebt: healthData.total_debt_usd || 0,
          totalCollateral: healthData.total_collateral_usd || 0,
          availableBorrow: 0 // Will be calculated based on health factor
        });

        // Show critical alerts
        if (riskAssessment.riskLevel === 'critical') {
          toast({
            variant: "destructive",
            title: "⚠️ Liquidation Risk",
            description: riskAssessment.recommendation
          });
        } else if (riskAssessment.riskLevel === 'danger') {
          toast({
            variant: "destructive",
            title: "⚠️ High Risk Position",
            description: riskAssessment.recommendation
          });
        }
      } else {
        setRiskMetrics({
          healthFactor: null,
          riskLevel: 'safe',
          liquidationRisk: 0,
          totalDebt: 0,
          totalCollateral: 0,
          availableBorrow: 0
        });
      }
    } catch (error) {
      console.error('Error fetching risk metrics:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch risk metrics"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchRiskAlerts = async () => {
    if (!user) return;

    try {
      const alerts = await LiquidationService.getUserRiskAlerts(user.id);
      setRiskAlerts(alerts);
    } catch (error) {
      console.error('Error fetching risk alerts:', error);
    }
  };

  const fetchPositionLimits = async (chain: string = 'ethereum') => {
    if (!user) return;

    try {
      const limits = await LiquidationService.getUserPositionLimits(user.id, chain);
      setPositionLimits(limits);
    } catch (error) {
      console.error('Error fetching position limits:', error);
    }
  };

  const acknowledgeAlert = async (alertId: string) => {
    try {
      await LiquidationService.acknowledgeRiskAlert(alertId);
      setRiskAlerts(prev => prev.filter(alert => alert.id !== alertId));
      
      toast({
        title: "Alert Acknowledged",
        description: "Risk alert has been marked as read"
      });
    } catch (error) {
      console.error('Error acknowledging alert:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to acknowledge alert"
      });
    }
  };

  const setPositionLimit = async (
    asset: string,
    maxSupplyAmount: number,
    maxBorrowAmount: number,
    chain: string = 'ethereum',
    riskTier: string = 'standard'
  ) => {
    if (!user) return;

    try {
      await LiquidationService.setPositionLimit(
        user.id, 
        asset, 
        maxSupplyAmount, 
        maxBorrowAmount, 
        chain, 
        riskTier
      );
      
      await fetchPositionLimits(chain);
      
      toast({
        title: "Position Limit Set",
        description: `Updated limits for ${asset}`
      });
    } catch (error) {
      console.error('Error setting position limit:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to set position limit"
      });
    }
  };

  const checkPositionLimit = (asset: string, amount: number, type: 'supply' | 'borrow'): boolean => {
    const limit = positionLimits.find(l => l.asset === asset);
    if (!limit) return true; // No limit set

    const maxAmount = type === 'supply' ? limit.max_supply_amount : limit.max_borrow_amount;
    return amount <= maxAmount;
  };

  const getAvailableAmount = (asset: string, type: 'supply' | 'borrow'): number => {
    const limit = positionLimits.find(l => l.asset === asset);
    if (!limit) return Infinity;

    return type === 'supply' ? limit.max_supply_amount : limit.max_borrow_amount;
  };

  // Set up real-time subscriptions for risk alerts
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('risk-management-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'risk_alerts',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('New risk alert:', payload.new);
          setRiskAlerts(prev => [payload.new as RiskAlert, ...prev]);
          
          // Show toast for new critical alerts
          const newAlert = payload.new as RiskAlert;
          if (newAlert.severity === 'critical') {
            toast({
              variant: "destructive",
              title: "🚨 Critical Risk Alert",
              description: newAlert.message
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_health_factors',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('Health factor updated:', payload.new);
          fetchRiskMetrics(); // Refresh risk metrics when health factor changes
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Initial data fetch
  useEffect(() => {
    if (user) {
      fetchRiskMetrics();
      fetchRiskAlerts();
      fetchPositionLimits();
    }
  }, [user]);

  return {
    riskMetrics,
    riskAlerts,
    positionLimits,
    loading,
    
    // Actions
    fetchRiskMetrics,
    fetchRiskAlerts,
    acknowledgeAlert,
    setPositionLimit,
    checkPositionLimit,
    getAvailableAmount,
    
    // Utilities
    formatHealthFactor: LiquidationService.formatHealthFactor,
    formatUsdAmount: LiquidationService.formatUsdAmount,
    calculateLiquidationRisk: LiquidationService.calculateLiquidationRisk
  };
}