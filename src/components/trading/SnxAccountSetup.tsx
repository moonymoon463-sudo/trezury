import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle2, XCircle, RefreshCw, Mail, Sparkles, AlertCircle, Shield } from 'lucide-react';
import { useAccount, useAuthenticate, useSignerStatus, useSmartAccountClient } from '@account-kit/react';
import { snxAccountService } from '@/services/snxAccountService';
import { ethers } from 'ethers';
import { secureWalletService } from '@/services/secureWalletService';
import { useAuth } from '@/hooks/useAuth';

interface SnxAccountSetupProps {
  chainId: number;
  onAccountCreated: (accountId: bigint) => void;
  initialWalletSource: 'alchemy' | 'internal' | 'external';
  alchemyAddress?: string;
  internalAddress?: string;
  externalAddress?: string;
}

export function SnxAccountSetup({ 
  chainId, 
  onAccountCreated, 
  initialWalletSource,
  alchemyAddress,
  internalAddress,
  externalAddress
}: SnxAccountSetupProps) {
  // Wallet selection state
  const [selectedSource, setSelectedSource] = useState<'alchemy' | 'internal' | 'external'>(initialWalletSource);
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [isAwaitingOTP, setIsAwaitingOTP] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [walletPassword, setWalletPassword] = useState('');
  const [needsPassword, setNeedsPassword] = useState(false);
  const [ethBalance, setEthBalance] = useState<string | null>(null);
  const [alchemyEthBalance, setAlchemyEthBalance] = useState<string | null>(null);
  const [isCheckingAlchemyBalance, setIsCheckingAlchemyBalance] = useState(false);
  
  const hasGasPolicy = !!import.meta.env.VITE_ALCHEMY_GAS_POLICY_ID;
  
  const { address } = useAccount({ type: "LightAccount" });
  const { authenticate, isPending: isAuthenticating } = useAuthenticate();
  const signerStatus = useSignerStatus();
  const { client } = useSmartAccountClient({ type: "LightAccount" });
  const { user } = useAuth();
  
  const [accountId, setAccountId] = useState<bigint | null>(null);
  const [isCheckingAccount, setIsCheckingAccount] = useState(false);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  
  // Determine selected address based on source
  const selectedAddress = 
    selectedSource === 'alchemy' ? (address || alchemyAddress) :
    selectedSource === 'internal' ? internalAddress :
    externalAddress;
  
  // UI state derived from wallet source and connection status
  const isAlchemyFlow = selectedSource === 'alchemy';
  const isInternalFlow = selectedSource === 'internal';
  const isExternalFlow = selectedSource === 'external';
  
  // Check if multiple wallet sources are available
  const availableSources = [
    internalAddress ? 'internal' as const : null,
    externalAddress ? 'external' as const : null,
    (alchemyAddress || signerStatus.isConnected) ? 'alchemy' as const : null,
  ].filter(Boolean) as Array<'alchemy' | 'internal' | 'external'>;
  
  const hasMultipleSources = availableSources.length > 1;
  
  const showOTPInput = isAlchemyFlow && signerStatus.status === "AWAITING_EMAIL_AUTH";
  const showEmailInput = isAlchemyFlow && !signerStatus.isConnected && !showOTPInput;
  const showAccountCheck = 
    (isAlchemyFlow && signerStatus.isConnected) || 
    (isInternalFlow && selectedAddress) || 
    (isExternalFlow && selectedAddress);

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

  // Check if user has a Synthetix account when wallet is ready
  useEffect(() => {
    const walletReady = 
      (isAlchemyFlow && signerStatus.isConnected && address) ||
      (isInternalFlow && selectedAddress) ||
      (isExternalFlow && selectedAddress);
      
    if (walletReady) {
      checkForSynthetixAccount();
    }
  }, [signerStatus.isConnected, address, selectedAddress, isAlchemyFlow, isInternalFlow, isExternalFlow]);

  // Load ETH balance for internal wallet on Base
  useEffect(() => {
    const loadEthBalance = async () => {
      if (isInternalFlow && internalAddress) {
        try {
          const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
          const balance = await provider.getBalance(internalAddress);
          const ethAmount = ethers.formatEther(balance);
          setEthBalance(parseFloat(ethAmount).toFixed(4));
        } catch (error) {
          console.error('[SNX Account Setup] Error loading ETH balance:', error);
          setEthBalance(null);
        }
      } else {
        setEthBalance(null);
      }
    };
    
    loadEthBalance();
  }, [isInternalFlow, internalAddress]);

  // Load ETH balance for Alchemy wallet on Base
  useEffect(() => {
    const loadAlchemyBalance = async () => {
      if (isAlchemyFlow && address && !hasGasPolicy) {
        setIsCheckingAlchemyBalance(true);
        try {
          const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
          const balance = await provider.getBalance(address);
          const ethAmount = ethers.formatEther(balance);
          setAlchemyEthBalance(parseFloat(ethAmount).toFixed(4));
        } catch (error) {
          console.error('[SNX Account Setup] Error loading Alchemy ETH balance:', error);
          setAlchemyEthBalance(null);
        } finally {
          setIsCheckingAlchemyBalance(false);
        }
      } else if (hasGasPolicy) {
        setAlchemyEthBalance('sponsored');
      } else {
        setAlchemyEthBalance(null);
      }
    };
    
    loadAlchemyBalance();
  }, [isAlchemyFlow, address, hasGasPolicy]);

  // Re-check for account when user switches wallet sources
  useEffect(() => {
    if (selectedAddress) {
      checkForSynthetixAccount();
    }
  }, [selectedSource, selectedAddress]);

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
    // Use selected address from current wallet source
    const addressToCheck = selectedAddress;
    if (!addressToCheck) return;
    
    setIsCheckingAccount(true);
    try {
      // Check for SNX account by wallet address in Supabase
      console.log('[SNX Account Setup] Checking for SNX account:', addressToCheck, 'source:', selectedSource);
      const { data, error } = await supabase
        .from('snx_accounts')
        .select('account_id')
        .eq('wallet_address', addressToCheck.toLowerCase())
        .eq('chain_id', chainId)
        .maybeSingle();

      if (data && !error) {
        console.log('[SNX Account Setup] Account found in DB:', data.account_id);
        setAccountId(BigInt(data.account_id));
      } else {
        console.log('[SNX Account Setup] No account in DB, checking on-chain...');
        
        // Fallback: Check on-chain if not found in database
        const onChainAccountId = await snxAccountService.checkForAccount(addressToCheck, chainId);
        
        if (onChainAccountId) {
          console.log('[SNX Account Setup] Account found on-chain:', onChainAccountId);
          setAccountId(onChainAccountId);
          // The service already stored it in DB
        } else {
          console.log('[SNX Account Setup] No account found');
          setAccountId(null);
        }
      }
    } catch (error) {
      console.error('[SNX Account Setup] Error checking for Synthetix account:', error);
      setAccountId(null);
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
    // Internal wallet flow - prompt for password
    if (isInternalFlow) {
      setNeedsPassword(true);
      return;
    }

    // Alchemy wallet flow
    if (isAlchemyFlow) {
      if (!address || !client) {
        toast.error('Wallet not connected');
        return;
      }

      setIsCreatingAccount(true);
      try {
        console.log('[SNX Account Setup] Creating Synthetix account with Alchemy wallet...');
        
        // Use Account Kit's native signer via window.ethereum (provided by Account Kit)
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
        handleAccountCreationError(error);
      } finally {
        setIsCreatingAccount(false);
      }
      return;
    }

    // External wallet flow (MetaMask)
    if (isExternalFlow) {
      if (!window.ethereum) {
        toast.error('MetaMask not detected');
        return;
      }

      setIsCreatingAccount(true);
      try {
        console.log('[SNX Account Setup] Creating Synthetix account with external wallet...');
        
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
        handleAccountCreationError(error);
      } finally {
        setIsCreatingAccount(false);
      }
    }
  };

  const handleAccountCreationError = (error: unknown) => {
    let errorMessage = 'Failed to create account';
    let showSwitchToInternal = false;
    
    if (error instanceof Error) {
      if (error.message.includes('gas') || error.message.includes('insufficient funds')) {
        errorMessage = 'Insufficient funds for gas';
        // Suggest switching to internal wallet if available and not already using it
        if (internalAddress && selectedSource !== 'internal') {
          showSwitchToInternal = true;
          errorMessage += '. Try using your Internal Wallet instead.';
        } else if (!hasGasPolicy && isAlchemyFlow) {
          errorMessage += '. Please fund your Alchemy wallet with ETH on Base.';
        }
      } else if (error.message.includes('user rejected')) {
        errorMessage = 'Transaction cancelled';
      } else {
        errorMessage = error.message;
      }
    }
    
    toast.error(errorMessage, {
      duration: showSwitchToInternal ? 8000 : 4000,
      action: showSwitchToInternal && internalAddress ? {
        label: 'Switch to Internal',
        onClick: () => setSelectedSource('internal')
      } : undefined
    });
  };

  const handleCreateWithInternalWallet = async () => {
    if (!walletPassword) {
      toast.error('Password required');
      return;
    }

    if (!user) {
      toast.error('User not authenticated');
      return;
    }

    setIsCreatingAccount(true);
    setNeedsPassword(false);
    
    try {
      console.log('[SNX Account Setup] Creating account with internal wallet...');
      
      // Get private key from internal wallet
      const privateKey = await secureWalletService.revealPrivateKey(user.id, walletPassword);
      
      // Create signer connected to Base network
      const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
      const wallet = new ethers.Wallet(privateKey, provider);
      
      console.log('[SNX Account Setup] Using internal wallet:', wallet.address);
      
      toast.info('Creating your Synthetix account...', { duration: 2000 });
      
      // Create Synthetix account
      const result = await snxAccountService.createAccount(wallet, chainId);
      
      if (result.success && result.accountId) {
        toast.success('Trading account created successfully!');
        setAccountId(result.accountId);
        console.log('[SNX Account Setup] Account created:', result.accountId);
        setWalletPassword(''); // Clear password
      } else {
        toast.error(result.error || 'Failed to create account');
      }
    } catch (error) {
      console.error('[SNX Account Setup] Account creation error:', error);
      
      let errorMessage = 'Failed to create account';
      if (error instanceof Error) {
        if (error.message.includes('password') || error.message.includes('decrypt')) {
          errorMessage = 'Invalid password';
        } else if (error.message.includes('gas')) {
          errorMessage = 'Insufficient ETH for gas fees';
        } else if (error.message.includes('insufficient funds')) {
          errorMessage = 'Insufficient ETH balance';
        } else {
          errorMessage = error.message;
        }
      }
      
      toast.error(errorMessage);
      setNeedsPassword(true); // Show password prompt again
    } finally {
      setIsCreatingAccount(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Synthetix Trading Account</CardTitle>
        <CardDescription>
          {isAlchemyFlow && 'Sign in with email to access perpetual futures trading'}
          {isInternalFlow && 'Create your trading account using your secure internal wallet'}
          {isExternalFlow && 'Create your trading account with your connected wallet'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Wallet Selector - Show if multiple sources available */}
        {hasMultipleSources && !needsPassword && (
          <div className="space-y-3">
            <Label>Select Wallet</Label>
            <div className="flex gap-2">
              {availableSources.map((source) => (
                <Button
                  key={source}
                  variant={selectedSource === source ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedSource(source)}
                  className="flex-1"
                  disabled={isCreatingAccount}
                >
                  {source === 'internal' && '🔒 Internal'}
                  {source === 'external' && '🦊 External'}
                  {source === 'alchemy' && '✉️ Email'}
                </Button>
              ))}
            </div>
            
            {/* Show wallet address and ETH balance for selected source */}
            {selectedAddress && (
              <div className="text-sm space-y-1 p-3 bg-muted rounded-lg">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Address:</span>
                  <code className="text-xs">{selectedAddress.slice(0, 6)}...{selectedAddress.slice(-4)}</code>
                </div>
                
                {isInternalFlow && ethBalance !== null && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ETH on Base:</span>
                    <span className={parseFloat(ethBalance) > 0 ? "text-green-600 dark:text-green-400 font-semibold" : "text-red-600 dark:text-red-400"}>
                      {ethBalance} ETH
                    </span>
                  </div>
                )}
                
                {isAlchemyFlow && hasGasPolicy && (
                  <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                    <Sparkles className="h-3 w-3" />
                    <span className="font-semibold">Gas Sponsored</span>
                  </div>
                )}
                
                {isAlchemyFlow && !hasGasPolicy && alchemyEthBalance !== null && alchemyEthBalance !== 'sponsored' && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ETH on Base:</span>
                    <span className={parseFloat(alchemyEthBalance) >= 0.001 ? "text-green-600 dark:text-green-400 font-semibold" : "text-red-600 dark:text-red-400"}>
                      {alchemyEthBalance} ETH
                    </span>
                  </div>
                )}
                
                {isInternalFlow && ethBalance !== null && parseFloat(ethBalance) === 0 && (
                  <Alert className="mt-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      No ETH on Base network. You'll need ETH for gas fees to create an account.
                    </AlertDescription>
                  </Alert>
                )}
                
                {isAlchemyFlow && !hasGasPolicy && alchemyEthBalance !== null && alchemyEthBalance !== 'sponsored' && parseFloat(alchemyEthBalance) < 0.001 && (
                  <Alert variant="destructive" className="mt-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      <p className="font-semibold">⚠️ Insufficient ETH</p>
                      <p className="mt-1">
                        You need ~0.001 ETH on Base to create your trading account.
                        {internalAddress && ' Switch to Internal Wallet or fund your Alchemy wallet.'}
                      </p>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </div>
        )}
        
        {/* Password prompt for internal wallet */}
        {isInternalFlow && needsPassword && (
          <div className="space-y-4">
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                <strong>Secure Wallet Authentication</strong>
                <div className="text-sm mt-2">
                  Enter your wallet password to create your trading account using your internal wallet (which has ETH for gas).
                </div>
              </AlertDescription>
            </Alert>
            
            <div className="space-y-2">
              <Label htmlFor="wallet-password">Wallet Password</Label>
              <Input
                id="wallet-password"
                type="password"
                placeholder="Enter your wallet password"
                value={walletPassword}
                onChange={(e) => setWalletPassword(e.target.value)}
                disabled={isCreatingAccount}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && walletPassword) {
                    handleCreateWithInternalWallet();
                  }
                }}
              />
            </div>
            
            <div className="flex gap-2">
              <Button
                onClick={handleCreateWithInternalWallet}
                disabled={!walletPassword || isCreatingAccount}
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
                onClick={() => {
                  setNeedsPassword(false);
                  setWalletPassword('');
                }}
                disabled={isCreatingAccount}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Show email/OTP flow only for Alchemy wallet */}
        {isAlchemyFlow && showEmailInput && (
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

        {isAlchemyFlow && showOTPInput && (
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
                    <div>Wallet: <code>{selectedAddress?.slice(0, 6)}...{selectedAddress?.slice(-4)}</code></div>
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
                    Connected wallet: <code className="text-xs">{selectedAddress?.slice(0, 6)}...{selectedAddress?.slice(-4)}</code>
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

        {/* Info footer based on wallet source */}
        {isAlchemyFlow && (
          <Alert>
            <AlertDescription className="text-xs text-muted-foreground">
              <strong>Powered by Alchemy Account Kit</strong>
              <div className="mt-1">
                Email authentication with embedded smart wallet for gasless trading
              </div>
            </AlertDescription>
          </Alert>
        )}
        
        {isInternalFlow && !needsPassword && (
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription className="text-xs text-muted-foreground">
              <strong>Using Your Secure Internal Wallet</strong>
              <div className="mt-1">
                Your trading account will be created using your internal wallet which has ETH for gas fees.
              </div>
            </AlertDescription>
          </Alert>
        )}
        
        {isExternalFlow && (
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription className="text-xs text-muted-foreground">
              <strong>Using Your External Wallet</strong>
              <div className="mt-1">
                MetaMask will prompt you to sign the account creation transaction. You'll need ETH for gas fees.
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
