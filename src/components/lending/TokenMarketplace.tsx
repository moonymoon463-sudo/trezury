import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, Coins, Filter, ArrowUpDown, ChevronRight, Activity, Wallet } from "lucide-react";
import { useAaveStyleLending } from "@/hooks/useAaveStyleLending";
import { useWalletConnection } from "@/hooks/useWalletConnection";
import { useWalletBalance } from "@/hooks/useWalletBalance";
import { Chain, Token, CHAIN_CONFIGS } from "@/types/lending";

interface TokenMarketplaceProps {
  onSelectToken: (chain: Chain, token: Token, apy: number) => void;
}

interface MarketToken {
  chain: Chain;
  token: Token;
  apy: number;
  totalSupplied: number;
  availableLiquidity: number;
  utilization: number;
  riskLevel: 'Low' | 'Medium' | 'High';
  isActive: boolean;
}

export function TokenMarketplace({ onSelectToken }: TokenMarketplaceProps) {
  const { poolReserves } = useAaveStyleLending();
  const { wallet, connectWallet } = useWalletConnection();  
  const { balances, getBalance } = useWalletBalance();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedChain, setSelectedChain] = useState<Chain | "all">("all");
  const [sortBy, setSortBy] = useState<"apy" | "liquidity" | "risk">("apy");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const isWalletConnected = wallet.isConnected;

  // Transform pool reserves into market tokens and group by token symbol
  const allMarketTokens: MarketToken[] = poolReserves.map(reserve => ({
    chain: reserve.chain as Chain,
    token: reserve.asset as Token,
    apy: reserve.supply_rate * 100,
    totalSupplied: reserve.total_supply_dec,
    availableLiquidity: reserve.available_liquidity_dec,
    utilization: reserve.utilization_rate * 100,
    riskLevel: getRiskLevel(reserve.asset as Token),
    isActive: reserve.is_active
  }));

  // Group by token symbol and select the highest APY for each token
  const marketTokens: MarketToken[] = Object.values(
    allMarketTokens.reduce((acc, token) => {
      const key = token.token;
      if (!acc[key] || token.apy > acc[key].apy) {
        acc[key] = token;
      }
      return acc;
    }, {} as Record<string, MarketToken>)
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
  const filteredTokens = marketTokens
    .filter(token => {
      const matchesSearch = token.token.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           token.chain.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesChain = selectedChain === "all" || token.chain === selectedChain;
      return matchesSearch && matchesChain;
    })
    .sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'apy':
          comparison = a.apy - b.apy;
          break;
        case 'liquidity':
          comparison = a.availableLiquidity - b.availableLiquidity;
          break;
        case 'risk':
          const riskOrder = { 'Low': 1, 'Medium': 2, 'High': 3 };
          comparison = riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
          break;
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });


  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground mb-2">Token Marketplace</h2>
        <p className="text-muted-foreground">
          Discover the best yields across multiple chains and assets
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

        <Select value={sortBy} onValueChange={(value) => setSortBy(value as "apy" | "liquidity" | "risk")}>
          <SelectTrigger className="w-full sm:w-32 bg-surface-elevated border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-surface-overlay border-border">
            <SelectItem value="apy">Sort by APY</SelectItem>
            <SelectItem value="liquidity">Sort by Liquidity</SelectItem>
            <SelectItem value="risk">Sort by Risk</SelectItem>
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
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">Highest APY</span>
            </div>
            <p className="text-2xl font-bold text-primary">
              {Math.max(...marketTokens.map(t => t.apy)).toFixed(2)}%
            </p>
          </CardContent>
        </Card>

        <Card className="bg-surface-elevated border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Coins className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">Available Assets</span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {new Set(marketTokens.map(t => t.token)).size}
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
              {marketTokens.filter(t => t.isActive).length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Token List */}
      <div className="space-y-3">
        {filteredTokens.map((token, index) => (
          <Card 
            key={`${token.chain}-${token.token}`}
            className={`bg-surface-elevated border-border hover:bg-surface-overlay transition-colors ${
              !token.isActive ? 'cursor-not-allowed opacity-60' : ''
            }`}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                    <span className="text-primary font-bold">{token.token.charAt(0)}</span>
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

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="flex items-center gap-1">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      <span className="text-xl font-bold text-primary">
                        {token.apy.toFixed(2)}%
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">Supply APY</p>
                  </div>

                  {isWalletConnected && (
                    <div className="text-right">
                      <div className="flex items-center gap-1">
                        <Wallet className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium text-foreground">
                          {getBalance(token.token === 'XAUT' ? 'GOLD' : token.token).toFixed(4)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">Your Balance</p>
                    </div>
                  )}

                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-medium text-foreground">
                      ${token.availableLiquidity.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </p>
                    <p className="text-xs text-muted-foreground">Available</p>
                  </div>

                  {token.isActive && (
                    <div className="flex gap-2">
                      {isWalletConnected ? (
                        <>
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectToken(token.chain, token.token, token.apy);
                            }}
                            className="bg-primary hover:bg-primary/90"
                          >
                            Supply
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              // Add quick borrow functionality here
                            }}
                          >
                            Borrow
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            connectWallet();
                          }}
                          className="flex items-center gap-2"
                        >
                          <Wallet className="h-3 w-3" />
                          Connect Wallet
                        </Button>
                      )}
                    </div>
                  )}

                  {!token.isActive && (
                    <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
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
            <h3 className="text-lg font-medium mb-2 text-foreground">No tokens found</h3>
            <p className="text-muted-foreground">
              Try adjusting your search or filter criteria
            </p>
          </CardContent>
        </Card>
      )}
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
  return descriptions[token] || 'Digital asset for lending and borrowing';
}