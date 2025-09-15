import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, XCircle, Clock, CreditCard } from 'lucide-react';
import { usePaymentStatus } from '@/hooks/usePaymentStatus';
import { useNavigate } from 'react-router-dom';

interface PaymentStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactionId: string;
  amount: number;
  currency: string;
}

export const PaymentStatusModal = ({ 
  isOpen, 
  onClose, 
  transactionId, 
  amount, 
  currency 
}: PaymentStatusModalProps) => {
  const navigate = useNavigate();
  const { transaction, loading, error, refetch } = usePaymentStatus(transactionId);
  const [retryCount, setRetryCount] = useState(0);

  const getStatusIcon = () => {
    if (loading) return <Loader2 className="animate-spin" size={48} />;
    
    switch (transaction?.status) {
      case 'completed':
        return <CheckCircle className="text-green-500" size={48} />;
      case 'failed':
      case 'cancelled':
        return <XCircle className="text-red-500" size={48} />;
      case 'pending':
      case 'processing':
        return <Clock className="text-blue-500" size={48} />;
      default:
        return <CreditCard className="text-gray-500" size={48} />;
    }
  };

  const getStatusMessage = () => {
    if (loading) return 'Checking payment status...';
    if (error) return 'Failed to check payment status';
    
    switch (transaction?.status) {
      case 'completed':
        return 'Payment successful! Your USDC will be added to your wallet shortly.';
      case 'failed':
        return 'Payment failed. Please try again or contact support if the issue persists.';
      case 'cancelled':
        return 'Payment was cancelled. You can try again when ready.';
      case 'pending':
        return 'Payment is being processed. This may take a few minutes.';
      case 'processing':
        return 'Your payment is being verified. Please wait...';
      default:
        return 'Checking payment status...';
    }
  };

  const getStatusColor = () => {
    switch (transaction?.status) {
      case 'completed':
        return 'text-green-600';
      case 'failed':
      case 'cancelled':
        return 'text-red-600';
      case 'pending':
      case 'processing':
        return 'text-blue-600';
      default:
        return 'text-gray-600';
    }
  };

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    refetch?.();
  };

  const handleClose = () => {
    if (transaction?.status === 'completed') {
      navigate('/wallet');
    } else {
      navigate('/buy-gold');
    }
    onClose();
  };

  // Auto-retry logic for pending payments
  useEffect(() => {
    if (transaction?.status === 'pending' && retryCount < 10) {
      const timer = setTimeout(() => {
        handleRetry();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [transaction?.status, retryCount]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">Payment Status</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col items-center space-y-6 py-6">
          {getStatusIcon()}
          
          <div className="text-center space-y-2">
            <h3 className={`text-lg font-semibold ${getStatusColor()}`}>
              {transaction?.status ? transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1) : 'Checking...'}
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              {getStatusMessage()}
            </p>
          </div>

          {transaction && (
            <div className="w-full space-y-2 text-sm bg-muted/30 rounded-lg p-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount:</span>
                <span className="font-medium">${amount.toFixed(2)} {currency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Transaction ID:</span>
                <span className="font-mono text-xs">{transactionId.slice(0, 8)}...</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status:</span>
                <span className={`font-medium ${getStatusColor()}`}>
                  {transaction.status}
                </span>
              </div>
            </div>
          )}

          <div className="flex space-x-3 w-full">
            {(transaction?.status === 'failed' || error) && (
              <Button 
                variant="outline" 
                onClick={handleRetry}
                disabled={loading}
                className="flex-1"
              >
                {loading ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
                Retry
              </Button>
            )}
            
            <Button 
              onClick={handleClose}
              className="flex-1"
              variant={transaction?.status === 'completed' ? 'default' : 'outline'}
            >
              {transaction?.status === 'completed' ? 'View Wallet' : 'Close'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};