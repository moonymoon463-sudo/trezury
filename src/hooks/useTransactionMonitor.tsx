import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface TransactionIntent {
  id: string;
  status: string;
  tx_hash?: string;
  error_message?: string;
  output_amount?: number;
  output_asset?: string;
}

interface UseTransactionMonitorProps {
  intentId: string | null;
  onComplete?: () => void;
  onFailed?: () => void;
}

export const useTransactionMonitor = ({ 
  intentId, 
  onComplete, 
  onFailed 
}: UseTransactionMonitorProps) => {
  const { toast } = useToast();
  const [currentStatus, setCurrentStatus] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  useEffect(() => {
    if (!intentId) return;

    console.log('🔔 Setting up realtime monitor for intent:', intentId);
    
    // Timeout tracker for stuck validating status
    let validatingTimeout: NodeJS.Timeout | null = null;

    // Subscribe to transaction_intents changes
    const channel = supabase
      .channel(`transaction-${intentId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'transaction_intents',
          filter: `id=eq.${intentId}`
        },
        (payload: any) => {
          const newData = payload.new as TransactionIntent;
          console.log('🔔 Transaction status update:', newData.status);
          
          setCurrentStatus(newData.status);
          
          // Clear validating timeout if we move to another status
          if (newData.status !== 'validating' && validatingTimeout) {
            clearTimeout(validatingTimeout);
            validatingTimeout = null;
          }
          
          // Update transaction hash if available
          if (newData.tx_hash) {
            setTxHash(newData.tx_hash);
          }

          // Show status-specific toasts
          switch (newData.status) {
            case 'validating':
              toast({
                title: "Validating Swap",
                description: "Checking balances and preparing transaction...",
              });
              
              // Set timeout for stuck validating status (30 seconds)
              if (validatingTimeout) clearTimeout(validatingTimeout);
              validatingTimeout = setTimeout(() => {
                console.warn('⏱️ Swap stuck in validating status for >30s');
                toast({
                  variant: "destructive",
                  title: "Swap Taking Too Long ⏱️",
                  description: "The swap is taking longer than expected. Please try again or contact support.",
                });
                if (onFailed) {
                  onFailed();
                }
              }, 30000); // 30 seconds
              break;

            case 'funds_pulled':
              toast({
                title: "Transaction Broadcasting",
                description: "Sending transaction to the network...",
              });
              break;

            case 'swap_executed':
              toast({
                title: "Swap Executing",
                description: "Transaction pending confirmation...",
              });
              break;

            case 'completed':
              toast({
                title: "Swap Confirmed ✅",
                description: `Successfully swapped to ${newData.output_amount} ${newData.output_asset}`,
                variant: "default",
              });
              if (onComplete) {
                setTimeout(() => onComplete(), 1000);
              }
              break;

            case 'failed':
            case 'validation_failed':
              toast({
                variant: "destructive",
                title: "Swap Failed ❌",
                description: newData.error_message || "Transaction failed",
              });
              if (onFailed) {
                setTimeout(() => onFailed(), 1000);
              }
              break;

            case 'refunded':
              toast({
                title: "Funds Refunded",
                description: "Your funds have been returned due to swap failure",
              });
              if (onFailed) {
                setTimeout(() => onFailed(), 1000);
              }
              break;
          }
        }
      )
      .subscribe((status) => {
        console.log('🔔 Subscription status:', status);
      });

    // Cleanup subscription and timeout
    return () => {
      console.log('🔔 Cleaning up transaction monitor');
      if (validatingTimeout) {
        clearTimeout(validatingTimeout);
      }
      supabase.removeChannel(channel);
    };
  }, [intentId, toast, onComplete, onFailed]);

  return {
    currentStatus,
    txHash,
  };
};
