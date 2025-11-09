import { useState, useEffect } from "react";
import { AlertCircle, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PasswordPrompt } from "@/components/wallet/PasswordPrompt";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

export function WormholeRedemptionAlert() {
  const { user } = useAuth();
  const [hasPendingTx, setHasPendingTx] = useState(false);
  const [passwordPromptOpen, setPasswordPromptOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const checkPendingTransactions = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from('bridge_transactions')
          .select('*')
          .eq('user_id', user.id)
          .eq('bridge_provider', 'wormhole')
          .or('status.eq.pending,status.eq.step1_initiated')
          .limit(1);

        if (error) throw error;
        setHasPendingTx(data && data.length > 0);
      } catch (error) {
        console.error('[WormholeRedemptionAlert] Error checking pending txs:', error);
      }
    };

    checkPendingTransactions();
  }, [user]);

  const handleRecover = async (password: string) => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manual-wormhole-redemption', {
        body: {
          userId: user.id,
          password,
          ethTxHashes: [
            '0x7da896d6ab2f925a811ef7c0c8d8f3a01c85fdb0eda79933d6e38a94e7cc9a8b',
            '0x0e8faeb243f645cfa247c7fe32d6d8df4177cdd7ebdaebf712989fbb7449f3b9'
          ]
        }
      });

      if (error) throw error;

      if (data?.results) {
        const successful = data.results.filter((r: any) => r.success).length;
        const failed = data.results.filter((r: any) => !r.success).length;

        if (successful > 0) {
          toast({
            title: "Funds Recovered!",
            description: `${successful} transaction${successful > 1 ? 's' : ''} redeemed successfully to your Arbitrum wallet.`,
          });
          setDismissed(true);
          setPasswordPromptOpen(false);
        }

        if (failed > 0) {
          toast({
            title: "Partial Recovery",
            description: `${successful} succeeded, ${failed} failed. Check logs for details.`,
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Recovery Complete",
          description: "Funds have been redeemed to your Arbitrum wallet.",
        });
        setDismissed(true);
        setPasswordPromptOpen(false);
      }
    } catch (error: any) {
      console.error('[WormholeRedemptionAlert] Recovery error:', error);
      toast({
        title: "Recovery Failed",
        description: error.message || "Failed to redeem funds. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!hasPendingTx || dismissed) return null;

  return (
    <>
      <Card className="bg-amber-500/10 border-amber-500/50 p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm text-foreground mb-1">
              Unredeemed Bridge Funds
            </h3>
            <p className="text-xs text-muted-foreground mb-3">
              You have 54 USDC waiting to be redeemed from Wormhole bridge to your Arbitrum wallet.
            </p>
            <Button 
              size="sm"
              onClick={() => setPasswordPromptOpen(true)}
              disabled={loading}
              className="text-xs bg-amber-500 text-black hover:bg-amber-600"
            >
              {loading ? "Processing..." : "Recover 54 USDC"}
            </Button>
          </div>
        </div>
      </Card>

      <PasswordPrompt
        open={passwordPromptOpen}
        onOpenChange={setPasswordPromptOpen}
        onConfirm={handleRecover}
        loading={loading}
      />
    </>
  );
}
