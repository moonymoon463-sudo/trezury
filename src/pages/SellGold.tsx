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
          apiKey: 'pk_test_hnzbkKKRwR5ksg8cbLVafnA1Pv05YH46',
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
    <div className="min-h-[100dvh] w-full overflow-x-hidden bg-background">
      <StandardHeader showBackButton backPath="/" />

      {/* Main Content */}
      <main className="container mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8 pb-[calc(var(--bottom-nav-height,56px)+env(safe-area-inset-bottom)+1rem)] pt-2">
        <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground mb-6 sm:mb-8">Sell Your Gold Holdings for Fiat</h2>
        
        <div className="space-y-4 max-w-full">
          {/* Convert Assets Option */}
          <button 
            onClick={handleSellGold}
            disabled={loading}
            className="flex items-center gap-4 rounded-xl bg-card border border-border p-4 sm:p-6 transition-colors hover:bg-accent w-full text-left disabled:opacity-50 disabled:cursor-not-allowed max-w-full"
          >
            <div className="flex-1">
              <p className="text-base font-semibold text-foreground">Convert Assets</p>
              <p className="text-sm text-muted-foreground">Convert to USD via bank transfer or USDC</p>
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