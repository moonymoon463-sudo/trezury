import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Download, Wallet, DollarSign, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { feeCollectionService, FeeCollectionSummary, PlatformFeeRecord } from "@/services/feeCollectionService";
import { useToast } from "@/hooks/use-toast";

const AdminFees = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [summary, setSummary] = useState<FeeCollectionSummary | null>(null);
  const [recentFees, setRecentFees] = useState<PlatformFeeRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFeeData();
  }, []);

  const loadFeeData = async () => {
    try {
      setLoading(true);
      const [summaryData, feesData] = await Promise.all([
        feeCollectionService.getFeeCollectionSummary(),
        feeCollectionService.getCollectedFees()
      ]);
      
      setSummary(summaryData);
      setRecentFees(feesData.slice(0, 10)); // Show last 10 transactions
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error Loading Fees",
        description: "Failed to load fee collection data"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExportReport = async () => {
    try {
      const csvData = await feeCollectionService.exportFeeReport();
      const blob = new Blob([csvData], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `platform_fees_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Report Exported",
        description: "Fee collection report downloaded successfully"
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Export Failed",
        description: "Failed to export fee report"
      });
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-[#1C1C1E] items-center justify-center">
        <div className="text-white">Loading fee data...</div>
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
            onClick={() => navigate("/")}
            className="text-white hover:bg-gray-800"
          >
            <ArrowLeft size={24} />
          </Button>
          <h1 className="text-xl font-bold text-white flex-1 text-center pr-6">Platform Fees</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 pb-6 overflow-y-auto">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="bg-[#2C2C2E] border-gray-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">Total Fees Collected</CardTitle>
              <DollarSign className="h-4 w-4 text-green-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">${summary?.total_fees_usd.toFixed(2) || '0.00'}</div>
              <p className="text-xs text-gray-400">
                From {summary?.transaction_count || 0} transactions
              </p>
            </CardContent>
          </Card>

          <Card className="bg-[#2C2C2E] border-gray-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">Uncollected Fees</CardTitle>
              <TrendingUp className="h-4 w-4 text-yellow-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">${summary?.uncollected_fees_usd.toFixed(2) || '0.00'}</div>
              <p className="text-xs text-gray-400">
                Ready for withdrawal
              </p>
            </CardContent>
          </Card>

          <Card className="bg-[#2C2C2E] border-gray-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">Platform Wallet</CardTitle>
              <Wallet className="h-4 w-4 text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="text-sm font-mono text-white break-all">
                {feeCollectionService.getPlatformWallet()}
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Fee collection address
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex gap-4 mb-6">
          <Button 
            onClick={handleExportReport}
            className="bg-[#f9b006] text-black hover:bg-[#f9b006]/90"
          >
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </Button>
          <Button 
            variant="outline"
            className="border-gray-600 text-white hover:bg-gray-800"
            onClick={() => {
              navigator.clipboard.writeText(feeCollectionService.getPlatformWallet());
              toast({
                title: "Wallet Address Copied",
                description: "Platform wallet address copied to clipboard"
              });
            }}
          >
            <Wallet className="w-4 h-4 mr-2" />
            Copy Wallet
          </Button>
        </div>

        {/* Recent Transactions */}
        <Card className="bg-[#2C2C2E] border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Recent Fee Collections</CardTitle>
            <CardDescription className="text-gray-400">
              Latest transactions that generated platform fees
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recentFees.length === 0 ? (
              <div className="text-center text-gray-400 py-8">
                No fee collections yet
              </div>
            ) : (
              <div className="space-y-4">
                {recentFees.map((fee) => (
                  <div 
                    key={fee.transaction_id}
                    className="flex items-center justify-between p-4 bg-[#3C3C3E] rounded-lg"
                  >
                    <div>
                      <div className="text-white font-medium">
                        {fee.transaction_type.toUpperCase()} - {fee.fee_asset}
                      </div>
                      <div className="text-gray-400 text-sm">
                        {new Date(fee.collected_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-white font-bold">
                        ${fee.fee_amount_usd.toFixed(2)}
                      </div>
                      <div className="text-gray-400 text-sm">
                        Platform Fee
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card className="bg-[#2C2C2E] border-gray-700 mt-6">
          <CardHeader>
            <CardTitle className="text-white">How to Collect Your Fees</CardTitle>
          </CardHeader>
          <CardContent className="text-gray-300 space-y-3">
            <div>
              <strong className="text-white">1. Platform Wallet Address:</strong>
              <div className="font-mono text-sm bg-[#1C1C1E] p-2 rounded mt-1">
                {feeCollectionService.getPlatformWallet()}
              </div>
            </div>
            <div>
              <strong className="text-white">2. Fee Collection:</strong> Platform fees are automatically collected in USDC and GOLD tokens during each transaction.
            </div>
            <div>
              <strong className="text-white">3. Withdrawal:</strong> Currently fees are tracked but you need to implement a withdrawal mechanism to transfer collected fees from user wallets to your platform wallet.
            </div>
            <div>
              <strong className="text-white">4. Next Steps:</strong>
              <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                <li>Replace the placeholder wallet address with your actual wallet</li>
                <li>Implement automated fee transfers to your wallet</li>
                <li>Set up monitoring and alerts for fee collection</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default AdminFees;