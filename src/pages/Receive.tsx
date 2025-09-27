import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Copy, Check, QrCode, ArrowLeft, RefreshCw } from "lucide-react";
import StandardHeader from "@/components/StandardHeader";
import BottomNavigation from "@/components/BottomNavigation";
import { useSecureWallet } from "@/hooks/useSecureWallet";
import { useToast } from "@/hooks/use-toast";
import { useTransactionTracker } from "@/hooks/useTransactionTracker";
import { cn } from "@/lib/utils";

const Receive = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { getWalletAddress } = useSecureWallet();
  const { activities, fetchAllActivity } = useTransactionTracker();
  
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const loadWalletAddress = async () => {
      const address = await getWalletAddress();
      if (address) {
        setWalletAddress(address);
        // Generate QR code URL
        setQrCodeUrl(`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${address}`);
      }
    };
    loadWalletAddress();
  }, [getWalletAddress]);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      toast({
        title: "Address Copied",
        description: "Wallet address has been copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Copy Failed",
        description: "Failed to copy address to clipboard",
      });
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchAllActivity();
      toast({
        title: "Refreshed",
        description: "Transaction history updated",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Refresh Failed",
        description: "Failed to refresh transaction history",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const formatAddress = (address: string) => {
    if (!address) return "";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const recentReceives = activities
    .filter(activity => 
      activity.type === 'receive' || 
      (activity.type === 'deposit' && activity.status === 'completed')
    )
    .slice(0, 5);

  return (
    <div className="min-h-[100dvh] w-full overflow-x-hidden bg-background">
      <StandardHeader 
        title="Receive Tokens"
        showBackButton
        onBack={() => navigate("/")}
      />

      <div className="container mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8 pb-[calc(var(--bottom-nav-height,56px)+env(safe-area-inset-bottom)+1rem)] pt-2 space-y-4">
        {/* Wallet Address Section */}
        <div className="bg-surface-elevated rounded-xl p-4 space-y-4 max-w-full">
          <div className="text-center space-y-4">
            <h3 className="text-foreground text-lg sm:text-xl font-bold">Your Wallet Address</h3>
            
            {qrCodeUrl && (
              <div className="flex justify-center">
                <div className="bg-white p-2 sm:p-4 rounded-lg max-w-full">
                  <img 
                    src={qrCodeUrl} 
                    alt="Wallet Address QR Code"
                    className="w-32 sm:w-48 lg:w-56 h-auto max-w-full"
                  />
                </div>
              </div>
            )}

            <div className="bg-background rounded-lg p-3 space-y-3 max-w-full">
              <div className="font-mono text-xs sm:text-sm text-foreground break-all overflow-wrap-anywhere">
                {walletAddress || "Loading..."}
              </div>
              
              <Button
                onClick={copyToClipboard}
                variant="outline"
                className="w-full"
                disabled={!walletAddress}
              >
                {copied ? (
                  <div className="flex items-center gap-2">
                    <Check size={16} className="text-green-500" />
                    Copied!
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Copy size={16} />
                    Copy Address
                  </div>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-surface-elevated rounded-xl p-4 max-w-full">
          <h4 className="text-foreground font-semibold mb-3 text-base sm:text-lg">How to Receive Tokens</h4>
          <div className="space-y-2 text-sm sm:text-base text-muted-foreground">
            <div className="flex items-start gap-2">
              <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mt-0.5">1</span>
              <span>Share your wallet address or QR code with the sender</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mt-0.5">2</span>
              <span>Ensure they send supported tokens (USDC, XAUT) on Ethereum network</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mt-0.5">3</span>
              <span>Tokens will appear in your wallet after blockchain confirmation</span>
            </div>
          </div>
        </div>

        {/* Supported Assets */}
        <div className="bg-surface-elevated rounded-xl p-4">
          <h4 className="text-foreground font-semibold mb-3">Supported Assets</h4>
          <div className="space-y-2">
            <div className="flex items-center gap-3 p-2 rounded-lg bg-background">
              <span className="text-lg">💲</span>
              <div>
                <div className="font-medium">USDC</div>
                <div className="text-xs text-muted-foreground">USD Coin</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-2 rounded-lg bg-background">
              <span className="text-lg">🥇</span>
              <div>
                <div className="font-medium">XAUT</div>
                <div className="text-xs text-muted-foreground">Tether Gold</div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Incoming Transactions */}
        {recentReceives.length > 0 && (
          <div className="bg-surface-elevated rounded-xl p-4">
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-foreground font-semibold">Recent Incoming</h4>
              <Button
                onClick={handleRefresh}
                variant="ghost"
                size="sm"
                disabled={isRefreshing}
              >
                <RefreshCw size={14} className={cn(isRefreshing && "animate-spin")} />
              </Button>
            </div>
            <div className="space-y-2">
              {recentReceives.map((activity, index) => (
                <div key={index} className="flex justify-between items-center p-2 rounded-lg bg-background">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-green-500/10 rounded-full flex items-center justify-center">
                      <span className="text-green-500 text-xs">↓</span>
                    </div>
                    <div>
                  <div className="text-sm font-medium">
                    +{parseFloat(activity.quantity?.toString() || "0").toFixed(4)} {activity.asset}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(activity.timestamp).toLocaleDateString()}
                  </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-green-500 font-medium">Received</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <Alert>
          <QrCode className="h-4 w-4" />
          <AlertDescription>
            Only send tokens to this address on the Ethereum network. 
            Sending tokens on other networks may result in permanent loss.
          </AlertDescription>
        </Alert>
      </div>

      <BottomNavigation />
    </div>
  );
};

export default Receive;