import { supabase } from "@/integrations/supabase/client";

export interface MoonPayTestResult {
  success: boolean;
  operation: string;
  data?: any;
  error?: string;
  timestamp: string;
}

export interface MoonPayValidationReport {
  overall_status: 'pass' | 'fail' | 'warning';
  kyc_flow: MoonPayTestResult;
  buy_flow: MoonPayTestResult;
  sell_flow: MoonPayTestResult;
  webhook_handling: MoonPayTestResult;
  error_scenarios: MoonPayTestResult[];
  recommendations: string[];
  generated_at: string;
}

class MoonPayValidationService {
  private results: MoonPayTestResult[] = [];

  // Test KYC flow end-to-end
  async validateKYCFlow(): Promise<MoonPayTestResult> {
    console.log('🔍 Validating MoonPay KYC flow...');
    
    try {
      const startTime = Date.now();

      // Test KYC widget URL generation
      const { data, error } = await supabase.functions.invoke('moonpay-kyc', {
        body: { action: 'create-widget-url' }
      });

      if (error) {
        return {
          success: false,
          operation: 'KYC Flow Validation',
          error: `KYC URL generation failed: ${error.message}`,
          timestamp: new Date().toISOString()
        };
      }

      const elapsed = Date.now() - startTime;

      // Validate response structure
      if (!data?.widgetUrl || !data?.customerId) {
        return {
          success: false,
          operation: 'KYC Flow Validation',
          error: 'Invalid KYC response structure - missing widgetUrl or customerId',
          timestamp: new Date().toISOString()
        };
      }

      // Validate URL format
      if (!data.widgetUrl.includes('moonpay.com')) {
        return {
          success: false,
          operation: 'KYC Flow Validation',
          error: 'Invalid KYC widget URL format',
          timestamp: new Date().toISOString()
        };
      }

      return {
        success: true,
        operation: 'KYC Flow Validation',
        data: {
          response_time_ms: elapsed,
          widget_url_valid: true,
          customer_id_present: true,
          url_format: 'valid'
        },
        timestamp: new Date().toISOString()
      };

    } catch (err) {
      return {
        success: false,
        operation: 'KYC Flow Validation',
        error: err instanceof Error ? err.message : 'Unknown KYC validation error',
        timestamp: new Date().toISOString()
      };
    }
  }

  // Test buy flow validation
  async validateBuyFlow(): Promise<MoonPayTestResult> {
    console.log('💰 Validating MoonPay buy flow...');

    try {
      const testAmount = 100; // $100 test amount
      const testCurrency = 'USDC';

      const { data, error } = await supabase.functions.invoke('moonpay-buy', {
        body: {
          amount: testAmount,
          currency: testCurrency,
          test_mode: true
        }
      });

      if (error) {
        return {
          success: false,
          operation: 'Buy Flow Validation',
          error: `Buy flow failed: ${error.message}`,
          timestamp: new Date().toISOString()
        };
      }

      // Validate buy response structure
      const hasRequiredFields = data?.transactionId && data?.redirectUrl;

      return {
        success: hasRequiredFields,
        operation: 'Buy Flow Validation',
        data: {
          transaction_id_present: !!data?.transactionId,
          redirect_url_present: !!data?.redirectUrl,
          test_amount: testAmount,
          test_currency: testCurrency
        },
        error: hasRequiredFields ? undefined : 'Missing required fields in buy response',
        timestamp: new Date().toISOString()
      };

    } catch (err) {
      return {
        success: false,
        operation: 'Buy Flow Validation',
        error: err instanceof Error ? err.message : 'Unknown buy flow error',
        timestamp: new Date().toISOString()
      };
    }
  }

  // Test sell flow validation  
  async validateSellFlow(): Promise<MoonPayTestResult> {
    console.log('💸 Validating MoonPay sell flow...');

    try {
      const testAmount = 50; // $50 test amount
      const testCurrency = 'USDC';

      const { data, error } = await supabase.functions.invoke('moonpay-sell', {
        body: {
          amount: testAmount,
          currency: testCurrency,
          test_mode: true
        }
      });

      if (error) {
        return {
          success: false,
          operation: 'Sell Flow Validation',
          error: `Sell flow failed: ${error.message}`,
          timestamp: new Date().toISOString()
        };
      }

      return {
        success: data?.success || false,
        operation: 'Sell Flow Validation',
        data: {
          success: data?.success,
          transaction_id: data?.transactionId,
          redirect_url: data?.redirectUrl,
          test_amount: testAmount,
          test_currency: testCurrency
        },
        error: data?.success ? undefined : data?.error || 'Sell flow validation failed',
        timestamp: new Date().toISOString()
      };

    } catch (err) {
      return {
        success: false,
        operation: 'Sell Flow Validation',
        error: err instanceof Error ? err.message : 'Unknown sell flow error',
        timestamp: new Date().toISOString()
      };
    }
  }

