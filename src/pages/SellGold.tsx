import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";
import BottomNavigation from "@/components/BottomNavigation";
import StandardHeader from "@/components/StandardHeader";
import { loadMoonPay } from '@moonpay/moonpay-js';
import { toast } from "sonner";

const SellGold = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleSellGold = async () => {
    setLoading(true);
    try {
      // Initialize MoonPay SDK
      const moonPay = await loadMoonPay();
      
      const moonPaySdk = moonPay({
        flow: 'sell',
        environment: 'sandbox', // Change to 'production' for live
        variant: 'overlay',
        params: {
          apiKey: import.meta.env.VITE_MOONPAY_PUBLISHABLE_KEY || 'pk_test_hnzbkKKRwR5ksg8cbLVafnA1Pv05YH46',
          theme: 'dark' as const,
          currencyCode: 'usdc', // For sell flow, this is what we're selling
          baseCurrencyAmount: '100',
          colorCode: '#FFD700', // Gold theme
          onTransactionCompleted: (transaction: any) => {
            console.log('Transaction completed:', transaction);
            toast.success('Sell transaction completed successfully!');
            navigate('/transactions');
          },
          onTransactionFailed: (error: any) => {
            console.error('Transaction failed:', error);
            toast.error('Sell transaction failed. Please try again.');
          },
          onCloseWidget: () => {
            console.log('Widget closed');
            setLoading(false);
          }
        } as any
      });

      // Show the MoonPay widget
      moonPaySdk.show();
      
    } catch (error) {
      console.error('Error initializing MoonPay sell:', error);
      toast.error('Failed to initialize sell transaction');
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <StandardHeader showBackButton backPath="/" />

      {/* Main Content */}
      <main className="flex-1 p-4">
        <h2 className="text-2xl font-bold text-foreground mb-8">Which gold would you like to sell?</h2>
        
        <div className="space-y-4">
          {/* GOLD Token Option */}
          <button 
            onClick={handleSellGold}
            disabled={loading}
            className="flex items-center gap-4 rounded-xl bg-card border border-border p-4 transition-colors hover:bg-accent w-full text-left disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex-shrink-0">
              <div className="h-12 w-12 rounded-full bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">GOLD</span>
              </div>
            </div>
            <div className="flex-1">
              <p className="text-base font-semibold text-foreground">GOLD</p>
              <p className="text-sm text-muted-foreground">Aurum Gold Token</p>
            </div>
            {loading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary border-t-transparent"></div>
            ) : (
              <ChevronRight size={20} className="text-muted-foreground" />
            )}
          </button>
        </div>
      </main>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
};

export default SellGold;