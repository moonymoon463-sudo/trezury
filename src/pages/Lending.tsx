import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { GoldLendingMarkets } from "@/components/lending/GoldLendingMarkets";
import { GoldUserPositions } from "@/components/lending/GoldUserPositions";
import { GoldActionModal } from "@/components/lending/GoldActionModal";
import { PoolAsset } from "@/hooks/useLendingOperations";
import BottomNavigation from "@/components/BottomNavigation";
import AurumLogo from "@/components/AurumLogo";

export default function Lending() {
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalAction, setModalAction] = useState<'supply' | 'borrow' | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<PoolAsset | null>(null);
  const [activeTab, setActiveTab] = useState<'markets' | 'positions'>('markets');

  const handleSupply = (asset: PoolAsset) => {
    setSelectedAsset(asset);
    setModalAction('supply');
    setModalOpen(true);
  };

  const handleBorrow = (asset: PoolAsset) => {
    setSelectedAsset(asset);
    setModalAction('borrow');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalAction(null);
    setSelectedAsset(null);
  };

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
          <div className="flex-1 flex justify-center pr-6">
            <AurumLogo compact />
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-4 pb-4">
        <div className="max-w-md mx-auto space-y-6">
          {/* Subtitle */}
          <div className="text-center">
            <p className="text-gray-400">
              Supply assets to earn yield or borrow against your collateral.
            </p>
          </div>

          {/* Tab Navigation - Gold Style */}
          <div className="flex justify-center">
            <div className="inline-flex rounded-full bg-[#2C2C2E] p-1">
              <button 
                className={`rounded-full px-6 py-2 text-sm font-semibold transition-all ${
                  activeTab === "markets" 
                    ? "bg-[#f9b006] text-black" 
                    : "text-gray-400"
                }`}
                onClick={() => setActiveTab("markets")}
              >
                Markets
              </button>
              <button 
                className={`rounded-full px-6 py-2 text-sm font-semibold transition-all ${
                  activeTab === "positions" 
                    ? "bg-[#f9b006] text-black" 
                    : "text-gray-400"
                }`}
                onClick={() => setActiveTab("positions")}
              >
                Positions
              </button>
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === 'markets' ? (
            <GoldLendingMarkets 
              onSupply={handleSupply}
              onBorrow={handleBorrow}
            />
          ) : (
            <GoldUserPositions />
          )}

          <GoldActionModal
            isOpen={modalOpen}
            onClose={closeModal}
            action={modalAction}
            asset={selectedAsset}
          />
        </div>
      </main>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
}