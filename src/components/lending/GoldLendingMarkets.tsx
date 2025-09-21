import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useLendingOperations, PoolAsset } from "@/hooks/useLendingOperations";
import { TrendingUp, TrendingDown } from "lucide-react";

interface GoldLendingMarketsProps {
  onSupply: (asset: PoolAsset) => void;
  onBorrow: (asset: PoolAsset) => void;
}

export function GoldLendingMarkets({ onSupply, onBorrow }: GoldLendingMarketsProps) {
  const { poolAssets, fetchPoolAssets } = useLendingOperations();

  useEffect(() => {
    fetchPoolAssets();
  }, []);

  const formatApy = (apy: number) => `${(apy * 100).toFixed(2)}%`;
  const formatAmount = (amount: number) => {
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      return `${(amount / 1000).toFixed(1)}K`;
    }
    return amount.toLocaleString();
  };

  // Filter out any ETH and focus on key assets
  const filteredAssets = poolAssets.filter(asset => 
    ['USDC', 'USDT', 'DAI', 'XAUT'].includes(asset.asset)
  );

  return (
    <div className="space-y-4">
      {filteredAssets.map((asset) => (
        <div key={`${asset.asset}-${asset.chain}`} className="bg-[#2C2C2E] rounded-xl p-4 space-y-4">
          {/* Asset Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#f9b006] flex items-center justify-center">
                <span className="text-black font-bold text-sm">{asset.asset}</span>
              </div>
              <div>
                <h3 className="text-white font-semibold">{asset.asset}</h3>
                <p className="text-gray-400 text-sm capitalize">{asset.chain}</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-400">Available</div>
              <div className="text-white font-medium">{formatAmount(asset.available)}</div>
            </div>
          </div>

          {/* APY Display */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <TrendingUp size={16} className="text-green-400" />
                <span className="text-sm font-medium text-white">Supply APY</span>
              </div>
              <div className="text-2xl font-bold text-green-400">{formatApy(asset.supplyApy)}</div>
              <Button 
                onClick={() => onSupply(asset)}
                className="w-full bg-[#f9b006] text-black font-bold rounded-xl hover:bg-[#f9b006]/90"
              >
                Supply
              </Button>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <TrendingDown size={16} className="text-red-400" />
                <span className="text-sm font-medium text-white">Borrow APY</span>
              </div>
              <div className="text-2xl font-bold text-red-400">{formatApy(asset.borrowApy)}</div>
              <Button 
                onClick={() => onBorrow(asset)}
                className="w-full border border-gray-600 bg-transparent text-white rounded-xl hover:bg-gray-800"
              >
                Borrow
              </Button>
            </div>
          </div>

          {/* Asset Specific Info */}
          {asset.asset === 'XAUT' && (
            <div className="bg-[#f9b006]/10 border border-[#f9b006]/20 rounded-lg p-3">
              <p className="text-[#f9b006] text-sm font-medium">
                🥇 XAUT is backed by physical gold stored in secure vaults
              </p>
            </div>
          )}
        </div>
      ))}

      {filteredAssets.length === 0 && (
        <div className="text-center py-8">
          <p className="text-gray-400">No markets available</p>
        </div>
      )}
    </div>
  );
}