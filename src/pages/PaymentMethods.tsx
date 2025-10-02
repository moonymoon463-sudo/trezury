import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CreditCard, Plus, Trash2, Shield } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import AurumLogo from "@/components/AurumLogo";

interface PaymentMethod {
  id: string;
  type: string;
  provider: string;
  external_id: string;
  metadata: {
    last4?: string;
    brand?: string;
    exp_month?: number;
    exp_year?: number;
    bank_name?: string;
    account_type?: string;
  };
  is_active: boolean;
  created_at: string;
}

const PaymentMethods = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchPaymentMethods();
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

      if (data?.kyc_status !== 'verified') {
        toast({
          variant: "destructive",
          title: "Verification Required",
          description: "Please complete identity verification to manage payment methods"
        });
        navigate("/kyc-verification");
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error);
    }
  };

  const fetchPaymentMethods = async () => {
    try {
      const { data, error } = await supabase
        .from('payment_methods')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPaymentMethods((data || []).map(pm => ({
        ...pm,
        metadata: (pm.metadata as any) || {}
      })));
    } catch (error) {
      console.error('Failed to fetch payment methods:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load payment methods"
      });
    } finally {
      setLoading(false);
    }
  };

  const deletePaymentMethod = async (paymentMethodId: string) => {
    try {
      const { error } = await supabase
        .from('payment_methods')
        .update({ is_active: false })
        .eq('id', paymentMethodId)
        .eq('user_id', user!.id);

      if (error) throw error;

      setPaymentMethods(prev => 
        prev.map(pm => 
          pm.id === paymentMethodId 
            ? { ...pm, is_active: false }
            : pm
        )
      );

      toast({
        title: "Payment Method Removed",
        description: "Payment method has been successfully removed"
      });
    } catch (error) {
      console.error('Failed to delete payment method:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to remove payment method"
      });
    }
  };

  const getCardIcon = (brand: string) => {
    const brandLower = brand.toLowerCase();
    if (brandLower.includes('visa')) return '💳';
    if (brandLower.includes('mastercard')) return '💳';
    if (brandLower.includes('american express') || brandLower.includes('amex')) return '💳';
    if (brandLower.includes('discover')) return '💳';
    return '💳';
  };

  const getBankIcon = (accountType: string) => {
    return '🏦';
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

  if (profile?.kyc_status !== 'verified') {
    return (
      <div className="flex flex-col h-screen bg-background">
        <header className="p-4">
          <div className="flex items-center">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate("/settings")}
              className="text-white hover:bg-accent"
            >
              <ArrowLeft size={24} />
            </Button>
            <div className="flex-1 flex justify-center pr-6">
              <AurumLogo compact />
            </div>
          </div>
        </header>
        
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="bg-card rounded-xl p-8 w-full max-w-md text-center">
            <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-bold text-white mb-2">Verification Required</h2>
            <p className="text-muted-foreground mb-6">
              Complete identity verification to add and manage payment methods for card purchases.
            </p>
            <Button 
              onClick={() => navigate("/kyc-verification")} 
              className="w-full bg-primary text-black font-bold hover:bg-primary/90"
            >
              Start Verification
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const activePaymentMethods = paymentMethods.filter(pm => pm.is_active);

  return (
    <div className="flex flex-col h-screen bg-[#1C1C1E]">
      {/* Header */}
      <header className="p-4">
        <div className="flex items-center">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate("/settings")}
            className="text-white hover:bg-gray-800"
          >
            <ArrowLeft size={24} />
          </Button>
          <div className="flex-1 flex justify-center pr-6">
            <AurumLogo compact />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 py-4 space-y-4 overflow-y-auto">
        {/* Add Payment Method */}
        <div className="bg-[#2C2C2E] rounded-xl p-6 border-2 border-dashed border-gray-600 text-center">
          <Plus className="h-8 w-8 mx-auto mb-4 text-gray-400" />
          <h3 className="font-semibold text-white mb-2">Add Payment Method</h3>
          <p className="text-sm text-gray-400 mb-4">
            Add a credit card or bank account to buy gold instantly
          </p>
          <Button 
            onClick={() => navigate("/add-payment-method")} 
            className="w-full bg-primary text-black font-bold hover:bg-primary/90"
          >
            Add Payment Method
          </Button>
        </div>

        {/* Existing Payment Methods */}
        {activePaymentMethods.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-white">Your Payment Methods</h2>
            {activePaymentMethods.map((method) => (
              <div key={method.id} className="bg-[#2C2C2E] rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">
                      {method.type === 'card' 
                        ? getCardIcon(method.metadata.brand || '') 
                        : getBankIcon(method.metadata.account_type || '')
                      }
                    </div>
                    <div>
                      {method.type === 'card' ? (
                        <>
                          <p className="font-semibold text-white">
                            {method.metadata.brand} •••• {method.metadata.last4}
                          </p>
                          <p className="text-sm text-gray-400">
                            Expires {method.metadata.exp_month}/{method.metadata.exp_year}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="font-semibold text-white">
                            {method.metadata.bank_name}
                          </p>
                          <p className="text-sm text-gray-400">
                            {method.metadata.account_type} •••• {method.metadata.last4}
                          </p>
                        </>
                      )}
                      <Badge variant="secondary" className="text-xs mt-1 bg-[#1C1C1E] text-gray-400">
                        {method.provider}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deletePaymentMethod(method.id)}
                    className="text-gray-400 hover:text-red-500 hover:bg-red-500/10"
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {activePaymentMethods.length === 0 && (
          <div className="bg-[#2C2C2E] rounded-xl p-12 text-center">
            <CreditCard className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-semibold text-white mb-2">No Payment Methods</h3>
            <p className="text-gray-400">
              Add a payment method to start buying gold with your card or bank account
            </p>
          </div>
        )}

        {/* Security Notice */}
        <div className="bg-[#2C2C2E] rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <h4 className="font-semibold text-white mb-1">Secure & Protected</h4>
              <p className="text-sm text-gray-400">
                Your payment information is encrypted and processed through our secure payment partners. 
                We never store your full card details.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PaymentMethods;
