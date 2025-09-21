import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingDown, Coins, Filter, ArrowUpDown, ChevronRight, Activity, AlertTriangle } from "lucide-react";
import { useAaveStyleLending } from "@/hooks/useAaveStyleLending";
import { Chain, Token, CHAIN_CONFIGS } from "@/types/lending";

interface BorrowMarketplaceProps {
  onSelectToken: (chain: Chain, token: Token, variableRate: number, stableRate: number) => void;
}

interface BorrowToken {
  chain: Chain;
  token: Token;
  variableRate: number;
  stableRate: number;
  availableLiquidity: number;
  utilization: number;
  riskLevel: 'Low' | 'Medium' | 'High';
  isActive: boolean;
  borrowingEnabled: boolean;
}

export function BorrowMarketplace({ onSelectToken }: BorrowMarketplaceProps) {
  const { poolReserves } = useAaveStyleLending();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedChain, setSelectedChain] = useState<Chain | "all">("all");
  const [sortBy, setSortBy] = useState<"variable" | "stable" | "liquidity">("variable");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Transform pool reserves into borrow tokens and group by symbol
  const allBorrowTokens: BorrowToken[] = poolReserves
    .filter(reserve => reserve.borrowing_enabled)
    .map(reserve => ({
      chain: reserve.chain as Chain,
      token: reserve.asset as Token,
      variableRate: reserve.borrow_rate_variable * 100,
      stableRate: reserve.borrow_rate_stable * 100,
      availableLiquidity: reserve.available_liquidity_dec,
      utilization: reserve.utilization_rate * 100,
      riskLevel: getRiskLevel(reserve.asset as Token),
      isActive: reserve.is_active,
      borrowingEnabled: reserve.borrowing_enabled
    }));

  // Group by token symbol and select the lowest variable rate for each token
  const borrowTokens: BorrowToken[] = Object.values(
    allBorrowTokens.reduce((acc, token) => {
      const key = token.token;
      if (!acc[key] || token.variableRate < acc[key].variableRate) {
        acc[key] = token;
      }
      return acc;
    }, {} as Record<string, BorrowToken>)
  );

  function getRiskLevel(token: Token): 'Low' | 'Medium' | 'High' {
    const riskMap: Record<Token, 'Low' | 'Medium' | 'High'> = {
      USDC: 'Low',
      USDT: 'Low', 
      DAI: 'Low',
      XAUT: 'Medium',
      AURU: 'High'
    };
    return riskMap[token] || 'Medium';
  }

  function getRiskColor(level: 'Low' | 'Medium' | 'High'): string {
    switch (level) {
      case 'Low': return 'text-green-500 bg-green-500/10';
      case 'Medium': return 'text-yellow-500 bg-yellow-500/10';
      case 'High': return 'text-red-500 bg-red-500/10';
    }
  }

  // Filter and sort tokens
  const filteredTokens = borrowTokens
    .filter(token => {
      const matchesSearch = token.token.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           token.chain.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesChain = selectedChain === "all" || token.chain === selectedChain;
      return matchesSearch && matchesChain;
    })
    .sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'variable':
          comparison = a.variableRate - b.variableRate;
          break;
        case 'stable':
          comparison = a.stableRate - b.stableRate;
          break;
        case 'liquidity':
          comparison = a.availableLiquidity - b.availableLiquidity;
          break;
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground mb-2">Borrow Marketplace</h2>
        <p className="text-muted-foreground">
          Compare borrowing rates across chains and choose the best terms
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search tokens or chains..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-surface-elevated border-border"
          />
        </div>
        
        <Select value={selectedChain} onValueChange={(value) => setSelectedChain(value as Chain | "all")}>
          <SelectTrigger className="w-full sm:w-40 bg-surface-elevated border-border">
            <SelectValue placeholder="All Chains" />
          </SelectTrigger>
          <SelectContent className="bg-surface-overlay border-border">
            <SelectItem value="all">All Chains</SelectItem>
            {Object.entries(CHAIN_CONFIGS).map(([key, config]) => (
              <SelectItem key={key} value={key}>
                {config.displayName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={(value) => setSortBy(value as "variable" | "stable" | "liquidity")}>
          <SelectTrigger className="w-full sm:w-40 bg-surface-elevated border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-surface-overlay border-border">
            <SelectItem value="variable">Variable Rate</SelectItem>
            <SelectItem value="stable">Stable Rate</SelectItem>
            <SelectItem value="liquidity">Liquidity</SelectItem>
          </SelectContent>
        </Select>

        <Button 
          variant="outline" 
          size="icon"
          onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
          className="bg-surface-elevated border-border"
        >
          <ArrowUpDown className="h-4 w-4" />
        </Button>
      </div>

      {/* Market Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-surface-elevated border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">Lowest Variable Rate</span>
            </div>
            <p className="text-2xl font-bold text-green-500">
              {Math.min(...borrowTokens.map(t => t.variableRate)).toFixed(2)}%
            </p>
          </CardContent>
        </Card>

        <Card className="bg-surface-elevated border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Coins className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">Borrowable Assets</span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {borrowTokens.length}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-surface-elevated border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">Active Markets</span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {borrowTokens.filter(t => t.isActive).length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Token List */}
      <div className="space-y-3">
        {filteredTokens.map((token) => (
          <Card 
            key={`${token.chain}-${token.token}`}
            className={`bg-surface-elevated border-border hover:bg-surface-overlay transition-colors cursor-pointer ${
              !token.isActive ? 'opacity-60' : ''
            }`}
            onClick={() => token.isActive && onSelectToken(token.chain, token.token, token.variableRate, token.stableRate)}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-destructive/20 to-destructive/5 flex items-center justify-center">
                    <span className="text-destructive font-bold">{token.token.charAt(0)}</span>
                  </div>
                  
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-foreground">{token.token}</h3>
                      <Badge variant="outline" className="border-muted text-muted-foreground">
                        {CHAIN_CONFIGS[token.chain]?.displayName}
                      </Badge>
                      <Badge className={getRiskColor(token.riskLevel)}>
                        {token.riskLevel} Risk
                      </Badge>
                      {!token.isActive && (
                        <Badge variant="secondary">Coming Soon</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {getTokenDescription(token.token)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <div className="flex items-center gap-1">
                      <TrendingDown className="h-4 w-4 text-green-500" />
                      <span className="text-lg font-bold text-green-500">
                        {token.variableRate.toFixed(2)}%
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">Variable APR</p>
                  </div>

                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-medium text-yellow-500">
                      {token.stableRate.toFixed(2)}%
                    </p>
                    <p className="text-xs text-muted-foreground">Stable APR</p>
                  </div>

                  <div className="text-right hidden md:block">
                    <p className="text-sm font-medium text-foreground">
                      ${token.availableLiquidity.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </p>
                    <p className="text-xs text-muted-foreground">Available</p>
                  </div>

                  {token.isActive && (
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredTokens.length === 0 && (
        <Card className="bg-surface-elevated border-border">
          <CardContent className="py-12 text-center">
            <Filter className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2 text-foreground">No borrowable assets found</h3>
            <p className="text-muted-foreground">
              Try adjusting your search or filter criteria
            </p>
          </CardContent>
        </Card>
      )}

      {/* Risk Warning */}
      <Card className="bg-card border border-destructive/30">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
            <div className="space-y-2 text-sm">
              <p className="font-medium text-destructive">
                Important Borrowing Risks
              </p>
              <ul className="space-y-1 text-card-foreground">
                <li>• Borrowed assets accrue interest continuously</li>
                <li>• Maintain health factor above 1.0 to avoid liquidation</li>
                <li>• Collateral value fluctuations affect borrowing capacity</li>
                <li>• Liquidation penalty ranges from 5% to 12.5%</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function getTokenDescription(token: Token): string {
  const descriptions: Record<Token, string> = {
    USDC: 'USD Coin - Fully collateralized US dollar stablecoin',
    USDT: 'Tether USD - Most liquid stablecoin pegged to USD',
    DAI: 'DAI Stablecoin - Decentralized stable currency',
    XAUT: 'Tether Gold - Digital gold backed by physical gold',
    AURU: 'Aurum Governance Token - Protocol governance and rewards'
  };
  return descriptions[token] || 'Digital asset available for borrowing';
}