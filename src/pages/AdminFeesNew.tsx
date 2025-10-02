import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Download, Wallet, DollarSign, TrendingUp, ExternalLink, Clock, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { feeCollectionService, FeeCollectionSummary, PlatformFeeRecord } from "@/services/feeCollectionService";
import { externalWalletFeeCollectionBot } from "@/services/externalWalletFeeCollectionBot";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import TestDataManager from "@/components/admin/TestDataManager";
import SystemMonitor from "@/components/admin/SystemMonitor";
import SecurityAuditDashboard from "@/components/admin/SecurityAuditDashboard";

interface FeeCollectionRequest {
  id: string;
  user_id: string;
  transaction_id: string;
  from_address: string;
  to_address: string;
  amount: number;
  asset: string;
  status: 'pending' | 'completed' | 'failed';
  external_tx_hash?: string;
  created_at: string;
  completed_at?: string;
}

const AdminFeesNew = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [summary, setSummary] = useState<FeeCollectionSummary | null>(null);
  const [recentFees, setRecentFees] = useState<PlatformFeeRecord[]>([]);
  const [feeRequests, setFeeRequests] = useState<FeeCollectionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [botStats, setBotStats] = useState<any>(null);
  const [collectingFees, setCollectingFees] = useState(false);

  useEffect(() => {
    loadFeeData();
  }, []);

  const loadFeeData = async () => {
    try {
      setLoading(true);
      const [summaryData, feesData, stats, requests] = await Promise.all([
        feeCollectionService.getFeeCollectionSummary(),
        feeCollectionService.getCollectedFees(),
        externalWalletFeeCollectionBot.getFeeCollectionStats(),
        loadFeeCollectionRequests()
      ]);
      
      setSummary(summaryData);
      setRecentFees(feesData.slice(0, 10));
      setBotStats(stats);
      setFeeRequests(requests);
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

  const loadFeeCollectionRequests = async (): Promise<FeeCollectionRequest[]> => {
    const { data: requests } = await supabase
      .from('fee_collection_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    return (requests || []).map(request => ({
      id: request.id,
      user_id: request.user_id,
      transaction_id: request.transaction_id,
      from_address: request.from_address,
      to_address: request.to_address,
      amount: Number(request.amount),
      asset: request.asset,
      status: request.status as 'pending' | 'completed' | 'failed',
      external_tx_hash: request.external_tx_hash,
      created_at: request.created_at,
      completed_at: request.completed_at
    }));
  };

  const handleGenerateFeeRequests = async () => {
    try {
      setCollectingFees(true);
      const results = await externalWalletFeeCollectionBot.collectAllPendingFees();
      
      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;
      
      if (successCount > 0) {
        toast({
          title: "Fee Requests Generated",
          description: `Generated ${successCount} collection requests${failCount > 0 ? `, ${failCount} failed` : ''}`
        });
        loadFeeData();
      } else if (failCount > 0) {
        toast({
          variant: "destructive",
          title: "Generation Failed",
          description: `Failed to generate ${failCount} requests`
        });
      } else {
        toast({
          title: "No Fees to Process",
          description: "All platform fees are already processed or collected"
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Generation Error",
        description: "Failed to generate fee collection requests"
      });
    } finally {
      setCollectingFees(false);
    }
  };

  const handleMarkAsCompleted = async (requestId: string, txHash: string) => {
    try {
      const { error } = await supabase
        .from('fee_collection_requests')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          external_tx_hash: txHash
        })
        .eq('id', requestId);

      if (error) throw error;

      toast({
        title: "Request Completed",
        description: "Fee collection request marked as completed"
      });
      
      loadFeeData();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: "Failed to update request status"
      });
    }
  };

  const handleExportGnosisSafe = async () => {
    try {
      const response = await fetch(`https://auntkvllzejtfqmousxg.supabase.co/functions/v1/fee-collection-api/export/gnosis-safe`);
      const data = await response.json();
      
      if (data.success) {
        const blob = new Blob([JSON.stringify(data.gnosisBatch, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `gnosis-safe-batch-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        toast({
          title: "Gnosis Safe Batch Exported",
          description: `${data.totalRequests} fee collections ready for Gnosis Safe`
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Export Failed",
        description: "Failed to export Gnosis Safe batch"
      });
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-background items-center justify-center">
        <div className="text-white">Loading fee data...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
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
          <h1 className="text-xl font-bold text-white flex-1 text-center pr-6">External Wallet Fee Collection</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 pb-6 overflow-y-auto">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="bg-[#2C2C2E] border-gray-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">Collected Fees</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">${botStats?.total_collected_usd?.toFixed(2) || '0.00'}</div>
              <p className="text-xs text-gray-400">
                From {botStats?.collection_count || 0} collections
              </p>
            </CardContent>
          </Card>

          <Card className="bg-[#2C2C2E] border-gray-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">Pending Requests</CardTitle>
              <Clock className="h-4 w-4 text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">${botStats?.total_pending_requests_usd?.toFixed(2) || '0.00'}</div>
              <p className="text-xs text-gray-400">
                {botStats?.pending_requests_count || 0} requests ready
              </p>
            </CardContent>
          </Card>

          <Card className="bg-[#2C2C2E] border-gray-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">Uncollected Fees</CardTitle>
              <TrendingUp className="h-4 w-4 text-yellow-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">${botStats?.total_uncollected_usd?.toFixed(2) || '0.00'}</div>
              <p className="text-xs text-gray-400">
                Need request generation
              </p>
            </CardContent>
          </Card>

          <Card className="bg-[#2C2C2E] border-gray-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">Platform Wallet</CardTitle>
              <Wallet className="h-4 w-4 text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="text-xs font-mono text-white break-all">
                0xb46DA2C95D65e3F24B48653F1AaFe8BDA7c64835
              </div>
              <p className="text-xs text-gray-400 mt-1">
                External wallet integration
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex gap-4 mb-6 flex-wrap">
          <Button 
            onClick={handleGenerateFeeRequests}
            disabled={collectingFees}
            className="bg-blue-600 text-white hover:bg-blue-700"
          >
            {collectingFees ? "Generating..." : "Generate Fee Requests"}
          </Button>
          <Button 
            onClick={handleExportGnosisSafe}
            className="bg-purple-600 text-white hover:bg-purple-700"
          >
            <Download className="w-4 h-4 mr-2" />
            Export Gnosis Safe
          </Button>
          <Button 
            variant="outline"
            className="border-gray-600 text-white hover:bg-gray-800"
            onClick={() => {
              navigator.clipboard.writeText('0xb46DA2C95D65e3F24B48653F1AaFe8BDA7c64835');
              toast({
                title: "Wallet Address Copied",
                description: "Platform wallet address copied to clipboard"
              });
            }}
          >
            <Wallet className="w-4 h-4 mr-2" />
            Copy Wallet
          </Button>
          <Button 
            variant="outline"
            className="border-gray-600 text-white hover:bg-gray-800"
            onClick={() => window.open('https://auntkvllzejtfqmousxg.supabase.co/functions/v1/fee-collection-api/pending-requests', '_blank')}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            API Endpoint
          </Button>
        </div>

        {/* Fee Collection Requests */}
        <Card className="bg-card border-border mb-6">
          <CardHeader>
            <CardTitle className="text-white">Fee Collection Requests</CardTitle>
            <CardDescription className="text-muted-foreground">
              Pending fee collections for external wallet processing
            </CardDescription>
          </CardHeader>
          <CardContent>
            {feeRequests.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                No fee collection requests yet
              </div>
            ) : (
              <div className="space-y-4">
                {feeRequests.slice(0, 10).map((request) => (
                  <div 
                    key={request.id}
                    className="flex items-center justify-between p-4 bg-accent rounded-lg"
                  >
                    <div>
                      <div className="text-white font-medium">
                        {request.asset} Fee Request
                      </div>
                      <div className="text-gray-400 text-sm">
                        From: {request.from_address.slice(0, 6)}...{request.from_address.slice(-4)}
                      </div>
                      <div className="text-gray-400 text-xs">
                        {new Date(request.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-white font-bold">
                        {request.amount} {request.asset}
                      </div>
                      <div className={`text-xs px-2 py-1 rounded ${
                        request.status === 'completed' ? 'bg-green-600 text-green-100' :
                        request.status === 'failed' ? 'bg-red-600 text-red-100' :
                        'bg-yellow-600 text-yellow-100'
                      }`}>
                        {request.status.toUpperCase()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* System Monitoring */}
        <SystemMonitor />

        {/* Security Audit Dashboard */}
        <SecurityAuditDashboard />

        {/* Test Data Management */}
        <TestDataManager />

        {/* Instructions */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-white">External Wallet Integration Guide</CardTitle>
          </CardHeader>
          <CardContent className="text-gray-300 space-y-4">
            <div>
              <strong className="text-white">1. Platform Wallet:</strong>
              <div className="font-mono text-sm bg-input p-2 rounded mt-1">
                0xb46DA2C95D65e3F24B48653F1AaFe8BDA7c64835
              </div>
            </div>
            
            <div>
              <strong className="text-white">2. How It Works:</strong>
              <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                <li>System generates fee collection requests instead of direct transfers</li>
                <li>Your external wallet can query pending requests via API</li>
                <li>Execute transfers with your external wallet (Gnosis Safe, etc.)</li>
                <li>Send webhook confirmation back to mark as completed</li>
              </ul>
            </div>

            <div>
              <strong className="text-white">3. API Endpoints:</strong>
              <ul className="list-disc list-inside mt-2 space-y-1 text-sm font-mono">
                <li>GET /fee-collection-api/pending-requests</li>
                <li>POST /fee-collection-webhook (for confirmations)</li>
                <li>GET /fee-collection-api/export/gnosis-safe</li>
              </ul>
            </div>

            <div>
              <strong className="text-white">4. Security Features:</strong>
              <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                <li>No private keys stored in system</li>
                <li>Webhook signature verification</li>
                <li>API key authentication</li>
                <li>Complete audit trail</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default AdminFeesNew;