  // Test webhook handling
  async validateWebhookHandling(): Promise<MoonPayTestResult> {
    console.log('🔗 Validating MoonPay webhook handling...');

    try {
      // Test webhook with mock data
      const mockWebhookData = {
        type: 'transaction_updated',
        data: {
          id: 'test_transaction_id',
          status: 'completed',
          cryptoAmount: 100,
          cryptoCurrency: 'USDC',
          fiatAmount: 100,
          fiatCurrency: 'USD'
        }
      };

      const { data, error } = await supabase.functions.invoke('moonpay-webhook', {
        body: mockWebhookData
      });

      if (error) {
        return {
          success: false,
          operation: 'Webhook Handling Validation',
          error: `Webhook handling failed: ${error.message}`,
          timestamp: new Date().toISOString()
        };
      }

      return {
        success: true,
        operation: 'Webhook Handling Validation',
        data: {
          webhook_processed: true,
          response_data: data
        },
        timestamp: new Date().toISOString()
      };

    } catch (err) {
      return {
        success: false,
        operation: 'Webhook Handling Validation',
        error: err instanceof Error ? err.message : 'Unknown webhook error',
        timestamp: new Date().toISOString()
      };
    }
  }

  // Test error scenarios
  async validateErrorScenarios(): Promise<MoonPayTestResult[]> {
    console.log('⚠️ Testing MoonPay error scenarios...');

    const errorTests = [
      // Test invalid amount
      {
        name: 'Invalid Amount Test',
        test: () => supabase.functions.invoke('moonpay-buy', {
          body: { amount: -100, currency: 'USDC' }
        })
      },
      // Test invalid currency
      {
        name: 'Invalid Currency Test', 
        test: () => supabase.functions.invoke('moonpay-buy', {
          body: { amount: 100, currency: 'INVALID' }
        })
      },
      // Test missing parameters
      {
        name: 'Missing Parameters Test',
        test: () => supabase.functions.invoke('moonpay-buy', {
          body: {}
        })
      }
    ];

    const results: MoonPayTestResult[] = [];

    for (const errorTest of errorTests) {
      try {
        const { error } = await errorTest.test();
        
        results.push({
          success: !!error, // Success means we got expected error
          operation: errorTest.name,
          data: {
            error_caught: !!error,
            error_message: error?.message
          },
          error: !error ? 'Expected error was not thrown' : undefined,
          timestamp: new Date().toISOString()
        });

      } catch (err) {
        results.push({
          success: true, // Catching exception is expected
          operation: errorTest.name,
          data: {
            exception_caught: true,
            exception_message: err instanceof Error ? err.message : 'Unknown error'
          },
          timestamp: new Date().toISOString()
        });
      }
    }

    return results;
  }

  // Run comprehensive validation
  async runComprehensiveValidation(): Promise<MoonPayValidationReport> {
    console.log('🚀 Starting comprehensive MoonPay validation...');

    const startTime = Date.now();

    // Run all validations in parallel
    const [
      kycResult,
      buyResult,
      sellResult,
      webhookResult,
      errorResults
    ] = await Promise.all([
      this.validateKYCFlow(),
      this.validateBuyFlow(),
      this.validateSellFlow(),
      this.validateWebhookHandling(),
      this.validateErrorScenarios()
    ]);

    // Determine overall status
    const allResults = [kycResult, buyResult, sellResult, webhookResult, ...errorResults];
    const failedTests = allResults.filter(r => !r.success);
    const criticalFailures = [kycResult, buyResult, sellResult, webhookResult].filter(r => !r.success);

    let overall_status: 'pass' | 'fail' | 'warning' = 'pass';
    if (criticalFailures.length > 0) {
      overall_status = 'fail';
    } else if (failedTests.length > 0) {
      overall_status = 'warning';
    }

    // Generate recommendations
    const recommendations: string[] = [];
    
    if (!kycResult.success) {
      recommendations.push('Fix KYC widget URL generation before launch');
    }
    if (!buyResult.success) {
      recommendations.push('Resolve buy flow issues - this will block user purchases');
    }
    if (!sellResult.success) {
      recommendations.push('Fix sell flow problems - users won\'t be able to cash out');
    }
    if (!webhookResult.success) {
      recommendations.push('Webhook handling needs fixing - transaction updates may fail');
    }
    if (errorResults.some(r => !r.success)) {
      recommendations.push('Improve error handling for edge cases');
    }

    const totalTime = Date.now() - startTime;
    console.log(`✅ MoonPay validation completed in ${totalTime}ms`);

    const report: MoonPayValidationReport = {
      overall_status,
      kyc_flow: kycResult,
      buy_flow: buyResult,
      sell_flow: sellResult,
      webhook_handling: webhookResult,
      error_scenarios: errorResults,
      recommendations,
      generated_at: new Date().toISOString()
    };

    // Store validation results for tracking
    await this.storeValidationResults(report);

    return report;
  }

  // Store validation results in database
  private async storeValidationResults(report: MoonPayValidationReport) {
    try {
      await supabase.rpc('record_system_metric', {
        p_metric_name: 'moonpay_validation',
        p_metric_value: report.overall_status === 'pass' ? 1 : 0,
        p_metric_unit: 'status',
        p_threshold_warning: null,
        p_threshold_critical: null
      });
    } catch (err) {
      console.error('Store validation results error:', err);
    }
  }
}

export const moonPayValidationService = new MoonPayValidationService();