import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const BuyGoldAmount = () => {
  const navigate = useNavigate();
  const [currency, setCurrency] = useState<"USD" | "GRAMS">("USD");
  const [amount, setAmount] = useState("100");
  
  // Mock USD balance
  const usdBalance = 10000.00;
  
  // Mock conversion rate (1 gram = ~$75.43 based on earlier screen)
  const goldPricePerGram = 75.43;
  
  const calculateGoldAmount = (usdAmount: string) => {
    const usd = parseFloat(usdAmount) || 0;
    return (usd / goldPricePerGram).toFixed(3);
  };

  const handleAmountChange = (value: string) => {
    // Remove any non-numeric characters except decimal point
    const cleanValue = value.replace(/[^0-9.]/g, '');
    setAmount(cleanValue);
  };

  const handleQuickAmount = (quickAmount: string) => {
    setAmount(quickAmount);
  };

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col bg-[#1C1C1E] justify-between">
      <div className="flex-grow">
        {/* Header */}
        <header className="flex items-center p-4">
          <button 
            className="text-white"
            onClick={() => navigate("/buy-gold")}
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="flex-1 text-center text-lg font-bold text-white">
            Buy Gold
          </h1>
          <div className="w-8"></div>
        </header>

        {/* Main Content */}
        <main className="px-4 py-8">
          {/* USD Balance */}
          <div className="text-center">
            <p className="text-sm text-gray-400">USD Balance</p>
            <p className="text-3xl font-bold text-white">
              ${usdBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>

          {/* Currency Toggle */}
          <div className="my-12 text-center">
            <div className="inline-flex rounded-full bg-[#2C2C2E] p-1">
              <button 
                className={`rounded-full px-6 py-2 text-sm font-semibold transition-all ${
                  currency === "USD" 
                    ? "bg-[#f9b006] text-black" 
                    : "text-white"
                }`}
                onClick={() => setCurrency("USD")}
              >
                USD
              </button>
              <button 
                className={`rounded-full px-6 py-2 text-sm font-semibold transition-all ${
                  currency === "GRAMS" 
                    ? "bg-[#f9b006] text-black" 
                    : "text-white"
                }`}
                onClick={() => setCurrency("GRAMS")}
              >
                GRAMS
              </button>
            </div>
          </div>

          {/* Amount Input */}
          <div className="relative text-center">
            {currency === "USD" && (
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-5xl font-bold text-white pointer-events-none">
                $
              </span>
            )}
            <input
              aria-label={`Amount in ${currency}`}
              className="w-full border-0 bg-transparent text-center text-8xl font-bold text-white focus:ring-0 focus:outline-none placeholder-gray-600"
              type="text"
              value={amount}
              onChange={(e) => handleAmountChange(e.target.value)}
              placeholder="0"
            />
            <p className="mt-2 text-gray-400">
              {currency === "USD" 
                ? `You will receive ${calculateGoldAmount(amount)} grams of gold`
                : `This will cost $${(parseFloat(amount || "0") * goldPricePerGram).toFixed(2)}`
              }
            </p>
          </div>

          {/* Quick Amount Buttons */}
          <div className="mt-16 grid grid-cols-3 gap-4 text-center">
            <button 
              className="rounded-lg bg-[#2C2C2E] py-3 text-lg font-semibold text-white hover:bg-[#3C3C3E] transition-colors"
              onClick={() => handleQuickAmount("100")}
            >
              ${currency === "USD" ? "100" : "75"}
            </button>
            <button 
              className="rounded-lg bg-[#2C2C2E] py-3 text-lg font-semibold text-white hover:bg-[#3C3C3E] transition-colors"
              onClick={() => handleQuickAmount("250")}
            >
              ${currency === "USD" ? "250" : "200"}
            </button>
            <button 
              className="rounded-lg bg-[#2C2C2E] py-3 text-lg font-semibold text-white hover:bg-[#3C3C3E] transition-colors"
              onClick={() => handleQuickAmount("500")}
            >
              ${currency === "USD" ? "500" : "400"}
            </button>
          </div>
        </main>
      </div>

      {/* Continue Button */}
      <div className="px-4 py-6">
        <Button 
          className="w-full h-14 bg-[#f9b006] text-black font-bold text-lg rounded-lg hover:bg-[#f9b006]/90"
          disabled={!amount || parseFloat(amount) <= 0}
          onClick={() => navigate("/buy-gold/asset")}
        >
          Continue
        </Button>
      </div>

      {/* Bottom Navigation */}
      <footer className="border-t border-gray-700 bg-black">
        <nav className="flex justify-around py-2">
          <button 
            className="flex flex-col items-center gap-1 text-gray-400"
            onClick={() => navigate("/")}
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
            </svg>
            <span className="text-xs">Dashboard</span>
          </button>
          <div className="flex flex-col items-center gap-1 text-[#f9b006]">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M7 4V2C7 1.45 7.45 1 8 1H16C16.55 1 17 1.45 17 2V4H20C20.55 4 21 4.45 21 5S20.55 6 20 6H19V19C19 20.1 18.1 21 17 21H7C5.9 21 5 20.1 5 19V6H4C3.45 6 3 5.55 3 5S3.45 4 4 4H7ZM9 3V4H15V3H9ZM7 6V19H17V6H7Z"/>
            </svg>
            <span className="text-xs font-medium">Buy/Sell</span>
          </div>
          <button className="flex flex-col items-center gap-1 text-gray-400">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6.99 11L3 15l3.99 4v-3H14v-2H6.99v-3zM21 9l-3.99-4v3H10v2h7.01v3L21 9z"/>
            </svg>
            <span className="text-xs">Swap</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-gray-400">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M13,3A9,9 0 0,0 4,12H1L4.5,15.5L8,12H5A7,7 0 0,1 12,5A7,7 0 0,1 19,12A7,7 0 0,1 12,19C10.5,19 9.09,18.5 7.94,17.7L6.5,19.14C8.04,20.3 9.94,21 12,21A9,9 0 0,0 21,12A9,9 0 0,0 12,3H13Z"/>
            </svg>
            <span className="text-xs">History</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-gray-400">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.22,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.22,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.68 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z"/>
            </svg>
            <span className="text-xs">Settings</span>
          </button>
        </nav>
      </footer>
    </div>
  );
};

export default BuyGoldAmount;