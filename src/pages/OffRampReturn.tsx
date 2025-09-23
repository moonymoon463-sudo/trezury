import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, ArrowRight, Home } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const OffRampReturn = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'cancelled'>('loading');

  useEffect(() => {
    // Parse MoonPay return parameters
    const sellProvider = searchParams.get('sell');
    const transactionStatus = searchParams.get('transactionStatus');
    const transactionId = searchParams.get('transactionId');
    const errorCode = searchParams.get('errorCode');

    console.log('OffRamp return params:', { sellProvider, transactionStatus, transactionId, errorCode });

    if (sellProvider === 'moonpay') {
      if (transactionStatus === 'completed') {
        setStatus('success');
        toast({
          title: "Sale Completed!",
          description: "Your gold sale has been processed successfully.",
        });
      } else if (transactionStatus === 'failed' || errorCode) {
        setStatus('error');
        toast({
          title: "Sale Failed",
          description: "Your gold sale could not be completed.",
          variant: "destructive"
        });
      } else if (transactionStatus === 'cancelled') {
        setStatus('cancelled');
        toast({
          title: "Sale Cancelled",
          description: "You cancelled the gold sale process.",
          variant: "destructive"
        });
      } else {
        // Default to success if no specific status (user completed the flow)
        setStatus('success');
        toast({
          title: "Sale Initiated",
          description: "Your gold sale has been initiated. You'll receive updates via email.",
        });
      }
    } else {
      setStatus('error');
    }
  }, [searchParams, toast]);

  const getStatusContent = () => {
    switch (status) {
      case 'success':
        return {
          icon: <CheckCircle size={64} className="text-green-500" />,
          title: "Sale Completed!",
          description: "Your gold sale has been processed successfully. The funds should appear in your bank account within 2-5 business days.",
          buttonText: "View Transactions"
        };
      case 'error':
        return {
          icon: <XCircle size={64} className="text-red-500" />,
          title: "Sale Failed",
          description: "Something went wrong with your gold sale. Please try again or contact support if the issue persists.",
          buttonText: "Try Again"
        };
      case 'cancelled':
        return {
          icon: <XCircle size={64} className="text-yellow-500" />,
          title: "Sale Cancelled",
          description: "You cancelled the gold sale process. No funds have been transferred.",
          buttonText: "Try Again"
        };
      default:
        return {
          icon: <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />,
          title: "Processing...",
          description: "Please wait while we process your return from MoonPay.",
          buttonText: "Please wait..."
        };
    }
  };

  const statusContent = getStatusContent();

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="text-center max-w-md">
          <div className="flex justify-center mb-6">
            {statusContent.icon}
          </div>
          
          <h1 className="text-2xl font-bold text-foreground mb-4">
            {statusContent.title}
          </h1>
          
          <p className="text-muted-foreground mb-8">
            {statusContent.description}
          </p>
          
          <div className="space-y-3">
            {status === 'success' && (
              <Button 
                className="w-full h-12 font-semibold"
                onClick={() => navigate("/transactions")}
              >
                <ArrowRight size={20} className="mr-2" />
                {statusContent.buttonText}
              </Button>
            )}
            
            {(status === 'error' || status === 'cancelled') && (
              <Button 
                className="w-full h-12 font-semibold"
                onClick={() => navigate("/sell-gold/amount")}
              >
                <ArrowRight size={20} className="mr-2" />
                {statusContent.buttonText}
              </Button>
            )}
            
            <Button 
              variant="outline"
              className="w-full h-12 font-semibold"
              onClick={() => navigate("/")}
            >
              <Home size={20} className="mr-2" />
              Go Home
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default OffRampReturn;