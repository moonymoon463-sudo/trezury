import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bug, Wallet, User, AlertCircle, CheckCircle, XCircle, Search, Download } from "lucide-react";
import { useWalletConnection } from "@/hooks/useWalletConnection";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { ImportWalletKeyModal } from "./ImportWalletKeyModal";

export function WalletDebugPanel() {
  const { wallet, connectWallet, connecting } = useWalletConnection();
  const { user } = useAuth();
  const [testingEdge, setTestingEdge] = useState(false);
  const [edgeTestResult, setEdgeTestResult] = useState<string>('');
  const [diagnosticsResult, setDiagnosticsResult] = useState<any>(null);
  const [runningDiagnostics, setRunningDiagnostics] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  const runDiagnostics = async () => {
    setRunningDiagnostics(true);
    setDiagnosticsResult(null);
    
    try {
      console.log('🔍 Running wallet diagnostics...');
      
      const { data, error } = await supabase.functions.invoke('blockchain-operations', {
        body: { operation: 'wallet_diagnostics' }
      });

      console.log('🔍 Diagnostics response:', { data, error });
      
      if (error) {
        setDiagnosticsResult({ error: error.message });
      } else if (data) {
        setDiagnosticsResult(data);
      }
    } catch (err) {
      console.error('🔍 Diagnostics failed:', err);
      setDiagnosticsResult({ error: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      setRunningDiagnostics(false);
    }
  };

  const testEdgeFunction = async () => {
    setTestingEdge(true);
    setEdgeTestResult('');
    
    try {
      console.log('🧪 Testing blockchain-operations edge function...');
      
      const { data, error } = await supabase.functions.invoke('blockchain-operations', {
        body: {
          operation: 'get_balance',
          asset: 'USDC',
          address: wallet.address || '0x726951bef4b0C6E972da44b186a4Db8749A4B9B9'
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
        <div className="flex flex-wrap gap-2">
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
            onClick={runDiagnostics} 
            disabled={runningDiagnostics || !user}
            variant="default"
            size="sm"
          >
            <Search className="h-3 w-3 mr-1" />
            {runningDiagnostics ? 'Diagnosing...' : 'Run Wallet Diagnostics'}
          </Button>
          
          <Button 
            onClick={testEdgeFunction} 
            disabled={testingEdge}
            variant="outline"
            size="sm"
          >
            {testingEdge ? 'Testing...' : 'Test Edge Function'}
          </Button>
        </div>

        {/* Diagnostics Result */}
        {diagnosticsResult && (
          <div className="space-y-3">
            <div className="font-semibold text-sm flex items-center gap-2">
              {diagnosticsResult.error ? (
                <>
                  <XCircle className="h-4 w-4 text-destructive" />
                  Diagnostics Failed
                </>
              ) : diagnosticsResult.mismatch ? (
                <>
                  <AlertCircle className="h-4 w-4 text-warning" />
                  Wallet Mismatch Detected
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 text-success" />
                  Diagnostics Passed
                </>
              )}
            </div>
            
            {diagnosticsResult.error ? (
              <div className="p-3 bg-destructive/10 rounded text-sm text-destructive">
                {diagnosticsResult.error}
              </div>
            ) : (
              <>
                <div className="p-3 bg-muted rounded text-sm space-y-2">
                  <div><strong>Decrypted Wallet:</strong> {diagnosticsResult.decryptedAddress}</div>
                  <div><strong>Saved Addresses:</strong></div>
                  {diagnosticsResult.onchainAddresses?.map((addr: any, i: number) => (
                    <div key={i} className="ml-4 text-xs">
                      • {addr.address} ({addr.asset} on {addr.chain})
                    </div>
                  ))}
                  
                  <div><strong>Balances:</strong></div>
                  {Object.entries(diagnosticsResult.balances || {}).map(([address, bals]: [string, any]) => (
                    <div key={address} className="ml-4 text-xs space-y-1">
                      <div className="font-medium">{address}:</div>
                      {typeof bals === 'object' && !bals.error ? (
                        <>
                          <div className="ml-4">USDC: {bals.USDC}</div>
                          <div className="ml-4">XAUT: {bals.XAUT}</div>
                        </>
                      ) : (
                        <div className="ml-4 text-destructive">{bals.error || 'Unknown'}</div>
                      )}
                    </div>
                  ))}
                  
                  <div><strong>Uniswap Allowance:</strong> {diagnosticsResult.allowance} USDC</div>
                  <div><strong>Status:</strong> {diagnosticsResult.mismatch ? 'Mismatch' : 'OK'}</div>
                </div>
                
                {diagnosticsResult.notes && diagnosticsResult.notes.length > 0 && (
                  <div className="p-3 bg-warning/10 rounded text-sm space-y-1">
                    {diagnosticsResult.notes.map((note: string, i: number) => (
                      <div key={i}>{note}</div>
                    ))}
                  </div>
                )}
                
                <div className="p-3 bg-primary/10 rounded text-sm">
                  <strong>Recommendation:</strong> {diagnosticsResult.recommendation}
                </div>
                
                {diagnosticsResult.mismatch && (
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => setShowImportModal(true)} 
                      variant="outline" 
                      size="sm"
                    >
                      <Download className="h-3 w-3 mr-1" />
                      Import Correct Key
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

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
          <div>• Run diagnostics to check wallet balances</div>
          <div>• Fund the decrypted address shown above to perform swaps</div>
        </div>
      </CardContent>
      
      <ImportWalletKeyModal 
        open={showImportModal} 
        onOpenChange={setShowImportModal}
        onSuccess={() => {
          setShowImportModal(false);
          runDiagnostics();
        }}
      />
    </Card>
  );
}