/**
 * Alchemy Account Hook
 * Manages Synthetix account creation and authentication via Alchemy
 */

import { useState, useEffect } from 'react';
import { useAccount, useAuthenticate, useSignerStatus } from '@account-kit/react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useAlchemyAccount(chainId: number = 8453) {
  const { address } = useAccount({ type: "LightAccount" });
  const { authenticate, isPending: isAuthenticating } = useAuthenticate();
  const signerStatus = useSignerStatus();
  const [accountId, setAccountId] = useState<bigint | null>(null);
  const [isCheckingAccount, setIsCheckingAccount] = useState(false);
  
  // Email OTP flow state
  const [emailForOTP, setEmailForOTP] = useState<string>('');
  const [isAwaitingOTPInput, setIsAwaitingOTPInput] = useState(false);
  const [isSendingOTP, setIsSendingOTP] = useState(false);
  const [isVerifyingOTP, setIsVerifyingOTP] = useState(false);

  // Computed authentication state - only requires connected signer
  const isAuthenticated = signerStatus.isConnected;

  // Debug logging for authentication state changes
  useEffect(() => {
    console.log('[Alchemy Account] Auth state:', {
      signerStatus: signerStatus.status,
      isConnected: signerStatus.isConnected,
      hasAddress: !!address,
      isAuthenticated,
      address: address?.slice(0, 10),
    });
  }, [signerStatus.status, signerStatus.isConnected, address, isAuthenticated]);

  // Check if user has a Synthetix account when connected
  useEffect(() => {
    if (signerStatus.isConnected && address) {
      checkForSynthetixAccount();
    }
  }, [signerStatus.isConnected, address]);

  // Add timeout fallback for OTP flow
  useEffect(() => {
    if (isAwaitingOTPInput) {
      const timeoutId = setTimeout(() => {
        if (!signerStatus.isConnected) {
          toast.error('Authentication timeout', {
            description: 'Please check: 1) Alchemy Allowed Origins, 2) Account Kit API key is correct, 3) Email OTP is enabled in Alchemy dashboard',
            duration: 10000,
          });
          setIsAwaitingOTPInput(false);
        }
      }, 60000); // 60 second timeout
      
      return () => clearTimeout(timeoutId);
    }
  }, [isAwaitingOTPInput, signerStatus.isConnected]);

  // Show success when signer connects after OTP
  useEffect(() => {
    if (signerStatus.isConnected && !isAwaitingOTPInput) {
      // Only show success if we just completed authentication
      if (signerStatus.status === "CONNECTED") {
        toast.success('Verification successful! Setting up your account...');
      }
    }
  }, [signerStatus.isConnected, signerStatus.status, isAwaitingOTPInput]);

  const checkForSynthetixAccount = async () => {
    if (!address) return;
    
    setIsCheckingAccount(true);
    try {
      // Check for SNX account by wallet address
      console.log('[Alchemy Account] Checking for SNX account:', address);
      const { data, error } = await supabase
        .from('snx_accounts')
        .select('account_id')
        .eq('wallet_address', address.toLowerCase())
        .eq('chain_id', chainId)
        .single();

      if (data && !error) {
        console.log('[Alchemy Account] Account found:', data.account_id);
        setAccountId(BigInt(data.account_id));
      } else {
        console.log('[Alchemy Account] No account found');
        setAccountId(null);
      }
    } catch (error) {
      console.error('[Alchemy Account] Error checking for Synthetix account:', error);
    } finally {
      setIsCheckingAccount(false);
    }
  };

  const sendEmailOTP = async (email: string) => {
    setIsSendingOTP(true);
    try {
      console.log('[Alchemy Account] Sending OTP to:', email);
      await authenticate({ type: "email", emailMode: "otp", email });
      setEmailForOTP(email);
      setIsAwaitingOTPInput(true);
      toast.success('Verification code sent! Check your email');
      console.log('[Alchemy Account] OTP sent successfully');
    } catch (error) {
      toast.error('Failed to send verification code');
      console.error('[Alchemy Account] Email OTP send error:', error);
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
      console.log('[Alchemy Account] Verifying OTP code...');
      
      // Verify OTP with Alchemy - let React handle state updates
      await authenticate({ 
        type: "otp", 
        otpCode
      });
      
      console.log('[Alchemy Account] OTP verification request sent');
      toast.info('Verifying code...', { duration: 2000 });
      
      // Let the useEffect handle connection status updates
      setIsAwaitingOTPInput(false);
      setEmailForOTP('');
    } catch (error) {
      toast.error('Invalid or expired code');
      console.error('[Alchemy Account] Email OTP verify error:', error);
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


  const openSynthetixExchange = () => {
    window.open('https://exchange.synthetix.io', '_blank');
    toast.info('Create your account on Synthetix Exchange, then come back here');
  };

  return {
    // Alchemy account state
    address,
    isAuthenticated,
    isConnected: signerStatus.isConnected,
    signerStatus: signerStatus.status,
    
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
    openSynthetixExchange,
    isAuthenticating,
    
    // Utils
    refreshAccount: checkForSynthetixAccount,
  };
}
