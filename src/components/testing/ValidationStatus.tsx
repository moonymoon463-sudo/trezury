import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  BarChart3, 
  RefreshCw,
  Shield,
  Zap
} from "lucide-react";
import { LendingValidator, PerformanceMonitor } from "@/utils/testingUtils";
import { useValidatedLending } from "@/hooks/useValidatedLending";

export function ValidationStatus() {
  const lending = useValidatedLending();
  const [testResults, setTestResults] = useState<Array<{
    name: string;
    status: 'passed' | 'failed' | 'warning' | 'running';
    message: string;
    duration?: number;
  }>>([]);

  const [isRunningTests, setIsRunningTests] = useState(false);

  const runValidationTests = async () => {
    setIsRunningTests(true);
    const results: typeof testResults = [];

    try {
      // Test 1: Health Factor Validation
      results.push({ name: "Health Factor Validation", status: "running", message: "Validating health factor calculation..." });
      const healthValidation = lending.validateHealthFactor();
      results[results.length - 1] = {
        name: "Health Factor Validation",
        status: healthValidation?.isValid === false ? 'failed' : (healthValidation?.warnings.length ? 'warning' : 'passed'),
        message: healthValidation?.isValid === false 
          ? healthValidation.errors[0] 
          : healthValidation?.warnings.length 
            ? healthValidation.warnings[0]
            : "Health factor calculation is valid"
      };

      // Test 2: APY Validation
      results.push({ name: "APY Validation", status: "running", message: "Validating APY calculations..." });
      const startTime = Date.now();
      
      try {
        // Test USDC APY
        const poolReserve = lending.poolReserves.find(r => r.asset === 'USDC');
        if (poolReserve) {
          const apyValidation = LendingValidator.validateAPY(poolReserve.supply_rate * 100, {
            chain: poolReserve.chain,
            token: 'USDC',
            termDays: 30
          });
          
          results[results.length - 1] = {
            name: "APY Validation",
            status: apyValidation.isValid ? (apyValidation.warnings.length ? 'warning' : 'passed') : 'failed',
            message: apyValidation.isValid 
              ? (apyValidation.warnings.length ? apyValidation.warnings[0] : "APY calculations are valid")
              : apyValidation.errors[0],
            duration: Date.now() - startTime
          };
        } else {
          results[results.length - 1] = {
            name: "APY Validation",
            status: 'warning',
            message: "No pool reserves found for testing"
          };
        }
      } catch (error) {
        results[results.length - 1] = {
          name: "APY Validation",
          status: 'failed',
          message: error instanceof Error ? error.message : "APY validation failed"
        };
      }

      // Test 3: Input Validation
      results.push({ name: "Input Validation", status: "running", message: "Testing input validation..." });
      const inputTests = [
        { amount: -1, shouldFail: true, test: "Negative amount" },
        { amount: 0, shouldFail: true, test: "Zero amount" },
        { amount: 100.123456789, shouldFail: true, test: "Too many decimals" },
        { amount: 100, shouldFail: false, test: "Valid amount" }
      ];

      let inputTestsPassed = 0;
      for (const test of inputTests) {
        const validation = LendingValidator.validateInputAmount(test.amount, { min: 0.01, decimals: 6 });
        const testPassed = test.shouldFail ? !validation.isValid : validation.isValid;
        if (testPassed) inputTestsPassed++;
      }

      results[results.length - 1] = {
        name: "Input Validation",
        status: inputTestsPassed === inputTests.length ? 'passed' : 'failed',
        message: `${inputTestsPassed}/${inputTests.length} input validation tests passed`
      };

      // Test 4: Performance Check
      results.push({ name: "Performance Check", status: "running", message: "Checking operation performance..." });
      const perfStats = lending.getPerformanceStats();
      const slowOperations = Object.entries(perfStats)
        .filter(([_, stats]) => stats && stats.average > 3000)
        .map(([op]) => op);

      results[results.length - 1] = {
        name: "Performance Check",
        status: slowOperations.length === 0 ? 'passed' : 'warning',
        message: slowOperations.length === 0 
          ? "All operations performing within acceptable limits"
          : `Slow operations detected: ${slowOperations.join(', ')}`
      };

      // Test 5: Data Consistency
      results.push({ name: "Data Consistency", status: "running", message: "Checking data consistency..." });
      const hasInconsistentData = lending.userSupplies.some(supply => 
        supply.supplied_amount_dec < 0 || supply.accrued_interest_dec < 0
      ) || lending.userBorrows.some(borrow => 
        borrow.borrowed_amount_dec < 0 || borrow.accrued_interest_dec < 0
      );

      results[results.length - 1] = {
        name: "Data Consistency",
        status: hasInconsistentData ? 'failed' : 'passed',
        message: hasInconsistentData ? "Inconsistent data detected" : "All data is consistent"
      };

    } catch (error) {
      results.push({
        name: "Test Runner",
        status: 'failed',
        message: error instanceof Error ? error.message : "Test runner failed"
      });
    }

    setTestResults(results);
    setIsRunningTests(false);
  };

  useEffect(() => {
    // Run initial tests when component mounts
    if (lending.poolReserves.length > 0) {
      runValidationTests();
    }
  }, [lending.poolReserves.length]);

  const passedTests = testResults.filter(t => t.status === 'passed').length;
  const failedTests = testResults.filter(t => t.status === 'failed').length;
  const warningTests = testResults.filter(t => t.status === 'warning').length;
  const totalTests = testResults.length;
  const successRate = totalTests > 0 ? (passedTests / totalTests) * 100 : 0;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'passed': return <CheckCircle className="h-4 w-4 text-success" />;
      case 'failed': return <XCircle className="h-4 w-4 text-destructive" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-warning" />;
      case 'running': return <Clock className="h-4 w-4 text-muted-foreground animate-spin" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'passed': return 'bg-success/10 text-success border-success/20';
      case 'failed': return 'bg-destructive/10 text-destructive border-destructive/20';
      case 'warning': return 'bg-warning/10 text-warning border-warning/20';
      default: return 'bg-muted/10 text-muted-foreground border-muted/20';
    }
  };

  return (
    <Card className="bg-surface-elevated border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              System Validation Status
            </CardTitle>
            <CardDescription>
              Real-time testing and validation of lending system components
            </CardDescription>
          </div>
          <Button 
            onClick={runValidationTests} 
            disabled={isRunningTests}
            size="sm"
            variant="outline"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRunningTests ? 'animate-spin' : ''}`} />
            {isRunningTests ? 'Running...' : 'Run Tests'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Status */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-surface-overlay rounded-lg border border-border">
            <div className="text-2xl font-bold text-success">{passedTests}</div>
            <div className="text-sm text-muted-foreground">Passed</div>
          </div>
          <div className="text-center p-4 bg-surface-overlay rounded-lg border border-border">
            <div className="text-2xl font-bold text-warning">{warningTests}</div>
            <div className="text-sm text-muted-foreground">Warnings</div>
          </div>
          <div className="text-center p-4 bg-surface-overlay rounded-lg border border-border">
            <div className="text-2xl font-bold text-destructive">{failedTests}</div>
            <div className="text-sm text-muted-foreground">Failed</div>
          </div>
          <div className="text-center p-4 bg-surface-overlay rounded-lg border border-border">
            <div className="text-2xl font-bold text-primary">{successRate.toFixed(1)}%</div>
            <div className="text-sm text-muted-foreground">Success Rate</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Overall Health</span>
            <span>{successRate.toFixed(1)}%</span>
          </div>
          <Progress value={successRate} className="h-2" />
        </div>

        {/* Test Results */}
        <div className="space-y-3">
          <h4 className="font-semibold flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Test Results
          </h4>
          {testResults.map((test, index) => (
            <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-surface-overlay border border-border">
              <div className="flex items-center gap-3">
                {getStatusIcon(test.status)}
                <div>
                  <div className="font-medium">{test.name}</div>
                  <div className="text-sm text-muted-foreground">{test.message}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {test.duration && (
                  <Badge variant="outline" className="border-muted-foreground/20">
                    <Zap className="h-3 w-3 mr-1" />
                    {test.duration}ms
                  </Badge>
                )}
                <Badge className={getStatusColor(test.status)}>
                  {test.status}
                </Badge>
              </div>
            </div>
          ))}
        </div>

        {/* Performance Stats */}
        {Object.keys(lending.getPerformanceStats()).length > 0 && (
          <div className="space-y-3">
            <h4 className="font-semibold">Performance Metrics</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {Object.entries(lending.getPerformanceStats()).map(([operation, stats]) => (
                stats && (
                  <div key={operation} className="p-3 bg-surface-overlay rounded-lg border border-border">
                    <div className="font-medium capitalize">{operation}</div>
                    <div className="text-sm text-muted-foreground">
                      Avg: {stats.average.toFixed(0)}ms
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {stats.count} samples
                    </div>
                  </div>
                )
              ))}
            </div>
          </div>
        )}

        {/* Critical Alerts */}
        {failedTests > 0 && (
          <Alert className="border-destructive bg-destructive/10">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Critical Issues Detected</AlertTitle>
            <AlertDescription>
              {failedTests} test(s) failed. Please review the system before proceeding with operations.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}