/**
 * Synthetix Account Setup with Alchemy Integration
 * Creates trading accounts using Alchemy's embedded wallet system
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ExternalLink, Loader2, Mail, Key, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { AlchemyAccountProvider, useAccount, useAuthenticate, useSignerStatus, useUser } from "@account-kit/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { alchemyConfig } from "@/lib/alchemy/config";
import { supabase } from "@/integrations/supabase/client";

interface SnxAccountSetupProps {
  chainId: number;
  onAccountCreated: (accountId: bigint) => void;
}

const queryClient = new QueryClient();

function SnxAccountSetupInner({ chainId, onAccountCreated }: SnxAccountSetupProps) {
  const [email, setEmail] = useState("");
  const { address } = useAccount({ type: "LightAccount" });
  const { authenticate, isPending: isAuthenticating } = useAuthenticate();
  const signerStatus = useSignerStatus();
  const user = useUser();
  
  const [accountId, setAccountId] = useState<bigint | null>(null);
  const [isCheckingAccount, setIsCheckingAccount] = useState(false);

  // Use multiple signals for authentication state
  const isFullyAuthenticated = signerStatus.isConnected && !!address && !!user;

  // Debug authentication state
  useEffect(() => {
    console.log('[SnxAccountSetup] Auth state changed:', {
      isConnected: signerStatus.isConnected,
      hasAddress: !!address,
      hasUser: !!user,
      isFullyAuthenticated,
      address: address?.slice(0, 10),
    });
  }, [signerStatus.isConnected, address, user, isFullyAuthenticated]);

  // Check for Synthetix account when fully authenticated
  useEffect(() => {
    if (isFullyAuthenticated && address) {
      console.log('[SnxAccountSetup] Fully authenticated, checking for account...');
      checkForSynthetixAccount();
    }
  }, [isFullyAuthenticated, address]);

  // Notify parent when account is found
  useEffect(() => {
    if (accountId) {
      onAccountCreated(accountId);
    }
  }, [accountId]);

  const checkForSynthetixAccount = async () => {
    if (!address) {
      console.log('[SnxAccountSetup] Cannot check account - no address');
      return;
    }
    
    console.log('[SnxAccountSetup] Checking for Synthetix account...', { address });
    setIsCheckingAccount(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        console.log('[SnxAccountSetup] No Supabase user found');
        return;
      }

      const { data, error } = await supabase
        .from('snx_accounts')
        .select('account_id')
        .eq('user_id', authData.user.id)
        .eq('chain_id', chainId)
        .single();

      if (data && !error) {
        console.log('[SnxAccountSetup] Account found:', data.account_id);
        setAccountId(BigInt(data.account_id));
        toast.success('Synthetix account found!');
      } else {
        console.log('[SnxAccountSetup] No account found');
        setAccountId(null);
      }
    } catch (error) {
      console.error('[SnxAccountSetup] Error checking for Synthetix account:', error);
    } finally {
      setIsCheckingAccount(false);
    }
  };

  const handleEmailLogin = async () => {
    if (!email) {
      toast.error("Please enter your email");
      return;
    }
    try {
      await authenticate({ type: "email", email });
      toast.success('Check your email for the login link');
    } catch (error) {
      toast.error('Failed to send login email');
      console.error('Email auth error:', error);
    }
  };

  const handlePasskeyLogin = async () => {
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
    toast.info('Create your account on Synthetix Exchange, then come back and refresh');
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Synthetix Trading Account</CardTitle>
        <CardDescription>
          Sign in with email or passkey to access Synthetix perpetuals trading
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isFullyAuthenticated ? (
          <>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                <strong>New Authentication System</strong>
                <div className="mt-1">
                  Synthetix now uses Alchemy Account Kit for gasless trading with email/passkey authentication.
                </div>
              </AlertDescription>
            </Alert>

            {/* Email Login */}
            <div className="space-y-2">
              <Input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isAuthenticating}
                onKeyDown={(e) => e.key === 'Enter' && handleEmailLogin()}
              />
              <Button 
                onClick={handleEmailLogin}
                disabled={isAuthenticating || !email}
                className="w-full"
              >
                {isAuthenticating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Sign in with Email
                  </>
                )}
              </Button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or</span>
              </div>
            </div>

            {/* Passkey Login */}
            <Button 
              onClick={handlePasskeyLogin}
              disabled={isAuthenticating}
              variant="outline"
              className="w-full"
            >
              <Key className="mr-2 h-4 w-4" />
              Sign in with Passkey
            </Button>
          </>
        ) : (
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
                <CheckCircle className="h-4 w-4 text-green-500" />
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
                    <strong>No Synthetix Account Found</strong>
                  </div>
                  <div className="text-sm">
                    Connected wallet: <code className="text-xs">{address?.slice(0, 6)}...{address?.slice(-4)}</code>
                  </div>
                  <div className="text-sm">
                    You need to create a Synthetix trading account on their exchange first.
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={openSynthetixExchange}
                      className="flex-1"
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Create Account
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={checkForSynthetixAccount}
                      disabled={isCheckingAccount}
                    >
                      {isCheckingAccount ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Refresh'
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
              Email/passkey authentication with embedded smart wallet for gasless trading
            </div>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}

export function SnxAccountSetup(props: SnxAccountSetupProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <AlchemyAccountProvider config={alchemyConfig} queryClient={queryClient}>
        <SnxAccountSetupInner {...props} />
      </AlchemyAccountProvider>
    </QueryClientProvider>
  );
}
