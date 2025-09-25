import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChevronRight, CircleDollarSign, Building2 } from "lucide-react";
import BottomNavigation from "@/components/BottomNavigation";
import StandardHeader from "@/components/StandardHeader";

const SellGoldPayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedMethod, setSelectedMethod] = useState<'usdc' | 'bank' | null>(null);
  
  const quote = location.state?.quote;
  const asset = location.state?.asset || 'GOLD';

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <StandardHeader 
        showBackButton 
        backPath="/sell-gold/amount" 
        rightActions={
          <h1 className="text-xl font-bold text-foreground">Choose Payout</h1>
        } 
      />

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-4 pt-4 pb-24">
        <h2 className="text-2xl font-bold mb-6 text-foreground">Choose your payout method</h2>
        
        <div className="space-y-4">
          {/* USDC Option */}
          <button 
            className={`flex items-center gap-4 rounded-lg p-4 transition-colors w-full text-left ${
              selectedMethod === 'usdc' 
                ? 'bg-primary/20 border-2 border-primary' 
                : 'bg-card hover:bg-accent'
            }`}
            onClick={() => setSelectedMethod('usdc')}
          >
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent">
              <CircleDollarSign size={24} className="text-primary" />
            </div>
            <div className="flex-grow">
              <p className="text-base font-semibold text-foreground">USDC</p>
              <p className="text-sm text-muted-foreground">Receive USDC in your wallet</p>
            </div>
            <ChevronRight size={20} className="text-muted-foreground" />
          </button>

          {/* Bank via MoonPay Option */}
          <button 
            className={`flex items-center gap-4 rounded-lg p-4 transition-colors w-full text-left ${
              selectedMethod === 'bank' 
                ? 'bg-primary/20 border-2 border-primary' 
                : 'bg-card hover:bg-accent'
            }`}
            onClick={() => setSelectedMethod('bank')}
          >
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent">
              <Building2 size={24} className="text-primary" />
            </div>
            <div className="flex-grow">
              <p className="text-base font-semibold text-foreground">Bank via MoonPay</p>
              <p className="text-sm text-muted-foreground">Receive USD in your bank account</p>
            </div>
            <ChevronRight size={20} className="text-muted-foreground" />
          </button>
        </div>
      </main>

      {/* Continue Button */}
      <div className="fixed inset-x-0 bottom-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-t border-border p-4">
        <Button 
          className="w-full h-12 bg-primary text-primary-foreground font-bold text-lg rounded-xl hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground"
          disabled={!selectedMethod}
          onClick={() => {
            if (selectedMethod === 'usdc') {
              navigate("/sell-gold/confirmation", { state: { quote, asset, payoutMethod: 'usdc' } });
            } else if (selectedMethod === 'bank') {
              navigate("/sell-gold/confirmation", { state: { quote, asset, payoutMethod: 'bank' } });
            }
          }}
        >
          {selectedMethod === 'bank' ? 'Continue with MoonPay' : 'Complete Sale'}
        </Button>
      </div>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
};

export default SellGoldPayout;