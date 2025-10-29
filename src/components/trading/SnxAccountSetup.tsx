import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle2, XCircle, RefreshCw, Mail, Sparkles, AlertCircle } from 'lucide-react';
import { useAccount, useAuthenticate, useSignerStatus, useSmartAccountClient } from '@account-kit/react';
import { snxAccountService } from '@/services/snxAccountService';
import { ethers } from 'ethers';

interface SnxAccountSetupProps {
  chainId: number;
  onAccountCreated: (accountId: bigint) => void;
}

export function SnxAccountSetup({ chainId, onAccountCreated }: SnxAccountSetupProps) {
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [isAwaitingOTP, setIsAwaitingOTP] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  
  const { address } = useAccount({ type: "LightAccount" });
  const { authenticate, isPending: isAuthenticating } = useAuthenticate();
  const signerStatus = useSignerStatus();
  const { client } = useSmartAccountClient({ type: "LightAccount" });
  
  const [accountId, setAccountId] = useState<bigint | null>(null);
  const [isCheckingAccount, setIsCheckingAccount] = useState(false);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  
  // UI state derived from signer status only
  const showOTPInput = signerStatus.status === "AWAITING_EMAIL_AUTH";
  const showEmailInput = !signerStatus.isConnected && !showOTPInput;
  const showAccountCheck = signerStatus.isConnected;

  // Debug logging for authentication state changes
  useEffect(() => {
    console.log('[SNX Account Setup] Auth state:', {
      signerStatus: signerStatus.status,
      isConnected: signerStatus.isConnected,
      hasAddress: !!address,
      showOTPInput,
      showEmailInput,
      showAccountCheck,
      address: address?.slice(0, 10),
    });
  }, [signerStatus.status, signerStatus.isConnected, address, showOTPInput, showEmailInput, showAccountCheck]);

  // Check if user has a Synthetix account when connected
  useEffect(() => {
    if (signerStatus.isConnected && address) {
      checkForSynthetixAccount();
    }
  }, [signerStatus.isConnected, address]);

  // Notify parent component when account is found
  useEffect(() => {
    if (accountId !== null) {
      console.log('[SNX Account Setup] Notifying parent of account:', accountId);
      onAccountCreated(accountId);
    }
  }, [accountId, onAccountCreated]);

  // Reset isVerifying when connection succeeds or fails
  useEffect(() => {
    if (signerStatus.isConnected || signerStatus.status === "DISCONNECTED") {
      setIsVerifying(false);
    }
  }, [signerStatus.isConnected, signerStatus.status]);

  // Add timeout fallback for OTP flow
  useEffect(() => {
    if (showOTPInput) {
      const timeoutId = setTimeout(() => {
        if (!signerStatus.isConnected) {
          toast.error('Signer Connection Failed', {
            description: 'Alchemy could not establish a connection. Please check:\n\n1. Your URL is in Allowed Origins (Alchemy Dashboard)\n2. You\'re using the correct Account Kit API key\n3. Email OTP is enabled in your Alchemy app',
            duration: 15000,
          });
          setIsAwaitingOTP(false);
          setIsVerifying(false);
        }
      }, 60000); // 60 second timeout
      
      return () => clearTimeout(timeoutId);
    }
  }, [showOTPInput, signerStatus.isConnected]);

  // Show success when signer connects
  useEffect(() => {
    if (signerStatus.isConnected && signerStatus.status === "CONNECTED") {
      toast.success('You\'re signed in! Checking your Synthetix account...');
    }
  }, [signerStatus.isConnected, signerStatus.status]);

  const checkForSynthetixAccount = async () => {
    if (!address) return;
    
    setIsCheckingAccount(true);
    try {
      // Check for SNX account by wallet address
      console.log('[SNX Account Setup] Checking for SNX account:', address);
      const { data, error } = await supabase
        .from('snx_accounts')
        .select('account_id')
        .eq('wallet_address', address.toLowerCase())
        .eq('chain_id', chainId)
        .single();

      if (data && !error) {
        console.log('[SNX Account Setup] Account found:', data.account_id);
        setAccountId(BigInt(data.account_id));
      } else {
        console.log('[SNX Account Setup] No account found');
        setAccountId(null);
      }
    } catch (error) {
      console.error('[SNX Account Setup] Error checking for Synthetix account:', error);
    } finally {
      setIsCheckingAccount(false);
    }
  };

  const handleEmailLogin = async () => {
    if (!email) {
      toast.error('Please enter your email');
      return;
    }
    
    try {
      console.log('[SNX Account Setup] Sending OTP to:', email);
      await authenticate({ type: "email", emailMode: "otp", email });
      setIsAwaitingOTP(true);
      toast.success('Verification code sent! Check your email');
      console.log('[SNX Account Setup] OTP sent successfully');
    } catch (error) {
      toast.error('Failed to send verification code');
      console.error('[SNX Account Setup] Email OTP send error:', error);
    }
  };

  const handleVerifyOTP = async () => {
    if (otpCode.length !== 6) {
      toast.error('Please enter a 6-digit code');
      return;
    }

    setIsVerifying(true);
    try {
      console.log('[SNX Account Setup] Verifying OTP...');
      
      await authenticate({ 
        type: "otp", 
        otpCode 
      });
      
      console.log('[SNX Account Setup] OTP verification request sent');
      toast.info('Verifying code...', { duration: 2000 });
      
      setOtpCode('');
    } catch (error) {
      toast.error('Invalid or expired code');
      console.error('[SNX Account Setup] OTP verification error:', error);
      setIsVerifying(false);
    }
  };

  const handleResendOTP = async () => {
    if (email) {
      try {
        console.log('[SNX Account Setup] Resending OTP to:', email);
        await authenticate({ type: "email", emailMode: "otp", email });
        toast.success('New code sent!');
      } catch (error) {
        toast.error('Failed to resend code');
        console.error('[SNX Account Setup] Resend error:', error);
      }
    }
  };

  const handleCancelOTP = () => {
    setIsAwaitingOTP(false);
    setEmail('');
    setOtpCode('');
  };

  const handleCreateAccount = async () => {
    if (!address || !client) {
      toast.error('Wallet not connected');
      return;
    }

    setIsCreatingAccount(true);
    try {
      console.log('[SNX Account Setup] Creating Synthetix account...');
      
      // Use Account Kit's native signer via window.ethereum (provided by Account Kit)
      // Account Kit injects a compatible provider at window.ethereum
      if (!window.ethereum) {
        throw new Error('No wallet provider detected');
      }
      
      const provider = new ethers.BrowserProvider(window.ethereum as any);
      const signer = await provider.getSigner();
      
      toast.info('Creating your Synthetix account...', { duration: 2000 });
      
      const result = await snxAccountService.createAccount(signer, chainId);
      
      if (result.success && result.accountId) {
        toast.success('Trading account created successfully!');
        setAccountId(result.accountId);
        console.log('[SNX Account Setup] Account created:', result.accountId);
      } else {
        toast.error(result.error || 'Failed to create account');
      }
    } catch (error) {
      console.error('[SNX Account Setup] Account creation error:', error);
      
      let errorMessage = 'Failed to create account';
      if (error instanceof Error) {
        if (error.message.includes('gas')) {
          errorMessage = 'Gas estimation failed. Your wallet may need ETH for gas fees.';
        } else if (error.message.includes('user rejected')) {
          errorMessage = 'Transaction cancelled';
        } else if (error.message.includes('insufficient funds')) {
          errorMessage = 'Insufficient funds for gas';
        } else {
          errorMessage = error.message;
        }
      }
      
      toast.error(errorMessage);
    } finally {
      setIsCreatingAccount(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Synthetix Trading Account</CardTitle>
      <CardDescription>
        Sign in with email to access perpetual futures trading
      </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {showEmailInput && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isAuthenticating}
              />
            </div>
            <Button
              onClick={handleEmailLogin}
              disabled={!email || isAuthenticating}
              className="w-full"
            >
              {isAuthenticating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending code...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Sign up with Email
                </>
              )}
            </Button>
          </div>
        )}

        {showOTPInput && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="otp">Verification Code</Label>
              <p className="text-sm text-muted-foreground">
                Enter the 6-digit code sent to {email}
              </p>
              <div className="flex justify-center py-4">
                <InputOTP
                  maxLength={6}
                  value={otpCode}
                  onChange={(value) => setOtpCode(value)}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
            </div>

            <Button 
              onClick={handleVerifyOTP}
              className="w-full"
              disabled={isVerifying || otpCode.length !== 6}
            >
              {isVerifying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Verify Code'
              )}
            </Button>

          {isVerifying && (
            <Alert>
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertDescription>
                Connecting your account... This may take up to 60 seconds.
              </AlertDescription>
            </Alert>
          )}

            <div className="flex justify-between text-sm">
              <button
                type="button"
                onClick={handleResendOTP}
                disabled={isAuthenticating}
                className="text-primary hover:underline disabled:opacity-50"
              >
                Resend Code
              </button>
              <button
                type="button"
                onClick={handleCancelOTP}
                disabled={isAuthenticating}
                className="text-muted-foreground hover:underline disabled:opacity-50"
              >
                Change Email
              </button>
            </div>
          </div>
        )}

        {showAccountCheck && (
          <>
            {isCheckingAccount ? (
              <Alert>
                <Loader2 className="h-4 w-4 animate-spin" />
                <AlertDescription>
                  Checking for Synthetix account...
                </AlertDescription>
              </Alert>
            ) : accountId ? (
              <Alert>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <AlertDescription>
                  <strong className="text-green-700 dark:text-green-400">✓ Account Found!</strong>
                  <div className="text-sm mt-2 space-y-1">
                    <div>Wallet: <code>{address?.slice(0, 6)}...{address?.slice(-4)}</code></div>
                    <div>Account ID: <code>{accountId.toString()}</code></div>
                  </div>
                </AlertDescription>
              </Alert>
            ) : (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="space-y-3">
                  <div>
                    <strong>Create Your Trading Account</strong>
                  </div>
                  <div className="text-sm">
                    Connected wallet: <code className="text-xs">{address?.slice(0, 6)}...{address?.slice(-4)}</code>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    You'll need a trading account to start trading perps on Synthetix.
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleCreateAccount}
                      disabled={isCreatingAccount}
                      className="flex-1"
                    >
                      {isCreatingAccount ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-2 h-4 w-4" />
                          Create Account
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={checkForSynthetixAccount}
                      disabled={isCheckingAccount || isCreatingAccount}
                      title="Check if account exists"
                    >
                      {isCheckingAccount ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </>
        )}

        <Alert>
          <AlertDescription className="text-xs text-muted-foreground">
            <strong>Powered by Alchemy Account Kit</strong>
            <div className="mt-1">
              Email authentication with embedded smart wallet for gasless trading
            </div>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
