import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, CreditCard, Wallet, QrCode } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useMoonPayBuy } from "@/hooks/useMoonPayBuy";
import BottomNavigation from "@/components/BottomNavigation";
import QRCode from "qrcode";
import { useWalletBalance } from "@/hooks/useWalletBalance";
import AurumLogo from "@/components/AurumLogo";

const AddUSDC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { initiateBuy, loading } = useMoonPayBuy();
  const { fetchBalances } = useWalletBalance();
  
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"card" | "crypto">("card");
  const [depositAddress] = useState("0x742d35cc6634c0532925a3b8d7b1295ce8b8e81e"); // ERC20 compatible address
  const [qrCodeUrl, setQrCodeUrl] = useState("");

  const handleAmountChange = (value: string) => {
    // Remove any non-numeric characters except decimal point
    const sanitized = value.replace(/[^0-9.]/g, '');
    
    // Prevent multiple decimal points
    const parts = sanitized.split('.');
    if (parts.length > 2) {
      return;
    }
    
    // Limit to 2 decimal places
    if (parts[1] && parts[1].length > 2) {
      return;
    }
    
    setAmount(sanitized);
  };

  const generateQRCode = async () => {
    try {
      const qrUrl = await QRCode.toDataURL(depositAddress);
      setQrCodeUrl(qrUrl);
    } catch (error) {
      console.error('Failed to generate QR code:', error);
    }
  };

  const handleCreditCardPurchase = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast({
        variant: "destructive",
        title: "Invalid Amount",
        description: "Please enter a valid amount"
      });
      return;
    }

    if (!user) {
      toast({
        variant: "destructive",
        title: "Authentication Required",
        description: "Please sign in to continue"
      });
      return;
    }

    try {
      const result = await initiateBuy({
        amount: parseFloat(amount),
        currency: 'usd',
        walletAddress: depositAddress
      });

      if (result.success && result.redirectUrl) {
        // Open MoonPay in a new window
        const moonPayWindow = window.open(result.redirectUrl, '_blank', 'width=500,height=700');
        
        if (moonPayWindow) {
          // Poll for window closure and refresh balances
          const pollTimer = setInterval(() => {
            if (moonPayWindow.closed) {
              clearInterval(pollTimer);
              fetchBalances();
              toast({
                title: "Purchase Initiated",
                description: "Your USDC purchase is being processed"
              });
              navigate("/");
            }
          }, 1000);
        }
      }
    } catch (error) {
      console.error('Purchase failed:', error);
      toast({
        variant: "destructive",
        title: "Purchase Failed",
        description: "Failed to initiate purchase"
      });
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied!",
        description: "Address copied to clipboard"
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Copy Failed",
        description: "Failed to copy address"
      });
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="p-4">
        <div className="flex items-center">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate("/")}
            className="text-foreground hover:bg-surface-elevated"
          >
            <ArrowLeft size={24} />
          </Button>
          <div className="flex-1 flex justify-center pr-6">
            <AurumLogo compact />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 py-4 space-y-6 overflow-y-auto">
        <div className="max-w-md mx-auto space-y-6">
          {/* Amount Input */}
          <div className="bg-card rounded-xl p-4">
            <h3 className="text-foreground text-lg font-bold mb-4">Enter Amount</h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="amount" className="text-muted-foreground text-sm">Amount (USD)</Label>
                <Input
                  id="amount"
                  type="text"
                  placeholder="100.00"
                  value={amount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  className="text-lg font-semibold bg-surface-elevated border-border text-foreground mt-2"
                />
              </div>
              
              {/* Quick Amount Buttons */}
              <div className="grid grid-cols-4 gap-2">
                {[50, 100, 250, 500].map((quickAmount) => (
                  <Button
                    key={quickAmount}
                    variant="outline"
                    size="sm"
                    onClick={() => setAmount(quickAmount.toString())}
                    className="text-sm"
                  >
                    ${quickAmount}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Payment Method Selection */}
          <div className="bg-card rounded-xl p-4">
            <h3 className="text-foreground text-lg font-bold mb-4">Payment Method</h3>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant={paymentMethod === "card" ? "default" : "outline"}
                onClick={() => setPaymentMethod("card")}
                className="flex flex-col items-center gap-2 h-16"
              >
                <CreditCard size={20} />
                <span className="text-sm">Credit Card</span>
              </Button>
              <Button
                variant={paymentMethod === "crypto" ? "default" : "outline"}
                onClick={() => {
                  setPaymentMethod("crypto");
                  generateQRCode();
                }}
                className="flex flex-col items-center gap-2 h-16"
              >
                <Wallet size={20} />
                <span className="text-sm">Crypto Transfer</span>
              </Button>
            </div>
          </div>

          {/* Credit Card Payment */}
          {paymentMethod === "card" && (
            <div className="bg-card rounded-xl p-4">
              <h3 className="text-foreground text-lg font-bold mb-4 flex items-center gap-2">
                <CreditCard size={20} />
                Credit Card Payment
              </h3>
              <div className="space-y-4">
                <div className="bg-surface-elevated p-4 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-2">
                    You'll be redirected to MoonPay to complete your purchase securely.
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Instant USDC delivery</li>
                    <li>• Bank-grade security</li>
                    <li>• Support for major cards</li>
                  </ul>
                </div>
                
                <Button 
                  onClick={handleCreditCardPurchase}
                  disabled={loading || !amount || parseFloat(amount) <= 0}
                  className="w-full h-12 font-bold"
                >
                  {loading ? "Processing..." : `Buy $${amount || "0"} USDC`}
                </Button>
              </div>
            </div>
          )}

          {/* Crypto Transfer */}
          {paymentMethod === "crypto" && (
            <div className="bg-card rounded-xl p-4">
              <h3 className="text-foreground text-lg font-bold mb-4 flex items-center gap-2">
                <QrCode size={20} />
                Crypto Transfer
              </h3>
              <div className="space-y-4">
                <div className="text-center space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Send ERC20 tokens to this Ethereum address:
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    (Supports USDC and GOLD ERC20 tokens)
                  </p>
                  
                  {qrCodeUrl && (
                    <div className="flex justify-center">
                      <img src={qrCodeUrl} alt="Deposit Address QR Code" className="w-32 h-32" />
                    </div>
                  )}
                  
                  <div className="bg-surface-elevated p-3 rounded-lg">
                    <p className="font-mono text-sm break-all text-foreground">{depositAddress}</p>
                  </div>
                  
                  <Button 
                    variant="outline" 
                    onClick={() => copyToClipboard(depositAddress)}
                    className="w-full"
                  >
                    Copy Address
                  </Button>
                </div>
                
                <div className="bg-status-warning/20 p-4 rounded-lg border border-status-warning/30">
                  <p className="text-sm text-status-warning">
                    ⚠️ Only send ERC20 tokens (USDC, GOLD) on Ethereum network. Other tokens or networks may result in permanent loss.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Transaction Info */}
          <div className="bg-card rounded-xl p-4">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Network:</span>
                <span className="text-foreground">Ethereum (ERC20)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Supported Tokens:</span>
                <span className="text-foreground">USDC, GOLD</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Estimated time:</span>
                <span className="text-foreground">{paymentMethod === "card" ? "Instant" : "5-10 minutes"}</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
};

export default AddUSDC;