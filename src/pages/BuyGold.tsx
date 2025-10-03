import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CreditCard, DollarSign, AlertTriangle, Calendar } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { AutoInvestModal } from "@/components/recurring/AutoInvestModal";

const BuyGold = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [paymentMethod, setPaymentMethod] = useState("credit_card");
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAutoInvestModal, setShowAutoInvestModal] = useState(false);

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

  const handleContinue = () => {
    if (paymentMethod === "usdc") {
      navigate("/swap");
      return;
    }

    if (paymentMethod === "auto_invest") {
      setShowAutoInvestModal(true);
      return;
    }
    
    // Store payment method and navigate to amount page for credit card
    sessionStorage.setItem('selectedPaymentMethod', paymentMethod);
    navigate("/buy-gold/amount");
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
            >
              {paymentMethod === "auto_invest" ? "Set up Auto-Invest" : "Continue"}
            </Button>
        </div>
      </div>

      {/* Auto-Invest Modal */}
      <AutoInvestModal 
        open={showAutoInvestModal}
        onOpenChange={setShowAutoInvestModal}
        userCountry={profile?.country || 'US'}
      />
    </AppLayout>
  );
};

export default BuyGold;