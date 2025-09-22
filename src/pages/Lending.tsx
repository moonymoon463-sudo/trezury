import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, AlertTriangle, TrendingUp } from "lucide-react";
import { GoldLendingMarkets } from "@/components/lending/GoldLendingMarkets";
import { GoldUserPositions } from "@/components/lending/GoldUserPositions";
import { GoldActionModal } from "@/components/lending/GoldActionModal";
import { PoolAsset, useLendingOperations } from "@/hooks/useLendingOperations";
import { useRealTimeLending } from "@/hooks/useRealTimeLending";
import BottomNavigation from "@/components/BottomNavigation";
import AurumLogo from "@/components/AurumLogo";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function Lending() {
  const navigate = useNavigate();
  const { fetchPoolAssets, fetchUserPositions } = useLendingOperations();
  const {
    realTimeRates,
    enhancedHealthFactor,
    riskAlerts,
    acknowledgeAlert,
    triggerRateUpdate
  } = useRealTimeLending();
  
  const [modalOpen, setModalOpen] = useState(false);
  const [modalAction, setModalAction] = useState<'supply' | 'borrow' | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<PoolAsset | null>(null);
  const [activeTab, setActiveTab] = useState<'markets' | 'positions'>('markets');

  // Load lending data on mount
  useEffect(() => {
    fetchPoolAssets();
    fetchUserPositions();
  }, [fetchPoolAssets, fetchUserPositions]);

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
          <Button
            variant="ghost"
            size="icon"
            onClick={triggerRateUpdate}
            className="text-yellow-400 hover:bg-gray-800"
            title="Update Live Rates"
          >
            <TrendingUp size={20} />
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-4 pb-4">
        <div className="max-w-md mx-auto space-y-6">
          {/* Risk Alerts */}
          {riskAlerts.length > 0 && (
            <div className="space-y-2">
              {riskAlerts.map((alert) => (
                <Alert 
                  key={alert.id} 
                  variant={alert.severity === 'critical' ? 'destructive' : 'default'}
                  className="bg-red-900/20 border-red-500/50"
                >
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="flex items-center justify-between">
                    <span className="text-white">{alert.message}</span>
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => acknowledgeAlert(alert.id)}
                      className="text-white hover:bg-red-800/20"
                    >
                      Dismiss
                    </Button>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          )}

          {/* Enhanced Health Factor Display */}
          {enhancedHealthFactor && (
            <div className="bg-[#2C2C2E] rounded-xl p-4 space-y-3">
              <h3 className="text-white font-semibold text-center">Health Factor</h3>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-gray-400 text-xs">Health Factor</p>
                  <p className={`text-lg font-bold ${
                    enhancedHealthFactor.healthFactor < 1.1 ? 'text-red-400' :
                    enhancedHealthFactor.healthFactor < 1.3 ? 'text-yellow-400' : 'text-green-400'
                  }`}>
                    {enhancedHealthFactor.healthFactor > 999 ? '∞' : enhancedHealthFactor.healthFactor.toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-500 capitalize">
                    {enhancedHealthFactor.riskLevel}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs">Collateral</p>
                  <p className="text-white font-semibold">
                    ${enhancedHealthFactor.totalCollateralUsd.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs">Debt</p>
                  <p className="text-white font-semibold">
                    ${enhancedHealthFactor.totalDebtUsd.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          )}

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