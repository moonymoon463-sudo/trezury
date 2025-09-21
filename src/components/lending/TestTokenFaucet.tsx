import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Droplets, Fuel } from "lucide-react";
import { PRE_DEPLOYED_CONTRACTS } from "@/contracts/config";
import { Chain, Token } from "@/types/lending";
import { useToast } from "@/hooks/use-toast";

interface TestTokenFaucetProps {
  chain?: Chain;
}

export function TestTokenFaucet({ chain = 'ethereum' }: TestTokenFaucetProps) {
  const { toast } = useToast();
  
  const faucets = PRE_DEPLOYED_CONTRACTS[chain]?.faucets;
  const tokens = PRE_DEPLOYED_CONTRACTS[chain]?.tokens;

  if (!faucets || !tokens) {
    return null;
  }

  const handleFaucetClick = (token: Token, url: string) => {
    window.open(url, '_blank');
    toast({
      title: `${token} Faucet Opened`,
      description: `Get test ${token} tokens to interact with the lending protocol`,
    });
  };

  const getTokenDescription = (token: Token): string => {
    const descriptions = {
      USDC: 'Stable USD Coin for lending/borrowing',
      DAI: 'Decentralized stablecoin',
      USDT: 'Tether USD stablecoin',
      XAUT: 'Gold-backed token (using WETH)',
      AURU: 'Governance token (using LINK)'
    };
    return descriptions[token] || '';
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Droplets className="h-5 w-5 text-primary" />
          Test Token Faucets
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Get free test tokens to interact with the lending protocol on {chain}
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3">
          {Object.entries(faucets).map(([tokenKey, faucetUrl]) => {
            const token = tokenKey as Token;
            const tokenAddress = tokens[token];
            
            return (
              <div
                key={token}
                className="flex items-center justify-between p-3 rounded-lg bg-surface-elevated border border-border"
              >
                <div className="flex items-center gap-3">
                  <Fuel className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-foreground">{token}</h4>
                      <Badge variant="secondary" className="text-xs">
                        {tokenAddress.substring(0, 8)}...
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {getTokenDescription(token)}
                    </p>
                  </div>
                </div>
                
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleFaucetClick(token, faucetUrl)}
                  className="min-w-[100px]"
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Get {token}
                </Button>
              </div>
            );
          })}
        </div>
        
        <div className="mt-4 p-3 rounded-lg bg-info/10 border border-info/20">
          <p className="text-xs text-info">
            💡 <strong>Pro tip:</strong> Get ETH from{' '}
            <Button
              variant="link"
              size="sm"
              onClick={() => window.open('https://sepoliafaucet.com/', '_blank')}
              className="h-auto p-0 text-xs text-primary"
            >
              sepoliafaucet.com
            </Button>
            {' '}first, then claim other tokens from their respective faucets.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}