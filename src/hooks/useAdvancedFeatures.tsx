import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { FlashLoanService, FlashLoanOpportunity } from '@/services/flashLoanService';
import { AdvancedLiquidationService, LiquidationAuction } from '@/services/advancedLiquidationService';
import { AdvancedRiskService, PortfolioRisk, StressTestResult } from '@/services/advancedRiskService';
import { FeeOptimizationService, DynamicFeeStructure, RevenueShare, TreasuryMetrics } from '@/services/feeOptimizationService';
import { useToast } from '@/hooks/use-toast';

export const useAdvancedFeatures = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Flash Loans
  const [flashLoanOpportunities, setFlashLoanOpportunities] = useState<FlashLoanOpportunity[]>([]);
  const [flashLoanHistory, setFlashLoanHistory] = useState<any[]>([]);
  
  // Liquidations
  const [liquidationAuctions, setLiquidationAuctions] = useState<LiquidationAuction[]>([]);
  
  // Risk Management
  const [portfolioRisk, setPortfolioRisk] = useState<PortfolioRisk | null>(null);
  const [stressTestResults, setStressTestResults] = useState<StressTestResult[]>([]);
  
  // Fee Optimization
  const [dynamicFees, setDynamicFees] = useState<DynamicFeeStructure | null>(null);
  const [revenueShare, setRevenueShare] = useState<RevenueShare | null>(null);
  const [treasuryMetrics, setTreasuryMetrics] = useState<TreasuryMetrics | null>(null);
  
  const [loading, setLoading] = useState(false);

  // Flash Loan Functions
  const fetchFlashLoanOpportunities = useCallback(async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const opportunities = await FlashLoanService.getAvailableOpportunities();
      setFlashLoanOpportunities(opportunities);
    } catch (error) {
      console.error('Error fetching flash loan opportunities:', error);
      toast({
        title: "Error",
        description: "Failed to load flash loan opportunities",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  const executeFlashLoan = useCallback(async (params: any) => {
    if (!user) return null;
    
    try {
      setLoading(true);
      const result = await FlashLoanService.executeFlashLoan(params);
      
      toast({
        title: "Flash Loan Executed",
        description: `Flash loan of ${params.amount} ${params.asset} executed successfully`,
      });
      
      // Refresh opportunities
      await fetchFlashLoanOpportunities();
      
      return result;
    } catch (error) {
      console.error('Error executing flash loan:', error);
      toast({
        title: "Flash Loan Failed",
        description: "Failed to execute flash loan",
        variant: "destructive"
      });
      throw error;
    } finally {
      setLoading(false);
    }
  }, [user, toast, fetchFlashLoanOpportunities]);

  // Liquidation Functions
  const fetchLiquidationAuctions = useCallback(async () => {
    if (!user) return;
    
    try {
      const auctions = await AdvancedLiquidationService.getActiveLiquidationAuctions();
      setLiquidationAuctions(auctions);
    } catch (error) {
      console.error('Error fetching liquidation auctions:', error);
    }
  }, [user]);

  const placeLiquidationBid = useCallback(async (bid: any) => {
    if (!user) return null;
    
    try {
      setLoading(true);
      const result = await AdvancedLiquidationService.placeLiquidationBid(bid);
      
      toast({
        title: "Bid Placed",
        description: `Liquidation bid of ${bid.bidAmount} placed successfully`,
      });
      
      await fetchLiquidationAuctions();
      
      return result;
    } catch (error) {
      console.error('Error placing liquidation bid:', error);
      toast({
        title: "Bid Failed",
        description: "Failed to place liquidation bid",
        variant: "destructive"
      });
      throw error;
    } finally {
      setLoading(false);
    }
  }, [user, toast, fetchLiquidationAuctions]);

  // Risk Management Functions
  const fetchPortfolioRisk = useCallback(async () => {
    if (!user) return;
    
    try {
      const risk = await AdvancedRiskService.getPortfolioRiskAssessment(user.id);
      setPortfolioRisk(risk);
    } catch (error) {
      console.error('Error fetching portfolio risk:', error);
    }
  }, [user]);

  const runStressTest = useCallback(async (scenarios: string[]) => {
    if (!user) return;
    
    try {
      setLoading(true);
      const results = await AdvancedRiskService.runStressTest(user.id, scenarios);
      setStressTestResults(results);
      
      toast({
        title: "Stress Test Complete",
        description: `Analyzed ${scenarios.length} scenarios`,
      });
    } catch (error) {
      console.error('Error running stress test:', error);
      toast({
        title: "Stress Test Failed",
        description: "Failed to run stress test",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  // Fee Optimization Functions
  const fetchDynamicFees = useCallback(async (amount: number, operation: 'supply' | 'borrow' | 'swap') => {
    if (!user) return;
    
    try {
      const fees = await FeeOptimizationService.calculateDynamicFees(user.id, amount, operation);
      setDynamicFees(fees);
    } catch (error) {
      console.error('Error fetching dynamic fees:', error);
    }
  }, [user]);

  const fetchRevenueShare = useCallback(async () => {
    if (!user) return;
    
    try {
      const share = await FeeOptimizationService.getRevenueShareInfo(user.id);
      setRevenueShare(share);
    } catch (error) {
      console.error('Error fetching revenue share:', error);
    }
  }, [user]);

  const fetchTreasuryMetrics = useCallback(async () => {
    try {
      const metrics = await FeeOptimizationService.getTreasuryMetrics();
      setTreasuryMetrics(metrics);
    } catch (error) {
      console.error('Error fetching treasury metrics:', error);
    }
  }, []);

  // Initial data loading
  useEffect(() => {
    if (user) {
      fetchFlashLoanOpportunities();
      fetchLiquidationAuctions();
      fetchPortfolioRisk();
      fetchRevenueShare();
      fetchTreasuryMetrics();
    }
  }, [user, fetchFlashLoanOpportunities, fetchLiquidationAuctions, fetchPortfolioRisk, fetchRevenueShare, fetchTreasuryMetrics]);

  return {
    // Flash Loans
    flashLoanOpportunities,
    flashLoanHistory,
    executeFlashLoan,
    
    // Liquidations
    liquidationAuctions,
    placeLiquidationBid,
    
    // Risk Management
    portfolioRisk,
    stressTestResults,
    runStressTest,
    
    // Fee Optimization
    dynamicFees,
    revenueShare,
    treasuryMetrics,
    fetchDynamicFees,
    
    // Utils
    loading,
    refetch: {
      flashLoans: fetchFlashLoanOpportunities,
      liquidations: fetchLiquidationAuctions,
      portfolioRisk: fetchPortfolioRisk,
      revenueShare: fetchRevenueShare,
      treasuryMetrics: fetchTreasuryMetrics
    }
  };
};