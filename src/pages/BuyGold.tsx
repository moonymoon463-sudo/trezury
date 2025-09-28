import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CreditCard, DollarSign, AlertTriangle, Calendar } from "lucide-react";
import BottomNavigation from "@/components/BottomNavigation";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import AurumLogo from "@/components/AurumLogo";
import StandardHeader from "@/components/StandardHeader";
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
    if (paymentMethod === "credit_card" && profile?.kyc_status !== 'verified') {
      // Redirect to KYC if trying to use card without verification
      navigate("/kyc-verification");
      return;
    }
    
    if (paymentMethod === "usdc") {
      // Redirect to swap page for USDC purchases
      navigate("/swap");
      return;
    }

    if (paymentMethod === "auto_invest") {
      // Show auto-invest modal for recurring purchases
      setShowAutoInvestModal(true);
      return;
    }
    
    // Store payment method for later use
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
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <StandardHeader 
        showBackButton
        backPath="/"
      />

      {/* Main Content */}
      <main className="flex-1 px-3 sm:px-4 pb-4">
        <div className="w-full max-w-md mx-auto mobile-form-spacing">
          <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-4 sm:mb-6">Payment Method</h2>
          
          <div className="mobile-form-spacing">
            {/* Credit Card/Bank Option */}
            <label className={`flex items-center justify-between rounded-xl mobile-touch-padding cursor-pointer transition-all touch-target ${
              paymentMethod === "credit_card" 
                ? "bg-primary/20 border-2 border-primary" 
                : "bg-card border border-border"
            }`}>
              <div className="flex items-center gap-3 sm:gap-4">
                <CreditCard className="text-muted-foreground" size={20} />
                <div>
                  <span className="text-foreground font-medium block text-sm sm:text-base">Credit Card/Bank</span>
                  {profile?.kyc_status !== 'verified' && (
                    <span className="text-xs text-muted-foreground">Requires identity verification</span>
                  )}
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

            {/* KYC Warning for Credit Card */}
            {paymentMethod === "credit_card" && profile?.kyc_status !== 'verified' && (
              <div className="bg-card border border-primary/30 rounded-xl mobile-touch-padding">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-primary text-sm">Identity Verification Required</p>
                    <p className="text-muted-foreground text-sm mt-1">
                      To buy gold with a credit card, you need to complete identity verification first. 
                      This helps us comply with financial regulations.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* USDC Option */}
            <label className={`flex items-center justify-between rounded-xl mobile-touch-padding cursor-pointer transition-all touch-target ${
              paymentMethod === "usdc" 
                ? "bg-primary/20 border-2 border-primary" 
                : "bg-card border border-border"
            }`}>
              <div className="flex items-center gap-3 sm:gap-4">
                <DollarSign className="text-muted-foreground" size={20} />
                <div>
                  <span className="text-foreground font-medium block text-sm sm:text-base">USDC</span>
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
            <label className={`flex items-center justify-between rounded-xl mobile-touch-padding cursor-pointer transition-all touch-target ${
              paymentMethod === "auto_invest" 
                ? "bg-primary/20 border-2 border-primary" 
                : "bg-card border border-border"
            }`}>
              <div className="flex items-center gap-3 sm:gap-4">
                <Calendar className="text-muted-foreground" size={20} />
                <div>
                  <span className="text-foreground font-medium block text-sm sm:text-base">Auto-Invest</span>
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
              className="w-full font-bold h-12 sm:h-14 text-base sm:text-lg rounded-xl touch-target"
              onClick={handleContinue}
            >
              {paymentMethod === "credit_card" && profile?.kyc_status !== 'verified' 
                ? "Verify Identity & Continue" 
                : paymentMethod === "auto_invest"
                ? "Set up Auto-Invest"
                : "Continue"
              }
            </Button>
          </div>
        </div>
      </main>

      {/* Auto-Invest Modal */}
      <AutoInvestModal 
        open={showAutoInvestModal}
        onOpenChange={setShowAutoInvestModal}
        userCountry={profile?.country || 'US'}
      />

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
};

export default BuyGold;