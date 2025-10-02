import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ArrowLeft, User, Shield, CreditCard, Bell, LogOut, CheckCircle, Clock, AlertTriangle, FileText, Crown, Wallet, Copy, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useToast } from "@/hooks/use-toast";
import { useSecureWallet } from "@/hooks/useSecureWallet";
import { supabase } from "@/integrations/supabase/client";
import BottomNavigation from "@/components/BottomNavigation";
import AurumLogo from "@/components/AurumLogo";
import StandardHeader from "@/components/StandardHeader";
import { PasswordPrompt } from "@/components/wallet/PasswordPrompt";
import SecureWalletSetup from "@/components/SecureWalletSetup";

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
  const { isAdmin } = useAdmin();
  const { toast } = useToast();
  const { walletAddress: initialWalletAddress, getWalletAddress, revealPrivateKey, loading: walletLoading } = useSecureWallet();
  const [walletAddress, setWalletAddress] = useState<string | null>(initialWalletAddress);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [phone, setPhone] = useState("");
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [privateKey, setPrivateKey] = useState<string | null>(null);
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);

  useEffect(() => {
    if (user) {
      fetchProfile();
      getWalletAddress().then(addr => setWalletAddress(addr));
    }
  }, [user, getWalletAddress]);
  
  useEffect(() => {
    setWalletAddress(initialWalletAddress);
  }, [initialWalletAddress]);

  const fetchProfile = async () => {
    try {
      // Query profile data directly to avoid PII rate limiting
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, phone, kyc_status, created_at, updated_at')
        .eq('id', user!.id)
        .single();

      if (error) throw error;
      
      setProfile(data);
      setPhone(data?.phone || "");
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

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied",
        description: `${label} copied to clipboard`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to copy",
        description: "Unable to copy to clipboard",
      });
    }
  };

  const handleRevealPrivateKey = async (password: string) => {
    try {
      setIsRevealing(true);
      const key = await revealPrivateKey(password);
      if (key) {
        setPrivateKey(key);
        setShowPrivateKey(true);
        setShowPasswordPrompt(false);
        
        toast({
          title: "Private Key Revealed",
          description: "Your private key is now visible. Keep it secure!",
        });
      }
    } catch (error) {
      console.error('Failed to reveal private key:', error);
      toast({
        variant: "destructive",
        title: "Invalid Password",
        description: "The password you entered is incorrect. Please try again.",
      });
    } finally {
      setIsRevealing(false);
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
    <div className="relative flex min-h-[100dvh] w-full flex-col bg-background">
      {/* Header */}
      <StandardHeader 
        showBackButton
        backPath="/"
      />

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-3 md:px-4 py-4 space-y-6 pb-[calc(var(--bottom-nav-height,56px)+env(safe-area-inset-bottom))]">
        {/* Profile Information */}
        <div className="bg-card rounded-xl p-4">
          <h3 className="text-white text-lg font-bold mb-4 flex items-center gap-2">
            <User size={20} />
            Profile Information
          </h3>
          <div className="space-y-4">
            <div>
              <Label htmlFor="email" className="text-muted-foreground text-sm">Email</Label>
              <Input
                id="email"
                type="email"
                value={profile.email}
                disabled
                className="bg-input border-border text-white mt-2"
              />
            </div>
            <div>
              <Label htmlFor="phone" className="text-muted-foreground text-sm">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Enter your phone number"
                className="bg-input border-border text-white mt-2"
              />
            </div>
            <Button 
              onClick={updateProfile} 
              disabled={saving} 
              className="w-full bg-primary text-black font-bold hover:bg-primary/90"
            >
              {saving ? "Updating..." : "Update Profile"}
            </Button>
          </div>
        </div>

        {/* KYC Status */}
        <div className="bg-card rounded-xl p-4">
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
                  className={profile.kyc_status === 'verified' ? 'bg-primary text-black' : 'bg-input text-muted-foreground'}
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
                : 'bg-primary text-black hover:bg-primary/90'
              }`}
            >
              {profile.kyc_status === 'failed' ? 'Retry Verification' : 'Start Verification'}
            </Button>
          )}
        </div>

        {/* Wallet Management */}
        <div className="bg-card rounded-xl p-4">
          <h3 className="text-white text-lg font-bold mb-4 flex items-center gap-2">
            <Wallet size={20} />
            Wallet Management
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Manage your secure wallet and backup your private key
          </p>
          
          {walletAddress ? (
            <div className="space-y-4">
              {/* Wallet Address */}
              <div>
                <Label className="text-muted-foreground text-sm">Wallet Address</Label>
                <div className="flex items-center gap-2 mt-2">
                  <Input
                    value={walletAddress}
                    readOnly
                    className="bg-input border-border text-white font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(walletAddress, "Wallet address")}
                    className="bg-input border-border text-white hover:bg-accent"
                  >
                    <Copy size={16} />
                  </Button>
                </div>
              </div>

              {/* Private Key Backup */}
              <div>
                <Label className="text-muted-foreground text-sm">Private Key Backup</Label>
                <div className="space-y-3 mt-2">
                  <div className="p-3 bg-input rounded-lg border border-yellow-500/30">
                    <div className="flex items-start gap-2">
                      <Shield className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-muted-foreground">
                        <p className="font-medium text-white mb-1">Important Security Information:</p>
                        <ul className="list-disc list-inside space-y-1">
                          <li>Your private key gives full control over your wallet</li>
                          <li>Never share your private key with anyone</li>
                          <li>Store it securely - we cannot recover lost private keys</li>
                          <li>Anyone with your private key can access your funds</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {showPrivateKey && privateKey ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Input
                          value={privateKey}
                          readOnly
                          type="text"
                          className="bg-input border-border text-white font-mono text-sm"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(privateKey, "Private key")}
                          className="bg-input border-border text-white hover:bg-accent"
                        >
                          <Copy size={16} />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setShowPrivateKey(false);
                            setPrivateKey(null);
                          }}
                          className="bg-input border-border text-white hover:bg-accent"
                        >
                          <EyeOff size={16} />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" disabled={walletLoading} className="bg-input border-border text-white hover:bg-accent">
                            <Eye className="h-4 w-4 mr-2" />
                            Reveal Private Key
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-card border-border">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2 text-white">
                              <Shield className="h-5 w-5 text-yellow-500" />
                              Reveal Private Key
                            </AlertDialogTitle>
                            <AlertDialogDescription className="space-y-2 text-muted-foreground">
                              <p>You are about to reveal your wallet's private key. This is extremely sensitive information.</p>
                              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                                <p className="text-sm font-medium text-red-400">⚠️ Security Warning:</p>
                                <ul className="text-sm text-red-300 mt-1 space-y-1">
                                  <li>• Anyone with this key can steal all your funds</li>
                                  <li>• Only reveal this for backup purposes</li>
                                  <li>• Never share it with anyone, including support</li>
                                  <li>• Store it in a secure location offline</li>
                                </ul>
                              </div>
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="bg-input border-border text-white hover:bg-accent">Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => setShowPasswordPrompt(true)}
                              className="bg-red-600 hover:bg-red-700 text-white"
                            >
                              I Understand - Continue
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>

                      <PasswordPrompt
                        open={showPasswordPrompt}
                        onOpenChange={setShowPasswordPrompt}
                        onConfirm={handleRevealPrivateKey}
                        loading={isRevealing}
                      />
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : (
            // Show wallet creation UI if no wallet exists
            <SecureWalletSetup 
              onWalletCreated={(address) => {
                setWalletAddress(address);
                getWalletAddress();
                toast({
                  title: "Wallet Created",
                  description: "Your secure wallet has been created successfully"
                });
              }}
            />
          )}
        </div>

        {/* Admin Section */}
        {isAdmin && (
          <div className="bg-card rounded-xl p-4 border border-primary/30">
            <h3 className="text-white text-lg font-bold mb-4 flex items-center gap-2">
              <Crown size={20} className="text-primary" />
              Admin Panel
            </h3>
            <p className="text-sm text-gray-400 mb-4">
              Access administrative functions and system management
            </p>
            <Button 
              onClick={() => navigate('/admin')}
              className="w-full bg-primary text-black font-bold hover:bg-primary/90"
            >
              Access Admin Dashboard
            </Button>
          </div>
        )}

        {/* Payment Methods */}
        <div className="bg-card rounded-xl p-4">
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
            className="w-full bg-muted border border-border text-foreground hover:bg-accent disabled:opacity-50"
          >
            Manage Payment Methods
          </Button>
        </div>

        {/* Notifications */}
        <div className="bg-card rounded-xl p-4">
          <h3 className="text-foreground text-lg font-bold mb-4 flex items-center gap-2">
            <Bell size={20} />
            Notifications
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Manage your notification preferences
          </p>
          <Button 
            disabled 
            className="w-full bg-muted border border-border text-muted-foreground opacity-50"
          >
            Coming Soon
          </Button>
        </div>

        {/* Legal */}
        <div className="bg-card rounded-xl p-4">
          <h3 className="text-foreground text-lg font-bold mb-4 flex items-center gap-2">
            <FileText size={20} />
            Legal
          </h3>
          <div className="space-y-3">
            <Button 
              onClick={() => navigate("/privacy-policy")}
              className="w-full bg-muted border border-border text-foreground hover:bg-accent justify-start"
              variant="outline"
            >
              Privacy Policy
            </Button>
            <Button 
              onClick={() => navigate("/terms-of-service")}
              className="w-full bg-muted border border-border text-foreground hover:bg-accent justify-start"
              variant="outline"
            >
              Terms of Service
            </Button>
          </div>
        </div>

        {/* Account Actions */}
        <div className="bg-card rounded-xl p-4">
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