import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ForensicsResult {
  txHash: string;
  provider: 'wormhole' | 'across' | 'unknown';
  amount: string;
  sourceChain: string;
  needsRedemption?: boolean;
  vaaBytes?: string;
  redeemed?: boolean;
  sequence?: string;
  emitterAddress?: string;
  chainId?: number;
}

interface RecoveryResult {
  txHash: string;
  amount: string;
  redemptionTxHash?: string;
  error?: string;
  success: boolean;
}

export const useWormholeRecovery = () => {
  const [loading, setLoading] = useState(false);
  const [forensicsResults, setForensicsResults] = useState<ForensicsResult[] | null>(null);
  const [recoveryResults, setRecoveryResults] = useState<RecoveryResult[] | null>(null);

  const runForensics = async (
    userId: string,
    recipientAddress: string,
    txHashes: string[]
  ) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('bridge-forensics', {
        body: { userId, recipientAddress, txHashes }
      });

      if (error) throw error;

      console.log('Forensics results:', data);
      setForensicsResults(data.results);
      
      const needsRedemption = data.results.filter((r: ForensicsResult) => r.needsRedemption).length;
      
      if (needsRedemption > 0) {
        toast.info(
          `Found ${needsRedemption} Wormhole transaction(s) needing redemption`,
          { description: `Total unredeemed: ${data.summary.unredeemed_amount_usdc} USDC` }
        );
      } else {
        toast.success('No transactions need redemption');
      }

      return data;
    } catch (error) {
      console.error('Forensics error:', error);
      toast.error('Failed to analyze transactions');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const executeRecovery = async (
    userId: string,
    password: string,
    forensicsResults: ForensicsResult[]
  ) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('execute-wormhole-recovery', {
        body: { userId, password, forensicsResults }
      });

      if (error) throw error;

      console.log('Recovery results:', data);
      setRecoveryResults(data.redeemed);

      if (data.summary.successful_redemptions > 0) {
        toast.success(
          `Recovered ${data.summary.total_usdc_recovered} USDC!`,
          { description: `${data.summary.successful_redemptions} transaction(s) redeemed` }
        );
      }

      return data;
    } catch (error) {
      console.error('Recovery error:', error);
      toast.error('Failed to execute recovery');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    forensicsResults,
    recoveryResults,
    runForensics,
    executeRecovery
  };
};
