import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle, XCircle, Clock, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import StandardHeader from "@/components/StandardHeader";
import { useMoonPayRecurring } from "@/hooks/useMoonPayRecurring";

export default function MoonPayCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'success' | 'pending' | 'error'>('pending');
  
  const { getMoonPayManageUrl } = useMoonPayRecurring();

  // Extract callback parameters
  const transactionId = searchParams.get('transactionId');
  const transactionStatus = searchParams.get('transactionStatus');
  const externalCustomerId = searchParams.get('externalCustomerId');

  useEffect(() => {
    // Simulate processing time and determine status
    const timer = setTimeout(() => {
      if (transactionStatus === 'completed') {
        setStatus('success');
        toast.success('Recurring buy setup completed successfully!');
      } else if (transactionStatus === 'failed') {
        setStatus('error');
        toast.error('Recurring buy setup failed. Please try again.');
      } else {
        setStatus('pending');
        toast.info('Your recurring buy is being processed.');
      }
      setLoading(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, [transactionStatus]);

  const handleViewHistory = () => {
    navigate('/auto-invest');
  };

  const handleManageInMoonPay = () => {
    const manageUrl = getMoonPayManageUrl();
    window.open(manageUrl, '_blank');
  };

  const StatusIcon = () => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-12 w-12 text-green-500" />;
      case 'error':
        return <XCircle className="h-12 w-12 text-red-500" />;
      case 'pending':
        return <Clock className="h-12 w-12 text-yellow-500" />;
      default:
        return <Clock className="h-12 w-12 text-muted-foreground" />;
    }
  };

  const getStatusMessage = () => {
    switch (status) {
      case 'success':
        return {
          title: 'Recurring Buy Setup Complete!',
          description: 'Your auto-invest plan is now active. Future purchases will be processed automatically according to your schedule.'
        };
      case 'error':
        return {
          title: 'Setup Failed',
          description: 'There was an issue setting up your recurring buy. Please try again or contact support if the problem persists.'
        };
      case 'pending':
        return {
          title: 'Processing Your Setup...',
          description: 'Your recurring buy is being configured. This may take a few minutes to complete.'
        };
      default:
        return {
          title: 'Processing...',
          description: 'Please wait while we process your request.'
        };
    }
  };

  const statusMessage = getStatusMessage();

  return (
    <div className="min-h-screen bg-background">
      <StandardHeader 
        showBackButton
        backPath="/auto-invest"
        title="Setup Status"
      />

      <main className="px-4 py-6">
        <Card className="max-w-md mx-auto">
          <CardHeader className="text-center pb-6">
            <div className="flex justify-center mb-4">
              {loading ? (
                <div className="h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
              ) : (
                <StatusIcon />
              )}
            </div>
            
            <CardTitle className="text-xl">
              {loading ? (
                <Skeleton className="h-6 w-48 mx-auto" />
              ) : (
                statusMessage.title
              )}
            </CardTitle>
            
            <CardDescription className="mt-2">
              {loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4 mx-auto" />
                </div>
              ) : (
                statusMessage.description
              )}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {!loading && (
              <>
                {/* Transaction Details */}
                {transactionId && (
                  <div className="bg-muted/30 p-3 rounded-lg space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Transaction ID</span>
                      <span className="text-sm font-mono">{transactionId.slice(-8)}</span>
                    </div>
                    {externalCustomerId && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Customer ID</span>
                        <span className="text-sm font-mono">{externalCustomerId.slice(-8)}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="space-y-3">
                  <Button 
                    onClick={handleViewHistory}
                    className="w-full"
                    variant={status === 'success' ? 'default' : 'outline'}
                  >
                    View Auto-Invest History
                  </Button>
                  
                  <Button 
                    onClick={handleManageInMoonPay}
                    variant="outline"
                    className="w-full flex items-center gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Manage in MoonPay
                  </Button>
                </div>

                {/* Additional Info */}
                <div className="text-xs text-muted-foreground text-center space-y-1">
                  <p>
                    Recurring purchases are managed directly in MoonPay.
                  </p>
                  <p>
                    Purchase history will appear here as transactions are processed.
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}