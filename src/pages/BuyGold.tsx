import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CreditCard, DollarSign, AlertTriangle } from "lucide-react";
import BottomNavigation from "@/components/BottomNavigation";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

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
    
    // Store payment method for later use
    sessionStorage.setItem('selectedPaymentMethod', paymentMethod);
    navigate("/buy-gold/amount");
  };

  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-[#1C1C1E]">
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#f9b006]"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#1C1C1E]">
      {/* Header */}
      <header className="p-4">
        <div className="flex items-center">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate("/")}
            className="text-white hover:bg-gray-800"
          >
            <ArrowLeft size={24} />
          </Button>
          <h1 className="text-xl font-bold text-white flex-1 text-center pr-6">Buy Gold</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 pb-4">
        <div className="max-w-md mx-auto space-y-6">
          <h2 className="text-2xl font-bold text-white mb-6">Payment Method</h2>
          
          <div className="space-y-4">
            {/* Credit Card/Bank Option */}
            <label className={`flex items-center justify-between rounded-xl p-4 cursor-pointer transition-all ${
              paymentMethod === "credit_card" 
                ? "bg-[#f9b006]/20 border-2 border-[#f9b006]" 
                : "bg-[#2C2C2E] border border-gray-600"
            }`}>
              <div className="flex items-center gap-4">
                <CreditCard className="text-gray-400" size={24} />
                <div>
                  <span className="text-white font-medium block">Credit Card/Bank</span>
                  {profile?.kyc_status !== 'verified' && (
                    <span className="text-xs text-gray-400">Requires identity verification</span>
                  )}
                </div>
              </div>
              <input
                type="radio"
                name="payment_method"
                value="credit_card"
                checked={paymentMethod === "credit_card"}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="h-5 w-5 text-[#f9b006] focus:ring-[#f9b006] bg-transparent border-gray-400"
              />
            </label>

            {/* KYC Warning for Credit Card */}
            {paymentMethod === "credit_card" && profile?.kyc_status !== 'verified' && (
              <div className="bg-[#2C2C2E] border border-[#f9b006]/30 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-[#f9b006] mt-0.5" />
                  <div>
                    <p className="font-semibold text-[#f9b006] text-sm">Identity Verification Required</p>
                    <p className="text-gray-300 text-sm mt-1">
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
                ? "bg-[#f9b006]/20 border-2 border-[#f9b006]" 
                : "bg-[#2C2C2E] border border-gray-600"
            }`}>
              <div className="flex items-center gap-4">
                <DollarSign className="text-gray-400" size={24} />
                <div>
                  <span className="text-white font-medium block">USDC</span>
                  <span className="text-xs text-gray-400">Use existing wallet balance</span>
                </div>
              </div>
              <input
                type="radio"
                name="payment_method"
                value="usdc"
                checked={paymentMethod === "usdc"}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="h-5 w-5 text-[#f9b006] focus:ring-[#f9b006] bg-transparent border-gray-400"
              />
            </label>
          </div>

          {/* Continue Button */}
          <div className="pt-4">
            <Button 
              className="w-full bg-[#f9b006] text-black font-bold h-14 text-lg rounded-xl hover:bg-[#f9b006]/90"
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