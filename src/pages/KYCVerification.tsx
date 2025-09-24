import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Shield, CheckCircle, Clock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useMoonPayKYC } from "@/hooks/useMoonPayKYC";
import { supabase } from "@/integrations/supabase/client";

const KYCVerification = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { openMoonPayKYC, loading: moonpayLoading } = useMoonPayKYC();
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      // Query KYC fields and timestamps for better state detection
      const { data, error } = await supabase
        .from('profiles')
        .select('kyc_status, kyc_submitted_at, kyc_verified_at, metadata')
        .eq('id', user!.id)
        .single();

      if (error) throw error;
      
      console.log('Profile KYC data:', data);
      setProfile(data);

      // If already verified, redirect
      if (data?.kyc_status === 'verified') {
        toast({
          title: "Already Verified",
          description: "Your identity has already been verified"
        });
        navigate("/settings");
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load verification status"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStartVerification = async () => {
    try {
      await openMoonPayKYC();
      
      // Refresh profile after starting verification
      setTimeout(() => {
        fetchProfile();
      }, 1000);
      
      // Poll for completion (optional - user can also navigate back manually)
      const checkInterval = setInterval(async () => {
        const { data } = await supabase
          .from('profiles')
          .select('kyc_status')
          .eq('id', user!.id)
          .single();
          
        if (data?.kyc_status === 'verified') {
          clearInterval(checkInterval);
          toast({
            title: "Verification Complete!",
            description: "Your identity has been successfully verified"
          });
          navigate("/settings");
        }
      }, 5000);

      // Clear interval after 10 minutes
      setTimeout(() => clearInterval(checkInterval), 600000);
    } catch (error) {
      console.error('Failed to start verification:', error);
    }
  };

  const handleRestartVerification = async () => {
    try {
      // Reset KYC status to completely unverified state
      const { error } = await supabase
        .from('profiles')
        .update({
          kyc_status: 'pending',
          kyc_submitted_at: null,
          kyc_verified_at: null,
          metadata: {}
        })
        .eq('id', user!.id);

      if (error) throw error;

      toast({
        title: "KYC Reset Complete",
        description: "You can now start a fresh verification process."
      });

      // Refresh the profile state
      await fetchProfile();
    } catch (error) {
      console.error('Failed to restart verification:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to restart verification. Please try again."
      });
    }
  };

  // Check if the inquiry might be stale (older than 24 hours)
  const isStaleInquiry = () => {
    if (!profile?.kyc_submitted_at) return false;
    const submitted = new Date(profile.kyc_submitted_at);
    const now = new Date();
    const hoursDiff = (now.getTime() - submitted.getTime()) / (1000 * 60 * 60);
    return hoursDiff > 24; // Consider stale after 24 hours
  };

  const getStatusIcon = () => {
    if (!profile) return <Clock className="h-5 w-5 text-muted-foreground" />;
    
    const notStarted = profile.kyc_status === 'pending' && !profile.kyc_submitted_at;
    
    if (notStarted) {
      return <Shield className="h-5 w-5 text-muted-foreground" />;
    }
    
    switch (profile.kyc_status) {
      case 'verified':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'pending':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case 'rejected':
        return <Shield className="h-5 w-5 text-red-500" />;
      default:
        return <Shield className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusText = () => {
    if (!profile) return "Loading...";
    
    const notStarted = profile.kyc_status === 'pending' && !profile.kyc_submitted_at;
    
    if (notStarted) {
      return "Not Verified";
    }
    
    switch (profile.kyc_status) {
      case 'verified':
        return "Identity Verified";
      case 'pending':
        return "Verification Pending";
      case 'rejected':
        return "Verification Rejected";
      default:
        return "Not Verified";
    }
  };

  const getStatusDescription = () => {
    if (!profile) return "";
    
    const notStarted = profile.kyc_status === 'pending' && !profile.kyc_submitted_at;
    
    if (notStarted) {
      return "Complete identity verification to unlock all features and higher transaction limits.";
    }
    
    switch (profile.kyc_status) {
      case 'verified':
        return "Your identity has been successfully verified. You have full access to all features.";
      case 'pending':
        return "Your verification is being reviewed. This usually takes 24-48 hours.";
      case 'rejected':
        return "Your verification was rejected. Please contact support for assistance.";
      default:
        return "Complete identity verification to unlock all features and higher transaction limits.";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <Clock className="h-8 w-8 mx-auto mb-4 animate-spin" />
          <p className="text-muted-foreground">Loading verification status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-md mx-auto">
        <div className="flex items-center p-4 border-b border-border">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate("/settings")}
            className="mr-2"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold text-foreground">Identity Verification</h1>
        </div>

        <div className="p-4">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                {getStatusIcon()}
                <div>
                  <h2 className="text-xl font-semibold">{getStatusText()}</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {getStatusDescription()}
                  </p>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {profile?.kyc_status === 'verified' ? (
                <div className="text-center py-4">
                  <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-green-500 mb-2">
                    Verification Complete!
                  </h3>
                  <p className="text-muted-foreground">
                    Your identity has been verified. You now have access to all features.
                  </p>
                </div>
              ) : profile?.kyc_status === 'pending' && profile?.kyc_submitted_at ? (
                <div className="text-center py-4">
                  <Clock className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-yellow-500 mb-2">
                    Verification In Progress
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Your documents are being reviewed. This usually takes 24-48 hours.
                  </p>
                  
                  <div className="space-y-3">
                    <Button
                      onClick={handleRestartVerification}
                      variant="destructive"
                      className="w-full"
                    >
                      Reset & Start New Verification
                    </Button>
                    
                    <Button
                      onClick={handleStartVerification}
                      disabled={moonpayLoading}
                      variant="outline"
                      className="w-full"
                    >
                      {moonpayLoading ? (
                        <>
                          <Clock className="h-4 w-4 mr-2 animate-spin" />
                          Resuming...
                        </>
                      ) : (
                        <>
                          <Shield className="h-4 w-4 mr-2" />
                          Resume Current Verification
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="text-center">
                    <Shield className="h-16 w-16 text-primary mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">
                      Secure Identity Verification
                    </h3>
                    <p className="text-muted-foreground">
                      We use MoonPay to securely verify your identity. This process is quick, secure, and compliant with regulations.
                    </p>
                  </div>

                  <div className="bg-muted/50 rounded-lg p-4">
                    <h4 className="font-semibold mb-2">What you'll need:</h4>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      <li>• Government-issued photo ID</li>
                      <li>• 2-3 minutes of your time</li>
                      <li>• Good lighting for photos</li>
                    </ul>
                  </div>

                  <div className="bg-muted/50 rounded-lg p-4">
                    <h4 className="font-semibold mb-2">Why we verify:</h4>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      <li>• Regulatory compliance</li>
                      <li>• Prevent fraud and protect users</li>
                      <li>• Enable higher transaction limits</li>
                    </ul>
                  </div>

                  <Button
                    onClick={handleStartVerification}
                    disabled={moonpayLoading}
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                    size="lg"
                  >
                    {moonpayLoading ? (
                      <>
                        <Clock className="h-4 w-4 mr-2 animate-spin" />
                        Starting Verification...
                      </>
                    ) : (
                      <>
                        <Shield className="h-4 w-4 mr-2" />
                        Start Identity Verification
                      </>
                    )}
                  </Button>

                  <p className="text-xs text-muted-foreground text-center">
                    By proceeding, you agree to MoonPay's privacy policy and terms of service.
                    Your data is encrypted and securely processed.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default KYCVerification;