import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle2, Loader2, AlertCircle, ExternalLink } from 'lucide-react';

export default function AdminContractDeploy() {
  const [deploying, setDeploying] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedChain, setSelectedChain] = useState<'ethereum' | 'arbitrum'>('ethereum');

  const deployContract = async () => {
    try {
      setDeploying(true);
      setError(null);
      setResult(null);

      const { data, error: invokeError } = await supabase.functions.invoke(
        'contract-deployment',
        {
          body: { 
            operation: 'deploy_gelato_relay',
            chain: selectedChain 
          }
        }
      );

      if (invokeError) {
        throw invokeError;
      }

      if (!data.success) {
        throw new Error(data.error || 'Deployment failed');
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deployment failed');
    } finally {
      setDeploying(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>Deploy GelatoSwapRelay Contract</CardTitle>
          <CardDescription>
            Deploy the gasless swap contract to Ethereum or Arbitrum
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-semibold">Prerequisites:</p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>PLATFORM_PRIVATE_KEY secret must be set in Supabase</li>
                  <li>Ethereum: Min 0.05 ETH | Arbitrum: Min 0.01 ETH</li>
                  <li>Admin privileges required</li>
                </ul>
              </div>
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <label className="text-sm font-medium">Deployment Chain</label>
            <Select value={selectedChain} onValueChange={(value: 'ethereum' | 'arbitrum') => setSelectedChain(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select Chain" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ethereum">Ethereum Mainnet (chainId: 1)</SelectItem>
                <SelectItem value="arbitrum">Arbitrum One (chainId: 42161)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={deployContract}
            disabled={deploying}
            className="w-full"
            size="lg"
          >
            {deploying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deploying Contract...
              </>
            ) : (
              'Deploy Contract'
            )}
          </Button>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Deployment Failed:</strong> {error}
              </AlertDescription>
            </Alert>
          )}

          {result && (
            <Alert className="border-green-500 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-semibold text-green-800">✅ Contract Deployed Successfully!</p>
                  <div className="text-sm space-y-1">
                    <p><strong>Chain:</strong> <code className="bg-white px-2 py-1 rounded">{result.chain}</code></p>
                    <p><strong>Address:</strong> <code className="bg-white px-2 py-1 rounded">{result.contractAddress}</code></p>
                    <p><strong>TX Hash:</strong> <code className="bg-white px-2 py-1 rounded text-xs">{result.txHash}</code></p>
                    {result.etherscanUrl && (
                      <a
                        href={result.etherscanUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-blue-600 hover:text-blue-800"
                      >
                        View on {result.chain === 'ethereum' ? 'Etherscan' : 'Arbiscan'} <ExternalLink className="ml-1 h-3 w-3" />
                      </a>
                    )}
                  </div>
                  <p className="text-xs text-green-700 mt-2">
                    ✅ Contract address automatically stored as {result.chain === 'ethereum' ? 'GELATO_SWAP_CONTRACT_ADDRESS' : 'GELATO_SWAP_CONTRACT_ADDRESS_ARBITRUM'} secret
                  </p>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {result && (
            <Alert>
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-semibold">Next Steps:</p>
                  <ol className="list-decimal list-inside space-y-1 text-sm">
                    <li>Add GELATO_RELAY_API_KEY secret in Supabase (required)</li>
                    <li>Add GELATO_SPONSOR_API_KEY secret (optional, for sponsored mode)</li>
                    <li>Test gasless swaps in the Swap page</li>
                  </ol>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
