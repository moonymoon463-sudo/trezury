import { useState, useCallback } from "react";
import { useAaveStyleLending } from "@/hooks/useAaveStyleLending";
import { useToast } from "@/hooks/use-toast";
import { LendingValidator, ErrorHandler, PerformanceMonitor } from "@/utils/testingUtils";

export function useValidatedLending() {
  const lending = useAaveStyleLending();
  const { toast } = useToast();
  const [validationErrors, setValidationErrors] = useState<Record<string, string[]>>({});

  const clearValidationErrors = useCallback((field?: string) => {
    if (field) {
      setValidationErrors(prev => {
        const updated = { ...prev };
        delete updated[field];
        return updated;
      });
    } else {
      setValidationErrors({});
    }
  }, []);

  const validateAndExecute = useCallback(async (
    operation: 'supply' | 'withdraw' | 'borrow' | 'repay',
    asset: string,
    amount: number,
    options?: { rateMode?: 'variable' | 'stable'; chain?: string }
  ) => {
    const startTime = Date.now();
    const chain = options?.chain || 'ethereum';
    
    try {
      // Clear previous validation errors
      clearValidationErrors();

      // Get current user data for validation
      const userSupply = lending.userSupplies.find(s => s.asset === asset && s.chain === chain);
      const userBorrow = lending.userBorrows.find(b => b.asset === asset && b.chain === chain);
      const poolReserve = lending.poolReserves.find(r => r.asset === asset && r.chain === chain);

      // Validate input amount
      const amountValidation = LendingValidator.validateInputAmount(amount, {
        min: 0.01,
        max: operation === 'supply' ? 1000000 : (userSupply?.supplied_amount_dec || 0),
        balance: operation === 'supply' || operation === 'repay' ? 1000000 : undefined, // Mock balance
        decimals: 6
      });

      if (!amountValidation.isValid) {
        setValidationErrors({ amount: amountValidation.errors });
        throw new Error(amountValidation.errors[0]);
      }

      // Validate lending operation
      const operationValidation = LendingValidator.validateLendingOperation({
        type: operation,
        asset,
        amount,
        chain,
        userBalance: 1000000, // Mock user balance
        poolLiquidity: poolReserve?.available_liquidity_dec,
        currentHealthFactor: lending.userHealthFactor?.health_factor,
        newHealthFactor: lending.userHealthFactor?.health_factor // Mock calculation
      });

      if (!operationValidation.isValid) {
        setValidationErrors({ operation: operationValidation.errors });
        throw new Error(operationValidation.errors[0]);
      }

      // Show warnings if any
      const allWarnings = [...amountValidation.warnings, ...operationValidation.warnings];
      if (allWarnings.length > 0) {
        toast({
          title: "Warning",
          description: allWarnings[0],
          variant: "destructive"
        });
      }

      // Execute the operation
      let result;
      switch (operation) {
        case 'supply':
          result = await lending.supply(asset, amount, chain);
          break;
        case 'withdraw':
          result = await lending.withdraw(asset, amount, chain);
          break;
        case 'borrow':
          result = await lending.borrow(asset, amount, options?.rateMode || 'variable', chain);
          break;
        case 'repay':
          result = await lending.repay(asset, amount, options?.rateMode || 'variable', chain);
          break;
      }

      // Track performance
      const duration = Date.now() - startTime;
      PerformanceMonitor.trackOperation(operation, duration);

      // Check for slow operations
      if (PerformanceMonitor.isSlowOperation(operation)) {
        console.warn(`Slow ${operation} operation detected: ${duration}ms`);
      }

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      PerformanceMonitor.trackOperation(`${operation}_error`, duration);

      const errorInfo = ErrorHandler.handleLendingError(error);
      
      // Log error for debugging
      console.error(`${operation} operation failed:`, {
        error: errorInfo.message,
        category: errorInfo.category,
        retryable: errorInfo.retryable,
        duration
      });

      // Show user-friendly error
      toast({
        variant: "destructive",
        title: `${operation.charAt(0).toUpperCase() + operation.slice(1)} Failed`,
        description: errorInfo.userMessage
      });

      throw error;
    }
  }, [lending, toast, clearValidationErrors]);

  const validateSupply = useCallback((asset: string, amount: number, chain?: string) => 
    validateAndExecute('supply', asset, amount, { chain }), 
    [validateAndExecute]);

  const validateWithdraw = useCallback((asset: string, amount: number, chain?: string) => 
    validateAndExecute('withdraw', asset, amount, { chain }), 
    [validateAndExecute]);

  const validateBorrow = useCallback((asset: string, amount: number, rateMode: 'variable' | 'stable', chain?: string) => 
    validateAndExecute('borrow', asset, amount, { rateMode, chain }), 
    [validateAndExecute]);

  const validateRepay = useCallback((asset: string, amount: number, rateMode: 'variable' | 'stable', chain?: string) => 
    validateAndExecute('repay', asset, amount, { rateMode, chain }), 
    [validateAndExecute]);

  const validateHealthFactor = useCallback(() => {
    if (!lending.userHealthFactor) return null;

    const validation = LendingValidator.validateHealthFactor(
      lending.userHealthFactor.health_factor,
      {
        totalCollateral: lending.userHealthFactor.total_collateral_usd,
        totalDebt: lending.userHealthFactor.total_debt_usd,
        ltv: lending.userHealthFactor.ltv,
        liquidationThreshold: lending.userHealthFactor.liquidation_threshold
      }
    );

    if (!validation.isValid) {
      console.warn('Health factor validation failed:', validation.errors);
    }

    return validation;
  }, [lending.userHealthFactor]);

  const getPerformanceStats = useCallback(() => {
    return {
      supply: PerformanceMonitor.getStats('supply'),
      withdraw: PerformanceMonitor.getStats('withdraw'),
      borrow: PerformanceMonitor.getStats('borrow'),
      repay: PerformanceMonitor.getStats('repay')
    };
  }, []);

  return {
    // All original lending functionality
    ...lending,
    
    // Validated operations
    supply: validateSupply,
    withdraw: validateWithdraw,
    borrow: validateBorrow,
    repay: validateRepay,
    
    // Validation utilities
    validationErrors,
    clearValidationErrors,
    validateHealthFactor,
    getPerformanceStats,
    
    // Performance monitoring
    isSlowOperation: (operation: string) => PerformanceMonitor.isSlowOperation(operation)
  };
}