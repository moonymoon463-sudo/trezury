import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bug, Wallet, User, AlertCircle, CheckCircle, XCircle } from "lucide-react";
import { useWalletConnection } from "@/hooks/useWalletConnection";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";

export function WalletDebugPanel() {
  const { wallet, connectWallet, connecting } = useWalletConnection();
  const { user } = useAuth();
  const [testingEdge, setTestingEdge] = useState(false);
  const [edgeTestResult, setEdgeTestResult] = useState<string>('');

  const testEdgeFunction = async () => {
    setTestingEdge(true);
    setEdgeTestResult('');
    
    try {
      console.log('🧪 Testing supply-withdraw edge function directly...');
      
      const { data, error } = await supabase.functions.invoke('supply-withdraw', {
        body: {
          action: 'supply',
          asset: 'USDC',
          amount: 1,
          chain: 'ethereum'
        }
      });

      console.log('🧪 Edge function test response:', { data, error });
      
      if (error) {
        setEdgeTestResult(`❌ Error: ${error.message}`);
      } else if (data) {
        setEdgeTestResult(`✅ Success: ${JSON.stringify(data, null, 2)}`);
      } else {
        setEdgeTestResult('⚠️ No data returned');
      }
    } catch (err) {
      console.error('🧪 Edge function test failed:', err);
      setEdgeTestResult(`❌ Exception: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setTestingEdge(false);
    }
  };

  return (
    <Card className="border-2 border-dashed border-primary/50 bg-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bug className="h-5 w-5" />
          Debug Panel
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* User Authentication Status */}
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Authentication:
          </span>
          <Badge variant={user ? "default" : "destructive"}>
            {user ? (
              <>
                <CheckCircle className="h-3 w-3 mr-1" />
                Authenticated
              </>
            ) : (
              <>
                <XCircle className="h-3 w-3 mr-1" />
                Not Authenticated
              </>
            )}
          </Badge>
        </div>

        {/* Wallet Connection Status */}
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            Wallet:
          </span>
          <Badge variant={wallet.isConnected ? "default" : "destructive"}>
            {wallet.isConnected ? (
              <>
                <CheckCircle className="h-3 w-3 mr-1" />
                Connected
              </>
            ) : (
              <>
                <XCircle className="h-3 w-3 mr-1" />
                Disconnected
              </>
            )}
          </Badge>
        </div>

        {/* Wallet Details */}
        {wallet.isConnected && (
          <div className="space-y-2 text-sm">
            <div><strong>Address:</strong> {wallet.address}</div>
            <div><strong>Chain ID:</strong> {wallet.chainId}</div>
            <div><strong>Network:</strong> {wallet.networkName}</div>
            <div><strong>Supported:</strong> {wallet.isSupported ? 'Yes' : 'No'}</div>
            {wallet.balance && <div><strong>Balance:</strong> {wallet.balance} ETH</div>}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          {!wallet.isConnected && (
            <Button 
              onClick={connectWallet} 
              disabled={connecting}
              size="sm"
            >
              {connecting ? 'Connecting...' : 'Connect Wallet'}
            </Button>
          )}
          
          <Button 
            onClick={testEdgeFunction} 
            disabled={testingEdge}
            variant="outline"
            size="sm"
          >
            {testingEdge ? 'Testing...' : 'Test Edge Function'}
          </Button>
        </div>

        {/* Edge Function Test Result */}
        {edgeTestResult && (
          <div className="p-3 bg-muted rounded text-sm whitespace-pre-wrap">
            {edgeTestResult}
          </div>
        )}

        {/* Troubleshooting Tips */}
        <div className="text-xs text-muted-foreground space-y-1">
          <div className="flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            <span>Check browser console for detailed logs</span>
          </div>
          <div>• Authentication must be completed first</div>
          <div>• MetaMask must be installed and unlocked</div>
          <div>• Switch to a supported network (Ethereum, Sepolia)</div>
        </div>
      </CardContent>
    </Card>
  );
}