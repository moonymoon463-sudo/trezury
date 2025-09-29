import { useState, useEffect } from 'react';
import { ArrowLeft, Copy, QrCode, CheckCircle, Clock, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { walletService } from '@/services/wallet';
import { OnchainAddress, Deposit } from '@/services/providers/types';

export default function FundingMethods() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [depositAddress, setDepositAddress] = useState<OnchainAddress | null>(null);
  const [recentDeposits, setRecentDeposits] = useState<Deposit[]>([]);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (user) {
      loadDepositData();
    }
  }, [user]);

  const loadDepositData = async () => {
    try {
      setLoading(true);
      const address = await walletService.getOrCreateDepositAddress(user!.id);
      setDepositAddress(address);

      // Generate QR code
      const qrUrl = await QRCode.toDataURL(address.address);
      setQrCodeUrl(qrUrl);

      const deposits = await walletService.getRecentDeposits(user!.id);
      setRecentDeposits(deposits);
    } catch (error) {
      console.error('Failed to load deposit data:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load deposit information',
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (depositAddress) {
      try {
        await navigator.clipboard.writeText(depositAddress.address);
        toast({
          title: 'Copied!',
          description: 'Deposit address copied to clipboard',
        });
      } catch (error) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to copy address',
        });
      }
    }
  };

  const handleConfirmDeposit = async () => {
    try {
      setConfirming(true);
      // In a real implementation, this would open a modal to input transaction hash
      // For now, we'll create a placeholder entry
      await walletService.confirmDeposit(user!.id, 'placeholder-tx-hash');
      await loadDepositData(); // Refresh the deposits list
      toast({
        title: 'Deposit Confirmed',
        description: 'Your deposit has been submitted for verification',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to confirm deposit',
      });
    } finally {
      setConfirming(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1C1C1E] p-4">
        <div className="mx-auto max-w-lg md:max-w-2xl">
          <div className="flex items-center gap-4 mb-6">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate(-1)}
              className="text-white hover:bg-gray-800"
            >
              <ArrowLeft className="h-6 w-6" />
            </Button>
            <div className="flex-1 flex justify-center pr-10">
              <div className="text-white font-bold text-lg">TREZURY</div>
            </div>
          </div>
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#f9b006]"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1C1C1E] p-4">
      <div className="mx-auto max-w-lg md:max-w-2xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate(-1)}
            className="text-white hover:bg-gray-800"
          >
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <div className="flex-1 flex justify-center pr-10">
            <div className="text-white font-bold text-lg">TREZURY</div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="usdc" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="usdc">USDC Deposit</TabsTrigger>
            <TabsTrigger value="card" disabled className="opacity-50">
              Card (coming soon)
            </TabsTrigger>
          </TabsList>

          <TabsContent value="usdc" className="space-y-6 mt-6">
            {/* USDC Deposit Address */}
            <Card>
              <CardContent className="p-6">
                <div className="text-center space-y-4">
                  {/* QR Code */}
                  <div className="flex justify-center">
                    {qrCodeUrl && (
                      <img 
                        src={qrCodeUrl} 
                        alt="Deposit Address QR Code" 
                        className="w-48 h-48 border border-border rounded-lg"
                      />
                    )}
                  </div>

                  {/* Address */}
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Your USDC Deposit Address</p>
                    <div className="bg-muted p-3 rounded-lg">
                      <p className="text-sm font-mono text-foreground break-all">
                        {depositAddress?.address}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={copyToClipboard}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy Address
                    </Button>
                  </div>

                  <div className="text-left space-y-2">
                    <h3 className="font-medium text-foreground">Instructions:</h3>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Send USDC on Base network to this address</li>
                      <li>• Minimum deposit: $10 USDC</li>
                      <li>• Deposits usually confirm within 2-3 minutes</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Confirm Deposit Section */}
            <Card>
              <CardContent className="p-6">
                <h3 className="font-medium text-foreground mb-4">Confirm Deposit</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Already sent USDC? Click below to check for your deposit.
                </p>
                <Button 
                  className="w-full" 
                  onClick={handleConfirmDeposit}
                  disabled={confirming}
                >
                  {confirming ? 'Checking...' : "I've sent USDC"}
                </Button>
              </CardContent>
            </Card>

            {/* Recent Deposits */}
            <Card>
              <CardContent className="p-6">
                <h3 className="font-medium text-foreground mb-4">Recent Deposits</h3>
                {recentDeposits.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No deposits yet
                  </p>
                ) : (
                  <div className="space-y-3">
                    {recentDeposits.map((deposit) => (
                      <div key={deposit.id} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                        <div className="flex items-center gap-3">
                          {getStatusIcon(deposit.status)}
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {formatAmount(deposit.amount)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(deposit.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs capitalize text-muted-foreground">
                            {deposit.status}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}