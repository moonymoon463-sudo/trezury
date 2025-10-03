import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CreditCard, DollarSign, AlertTriangle, Calendar, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { AutoInvestModal } from "@/components/recurring/AutoInvestModal";
import { MoonPayFrame } from "@/components/recurring/MoonPayFrame";
import { useToast } from "@/hooks/use-toast";
import { secureWalletService } from "@/services/secureWalletService";

const BuyGold = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [paymentMethod, setPaymentMethod] = useState("credit_card");
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAutoInvestModal, setShowAutoInvestModal] = useState(false);
  const [showMoonPayDialog, setShowMoonPayDialog] = useState(false);
  const [moonPayUrl, setMoonPayUrl] = useState("");
  const [initiatingMoonPay, setInitiatingMoonPay] = useState(false);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      // Query only KYC status to avoid PII rate limiting
      const { data, error } = await supabase
        .from('profiles')
        .select('kyc_status')
        .eq('id', user!.id)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error('Failed to fetch profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const initiateMoonPayPurchase = async () => {
    setInitiatingMoonPay(true);
    try {
      // Get wallet address
      const walletAddress = await secureWalletService.getWalletAddress(user!.id);
      if (!walletAddress) {
        toast({
          title: "Wallet Required",
          description: "Please set up your wallet first",
          variant: "destructive"
        });
        return;
      }

      // Call MoonPay proxy with default amount ($100)
      const { data, error } = await supabase.functions.invoke('moonpay-proxy', {
        body: {
          amount: 100,
          currency: 'USD',
          walletAddress,
          userId: user!.id
        }
      });

      if (error) throw error;

      if (data.widgetUrl) {
        setMoonPayUrl(data.widgetUrl);
        setShowMoonPayDialog(true);
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to initiate MoonPay",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('MoonPay initiation error:', error);
      toast({
        title: "Error",
        description: "Failed to initiate purchase",
        variant: "destructive"
      });
    } finally {
      setInitiatingMoonPay(false);
    }
  };

  const handleContinue = async () => {
    if (paymentMethod === "usdc") {
      navigate("/swap");
      return;
    }

    if (paymentMethod === "auto_invest") {
      setShowAutoInvestModal(true);
      return;
    }
    
    // For credit card - open MoonPay directly
    if (paymentMethod === "credit_card") {
      await initiateMoonPayPurchase();
      return;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-background">
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <AppLayout
      headerProps={{
        showBackButton: true,
        backPath: "/"
      }}
      showBottomNav={true}
    >
      <div className="max-w-2xl mx-auto space-y-6 px-4">
          <h2 className="text-2xl font-bold text-foreground mb-6">Payment Method</h2>
          
          <div className="space-y-4">
            {/* Credit Card/Bank Option */}
            <label className={`flex items-center justify-between rounded-xl p-4 cursor-pointer transition-all ${
              paymentMethod === "credit_card" 
                ? "bg-primary/20 border-2 border-primary" 
                : "bg-card border border-border"
            }`}>
              <div className="flex items-center gap-4">
                <CreditCard className="text-muted-foreground" size={24} />
                <div>
                  <span className="text-foreground font-medium block">Credit Card/Bank</span>
                  <span className="text-xs text-muted-foreground">Fast and convenient</span>
                </div>
              </div>
              <input
                type="radio"
                name="payment_method"
                value="credit_card"
                checked={paymentMethod === "credit_card"}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="h-5 w-5 text-primary focus:ring-primary bg-transparent border-border"
              />
            </label>

            {/* USDC Option */}
            <label className={`flex items-center justify-between rounded-xl p-4 cursor-pointer transition-all ${
              paymentMethod === "usdc" 
                ? "bg-primary/20 border-2 border-primary" 
                : "bg-card border border-border"
            }`}>
              <div className="flex items-center gap-4">
                <DollarSign className="text-muted-foreground" size={24} />
                <div>
                  <span className="text-foreground font-medium block">USDC</span>
                  <span className="text-xs text-muted-foreground">Use existing wallet balance</span>
                </div>
              </div>
              <input
                type="radio"
                name="payment_method"
                value="usdc"
                checked={paymentMethod === "usdc"}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="h-5 w-5 text-primary focus:ring-primary bg-transparent border-border"
              />
            </label>

            {/* Auto-Invest Option */}
            <label className={`flex items-center justify-between rounded-xl p-4 cursor-pointer transition-all ${
              paymentMethod === "auto_invest" 
                ? "bg-primary/20 border-2 border-primary" 
                : "bg-card border border-border"
            }`}>
              <div className="flex items-center gap-4">
                <Calendar className="text-muted-foreground" size={24} />
                <div>
                  <span className="text-foreground font-medium block">Auto-Invest</span>
                  <span className="text-xs text-muted-foreground">Schedule recurring purchases</span>
                </div>
              </div>
              <input
                type="radio"
                name="payment_method"
                value="auto_invest"
                checked={paymentMethod === "auto_invest"}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="h-5 w-5 text-primary focus:ring-primary bg-transparent border-border"
              />
            </label>
          </div>

          {/* Continue Button */}
          <div className="pt-4">
            <Button 
              className="w-full font-bold h-14 text-lg rounded-xl"
              onClick={handleContinue}
              disabled={initiatingMoonPay}
            >
              {initiatingMoonPay ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Loading...
                </>
              ) : (
                paymentMethod === "auto_invest" ? "Set up Auto-Invest" : "Continue"
              )}
            </Button>
        </div>
      </div>

      {/* Auto-Invest Modal */}
      <AutoInvestModal 
        open={showAutoInvestModal}
        onOpenChange={setShowAutoInvestModal}
        userCountry={profile?.country || 'US'}
      />

      {/* MoonPay Dialog */}
      <MoonPayFrame
        url={moonPayUrl}
        open={showMoonPayDialog}
        onOpenChange={setShowMoonPayDialog}
        onComplete={() => {
          toast({
            title: "Purchase Complete",
            description: "Your gold purchase was successful!"
          });
          navigate("/portfolio");
        }}
      />
    </AppLayout>
  );
};

export default BuyGold;