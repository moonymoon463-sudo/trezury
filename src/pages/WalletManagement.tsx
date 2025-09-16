import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Wallet, RefreshCw, AlertTriangle, CheckCircle, Copy } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useBlockchainWallet } from "@/hooks/useBlockchainWallet";
import { realTimeBalanceService } from "@/services/realTimeBalanceService";
import { feeCollectionBot } from "@/services/feeCollectionBot";
import { useToast } from "@/hooks/use-toast";

const WalletManagement = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { walletInfo, balanceStatus, loading, generateWallet, forceSync } = useBlockchainWallet();
  const [botRunning, setBotRunning] = useState(false);

  useEffect(() => {
    // Start balance synchronization service
    realTimeBalanceService.start();
    return () => realTimeBalanceService.stop();
  }, []);

  const handleStartFeeBot = () => {
    feeCollectionBot.start();
    setBotRunning(true);
    toast({
      title: "Fee Collection Started",
      description: "Automated fee collection is now running"
    });
  };

  const handleStopFeeBot = () => {
    feeCollectionBot.stop();
    setBotRunning(false);
    toast({
      title: "Fee Collection Stopped",
      description: "Automated fee collection has been stopped"
    });
  };

  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    toast({
      title: "Address Copied",
      description: "Wallet address copied to clipboard"
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-[#1C1C1E] items-center justify-center">
        <div className="text-white">Loading wallet information...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#1C1C1E]">
      {/* Header */}
      <header className="p-4">
        <div className="flex items-center">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate("/admin/fees")}
            className="text-white hover:bg-gray-800"
          >
            <ArrowLeft size={24} />
          </Button>
          <h1 className="text-xl font-bold text-white flex-1 text-center pr-6">Wallet Management</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 pb-6 overflow-y-auto space-y-6">
        
        {/* Wallet Addresses */}
        <Card className="bg-[#2C2C2E] border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Wallet Addresses</CardTitle>
            <CardDescription className="text-gray-400">
              Ethereum addresses for USDC and XAUT tokens
            </CardDescription>
          </CardHeader>
          <CardContent>
            {walletInfo.length === 0 ? (
              <div className="text-center py-6">
                <Wallet className="mx-auto h-12 w-12 text-gray-500 mb-4" />
                <p className="text-gray-400 mb-4">No wallet addresses generated</p>
                <Button 
                  onClick={generateWallet}
                  className="bg-[#f9b006] text-black hover:bg-[#f9b006]/90"
                >
                  Generate Wallet
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {walletInfo.map((wallet, index) => (
                  <div key={index} className="bg-[#3C3C3E] rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white font-medium">{wallet.asset} Wallet</span>
                      <span className="text-gray-400 text-sm">{wallet.chain}</span>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <code className="bg-[#1C1C1E] px-2 py-1 rounded text-xs text-white flex-1">
                        {wallet.address}
                      </code>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => copyAddress(wallet.address)}
                        className="text-gray-400 hover:text-white"
                      >
                        <Copy size={14} />
                      </Button>
                    </div>
                    <div className="text-white font-bold">
                      {wallet.balance.toFixed(6)} {wallet.asset}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Balance Sync Status */}
        <Card className="bg-[#2C2C2E] border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Balance Synchronization</CardTitle>
            <CardDescription className="text-gray-400">
              Real-time sync between database and blockchain
            </CardDescription>
          </CardHeader>
          <CardContent>
            {balanceStatus.length === 0 ? (
              <p className="text-gray-400">No balance data available</p>
            ) : (
              <div className="space-y-4">
                {balanceStatus.map((balance, index) => (
                  <div key={index} className="bg-[#3C3C3E] rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white font-medium">{balance.asset}</span>
                      <div className="flex items-center gap-2">
                        {balance.is_synced ? (
                          <CheckCircle className="text-green-500" size={16} />
                        ) : (
                          <AlertTriangle className="text-yellow-500" size={16} />
                        )}
                        <span className="text-xs text-gray-400">
                          {balance.is_synced ? 'Synced' : 'Out of sync'}
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-400">Database</p>
                        <p className="text-white">{balance.database_balance.toFixed(6)}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Blockchain</p>
                        <p className="text-white">{balance.blockchain_balance.toFixed(6)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Fee Collection Control */}
        <Card className="bg-[#2C2C2E] border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Automated Fee Collection</CardTitle>
            <CardDescription className="text-gray-400">
              Control the automated platform fee collection bot
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-white">Collection Bot Status</span>
              <span className={`px-2 py-1 rounded text-xs ${
                botRunning ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
              }`}>
                {botRunning ? 'Running' : 'Stopped'}
              </span>
            </div>
            
            <div className="flex gap-2">
              <Button 
                onClick={handleStartFeeBot}
                disabled={botRunning}
                className="bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
              >
                Start Bot
              </Button>
              <Button 
                onClick={handleStopFeeBot}
                disabled={!botRunning}
                variant="outline"
                className="border-gray-600 text-white hover:bg-gray-800 disabled:opacity-50"
              >
                Stop Bot
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-4">
          <Button 
            onClick={forceSync}
            disabled={loading}
            className="bg-blue-600 text-white hover:bg-blue-700 flex-1"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Force Sync
          </Button>
          
          <Button 
            onClick={generateWallet}
            disabled={loading}
            className="bg-[#f9b006] text-black hover:bg-[#f9b006]/90 flex-1"
          >
            <Wallet className="w-4 h-4 mr-2" />
            Generate Wallet
          </Button>
        </div>

        {/* Instructions */}
        <Card className="bg-[#2C2C2E] border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Platform Management Guide</CardTitle>
          </CardHeader>
          <CardContent className="text-gray-300 space-y-3">
            <div>
              <strong className="text-white">1. Wallet Generation:</strong> Generate unique Ethereum addresses for each user to hold USDC and XAUT tokens.
            </div>
            <div>
              <strong className="text-white">2. Balance Sync:</strong> Automatically syncs database balances with actual blockchain balances every minute.
            </div>
            <div>
              <strong className="text-white">3. Fee Collection:</strong> Automated bot collects platform fees and transfers them to your wallet every 5 minutes.
            </div>
            <div>
              <strong className="text-white">4. Production Setup:</strong>
              <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                <li>Replace mock blockchain calls with actual Ethereum integration (ethers.js)</li>
                <li>Set up proper wallet generation with secure key management</li>
                <li>Implement real token transfer mechanisms</li>
                <li>Add monitoring and alerting systems</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default WalletManagement;