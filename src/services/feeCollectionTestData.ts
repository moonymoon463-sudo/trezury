// Fee Collection Test Data Generator
import { supabase } from "@/integrations/supabase/client";
import { Chain } from "@/types/lending";

interface TestFeeRequest {
  user_id: string;
  transaction_id: string;
  amount: number;
  asset: string;
  chain: Chain;
  from_address: string;
  to_address: string;
  status: 'pending' | 'completed' | 'failed';
  metadata: any;
}

export class FeeCollectionTestData {
  static async generateTestData(): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const testRequests: Omit<TestFeeRequest, 'user_id'>[] = [
      {
        transaction_id: 'test-trading-eth-001',
        amount: 15.50,
        asset: 'USDC',
        chain: 'ethereum',
        from_address: '0x742d35cc6634c0532925a3b8d33aa7b6b5f6b318',
        to_address: '0xb46DA2C95D65e3F24B48653F1AaFe8BDA7c64835',
        status: 'pending',
        metadata: {
          fee_type: 'trading',
          original_amount: 1550,
          fee_rate: 0.01
        }
      },
      {
        transaction_id: 'test-lending-base-002', 
        amount: 8.25,
        asset: 'USDC',
        chain: 'base',
        from_address: '0x1234567890abcdef1234567890abcdef12345678',
        to_address: '0xb46DA2C95D65e3F24B48653F1AaFe8BDA7c64835',
        status: 'completed',
        metadata: {
          fee_type: 'lending_completion',
          lock_id: 'test-lock-001',
          gross_interest: 458.33,
          platform_fee_rate: 0.018
        }
      },
      {
        transaction_id: 'test-swap-solana-003',
        amount: 12.75,
        asset: 'USDC', 
        chain: 'solana',
        from_address: '4zVpkkUx5f3c84mGCmbxHxbZhbUQ9yixm2NsAU4zrcj7',
        to_address: 'BzSNDYfdEf8Q2wpr3rvrqQyreAWqB25AnmQA6XohUNom',
        status: 'pending',
        metadata: {
          fee_type: 'swap',
          input_asset: 'USDC',
          output_asset: 'USDT',
          swap_amount: 1275
        }
      },
      {
        transaction_id: 'test-trading-tron-004',
        amount: 22.40,
        asset: 'USDT',
        chain: 'tron',
        from_address: 'TFLY2RJXohwZp1ppxiUdySstHUHZ2wc1Zm',
        to_address: 'TJChKfcNH9YamKfhvhiHhfDzMtBwNq9wnQ',
        status: 'failed',
        metadata: {
          fee_type: 'trading',
          original_amount: 2240,
          fee_rate: 0.01,
          failure_reason: 'Insufficient gas'
        }
      },
      {
        transaction_id: 'test-lending-eth-005',
        amount: 35.80,
        asset: 'DAI',
        chain: 'ethereum',
        from_address: '0x9876543210fedcba9876543210fedcba98765432',
        to_address: '0xb46DA2C95D65e3F24B48653F1AaFe8BDA7c64835',
        status: 'pending',
        metadata: {
          fee_type: 'lending_completion',
          lock_id: 'test-lock-002',
          gross_interest: 1988.89,
          platform_fee_rate: 0.018
        }
      }
    ];

    for (const request of testRequests) {
      const { error } = await supabase
        .from('fee_collection_requests')
        .insert({
          ...request,
          user_id: user.id
        });

      if (error) {
        console.error('Failed to create test fee request:', error);
      }
    }

    console.log(`Generated ${testRequests.length} test fee collection requests`);
  }

  static async clearTestData(): Promise<void> {
    const { error } = await supabase
      .from('fee_collection_requests')
      .delete()
      .like('transaction_id', 'test-%');

    if (error) {
      console.error('Failed to clear test data:', error);
    } else {
      console.log('Test data cleared successfully');
    }
  }

  static async getTestDataStats(): Promise<any> {
    const { data, error } = await supabase
      .from('fee_collection_requests')
      .select('*')
      .like('transaction_id', 'test-%');

    if (error) {
      console.error('Failed to get test data stats:', error);
      return null;
    }

    const stats = {
      total: data.length,
      pending: data.filter(r => r.status === 'pending').length,
      completed: data.filter(r => r.status === 'completed').length,
      failed: data.filter(r => r.status === 'failed').length,
      by_chain: data.reduce((acc, r) => {
        acc[r.chain] = (acc[r.chain] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      total_amount: data.reduce((sum, r) => sum + (r.amount || 0), 0)
    };

    return stats;
  }
}