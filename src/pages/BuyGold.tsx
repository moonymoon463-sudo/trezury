import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CreditCard, DollarSign, AlertTriangle } from "lucide-react";
import BottomNavigation from "@/components/BottomNavigation";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import AurumLogo from "@/components/AurumLogo";

const BuyGold = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [paymentMethod, setPaymentMethod] = useState("credit_card");
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      // Log profile access for security audit
      await supabase.rpc('log_profile_access', {
        target_user_id: user!.id,
        accessed_fields: ['kyc_status']
      });

      const { data, error } = await supabase
        .from('secure_profiles')
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
      <main className="flex-1 px-4 pb-4">
        <div className="max-w-md mx-auto space-y-6">
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
              <div className="bg-card border border-primary/30 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-primary mt-0.5" />
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
          </div>

          {/* Continue Button */}
          <div className="pt-4">
            <Button 
              className="w-full font-bold h-14 text-lg rounded-xl"
              onClick={handleContinue}
            >
              {paymentMethod === "credit_card" && profile?.kyc_status !== 'verified' 
                ? "Verify Identity & Continue" 
                : "Continue"
              }
            </Button>
          </div>
        </div>
      </main>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
};

export default BuyGold;