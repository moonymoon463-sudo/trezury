import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Activity, TrendingUp, TrendingDown } from 'lucide-react';
import { useAdmin } from '@/hooks/useAdmin';
import BottomNavigation from '@/components/BottomNavigation';
import AurumLogo from '@/components/AurumLogo';
import { supabase } from '@/integrations/supabase/client';

interface Transaction {
  id: string;
  type: string;
  asset: string;
  quantity: number;
  unit_price_usd: number;
  fee_usd: number;
  status: string;
  created_at: string;
  tx_hash?: string;
  input_asset?: string;
  output_asset?: string;
  metadata?: any;
  profiles: { email: string } | null;
  activity_type?: string;
  provider?: string;
}

const AdminTransactions = () => {
  const navigate = useNavigate();
  const { isAdmin, loading, getTransactions } = useAdmin();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    if (!isAdmin && !loading) {
      navigate('/');
      return;
    }

    const fetchAllActivity = async () => {
      try {
        const { data: regularTxs } = await supabase
          .from('transactions')
          .select('*, profiles(email)')
          .order('created_at', { ascending: false })
          .limit(200);

        const { data: paymentTxs } = await supabase
          .from('payment_transactions')
          .select('*, profiles(email)')
          .order('created_at', { ascending: false })
          .limit(100);

        // Combine all transactions
        const allTxs = [
          ...(regularTxs || []).map(tx => ({ 
            ...tx, 
            activity_type: 'transaction',
            timestamp: tx.created_at 
          })),
          ...(paymentTxs || []).map(pt => ({
            id: pt.id,
            type: pt.provider === 'moonpay' ? ((pt.metadata as any)?.transaction_type || 'buy') : 'payment',
            asset: pt.currency,
            quantity: pt.amount,
            unit_price_usd: 1,
            fee_usd: 0,
            status: pt.status,
            created_at: pt.created_at,
            tx_hash: pt.external_id,
            metadata: pt.metadata,
            profiles: pt.profiles,
            activity_type: 'payment',
            provider: pt.provider,
            timestamp: pt.created_at
          }))
        ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        setTransactions(allTxs as any);
        setFilteredTransactions(allTxs as any);
      } catch (error) {
        console.error('Error fetching activity:', error);
      }
    };

    if (isAdmin) {
      fetchAllActivity();
    }
  }, [isAdmin, loading, navigate]);

  useEffect(() => {
    if (filter === 'all') {
      setFilteredTransactions(transactions);
    } else if (filter === 'buy') {
      setFilteredTransactions(transactions.filter(tx => tx.type === 'buy'));
    } else if (filter === 'sell') {
      setFilteredTransactions(transactions.filter(tx => tx.type === 'sell'));
    } else if (filter === 'swap') {
      setFilteredTransactions(transactions.filter(tx => tx.type === 'swap'));
    } else if (filter === 'payment') {
      setFilteredTransactions(transactions.filter(tx => tx.activity_type === 'payment'));
    } else if (filter === 'completed') {
      setFilteredTransactions(transactions.filter(tx => tx.status === 'completed'));
    } else if (filter === 'pending') {
      setFilteredTransactions(transactions.filter(tx => tx.status === 'pending'));
    }
  }, [filter, transactions]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500">Completed</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500">Pending</Badge>;
      case 'failed':
        return <Badge className="bg-red-500">Failed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string, activityType?: string) => {
    if (activityType === 'payment') {
      return <Badge className="bg-purple-500">MoonPay</Badge>;
    }
    switch (type) {
      case 'buy':
        return <Badge className="bg-blue-500"><TrendingUp className="w-3 h-3 mr-1" />Buy</Badge>;
      case 'sell':
        return <Badge className="bg-orange-500"><TrendingDown className="w-3 h-3 mr-1" />Sell</Badge>;
      case 'swap':
        return <Badge className="bg-indigo-500">Swap</Badge>;
      default:
        return <Badge variant="secondary">{type}</Badge>;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-background">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading transactions...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex h-screen bg-background">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-muted-foreground mb-6">Admin privileges required.</p>
            <Button onClick={() => navigate('/')}>Return to Dashboard</Button>
          </div>
        </div>
      </div>
    );
  }

  const totalVolume = transactions
    .filter(tx => tx.status === 'completed')
    .reduce((sum, tx) => sum + (tx.quantity * tx.unit_price_usd), 0);

  const totalFees = transactions
    .filter(tx => tx.status === 'completed')
    .reduce((sum, tx) => sum + (tx.fee_usd || 0), 0);

  const buyCount = transactions.filter(tx => tx.type === 'buy').length;
  const sellCount = transactions.filter(tx => tx.type === 'sell').length;

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="p-4 border-b border-border">
        <div className="flex items-center">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate('/admin')}
            className="text-foreground hover:bg-accent"
          >
            <ArrowLeft size={24} />
          </Button>
          <div className="flex items-center gap-3 flex-1 justify-center pr-6">
            <AurumLogo className="w-8 h-8" />
            <h1 className="text-xl font-bold text-foreground">Transaction Management</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 overflow-y-auto">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Volume</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalVolume)}</div>
              <p className="text-xs text-muted-foreground">
                {transactions.length} transactions
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Fees</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalFees)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Buy Orders</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{buyCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sell Orders</CardTitle>
              <TrendingDown className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{sellCount}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filter Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Filter transactions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Activity</SelectItem>
                <SelectItem value="buy">Buy Orders</SelectItem>
                <SelectItem value="sell">Sell Orders</SelectItem>
                <SelectItem value="swap">Swaps</SelectItem>
                <SelectItem value="payment">MoonPay Payments</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Transactions Table */}
        <Card>
          <CardHeader>
            <CardTitle>Transactions ({filteredTransactions.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Asset</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Fee</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>TX Hash</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell className="font-medium">
                        {transaction.profiles?.email || 'Unknown'}
                      </TableCell>
                      <TableCell>{getTypeBadge(transaction.type, transaction.activity_type)}</TableCell>
                      <TableCell>
                        {transaction.input_asset && transaction.output_asset 
                          ? `${transaction.input_asset} → ${transaction.output_asset}`
                          : transaction.asset}
                      </TableCell>
                      <TableCell>{transaction.quantity.toFixed(4)}</TableCell>
                      <TableCell>{formatCurrency(transaction.unit_price_usd)}</TableCell>
                      <TableCell>
                        {formatCurrency(transaction.quantity * transaction.unit_price_usd)}
                      </TableCell>
                      <TableCell>{formatCurrency(transaction.fee_usd || 0)}</TableCell>
                      <TableCell>{getStatusBadge(transaction.status)}</TableCell>
                      <TableCell>
                        {transaction.tx_hash ? (
                          <a
                            href={`https://etherscan.io/tx/${transaction.tx_hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:underline text-xs"
                          >
                            {transaction.tx_hash.slice(0, 6)}...
                          </a>
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {new Date(transaction.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>

      <BottomNavigation />
    </div>
  );
};

export default AdminTransactions;