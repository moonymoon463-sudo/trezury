import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink, Calendar, TrendingUp, RefreshCw } from "lucide-react";
import { useMoonPayRecurring } from "@/hooks/useMoonPayRecurring";
import { format } from "date-fns";

interface RecurringTransaction {
  id: number;
  moonpay_tx_id: string | null;
  asset_symbol: string;
  amount_fiat: number | null;
  currency_fiat: string | null;
  amount_crypto: number | null;
  status: string;
  recurring_frequency: string | null;
  created_at: string;
  updated_at: string;
}

export const AutoInvestHistory = () => {
  const [transactions, setTransactions] = useState<RecurringTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const { getRecurringTransactions, getMoonPayManageUrl } = useMoonPayRecurring();

  const loadTransactions = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const data = await getRecurringTransactions();
      setTransactions(data);
    } catch (error) {
      console.error('Failed to load recurring transactions:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'default';
      case 'pending':
        return 'secondary';
      case 'failed':
        return 'destructive';
      case 'initiated':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const getFrequencyLabel = (frequency: string | null) => {
    if (!frequency) return 'Once';
    return frequency.charAt(0).toUpperCase() + frequency.slice(1);
  };

  const handleManageInMoonPay = () => {
    const manageUrl = getMoonPayManageUrl();
    window.open(manageUrl, '_blank', 'width=800,height=700,scrollbars=yes,resizable=yes');
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Auto-Invest History
          </CardTitle>
          <CardDescription>
            Your recurring purchase activity
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="space-y-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-3 w-24" />
              </div>
              <div className="text-right space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Auto-Invest History
            </CardTitle>
            <CardDescription>
              Your recurring purchase activity
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadTransactions(true)}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleManageInMoonPay}
              className="flex items-center gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              Manage in MoonPay
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <div className="text-center py-8 space-y-3">
            <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground opacity-50" />
            <div>
              <h3 className="font-medium">No recurring purchases yet</h3>
              <p className="text-sm text-muted-foreground">
                Set up your first auto-invest plan to see activity here
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.map((transaction) => (
              <div
                key={transaction.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">
                      {transaction.asset_symbol}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {getFrequencyLabel(transaction.recurring_frequency)}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {transaction.amount_fiat && transaction.currency_fiat 
                      ? `${transaction.currency_fiat} ${transaction.amount_fiat}`
                      : 'Amount pending'
                    }
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Created {format(new Date(transaction.created_at), 'MMM d, yyyy')}
                  </p>
                </div>
                
                <div className="text-right space-y-1">
                  <Badge variant={getStatusColor(transaction.status)} className="text-xs">
                    {transaction.status}
                  </Badge>
                  {transaction.amount_crypto && (
                    <p className="text-xs text-muted-foreground">
                      {transaction.amount_crypto.toFixed(6)} {transaction.asset_symbol}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Updated {format(new Date(transaction.updated_at), 'MMM d, HH:mm')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};