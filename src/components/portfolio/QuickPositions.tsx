import { ArrowRight, Wallet, TrendingUp, DollarSign } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PortfolioAsset } from "@/hooks/usePortfolioMonitoring";

interface QuickPositionsProps {
  assetsByType: {
    wallet: PortfolioAsset[];
    supplied: PortfolioAsset[];
    borrowed: PortfolioAsset[];
  };
}

export const QuickPositions = ({ assetsByType }: QuickPositionsProps) => {
  const navigate = useNavigate();

  // Get top 3 assets by value across all types
  const allAssets = [
    ...assetsByType.wallet,
    ...assetsByType.supplied,
    ...assetsByType.borrowed
  ];
  
  const topAssets = allAssets
    .sort((a, b) => b.valueUSD - a.valueUSD)
    .slice(0, 3);

  const getAssetIcon = (asset: PortfolioAsset) => {
    if (asset.type === 'supplied') return <TrendingUp className="h-4 w-4 text-status-success" />;
    if (asset.type === 'borrowed') return <DollarSign className="h-4 w-4 text-status-error" />;
    return <Wallet className="h-4 w-4 text-primary" />;
  };

  const getAssetTypeLabel = (type: string) => {
    switch (type) {
      case 'supplied': return 'Earning';
      case 'borrowed': return 'Borrowed';
      default: return 'Wallet';
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-foreground text-base font-semibold">Quick Positions</h3>
        <button
          onClick={() => navigate('/portfolio')}
          className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
        >
          View All
          <ArrowRight className="h-3 w-3" />
        </button>
      </div>

      {topAssets.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-muted-foreground text-sm mb-3">No positions yet</p>
          <button
            onClick={() => navigate('/buy-sell-hub')}
            className="text-primary text-sm hover:text-primary/80 transition-colors"
          >
            Get started by buying your first assets
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {topAssets.map((asset, index) => (
            <div key={`${asset.asset}-${asset.type}-${index}`} className="flex items-center justify-between p-2 bg-surface-elevated rounded-lg">
              <div className="flex items-center gap-2">
                {getAssetIcon(asset)}
                <div>
                  <p className="text-foreground text-sm font-medium">{asset.asset}</p>
                  <p className="text-muted-foreground text-xs">{getAssetTypeLabel(asset.type)}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-foreground text-sm font-medium">
                  ${asset.valueUSD.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </p>
                <p className="text-muted-foreground text-xs">
                  {asset.balance.toFixed(3)} {asset.asset}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};