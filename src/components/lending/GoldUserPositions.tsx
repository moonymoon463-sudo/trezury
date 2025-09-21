import { useLendingOperations } from "@/hooks/useLendingOperations";
import { useEffect } from "react";
import { TrendingUp, TrendingDown, Shield } from "lucide-react";

export function GoldUserPositions() {
  const { userPositions, healthFactor, fetchUserPositions } = useLendingOperations();

  useEffect(() => {
    fetchUserPositions();
  }, []);

  const formatAmount = (amount: number) => {
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(2)}M`;
    } else if (amount >= 1000) {
      return `${(amount / 1000).toFixed(2)}K`;
    }
    return amount.toFixed(2);
  };

  const suppliedPositions = userPositions.filter(pos => pos.suppliedAmount > 0);
  const borrowedPositions = userPositions.filter(pos => pos.borrowedAmount > 0);

  const getHealthFactorColor = (factor: number) => {
    if (factor >= 2) return 'text-green-400';
    if (factor >= 1.5) return 'text-yellow-400';
    if (factor >= 1.2) return 'text-orange-400';
    return 'text-red-400';
  };

  const getHealthFactorStatus = (factor: number) => {
    if (factor >= 2) return 'Excellent';
    if (factor >= 1.5) return 'Good';
    if (factor >= 1.2) return 'Caution';
    return 'Risk';
  };

  return (
    <div className="space-y-6">
      {/* Health Factor */}
      <div className="bg-[#2C2C2E] rounded-xl p-4">
        <div className="flex items-center gap-3 mb-3">
          <Shield size={20} className={getHealthFactorColor(healthFactor)} />
          <h3 className="text-white font-semibold">Health Factor</h3>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className={`text-2xl font-bold ${getHealthFactorColor(healthFactor)}`}>
              {healthFactor.toFixed(2)}
            </div>
            <div className="text-sm text-gray-400">
              {getHealthFactorStatus(healthFactor)}
            </div>
          </div>
          {healthFactor < 1.2 && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2">
              <p className="text-red-400 text-xs">
                Add collateral or repay debt
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Supplied Assets */}
      {suppliedPositions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-green-400" />
            <h3 className="text-white font-semibold">Supplied Assets</h3>
          </div>
          {suppliedPositions.map((position, index) => (
            <div key={index} className="bg-[#2C2C2E] rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#f9b006] flex items-center justify-center">
                    <span className="text-black font-bold text-xs">{position.asset}</span>
                  </div>
                  <div>
                    <h4 className="text-white font-medium">{position.asset}</h4>
                    <p className="text-gray-400 text-sm capitalize">{position.chain}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-white font-semibold">
                    {formatAmount(position.suppliedAmount)}
                  </div>
                  <div className="text-green-400 text-sm">
                    +{formatAmount(position.supplyApy * position.suppliedAmount * 0.01)} APY
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Borrowed Assets */}
      {borrowedPositions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <TrendingDown size={16} className="text-red-400" />
            <h3 className="text-white font-semibold">Borrowed Assets</h3>
          </div>
          {borrowedPositions.map((position, index) => (
            <div key={index} className="bg-[#2C2C2E] rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#f9b006] flex items-center justify-center">
                    <span className="text-black font-bold text-xs">{position.asset}</span>
                  </div>
                  <div>
                    <h4 className="text-white font-medium">{position.asset}</h4>
                    <p className="text-gray-400 text-sm capitalize">{position.chain}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-white font-semibold">
                    {formatAmount(position.borrowedAmount)}
                  </div>
                  <div className="text-red-400 text-sm">
                    -{formatAmount(position.borrowApy * position.borrowedAmount * 0.01)} APY
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {suppliedPositions.length === 0 && borrowedPositions.length === 0 && (
        <div className="text-center py-8">
          <div className="w-16 h-16 rounded-full bg-[#2C2C2E] flex items-center justify-center mx-auto mb-4">
            <TrendingUp size={24} className="text-gray-400" />
          </div>
          <h3 className="text-white font-semibold mb-2">No Positions Yet</h3>
          <p className="text-gray-400 text-sm">
            Supply assets to start earning yield or borrow against your collateral.
          </p>
        </div>
      )}
    </div>
  );
}