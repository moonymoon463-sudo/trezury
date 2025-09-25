import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Send as SendIcon, AlertTriangle, Copy, Check } from "lucide-react";
import StandardHeader from "@/components/StandardHeader";
import BottomNavigation from "@/components/BottomNavigation";
import { useWalletBalance } from "@/hooks/useWalletBalance";
import { useSecureWallet } from "@/hooks/useSecureWallet";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const Send = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { getBalance, refreshBalances } = useWalletBalance();
  const { signTransaction, getWalletAddress } = useSecureWallet();
  
  const [asset, setAsset] = useState<string>("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [estimatedFee, setEstimatedFee] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [senderAddress, setSenderAddress] = useState<string>("");

  const assets = [
    { value: "USDC", label: "USDC", icon: "💲" },
    { value: "XAUT", label: "Gold (XAUT)", icon: "🥇" },
  ];

  useEffect(() => {
    const loadSenderAddress = async () => {
      const address = await getWalletAddress();
      if (address) {
        setSenderAddress(address);
      }
    };
    loadSenderAddress();
  }, [getWalletAddress]);

  const validateForm = () => {
    const newErrors: {[key: string]: string} = {};
    
    if (!asset) {
      newErrors.asset = "Please select an asset to send";
    }
    
    if (!recipientAddress) {
      newErrors.recipient = "Recipient address is required";
    } else if (!/^0x[a-fA-F0-9]{40}$/.test(recipientAddress)) {
      newErrors.recipient = "Invalid Ethereum address format";
    } else if (recipientAddress.toLowerCase() === senderAddress.toLowerCase()) {
      newErrors.recipient = "Cannot send to your own address";
    }
    
    if (!amount || parseFloat(amount) <= 0) {
      newErrors.amount = "Please enter a valid amount";
    } else {
      const balance = getBalance(asset);
      const sendAmount = parseFloat(amount);
      const totalNeeded = sendAmount + estimatedFee;
      
      if (totalNeeded > balance) {
        newErrors.amount = `Insufficient balance. Available: ${balance.toFixed(4)} ${asset}`;
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const estimateFee = async () => {
    if (!asset || !amount) return;
    
    try {
      const response = await supabase.functions.invoke('blockchain-operations', {
        body: {
          operation: 'estimate_gas',
          asset,
          amount: parseFloat(amount)
        }
      });
      
      if (response.data?.fee_in_token) {
        setEstimatedFee(response.data.fee_in_token);
      } else {
        setEstimatedFee(0.01); // Fallback estimate
      }
    } catch (error) {
      console.error('Error estimating fee:', error);
      setEstimatedFee(0.01); // Fallback estimate
    }
  };

  useEffect(() => {
    if (asset && amount) {
      estimateFee();
    }
  }, [asset, amount]);

  const handleSend = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      const response = await supabase.functions.invoke('blockchain-operations', {
        body: {
          operation: 'transfer',
          asset,
          to_address: recipientAddress,
          amount: parseFloat(amount),
          from_address: senderAddress
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      await refreshBalances();
      
      toast({
        title: "Transfer Initiated",
        description: `Sending ${amount} ${asset} to ${recipientAddress.slice(0, 6)}...${recipientAddress.slice(-4)}`,
      });

      navigate("/transactions");
    } catch (error) {
      console.error('Send error:', error);
      toast({
        variant: "destructive",
        title: "Transfer Failed",
        description: error instanceof Error ? error.message : "An error occurred during the transfer",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatBalance = (assetSymbol: string) => {
    const balance = getBalance(assetSymbol);
    return balance.toFixed(4);
  };

  return (
    <div className="relative flex h-screen w-full flex-col bg-background">
      <StandardHeader 
        title="Send Tokens"
        showBackButton
        onBack={() => navigate("/")}
      />

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-20 space-y-4">
        <div className="bg-surface-elevated rounded-xl p-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="asset">Select Asset</Label>
            <Select value={asset} onValueChange={setAsset}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose asset to send" />
              </SelectTrigger>
              <SelectContent>
                {assets.map((assetOption) => (
                  <SelectItem key={assetOption.value} value={assetOption.value}>
                    <div className="flex items-center gap-2">
                      <span>{assetOption.icon}</span>
                      <span>{assetOption.label}</span>
                      <span className="text-muted-foreground text-xs ml-auto">
                        Balance: {formatBalance(assetOption.value)}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.asset && (
              <p className="text-destructive text-sm">{errors.asset}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="recipient">Recipient Address</Label>
            <Input
              id="recipient"
              placeholder="0x..."
              value={recipientAddress}
              onChange={(e) => setRecipientAddress(e.target.value)}
              className={cn("font-mono", errors.recipient && "border-destructive")}
            />
            {errors.recipient && (
              <p className="text-destructive text-sm">{errors.recipient}</p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label htmlFor="amount">Amount</Label>
              {asset && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const balance = getBalance(asset);
                    const maxSend = Math.max(0, balance - estimatedFee);
                    setAmount(maxSend.toString());
                  }}
                  className="text-xs h-auto p-1"
                >
                  Max: {formatBalance(asset)} {asset}
                </Button>
              )}
            </div>
            <Input
              id="amount"
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={cn(errors.amount && "border-destructive")}
            />
            {errors.amount && (
              <p className="text-destructive text-sm">{errors.amount}</p>
            )}
          </div>

          {estimatedFee > 0 && asset && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Estimated network fee: {estimatedFee.toFixed(6)} {asset}
                <br />
                Total deducted: {(parseFloat(amount || "0") + estimatedFee).toFixed(6)} {asset}
              </AlertDescription>
            </Alert>
          )}

          <Button
            onClick={handleSend}
            disabled={isLoading || !asset || !recipientAddress || !amount}
            className="w-full bg-primary hover:bg-primary/90"
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-background border-t-transparent" />
                Sending...
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <SendIcon size={16} />
                Send {asset || "Tokens"}
              </div>
            )}
          </Button>
        </div>
      </div>

      <BottomNavigation />
    </div>
  );
};

export default Send;