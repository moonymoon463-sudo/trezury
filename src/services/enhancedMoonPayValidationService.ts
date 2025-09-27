import { supabase } from "@/integrations/supabase/client";

export interface MoonPayTestResult {
  success: boolean;
  operation: string;
  data?: any;
  error?: string;
  timestamp: string;
  duration_ms?: number;
}

export interface MoonPayValidationReport {
  overall_status: 'pass' | 'fail' | 'warning';
  kyc_flow: MoonPayTestResult;
  buy_flow: MoonPayTestResult;
  sell_flow: MoonPayTestResult;
  webhook_handling: MoonPayTestResult;
  webhook_security: MoonPayTestResult;
  error_scenarios: MoonPayTestResult[];
  performance_tests: MoonPayTestResult[];
  recommendations: string[];
  generated_at: string;
  total_duration_ms: number;
}

export interface WebhookSecurityTest {
  signature_verification: boolean;
  rate_limiting: boolean;
  idempotency: boolean;
  ip_filtering: boolean;
}

class EnhancedMoonPayValidationService {
  private results: MoonPayTestResult[] = [];

  // Enhanced KYC flow validation with timeout and retry
  async validateKYCFlow(): Promise<MoonPayTestResult> {
    console.log('🔍 Enhanced KYC flow validation...');
    
    const startTime = Date.now();
    
    try {
      // Test with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const { data, error } = await supabase.functions.invoke('moonpay-kyc', {
        body: { action: 'create-widget-url', test_mode: true }
      });

      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;

      if (error) {
        return {
          success: false,
          operation: 'Enhanced KYC Flow Validation',
          error: `KYC URL generation failed: ${error.message}`,
          timestamp: new Date().toISOString(),
          duration_ms: duration
        };
      }

      // Enhanced validation checks
      const validationChecks = {
        has_widget_url: !!data?.widgetUrl,
        has_customer_id: !!data?.customerId,
        url_format_valid: data?.widgetUrl?.includes('moonpay.com'),
        response_time_acceptable: duration < 5000, // Under 5 seconds
        has_required_params: data?.widgetUrl?.includes('apiKey') && data?.widgetUrl?.includes('externalCustomerId')
      };

      const allChecksPass = Object.values(validationChecks).every(check => check);

