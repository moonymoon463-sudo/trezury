import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CreditCard, DollarSign } from "lucide-react";
import BottomNavigation from "@/components/BottomNavigation";

const BuyGold = () => {
  const navigate = useNavigate();
  const [paymentMethod, setPaymentMethod] = useState("credit_card");

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
          <h1 className="text-xl font-bold text-foreground flex-1 text-center pr-6">Buy Gold</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 py-8">
        <h2 className="text-2xl font-bold text-foreground mb-6">Payment Method</h2>
        
        <div className="space-y-4">
          {/* Credit Card/Bank Option */}
          <label className={`flex items-center justify-between rounded-xl border p-4 cursor-pointer transition-all ${
            paymentMethod === "credit_card" 
              ? "border-primary bg-accent" 
              : "border-border bg-card"
          }`}>
            <div className="flex items-center gap-4">
              <CreditCard className="text-muted-foreground" size={24} />
              <span className="text-foreground font-medium">Credit Card/Bank</span>
            </div>
            <input
              type="radio"
              name="payment_method"
              value="credit_card"
              checked={paymentMethod === "credit_card"}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="h-5 w-5 text-primary focus:ring-primary"
            />
          </label>

          {/* USDC Option */}
          <label className={`flex items-center justify-between rounded-xl border p-4 cursor-pointer transition-all ${
            paymentMethod === "usdc" 
              ? "border-primary bg-accent" 
              : "border-border bg-card"
          }`}>
            <div className="flex items-center gap-4">
              <DollarSign className="text-muted-foreground" size={24} />
              <span className="text-foreground font-medium">USDC</span>
            </div>
            <input
              type="radio"
              name="payment_method"
              value="usdc"
              checked={paymentMethod === "usdc"}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="h-5 w-5 text-primary focus:ring-primary"
            />
          </label>
        </div>
      </main>

      {/* Continue Button */}
      <div className="px-4 py-6">
        <Button 
          className="w-full h-14 font-bold text-lg rounded-xl"
          onClick={() => navigate("/buy-gold/amount")}
        >
          Continue
        </Button>
      </div>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
};

export default BuyGold;