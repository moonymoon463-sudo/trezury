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

const AddUSDC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { initiateBuy, loading } = useMoonPayBuy();
  const { fetchBalances } = useWalletBalance();
  
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"card" | "crypto">("card");
  const [depositAddress] = useState("0x742d35Cc6634C0532925a3b8D7B1295ce8b8e81e"); // Mock address
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
            className="text-foreground hover:bg-accent"
          >
            <ArrowLeft size={24} />
          </Button>
          <h1 className="text-xl font-bold text-foreground flex-1 text-center pr-6">Add USDC</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 py-4 space-y-6 overflow-y-auto">
        {/* Amount Input */}
        <Card>
          <CardHeader>
            <CardTitle>Enter Amount</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="amount">Amount (USD)</Label>
              <Input
                id="amount"
                type="text"
                placeholder="100.00"
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                className="text-lg font-semibold"
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
          </CardContent>
        </Card>

        {/* Payment Method Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Method</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
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
          </CardContent>
        </Card>

        {/* Credit Card Payment */}
        {paymentMethod === "card" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard size={20} />
                Credit Card Payment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted p-4 rounded-lg">
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
                className="w-full h-12"
              >
                {loading ? "Processing..." : `Buy $${amount || "0"} USDC`}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Crypto Transfer */}
        {paymentMethod === "crypto" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode size={20} />
                Crypto Transfer
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center space-y-4">
                <p className="text-sm text-muted-foreground">
                  Send USDC to this address on Base network:
                </p>
                
                {qrCodeUrl && (
                  <div className="flex justify-center">
                    <img src={qrCodeUrl} alt="Deposit Address QR Code" className="w-32 h-32" />
                  </div>
                )}
                
                <div className="bg-muted p-3 rounded-lg">
                  <p className="font-mono text-sm break-all">{depositAddress}</p>
                </div>
                
                <Button 
                  variant="outline" 
                  onClick={() => copyToClipboard(depositAddress)}
                  className="w-full"
                >
                  Copy Address
                </Button>
              </div>
              
              <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  ⚠️ Only send USDC on Base network. Other tokens or networks may result in permanent loss.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Transaction Info */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Network:</span>
                <span>Base</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Asset:</span>
                <span>USDC</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Estimated time:</span>
                <span>{paymentMethod === "card" ? "Instant" : "5-10 minutes"}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
};

export default AddUSDC;