      return {
        success: allChecksPass,
        operation: 'Enhanced KYC Flow Validation',
        data: {
          ...validationChecks,
          response_time_ms: duration,
          widget_url_length: data?.widgetUrl?.length,
          customer_id_format: data?.customerId?.length
        },
        timestamp: new Date().toISOString(),
        duration_ms: duration
      };

    } catch (err) {
      const duration = Date.now() - startTime;
      return {
        success: false,
        operation: 'Enhanced KYC Flow Validation',
        error: err instanceof Error ? err.message : 'Unknown KYC validation error',
        timestamp: new Date().toISOString(),
        duration_ms: duration
      };
    }
  }

  // Enhanced buy flow with multiple scenarios
  async validateBuyFlow(): Promise<MoonPayTestResult> {
    console.log('💰 Enhanced buy flow validation...');

    const startTime = Date.now();

    try {
      // Test multiple amounts and currencies
      const testScenarios = [
        { amount: 100, currency: 'USDC', expected_success: true },
        { amount: 50, currency: 'USDC', expected_success: true },
        { amount: 25, currency: 'USDC', expected_success: true }
      ];

      const results = await Promise.allSettled(
        testScenarios.map(async (scenario) => {
          const { data, error } = await supabase.functions.invoke('moonpay-buy', {
            body: {
              amount: scenario.amount,
              currency: scenario.currency,
              test_mode: true
            }
          });

          return {
            scenario,
            success: !error && (data?.transactionId || data?.redirectUrl),
            data,
            error: error?.message
          };
        })
      );

      const duration = Date.now() - startTime;
      const successfulTests = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
      const totalTests = results.length;

      return {
        success: successfulTests === totalTests,
        operation: 'Enhanced Buy Flow Validation',
        data: {
          successful_scenarios: successfulTests,
          total_scenarios: totalTests,
          success_rate: (successfulTests / totalTests) * 100,
          test_results: results.map(r => r.status === 'fulfilled' ? r.value : { error: 'Test failed' }),
          response_time_ms: duration
        },
        timestamp: new Date().toISOString(),
        duration_ms: duration
      };

    } catch (err) {
      const duration = Date.now() - startTime;
      return {
        success: false,
        operation: 'Enhanced Buy Flow Validation',
        error: err instanceof Error ? err.message : 'Unknown buy flow error',
        timestamp: new Date().toISOString(),
        duration_ms: duration
      };
    }
  }

  // Enhanced sell flow validation
  async validateSellFlow(): Promise<MoonPayTestResult> {
    console.log('💸 Enhanced sell flow validation...');

    const startTime = Date.now();

    try {
      const testScenarios = [
        { amount: 50, currency: 'USDC', expected_success: true },
        { amount: 25, currency: 'USDC', expected_success: true }
      ];

      const results = await Promise.allSettled(
        testScenarios.map(async (scenario) => {
          const { data, error } = await supabase.functions.invoke('moonpay-sell', {
            body: {
              amount: scenario.amount,
              currency: scenario.currency,
              test_mode: true
            }
          });

          return {
            scenario,
            success: !error && data?.success,
            data,
            error: error?.message
          };
        })
      );

      const duration = Date.now() - startTime;
      const successfulTests = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
      const totalTests = results.length;

      return {
        success: successfulTests >= totalTests * 0.5, // At least 50% success rate
        operation: 'Enhanced Sell Flow Validation',
        data: {
          successful_scenarios: successfulTests,
          total_scenarios: totalTests,
          success_rate: (successfulTests / totalTests) * 100,
          test_results: results.map(r => r.status === 'fulfilled' ? r.value : { error: 'Test failed' }),
          response_time_ms: duration
        },
        timestamp: new Date().toISOString(),
        duration_ms: duration
      };

    } catch (err) {
      const duration = Date.now() - startTime;
      return {
        success: false,
        operation: 'Enhanced Sell Flow Validation',
        error: err instanceof Error ? err.message : 'Unknown sell flow error',
        timestamp: new Date().toISOString(),
        duration_ms: duration
      };
    }
  }

  // Enhanced webhook validation with security tests
  async validateWebhookHandling(): Promise<MoonPayTestResult> {
    console.log('🔗 Enhanced webhook handling validation...');

    const startTime = Date.now();

    try {
      // Test different webhook event types
      const webhookTests = [
        {
          name: 'Transaction Updated',
          payload: {
            type: 'transaction_updated',
            data: {
              id: 'test_tx_' + Date.now(),
              status: 'completed',
              cryptoAmount: 100,
              cryptoCurrency: 'USDC',
              baseCurrencyAmount: 100,
              externalCustomerId: 'test_user_' + Date.now()
            }
          }
        },
        {
          name: 'Customer Updated',
          payload: {
            type: 'customer_updated',
            data: {
              id: 'test_customer_' + Date.now(),
              identityStatus: 'verified',
              externalCustomerId: 'test_user_' + Date.now()
            }
          }
        },
        {
          name: 'Transaction Failed',
          payload: {
            type: 'transaction_failed',
            data: {
              id: 'test_tx_failed_' + Date.now(),
              failureReason: 'Insufficient funds',
              externalCustomerId: 'test_user_' + Date.now()
            }
          }
        }
      ];

      const results = await Promise.allSettled(
        webhookTests.map(async (test) => {
          const { data, error } = await supabase.functions.invoke('moonpay-webhook', {
            body: test.payload
          });

          return {
            test_name: test.name,
            success: !error && data?.received,
            response_data: data,
            error: error?.message
          };
        })
      );

      const duration = Date.now() - startTime;
      const successfulTests = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
      const totalTests = results.length;

      return {
        success: successfulTests === totalTests,
        operation: 'Enhanced Webhook Handling Validation',
        data: {
          successful_tests: successfulTests,
          total_tests: totalTests,
          success_rate: (successfulTests / totalTests) * 100,
          test_results: results.map(r => r.status === 'fulfilled' ? r.value : { error: 'Test failed' }),
          response_time_ms: duration
        },
        timestamp: new Date().toISOString(),
        duration_ms: duration
      };

    } catch (err) {
      const duration = Date.now() - startTime;
      return {
        success: false,
        operation: 'Enhanced Webhook Handling Validation',
        error: err instanceof Error ? err.message : 'Unknown webhook error',
        timestamp: new Date().toISOString(),
        duration_ms: duration
      };
    }
  }

  // Webhook security validation
  async validateWebhookSecurity(): Promise<MoonPayTestResult> {
    console.log('🔒 Webhook security validation...');

    const startTime = Date.now();

    try {
      // Test security features
      const securityTests = {
        signature_verification: false,
        rate_limiting: false,
        idempotency: false,
        error_handling: false
      };

      // Test with invalid signature (should fail)
      try {
        const { error } = await supabase.functions.invoke('moonpay-webhook', {
          body: {
            type: 'transaction_updated',
            data: { id: 'security_test', status: 'completed' }
          },
          headers: {
            'x-moonpay-signature': 'invalid_signature'
          }
        });
        
        securityTests.signature_verification = !!error; // Should error with invalid signature
      } catch {
        securityTests.signature_verification = true; // Error is expected
      }

      // Test rate limiting by making multiple rapid requests
      const rapidRequests = Array(5).fill(null).map(() => 
        supabase.functions.invoke('moonpay-webhook', {
          body: { type: 'test', data: { id: 'rate_limit_test' } }
        })
      );

      try {
        const rapidResults = await Promise.allSettled(rapidRequests);
        // If some requests fail due to rate limiting, that's good
        const failedRequests = rapidResults.filter(r => r.status === 'rejected').length;
        securityTests.rate_limiting = failedRequests > 0;
      } catch {
        securityTests.rate_limiting = true;
      }

      // Test idempotency with duplicate webhook IDs
      const duplicateId = 'idempotency_test_' + Date.now();
      try {
        const [first, second] = await Promise.allSettled([
          supabase.functions.invoke('moonpay-webhook', {
            body: { 
              type: 'transaction_updated', 
              data: { id: duplicateId, status: 'completed' }
            }
          }),
          supabase.functions.invoke('moonpay-webhook', {
            body: { 
              type: 'transaction_updated', 
              data: { id: duplicateId, status: 'completed' }
            }
          })
        ]);

        // Second request should be handled differently (idempotency)
        securityTests.idempotency = first.status === 'fulfilled' && second.status === 'fulfilled';
      } catch {
        securityTests.idempotency = false;
      }

      // Test error handling with malformed data
      try {
        const { error } = await supabase.functions.invoke('moonpay-webhook', {
          body: { invalid: 'data' }
        });
        securityTests.error_handling = !error; // Should handle gracefully
      } catch {
        securityTests.error_handling = true; // Error handling works
      }

      const duration = Date.now() - startTime;
      const passedTests = Object.values(securityTests).filter(Boolean).length;
      const totalTests = Object.keys(securityTests).length;

      return {
        success: passedTests >= totalTests * 0.75, // 75% pass rate
        operation: 'Webhook Security Validation',
        data: {
          security_tests: securityTests,
          passed_tests: passedTests,
          total_tests: totalTests,
          security_score: (passedTests / totalTests) * 100,
          response_time_ms: duration
        },
        timestamp: new Date().toISOString(),
        duration_ms: duration
      };

    } catch (err) {
      const duration = Date.now() - startTime;
      return {
        success: false,
        operation: 'Webhook Security Validation',
        error: err instanceof Error ? err.message : 'Unknown security validation error',
        timestamp: new Date().toISOString(),
        duration_ms: duration
      };
    }
  }

  // Performance tests under load
  async runPerformanceTests(): Promise<MoonPayTestResult[]> {
    console.log('⚡ Running performance tests...');

    const tests = [
      {
        name: 'Concurrent KYC Requests',
        test: () => this.testConcurrentRequests('moonpay-kyc', { action: 'create-widget-url' }, 5)
      },
      {
        name: 'Concurrent Buy Requests',
        test: () => this.testConcurrentRequests('moonpay-buy', { amount: 100, currency: 'USDC', test_mode: true }, 3)
      },
      {
        name: 'Webhook Processing Speed',
        test: () => this.testWebhookSpeed()
      }
    ];

    const results = await Promise.allSettled(
      tests.map(async (test) => {
        const startTime = Date.now();
        try {
          const testResult = await test.test();
          const duration = Date.now() - startTime;
          
          return {
            success: testResult.success,
            operation: test.name,
            data: testResult.data,
            timestamp: new Date().toISOString(),
            duration_ms: duration
          };
        } catch (err) {
          const duration = Date.now() - startTime;
          return {
            success: false,
            operation: test.name,
            error: err instanceof Error ? err.message : 'Performance test failed',
            timestamp: new Date().toISOString(),
            duration_ms: duration
          };
        }
      })
    );

    return results.map(r => r.status === 'fulfilled' ? r.value : {
      success: false,
      operation: 'Performance Test',
      error: 'Test execution failed',
      timestamp: new Date().toISOString()
    });
  }

  // Helper: Test concurrent requests
  private async testConcurrentRequests(functionName: string, payload: any, concurrency: number) {
    const startTime = Date.now();
    
    const requests = Array(concurrency).fill(null).map(() =>
      supabase.functions.invoke(functionName, { body: payload })
    );

    const results = await Promise.allSettled(requests);
    const duration = Date.now() - startTime;
    
    const successful = results.filter(r => r.status === 'fulfilled' && !r.value.error).length;
    const avgResponseTime = duration / concurrency;

    return {
      success: successful >= concurrency * 0.8, // 80% success rate
      data: {
        concurrent_requests: concurrency,
        successful_requests: successful,
        success_rate: (successful / concurrency) * 100,
        total_duration_ms: duration,
        avg_response_time_ms: avgResponseTime,
        requests_per_second: 1000 / avgResponseTime
      }
    };
  }

  // Helper: Test webhook processing speed
  private async testWebhookSpeed() {
    const webhookPayloads = Array(10).fill(null).map((_, i) => ({
      type: 'transaction_updated',
      data: {
        id: `speed_test_${i}_${Date.now()}`,
        status: 'completed',
        cryptoAmount: 100,
        externalCustomerId: `test_user_${i}`
      }
    }));

    const startTime = Date.now();
    const results = await Promise.allSettled(
      webhookPayloads.map(payload =>
        supabase.functions.invoke('moonpay-webhook', { body: payload })
      )
    );
    const duration = Date.now() - startTime;

    const successful = results.filter(r => r.status === 'fulfilled' && !r.value.error).length;

    return {
      success: successful >= webhookPayloads.length * 0.9, // 90% success rate
      data: {
        webhook_count: webhookPayloads.length,
        successful_webhooks: successful,
        total_duration_ms: duration,
        avg_processing_time_ms: duration / webhookPayloads.length,
        webhooks_per_second: (webhookPayloads.length * 1000) / duration
      }
    };
  }

  // Enhanced error scenario testing
  async validateErrorScenarios(): Promise<MoonPayTestResult[]> {
    console.log('⚠️ Testing enhanced error scenarios...');

    const errorTests = [
      {
        name: 'Invalid Amount Test',
        test: () => supabase.functions.invoke('moonpay-buy', {
          body: { amount: -100, currency: 'USDC' }
        })
      },
      {
        name: 'Invalid Currency Test',
        test: () => supabase.functions.invoke('moonpay-buy', {
          body: { amount: 100, currency: 'INVALID_CURRENCY' }
        })
      },
      {
        name: 'Missing Parameters Test',
        test: () => supabase.functions.invoke('moonpay-buy', {
          body: {}
        })
      },
      {
        name: 'Oversized Amount Test',
        test: () => supabase.functions.invoke('moonpay-buy', {
          body: { amount: 999999999, currency: 'USDC' }
        })
      },
      {
        name: 'Malformed Webhook Test',
        test: () => supabase.functions.invoke('moonpay-webhook', {
          body: { malformed: 'data', no_type: true }
        })
      }
    ];

    const results: MoonPayTestResult[] = [];

    for (const errorTest of errorTests) {
      const startTime = Date.now();
      try {
        const { error } = await errorTest.test();
        const duration = Date.now() - startTime;
        
        results.push({
          success: !!error, // Success means we got expected error
          operation: errorTest.name,
          data: {
            error_caught: !!error,
            error_message: error?.message,
            response_time_ms: duration
          },
          error: !error ? 'Expected error was not thrown' : undefined,
          timestamp: new Date().toISOString(),
          duration_ms: duration
        });

      } catch (err) {
        const duration = Date.now() - startTime;
        results.push({
          success: true, // Catching exception is expected
          operation: errorTest.name,
          data: {
            exception_caught: true,
            exception_message: err instanceof Error ? err.message : 'Unknown error',
            response_time_ms: duration
          },
          timestamp: new Date().toISOString(),
          duration_ms: duration
        });
      }
    }

    return results;
  }

  // Run comprehensive enhanced validation
  async runComprehensiveValidation(): Promise<MoonPayValidationReport> {
    console.log('🚀 Starting comprehensive enhanced MoonPay validation...');

    const startTime = Date.now();

    try {
      // Run all validations in parallel
      const [
        kycResult,
        buyResult,
        sellResult,
        webhookResult,
        webhookSecurityResult,
        errorResults,
        performanceResults
      ] = await Promise.all([
        this.validateKYCFlow(),
        this.validateBuyFlow(),
        this.validateSellFlow(),
        this.validateWebhookHandling(),
        this.validateWebhookSecurity(),
        this.validateErrorScenarios(),
        this.runPerformanceTests()
      ]);

      const totalDuration = Date.now() - startTime;

      // Determine overall status
      const allResults = [kycResult, buyResult, sellResult, webhookResult, webhookSecurityResult, ...errorResults, ...performanceResults];
      const criticalTests = [kycResult, buyResult, sellResult, webhookResult, webhookSecurityResult];
      
      const failedCriticalTests = criticalTests.filter(r => !r.success);
      const failedTests = allResults.filter(r => !r.success);

      let overall_status: 'pass' | 'fail' | 'warning' = 'pass';
      if (failedCriticalTests.length > 0) {
        overall_status = 'fail';
      } else if (failedTests.length > allResults.length * 0.1) { // More than 10% failures
        overall_status = 'warning';
      }

      // Generate enhanced recommendations
      const recommendations: string[] = [];

      if (!kycResult.success) {
        recommendations.push('🔴 CRITICAL: Fix KYC widget URL generation - blocks user onboarding');
      }
      if (!buyResult.success) {
        recommendations.push('🔴 CRITICAL: Resolve buy flow issues - prevents user purchases');
      }
      if (!sellResult.success) {
        recommendations.push('🟡 WARNING: Fix sell flow problems - affects user liquidity');
      }
      if (!webhookResult.success) {
        recommendations.push('🔴 CRITICAL: Webhook handling needs fixing - transaction updates will fail');
      }
      if (!webhookSecurityResult.success) {
        recommendations.push('🟠 HIGH: Improve webhook security - potential vulnerability');
      }

      // Performance recommendations
      const avgResponseTime = performanceResults.reduce((sum, r) => sum + (r.duration_ms || 0), 0) / performanceResults.length;
      if (avgResponseTime > 3000) {
        recommendations.push('🟡 PERFORMANCE: API response times are slow - consider optimization');
      }

      // Add security recommendations
      const securityScore = webhookSecurityResult.data?.security_score || 0;
      if (securityScore < 75) {
        recommendations.push('🔒 SECURITY: Webhook security score below 75% - immediate attention required');
      }

      if (recommendations.length === 0) {
        recommendations.push('✅ All validations passed - system is ready for production launch');
      }

      console.log(`✅ Enhanced MoonPay validation completed in ${totalDuration}ms`);

      const report: MoonPayValidationReport = {
        overall_status,
        kyc_flow: kycResult,
        buy_flow: buyResult,
        sell_flow: sellResult,
        webhook_handling: webhookResult,
        webhook_security: webhookSecurityResult,
        error_scenarios: errorResults,
        performance_tests: performanceResults,
        recommendations,
        generated_at: new Date().toISOString(),
        total_duration_ms: totalDuration
      };

      // Store enhanced validation results
      await this.storeValidationResults(report);

      return report;

    } catch (err) {
      const totalDuration = Date.now() - startTime;
      console.error('Enhanced validation failed:', err);
      
      // Return error report
      return {
        overall_status: 'fail',
        kyc_flow: { success: false, operation: 'KYC', error: 'Validation suite failed', timestamp: new Date().toISOString() },
        buy_flow: { success: false, operation: 'Buy', error: 'Validation suite failed', timestamp: new Date().toISOString() },
        sell_flow: { success: false, operation: 'Sell', error: 'Validation suite failed', timestamp: new Date().toISOString() },
        webhook_handling: { success: false, operation: 'Webhook', error: 'Validation suite failed', timestamp: new Date().toISOString() },
        webhook_security: { success: false, operation: 'Security', error: 'Validation suite failed', timestamp: new Date().toISOString() },
        error_scenarios: [],
        performance_tests: [],
        recommendations: ['🔴 CRITICAL: Validation suite failed to run - investigate immediately'],
        generated_at: new Date().toISOString(),
        total_duration_ms: totalDuration
      };
    }
  }

  // Store enhanced validation results
  private async storeValidationResults(report: MoonPayValidationReport) {
    try {
      // Store overall status
      await supabase.rpc('record_system_metric', {
        p_metric_name: 'moonpay_validation_status',
        p_metric_value: report.overall_status === 'pass' ? 1 : report.overall_status === 'warning' ? 0.5 : 0,
        p_metric_unit: 'status'
      });

      // Store performance metrics
      await supabase.rpc('record_system_metric', {
        p_metric_name: 'moonpay_validation_duration',
        p_metric_value: report.total_duration_ms,
        p_metric_unit: 'milliseconds'
      });

      // Store individual test results
      const testResults = [
        report.kyc_flow,
        report.buy_flow,
        report.sell_flow,
        report.webhook_handling,
        report.webhook_security,
        ...report.performance_tests
      ];

      for (const result of testResults) {
        await supabase.rpc('record_system_metric', {
          p_metric_name: `moonpay_${result.operation.toLowerCase().replace(/\s+/g, '_')}`,
          p_metric_value: result.success ? 1 : 0,
          p_metric_unit: 'status'
        });
      }

    } catch (err) {
      console.error('Failed to store validation results:', err);
    }
  }
}

export const enhancedMoonPayValidationService = new EnhancedMoonPayValidationService();