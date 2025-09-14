import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, User, Shield, CreditCard, Bell, LogOut, CheckCircle, Clock, AlertTriangle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import BottomNavigation from "@/components/BottomNavigation";

interface UserProfile {
  id: string;
  email: string;
  phone: string | null;
  kyc_status: string;
  created_at: string;
  updated_at: string;
}

const Settings = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user!.id)
        .single();

      if (error) throw error;
      
      setProfile(data);
      setPhone(data.phone || "");
    } catch (error) {
      console.error('Failed to fetch profile:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load profile information"
      });
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async () => {
    if (!profile) return;

    try {
      setSaving(true);
      const { error } = await supabase
        .from('profiles')
        .update({
          phone: phone || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', user!.id);

      if (error) throw error;

      setProfile({ ...profile, phone: phone || null });
      toast({
        title: "Profile Updated",
        description: "Your profile has been successfully updated"
      });
    } catch (error) {
      console.error('Failed to update profile:', error);
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: "Failed to update profile information"
      });
    } finally {
      setSaving(false);
    }
  };

  const getKycStatusInfo = (status: string) => {
    switch (status) {
      case 'verified':
        return {
          icon: CheckCircle,
          color: "text-green-500",
          bgColor: "bg-green-500/10",
          label: "Verified",
          description: "Your identity has been verified"
        };
      case 'pending':
        return {
          icon: Clock,
          color: "text-yellow-500",
          bgColor: "bg-yellow-500/10",
          label: "Pending",
          description: "Identity verification in progress"
        };
      case 'failed':
        return {
          icon: AlertTriangle,
          color: "text-red-500",
          bgColor: "bg-red-500/10",
          label: "Failed",
          description: "Identity verification failed"
        };
      default:
        return {
          icon: AlertTriangle,
          color: "text-muted-foreground",
          bgColor: "bg-muted/50",
          label: "Not Started",
          description: "Identity verification required for card payments"
        };
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate("/auth");
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Sign Out Failed",
        description: "Failed to sign out"
      });
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-background">
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex flex-col h-screen bg-background">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-xl font-bold text-foreground mb-4">Profile Not Found</h2>
            <Button onClick={() => navigate("/")}>Back to Dashboard</Button>
          </div>
        </div>
      </div>
    );
  }

  const kycInfo = getKycStatusInfo(profile.kyc_status);
  const IconComponent = kycInfo.icon;

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="p-4">
        <div className="flex items-center">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate("/")}
            className="text-foreground hover:bg-accent"
          >
            <ArrowLeft size={24} />
          </Button>
          <h1 className="text-xl font-bold text-foreground flex-1 text-center pr-6">Settings</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 py-4 space-y-6 overflow-y-auto">
        {/* Profile Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User size={20} />
              Profile Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={profile.email}
                disabled
                className="bg-muted"
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Enter your phone number"
              />
            </div>
            <Button onClick={updateProfile} disabled={saving} className="w-full">
              {saving ? "Updating..." : "Update Profile"}
            </Button>
          </CardContent>
        </Card>

        {/* KYC Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield size={20} />
              Identity Verification
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${kycInfo.bgColor}`}>
                <IconComponent size={20} className={kycInfo.color} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-foreground">KYC Status</span>
                  <Badge variant={profile.kyc_status === 'verified' ? 'default' : 'secondary'}>
                    {kycInfo.label}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{kycInfo.description}</p>
              </div>
            </div>
            
            {profile.kyc_status !== 'verified' && (
              <Button 
                onClick={() => navigate("/kyc-verification")}
                className="w-full"
                variant={profile.kyc_status === 'failed' ? 'destructive' : 'default'}
              >
                {profile.kyc_status === 'failed' ? 'Retry Verification' : 'Start Verification'}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Payment Methods */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard size={20} />
              Payment Methods
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              {profile.kyc_status === 'verified' 
                ? "Manage your payment methods for buying gold"
                : "Complete identity verification to add payment methods"
              }
            </p>
            <Button 
              onClick={() => navigate("/payment-methods")}
              disabled={profile.kyc_status !== 'verified'}
              className="w-full"
              variant="outline"
            >
              Manage Payment Methods
            </Button>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell size={20} />
              Notifications
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Manage your notification preferences
            </p>
            <Button variant="outline" className="w-full" disabled>
              Coming Soon
            </Button>
          </CardContent>
        </Card>

        {/* Account Actions */}
        <Card>
          <CardContent className="pt-6">
            <Button 
              onClick={handleSignOut}
              variant="destructive"
              className="w-full flex items-center gap-2"
            >
              <LogOut size={16} />
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </main>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
};

export default Settings;