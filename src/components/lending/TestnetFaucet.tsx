import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Droplets } from "lucide-react";
import { blockchainTestnetService } from "@/services/blockchainTestnetService";
import { useToast } from "@/hooks/use-toast";

export function TestnetFaucet() {
  const [loading, setLoading] = useState<string | null>(null);
  const { toast } = useToast();

  const faucets = blockchainTestnetService.getTestnetFaucets();
  const networkInfo = blockchainTestnetService.getNetworkInfo();

  const handleFaucetClick = (tokenName: string, url: string) => {
    setLoading(tokenName);
    
    // Open faucet in new tab
    window.open(url, '_blank');
    
    // Show helpful toast
    toast({
      title: "Faucet Opened",
      description: `Get ${tokenName} tokens from the faucet to test lending features`
    });

    // Clear loading state after a moment
    setTimeout(() => setLoading(null), 2000);
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Droplets className="h-5 w-5 text-primary" />
          <CardTitle>Testnet Faucet</CardTitle>
        </div>
        <CardDescription>
          Get test tokens on {networkInfo.name} to try out lending features
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">
            Available Test Tokens:
          </div>
          
          {Object.entries(faucets).map(([token, url]) => (
            <div key={token} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{token}</Badge>
                <span className="text-sm">
                  {token === 'ETH' ? 'For gas fees' : 
                   token === 'USDC' ? 'For lending' : 'General faucet'}
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleFaucetClick(token, url)}
                disabled={loading === token}
              >
                {loading === token ? 'Opening...' : (
                  <>
                    Get {token}
                    <ExternalLink className="ml-1 h-3 w-3" />
                  </>
                )}
              </Button>
            </div>
          ))}
        </div>

        <div className="pt-4 border-t">
          <div className="text-xs text-muted-foreground space-y-1">
            <div>Network: {networkInfo.name}</div>
            <div>Chain ID: {networkInfo.chainId}</div>
            <div className="text-orange-600 dark:text-orange-400">
              ⚠️ These are test tokens with no real value
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}