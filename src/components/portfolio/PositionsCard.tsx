import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  PiggyBank, 
  CreditCard,
  Shield,
  ShieldOff
} from "lucide-react";
import { PortfolioAsset } from "@/hooks/usePortfolioMonitoring";
import { useNavigate } from "react-router-dom";

interface PositionsCardProps {
  assetsByType: {
    wallet: PortfolioAsset[];
    supplied: PortfolioAsset[];
    borrowed: PortfolioAsset[];
  };
}

export function PositionsCard({ assetsByType }: PositionsCardProps) {
  const navigate = useNavigate();

  const AssetRow = ({ asset, showActions = false }: { asset: PortfolioAsset; showActions?: boolean }) => (
    <div className="flex items-center justify-between p-2 bg-surface-elevated rounded-lg">
      <div className="flex items-center gap-3">
        <div className="w-7 h-7 bg-primary/10 rounded-full flex items-center justify-center">
          <span className="text-xs font-bold text-primary">{asset.asset}</span>
        </div>
        <div>
          <p className="font-medium text-sm">{asset.asset}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{asset.chain}</span>
            {asset.isCollateral !== undefined && (
              <>
                <span>•</span>
                {asset.isCollateral ? (
                  <div className="flex items-center gap-1 text-status-success">
                    <Shield className="h-3 w-3" />
                    <span>Collateral</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <ShieldOff className="h-3 w-3" />
                    <span>Not collateral</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      <div className="text-right">
        <p className="font-semibold text-sm">
          {(asset.balance || 0) >= 0 ? '' : '-'}
          {Math.abs(asset.balance || 0).toLocaleString('en-US', { 
            minimumFractionDigits: 2, 
            maximumFractionDigits: 4 
          })}
        </p>
        <p className="text-xs text-muted-foreground">
          ${Math.abs(asset.valueUSD || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
        </p>
        {asset.apy && asset.apy > 0 && (
          <div className={`text-xs flex items-center gap-1 ${
            asset.type === 'supplied' ? 'text-status-success' : 'text-status-error'
          }`}>
            {asset.type === 'supplied' ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            <span>{(asset.apy * 100).toFixed(2)}% APY</span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Positions</CardTitle>
      </CardHeader>
      <CardContent className="p-3">
        <Tabs defaultValue="wallet" className="w-full">
          <TabsList className="grid w-full grid-cols-3 h-8 text-sm mt-2">
            <TabsTrigger value="wallet" className="flex items-center gap-1">
              <Wallet className="h-4 w-4" />
              Wallet
            </TabsTrigger>
            <TabsTrigger value="supplied" className="flex items-center gap-1">
              <PiggyBank className="h-4 w-4" />
              Supplied
            </TabsTrigger>
            <TabsTrigger value="borrowed" className="flex items-center gap-1">
              <CreditCard className="h-4 w-4" />
              Borrowed
            </TabsTrigger>
          </TabsList>

          <TabsContent value="wallet" className="space-y-3 mt-4">
            {assetsByType.wallet.length > 0 ? (
              <>
                {assetsByType.wallet.map((asset, index) => (
                  <AssetRow key={index} asset={asset} />
                ))}
                <Button 
                  onClick={() => navigate('/wallet')}
                  variant="outline" 
                  size="sm" 
                  className="w-full"
                >
                  Manage Wallet
                </Button>
              </>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <Wallet className="h-6 w-6 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No wallet assets</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="supplied" className="space-y-3 mt-4">
            {assetsByType.supplied.length > 0 ? (
              <>
                {assetsByType.supplied.map((asset, index) => (
                  <AssetRow key={index} asset={asset} showActions />
                ))}
                <Button 
                  onClick={() => navigate('/lending?tab=supply')}
                  variant="outline" 
                  size="sm" 
                  className="w-full"
                >
                  Supply More Assets
                </Button>
              </>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <PiggyBank className="h-6 w-6 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No supplied assets</p>
                <Button 
                  onClick={() => navigate('/lending?tab=supply')}
                  variant="outline" 
                  size="sm" 
                  className="mt-2"
                >
                  Start Earning Interest
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="borrowed" className="space-y-3 mt-4">
            {assetsByType.borrowed.length > 0 ? (
              <>
                {assetsByType.borrowed.map((asset, index) => (
                  <AssetRow key={index} asset={asset} showActions />
                ))}
                <Button 
                  onClick={() => navigate('/lending?tab=borrow')}
                  variant="outline" 
                  size="sm" 
                  className="w-full"
                >
                  Manage Borrows
                </Button>
              </>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <CreditCard className="h-6 w-6 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No borrowed assets</p>
                {assetsByType.supplied.length > 0 && (
                  <Button 
                    onClick={() => navigate('/lending?tab=borrow')}
                    variant="outline" 
                    size="sm" 
                    className="mt-2"
                  >
                    Borrow Against Collateral
                  </Button>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}