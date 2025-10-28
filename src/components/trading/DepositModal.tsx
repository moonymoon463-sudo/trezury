import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useWalletBalance } from '@/hooks/useWalletBalance';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ArrowRight, DollarSign, Zap } from 'lucide-react';
import { ethers } from 'ethers';

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  dydxAddress: string;
  internalAddress?: string;
  externalAddress?: string;
  onDepositComplete: () => void;
}

export const DepositModal = ({
  isOpen,
  onClose,
  dydxAddress,
  internalAddress,
  externalAddress,
  onDepositComplete
}: DepositModalProps) => {
  const [source, setSource] = useState<'internal' | 'external'>('internal');
  const [amount, setAmount] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { balances } = useWalletBalance();

  const usdcBalance = balances.find(b => b.asset === 'USDC')?.amount || 0;

  const handleDeposit = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast({
        variant: 'destructive',
        title: 'Invalid Amount',
        description: 'Please enter a valid amount'
      });
      return;
    }

    if (source === 'internal') {
      if (parseFloat(amount) > usdcBalance) {
        toast({
          variant: 'destructive',
          title: 'Insufficient Balance',
          description: `You only have ${usdcBalance.toFixed(2)} USDC available`
        });
        return;
      }

      if (!password) {
        toast({
          variant: 'destructive',
          title: 'Password Required',
          description: 'Please enter your wallet password'
        });
        return;
      }

      try {
        setLoading(true);

        // Step 1: Verify password BEFORE initiating transfer
        console.log('[DepositModal] Verifying wallet password...');
        const { data: verifyData, error: verifyError } = await supabase.functions.invoke('blockchain-operations', {
          body: {
            operation: 'verify_wallet_password',
            password
          }
        });

        if (verifyError || !verifyData?.ok) {
          console.error('[DepositModal] Password verification failed:', verifyError || verifyData);
          toast({
            variant: 'destructive',
            title: 'Incorrect Wallet Password',
            description: 'This is the password you used when you created or imported your internal wallet. It may be different from your Trading Password.',
            duration: 8000
          });
          setLoading(false);
          return;
        }

        console.log('[DepositModal] Password verified ✅, initiating transfer...');

        // Step 2: Proceed with transfer
        const { data, error } = await supabase.functions.invoke('transfer-to-dydx', {
          body: {
            amount: parseFloat(amount),
            password,
            destinationAddress: dydxAddress
          }
        });

        if (error) throw error;

      toast({
        title: '⚡ Gasless Deposit Initiated',
        description: (
          <div>
            <p>Bridging {amount} USDC to dYdX (gasless!)</p>
            <p className="text-xs mt-1 text-[#c6b795]">
              Est. arrival: <span className="font-semibold text-white">&lt;20 seconds</span>
            </p>
            <p className="text-xs mt-1 text-[#c6b795]">
              ⚡ Powered by Squid Router + Gelato
            </p>
            {data?.axelarTrackingUrl && (
              <a 
                href={data.axelarTrackingUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-[#e6b951] underline text-xs mt-1 block"
              >
                Track on Axelar →
              </a>
            )}
          </div>
        ),
        duration: 8000
      });

      setAmount('');
      setPassword('');
      onDepositComplete();
      onClose();
      } catch (error: any) {
        console.error('Deposit failed:', error);
        
        // Parse structured error from edge function
        const errorCode = error?.error || error?.message;
        
        if (errorCode === 'SQUID_API_UNREACHABLE') {
          toast({
            variant: 'destructive',
            title: 'Bridging Service Unavailable',
            description: 'Unable to connect to Squid Router. Please check your internet connection or try again in a few moments.',
            duration: 6000
          });
        } else if (errorCode === 'WALLET_DECRYPTION_FAILED' || error.message?.includes('Invalid wallet password')) {
          toast({
            variant: 'destructive',
            title: 'Incorrect Wallet Password',
            description: 'This is the password you used when creating or importing your internal wallet, not your trading password.',
            duration: 8000
          });
        } else if (errorCode === 'SQUID_ROUTE_ERROR') {
          toast({
            variant: 'destructive',
            title: 'Bridge Route Error',
            description: error.hint || 'Failed to get bridge route. Please try again or contact support.',
            duration: 6000
          });
        } else {
          toast({
            variant: 'destructive',
            title: 'Deposit Failed',
            description: error.message || 'Failed to initiate deposit'
          });
        }
      } finally {
        setLoading(false);
      }
    } else {
      // External wallet - show instruction
      toast({
        title: 'External Deposit',
        description: 'Please send USDC from your external wallet to the trading wallet address',
        duration: 5000
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[480px] bg-[#2a251a] border-[#463c25]">
        <DialogHeader>
          <DialogTitle className="text-white text-xl">Deposit to Trading Wallet</DialogTitle>
          <DialogDescription className="text-[#c6b795]">
            Transfer USDC from your wallet to start trading
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Gasless Badge */}
          {source === 'internal' && (
            <Alert className="bg-[#e6b951]/10 border-[#e6b951]/20">
              <Zap className="h-4 w-4 text-[#e6b951]" />
              <AlertDescription className="ml-2">
                <div className="text-sm font-semibold text-white">
                  ⚡ Gasless Transaction - No ETH Required!
                </div>
                <div className="text-xs text-[#c6b795] mt-1">
                  Gas fees sponsored by Trezury via Gelato Paymaster
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Source Wallet Selection */}
          <div className="space-y-3">
            <Label className="text-[#c6b795] text-sm font-medium">From Wallet</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setSource('internal')}
                disabled={!internalAddress}
                className={`p-4 rounded-lg border-2 transition-all ${
                  source === 'internal'
                    ? 'border-[#e6b951] bg-[#e6b951]/10'
                    : 'border-[#463c25] bg-[#211d12] hover:border-[#635636]'
                } ${!internalAddress ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="text-white font-semibold mb-1">Internal Wallet</div>
                <div className="text-[#c6b795] text-xs">
                  {usdcBalance.toFixed(2)} USDC
                </div>
              </button>
              
              <button
                onClick={() => setSource('external')}
                disabled={!externalAddress}
                className={`p-4 rounded-lg border-2 transition-all ${
                  source === 'external'
                    ? 'border-[#e6b951] bg-[#e6b951]/10'
                    : 'border-[#463c25] bg-[#211d12] hover:border-[#635636]'
                } ${!externalAddress ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="text-white font-semibold mb-1">External Wallet</div>
                <div className="text-[#c6b795] text-xs">
                  {externalAddress ? `${externalAddress.slice(0, 6)}...${externalAddress.slice(-4)}` : 'Not connected'}
                </div>
              </button>
            </div>
          </div>

          {/* Flow Indicator */}
          <div className="flex items-center justify-center gap-3 py-2">
            <div className="text-[#c6b795] text-sm font-medium">
              {source === 'internal' ? 'Internal' : 'External'}
            </div>
            <ArrowRight className="h-5 w-5 text-[#e6b951]" />
            <div className="text-white text-sm font-semibold">Trading Wallet</div>
          </div>

          {/* Amount Input */}
          <div className="space-y-2">
            <Label htmlFor="deposit-amount" className="text-[#c6b795] text-sm font-medium">
              Amount (USDC)
            </Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#c6b795]" />
              <Input
                id="deposit-amount"
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="0"
                step="0.01"
                className="pl-9 bg-[#211d12] border-[#463c25] text-white placeholder:text-[#c6b795]/50 focus:border-[#e6b951]"
              />
            </div>
            {source === 'internal' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAmount(usdcBalance.toString())}
                className="text-[#e6b951] hover:text-white hover:bg-[#463c25] text-xs"
              >
                Use Max ({usdcBalance.toFixed(2)} USDC)
              </Button>
            )}
          </div>

          {/* Password Input (only for internal) */}
          {source === 'internal' && (
            <div className="space-y-2">
              <Label htmlFor="deposit-password" className="text-[#c6b795] text-sm font-medium">
                Wallet Password
              </Label>
              <Input
                id="deposit-password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-[#211d12] border-[#463c25] text-white placeholder:text-[#c6b795]/50 focus:border-[#e6b951]"
              />
            </div>
          )}

          {/* Action Button */}
          <Button
            onClick={handleDeposit}
            disabled={loading || !amount || (source === 'internal' && !password)}
            className="w-full h-12 bg-[#e6b951] hover:bg-[#d4a840] text-black font-bold text-base"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                Deposit {amount || '0.00'} USDC
              </>
            )}
          </Button>

          {/* Info Text */}
          <p className="text-[#c6b795] text-xs text-center">
            {source === 'internal' 
              ? '⚡ Powered by Squid Router + Gelato - Cross-chain bridging via Axelar (<20 sec, gasless!)'
              : 'Send USDC from your external wallet to complete deposit'}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
