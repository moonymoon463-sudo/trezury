import { useState } from "react";
import { useNavigate } from "react-router-dom";
import StandardHeader from "@/components/StandardHeader";
import BottomNavigation from "@/components/BottomNavigation";
import { AutoInvestButton } from "@/components/recurring/AutoInvestButton";
import { AutoInvestModal } from "@/components/recurring/AutoInvestModal";
import { AutoInvestHistory } from "@/components/recurring/AutoInvestHistory";
import { MoonPayFrame } from "@/components/recurring/MoonPayFrame";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Shield, Zap, Info } from "lucide-react";
import { toast } from "sonner";

// Mock function to detect user region - in real app this would use IP geolocation
const getUserRegion = (): string => {
  return 'GB'; // Default to UK as per requirements
};

const SUPPORTED_REGIONS = ['GB', 'EU', 'US']; // Simplified for demo

export default function AutoInvest() {
  const navigate = useNavigate();
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [moonPayUrl, setMoonPayUrl] = useState<string | null>(null);
  
  const userRegion = getUserRegion();
  const isUnsupportedRegion = !SUPPORTED_REGIONS.includes(userRegion);

  const handleAutoInvestClick = () => {
    if (isUnsupportedRegion) {
      toast.error('Auto-Invest is not available in your region yet');
      return;
    }
    setShowSetupModal(true);
  };

  const handleMoonPayComplete = () => {
    toast.success('Recurring buy setup completed! Updates will appear in your history.');
    setMoonPayUrl(null);
  };

  const handleMoonPayError = (error: string) => {
    toast.error(`MoonPay error: ${error}`);
    setMoonPayUrl(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <StandardHeader 
        showBackButton
        backPath="/"
        title="Auto-Invest"
      />

      <main className="px-4 py-6 pb-20 space-y-6">
        {/* Region Notice */}
        {isUnsupportedRegion && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Auto-Invest is not available in your region yet. We're working to expand availability.
            </AlertDescription>
          </Alert>
        )}

        {/* Feature Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Auto-Invest with MoonPay
            </CardTitle>
            <CardDescription>
              Set up recurring cryptocurrency purchases to dollar-cost average into your favorite assets.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              <div className="flex items-center gap-3">
                <Shield className="h-4 w-4 text-primary" />
                <span className="text-sm">Regulated by FCA • Secure payment processing</span>
              </div>
              <div className="flex items-center gap-3">
                <Zap className="h-4 w-4 text-primary" />
                <span className="text-sm">Automated purchases • Cancel anytime</span>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="text-xs">
                  {userRegion} Region
                </Badge>
                <span className="text-sm">Bank transfers & debit cards supported</span>
              </div>
            </div>

            <AutoInvestButton 
              onClick={handleAutoInvestClick}
              isUnsupportedRegion={isUnsupportedRegion}
            />
          </CardContent>
        </Card>

        {/* Important Information */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="text-sm">
            <strong>How it works:</strong> We'll take you to MoonPay where you can set up your recurring purchase schedule.
            You'll manage (pause/cancel) your recurring buys directly in MoonPay. We'll track and display your purchase history here.
          </AlertDescription>
        </Alert>

        {/* Transaction History */}
        <AutoInvestHistory />
      </main>

      <BottomNavigation />

      {/* Setup Modal */}
      <AutoInvestModal 
        open={showSetupModal}
        onOpenChange={setShowSetupModal}
        userCountry={userRegion}
      />

      {/* MoonPay Frame */}
      {moonPayUrl && (
        <MoonPayFrame
          url={moonPayUrl}
          open={!!moonPayUrl}
          onOpenChange={(open) => !open && setMoonPayUrl(null)}
          onComplete={handleMoonPayComplete}
          onError={handleMoonPayError}
        />
      )}
    </div>
  );
}