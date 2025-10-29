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
  
  // Email OTP flow state
  const [emailForOTP, setEmailForOTP] = useState<string>('');
  const [isAwaitingOTPInput, setIsAwaitingOTPInput] = useState(false);
  const [isSendingOTP, setIsSendingOTP] = useState(false);
  const [isVerifyingOTP, setIsVerifyingOTP] = useState(false);

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

  const sendEmailOTP = async (email: string) => {
    setIsSendingOTP(true);
    try {
      console.log('[Alchemy Account] Sending OTP to:', email);
      await authenticate({ type: "email", email });
      setEmailForOTP(email);
      setIsAwaitingOTPInput(true);
      toast.success('Verification code sent! Check your email');
    } catch (error) {
      toast.error('Failed to send verification code');
      console.error('Email OTP send error:', error);
    } finally {
      setIsSendingOTP(false);
    }
  };

  const verifyEmailOTP = async (otpCode: string) => {
    if (!emailForOTP) {
      toast.error('Please request a code first');
      return;
    }

    setIsVerifyingOTP(true);
    try {
      console.log('[Alchemy Account] Verifying OTP code');
      
      // Actually verify the OTP with Alchemy
      await authenticate({ 
        type: "email", 
        email: emailForOTP,
        bundle: otpCode
      });
      
      toast.success('Verification successful!');
      setIsAwaitingOTPInput(false);
      setEmailForOTP('');
    } catch (error) {
      toast.error('Invalid or expired code');
      console.error('Email OTP verify error:', error);
    } finally {
      setIsVerifyingOTP(false);
    }
  };

  const resendEmailOTP = async () => {
    if (emailForOTP) {
      await sendEmailOTP(emailForOTP);
    }
  };

  const cancelOTPFlow = () => {
    setIsAwaitingOTPInput(false);
    setEmailForOTP('');
  };

  const loginWithEmail = async (email: string) => {
    // Redirect to the new OTP flow
    await sendEmailOTP(email);
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
    
    // Email OTP flow state
    isAwaitingOTPInput,
    emailForOTP,
    isSendingOTP,
    isVerifyingOTP,
    
    // Auth methods
    loginWithEmail,
    sendEmailOTP,
    verifyEmailOTP,
    resendEmailOTP,
    cancelOTPFlow,
    loginWithPasskey,
    openSynthetixExchange,
    isAuthenticating,
    
    // Utils
    refreshAccount: checkForSynthetixAccount,
  };
}
