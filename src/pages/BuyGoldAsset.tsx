import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check } from "lucide-react";

const BuyGoldAsset = () => {
  const navigate = useNavigate();
  const [selectedAsset, setSelectedAsset] = useState("XAUT");

  const assets = [
    {
      symbol: "PAXG",
      name: "Tokenized gold",
      icon: "🏅"
    },
    {
      symbol: "XAUT", 
      name: "Tokenized gold",
      icon: "🥇"
    }
  ];

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col justify-between bg-[#1C1C1C]">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-8">
          <button 
            className="text-white flex size-10 items-center justify-center rounded-full bg-zinc-800"
            onClick={() => navigate("/buy-gold/amount")}
          >
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-white text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center pr-10">
            Buy Gold
          </h2>
        </div>

        {/* Choose Asset Section */}
        <h3 className="text-white text-xl font-bold leading-tight tracking-[-0.015em] pb-4">
          Choose asset
        </h3>
        
        <div className="space-y-4">
          {assets.map((asset) => (
            <button
              key={asset.symbol}
              className={`flex items-center gap-4 rounded-xl border p-4 transition-all w-full ${
                selectedAsset === asset.symbol
                  ? "border-[#f9b006] bg-zinc-900"
                  : "border-zinc-800 bg-zinc-900 hover:border-[#f9b006]"
              }`}
              onClick={() => setSelectedAsset(asset.symbol)}
            >
              <div className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-12 flex items-center justify-center text-2xl bg-gradient-to-br from-yellow-600 to-yellow-800">
                {asset.icon}
              </div>
              <div className="flex-1 text-left">
                <p className="text-white text-base font-medium leading-normal">
                  {asset.symbol}
                </p>
                <p className="text-zinc-400 text-sm font-normal leading-normal">
                  {asset.name}
                </p>
              </div>
              <div className={`flex size-6 items-center justify-center rounded-full border-2 ${
                selectedAsset === asset.symbol
                  ? "border-[#f9b006] bg-[#f9b006]"
                  : "border-zinc-700"
              }`}>
                {selectedAsset === asset.symbol && (
                  <Check size={16} className="text-black" />
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Continue Button */}
      <div className="p-6">
        <Button 
          className="w-full h-14 bg-[#f9b006] text-black font-bold text-lg rounded-xl hover:bg-[#f9b006]/90"
          onClick={() => navigate("/buy-gold/quote")}
        >
          Continue
        </Button>
      </div>

      {/* Bottom Navigation */}
      <nav className="flex items-center justify-around border-t border-zinc-800 bg-[#1C1C1C] py-3">
        <button 
          className="flex flex-col items-center gap-1 text-zinc-400"
          onClick={() => navigate("/")}
        >
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
          </svg>
          <span className="text-xs">Dashboard</span>
        </button>
        <div className="flex flex-col items-center gap-1 text-[#f9b006]">
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/>
          </svg>
          <span className="text-xs">Buy/Sell</span>
        </div>
        <button className="flex flex-col items-center gap-1 text-zinc-400">
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6.99 11L3 15l3.99 4v-3H14v-2H6.99v-3zM21 9l-3.99-4v3H10v2h7.01v3L21 9z"/>
          </svg>
          <span className="text-xs">Swap</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-zinc-400">
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M13,3A9,9 0 0,0 4,12H1L4.5,15.5L8,12H5A7,7 0 0,1 12,5A7,7 0 0,1 19,12A7,7 0 0,1 12,19C10.5,19 9.09,18.5 7.94,17.7L6.5,19.14C8.04,20.3 9.94,21 12,21A9,9 0 0,0 21,12A9,9 0 0,0 12,3H13Z"/>
          </svg>
          <span className="text-xs">History</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-zinc-400">
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.22,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.22,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.68 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z"/>
          </svg>
          <span className="text-xs">Settings</span>
        </button>
      </nav>
    </div>
  );
};

export default BuyGoldAsset;