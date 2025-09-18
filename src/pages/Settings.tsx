import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, User, Shield, CreditCard, Bell, LogOut, CheckCircle, Clock, AlertTriangle, FileText } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import BottomNavigation from "@/components/BottomNavigation";
import AurumLogo from "@/components/AurumLogo";

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
      // Log profile access for security audit
      await supabase.rpc('log_profile_access', {
        target_user_id: user!.id,
        accessed_fields: ['phone', 'email', 'kyc_status', 'first_name', 'last_name']
      });

      const { data, error } = await supabase
        .rpc('get_secure_profile');

      if (error) throw error;
      
      const profileData = data?.[0];
      setProfile(profileData);
      setPhone(profileData?.phone || "");
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
      <div className="flex flex-col h-screen bg-[#1C1C1E]">
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#f9b006]"></div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex flex-col h-screen bg-[#1C1C1E]">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-xl font-bold text-white mb-4">Profile Not Found</h2>
            <Button onClick={() => navigate("/")}>Back to Dashboard</Button>
          </div>
        </div>
      </div>
    );
  }

  const kycInfo = getKycStatusInfo(profile.kyc_status);
  const IconComponent = kycInfo.icon;

  return (
    <div className="flex flex-col h-screen bg-[#1C1C1E]">
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
          <div className="flex-1 flex justify-center pr-6">
            <AurumLogo compact />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 py-4 space-y-6 overflow-y-auto">
        {/* Profile Information */}
        <div className="bg-[#2C2C2E] rounded-xl p-4">
          <h3 className="text-white text-lg font-bold mb-4 flex items-center gap-2">
            <User size={20} />
            Profile Information
          </h3>
          <div className="space-y-4">
            <div>
              <Label htmlFor="email" className="text-gray-400 text-sm">Email</Label>
              <Input
                id="email"
                type="email"
                value={profile.email}
                disabled
                className="bg-[#1C1C1E] border-gray-600 text-white mt-2"
              />
            </div>
            <div>
              <Label htmlFor="phone" className="text-gray-400 text-sm">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Enter your phone number"
                className="bg-[#1C1C1E] border-gray-600 text-white mt-2"
              />
            </div>
            <Button 
              onClick={updateProfile} 
              disabled={saving} 
              className="w-full bg-[#f9b006] text-black font-bold hover:bg-[#f9b006]/90"
            >
              {saving ? "Updating..." : "Update Profile"}
            </Button>
          </div>
        </div>

        {/* KYC Status */}
        <div className="bg-[#2C2C2E] rounded-xl p-4">
          <h3 className="text-white text-lg font-bold mb-4 flex items-center gap-2">
            <Shield size={20} />
            Identity Verification
          </h3>
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${kycInfo.bgColor}`}>
              <IconComponent size={20} className={kycInfo.color} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-white">KYC Status</span>
                <Badge 
                  variant={profile.kyc_status === 'verified' ? 'default' : 'secondary'}
                  className={profile.kyc_status === 'verified' ? 'bg-[#f9b006] text-black' : 'bg-[#1C1C1E] text-gray-400'}
                >
                  {kycInfo.label}
                </Badge>
              </div>
              <p className="text-sm text-gray-400">{kycInfo.description}</p>
            </div>
          </div>
          
          {profile.kyc_status !== 'verified' && (
            <Button 
              onClick={() => navigate("/kyc-verification")}
              className={`w-full ${profile.kyc_status === 'failed' 
                ? 'bg-red-600 hover:bg-red-700 text-white' 
                : 'bg-[#f9b006] text-black hover:bg-[#f9b006]/90'
              }`}
            >
              {profile.kyc_status === 'failed' ? 'Retry Verification' : 'Start Verification'}
            </Button>
          )}
        </div>

        {/* Payment Methods */}
        <div className="bg-[#2C2C2E] rounded-xl p-4">
          <h3 className="text-white text-lg font-bold mb-4 flex items-center gap-2">
            <CreditCard size={20} />
            Payment Methods
          </h3>
          <p className="text-sm text-gray-400 mb-4">
            {profile.kyc_status === 'verified' 
              ? "Manage your payment methods for buying gold"
              : "Complete identity verification to add payment methods"
            }
          </p>
          <Button 
            onClick={() => navigate("/payment-methods")}
            disabled={profile.kyc_status !== 'verified'}
            className="w-full bg-[#1C1C1E] border border-gray-600 text-white hover:bg-gray-700 disabled:opacity-50"
          >
            Manage Payment Methods
          </Button>
        </div>

        {/* Notifications */}
        <div className="bg-[#2C2C2E] rounded-xl p-4">
          <h3 className="text-white text-lg font-bold mb-4 flex items-center gap-2">
            <Bell size={20} />
            Notifications
          </h3>
          <p className="text-sm text-gray-400 mb-4">
            Manage your notification preferences
          </p>
          <Button 
            disabled 
            className="w-full bg-[#1C1C1E] border border-gray-600 text-gray-500 opacity-50"
          >
            Coming Soon
          </Button>
        </div>

        {/* Legal */}
        <div className="bg-[#2C2C2E] rounded-xl p-4">
          <h3 className="text-white text-lg font-bold mb-4 flex items-center gap-2">
            <FileText size={20} />
            Legal
          </h3>
          <div className="space-y-3">
            <Button 
              onClick={() => navigate("/privacy-policy")}
              className="w-full bg-[#1C1C1E] border border-gray-600 text-white hover:bg-gray-700 justify-start"
              variant="outline"
            >
              Privacy Policy
            </Button>
            <Button 
              onClick={() => navigate("/terms-of-service")}
              className="w-full bg-[#1C1C1E] border border-gray-600 text-white hover:bg-gray-700 justify-start"
              variant="outline"
            >
              Terms of Service
            </Button>
          </div>
        </div>

        {/* Account Actions */}
        <div className="bg-[#2C2C2E] rounded-xl p-4">
          <Button 
            onClick={handleSignOut}
            className="w-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center gap-2"
          >
            <LogOut size={16} />
            Sign Out
          </Button>
        </div>
      </main>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
};

export default Settings;