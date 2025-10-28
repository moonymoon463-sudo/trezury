/**
 * Alchemy Account Hook
 * Manages Synthetix account creation and authentication via Alchemy
 */

import { useState, useEffect } from 'react';
import { useAccount, useAuthenticate, useSignerStatus, useUser } from '@account-kit/react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useAlchemyAccount(chainId: number = 8453) {
  const { address } = useAccount({ type: "LightAccount" });
  const { authenticate, isPending: isAuthenticating } = useAuthenticate();
  const signerStatus = useSignerStatus();
  const user = useUser();
  const [accountId, setAccountId] = useState<bigint | null>(null);
  const [isCheckingAccount, setIsCheckingAccount] = useState(false);

  // Computed authentication state using multiple signals
  const isFullyAuthenticated = signerStatus.isConnected && !!address && !!user;

  // Debug logging for authentication state changes
  useEffect(() => {
    console.log('[Alchemy Account] Auth state:', {
      isConnected: signerStatus.isConnected,
      hasAddress: !!address,
      hasUser: !!user,
      isFullyAuthenticated,
      address: address?.slice(0, 10),
    });
  }, [signerStatus.isConnected, address, user, isFullyAuthenticated]);

  // Check if user has a Synthetix account
  useEffect(() => {
    if (address) {
      checkForSynthetixAccount();
    }
  }, [address]);

  const checkForSynthetixAccount = async () => {
    if (!address) return;
    
    setIsCheckingAccount(true);
    try {
      // Check if this address has a Synthetix account in our DB
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) return;

      const { data, error } = await supabase
        .from('snx_accounts')
        .select('account_id')
        .eq('user_id', authData.user.id)
        .eq('chain_id', chainId)
        .single();

      if (data && !error) {
        setAccountId(BigInt(data.account_id));
      } else {
        // Try to create account via Synthetix UI
        setAccountId(null);
      }
    } catch (error) {
      console.error('Error checking for Synthetix account:', error);
    } finally {
      setIsCheckingAccount(false);
    }
  };

  const loginWithEmail = async (email: string) => {
    try {
      await authenticate({ type: "email", email });
      toast.success('Check your email for the login link');
    } catch (error) {
      toast.error('Failed to send login email');
      console.error('Email auth error:', error);
    }
  };

  const loginWithPasskey = async () => {
    try {
      await authenticate({ type: "passkey", createNew: false });
      toast.success('Passkey authentication successful');
    } catch (error) {
      toast.error('Passkey authentication failed');
      console.error('Passkey auth error:', error);
    }
  };

  const openSynthetixExchange = () => {
    window.open('https://exchange.synthetix.io', '_blank');
    toast.info('Create your account on Synthetix Exchange, then come back here');
  };

  return {
    // Alchemy account state
    address,
    isAuthenticated: isFullyAuthenticated,
    isConnected: signerStatus.isConnected,
    user,
    
    // Synthetix account state
    accountId,
    hasAccount: accountId !== null,
    isCheckingAccount,
    
    // Auth methods
    loginWithEmail,
    loginWithPasskey,
    openSynthetixExchange,
    isAuthenticating,
    
    // Utils
    refreshAccount: checkForSynthetixAccount,
  };
}
