import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, AlertTriangle, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SecurityCheck {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  description: string;
  recommendation?: string;
}

interface SecuritySummary {
  overallScore: number;
  level: 'excellent' | 'good' | 'moderate' | 'poor';
  checks: SecurityCheck[];
  lastUpdated: string;
}

export const SecurityStatus: React.FC = () => {
  const [security, setSecurity] = useState<SecuritySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      performSecurityCheck();
    }
  }, [user]);

  const performSecurityCheck = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      const checks: SecurityCheck[] = [];
      let totalScore = 0;
      const maxScore = 100;

      // Check 1: Account verification status (use masked view)
      const { data: profile } = await supabase
        .from('v_profiles_masked')
        .select('kyc_status, email, created_at')
        .eq('id', user.id)
        .single();

      if (profile?.kyc_status === 'verified') {
        checks.push({
          name: 'Identity Verification',
          status: 'pass',
          description: 'KYC verification completed'
        });
        totalScore += 25;
      } else {
        checks.push({
          name: 'Identity Verification',
          status: 'warning',
          description: 'KYC verification pending',
          recommendation: 'Complete identity verification for enhanced security'
        });
        totalScore += 10;
      }

      // Check 2: Wallet security
      const { data: walletAddresses } = await supabase
        .from('onchain_addresses')
        .select('address, created_at')
        .eq('user_id', user.id);

      if (walletAddresses && walletAddresses.length > 0) {
        checks.push({
          name: 'Secure Wallet',
          status: 'pass',
          description: 'Secure wallet configured'
        });
        totalScore += 20;
      } else {
        checks.push({
          name: 'Secure Wallet',
          status: 'fail',
          description: 'No secure wallet configured',
          recommendation: 'Set up secure wallet for transactions'
        });
      }

      // Check 3: Recent security events
      const { data: recentEvents } = await supabase
        .from('security_audit')
        .select('risk_score, timestamp')
        .eq('user_id', user.id)
        .gte('timestamp', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('timestamp', { ascending: false })
        .limit(10);

      const hasHighRiskEvents = recentEvents?.some(event => event.risk_score >= 7);
      if (!hasHighRiskEvents) {
        checks.push({
          name: 'Account Activity',
          status: 'pass',
          description: 'No suspicious activity detected'
        });
        totalScore += 20;
      } else {
        checks.push({
          name: 'Account Activity',
          status: 'warning',
          description: 'Some suspicious activity detected',
          recommendation: 'Review recent account activity and secure your account'
        });
        totalScore += 5;
      }

      // Check 4: Session security
      const sessionAge = Date.now() - new Date(user.created_at).getTime();
      const isNewSession = sessionAge < 24 * 60 * 60 * 1000; // Less than 24 hours

      if (!isNewSession) {
        checks.push({
          name: 'Session Security',
          status: 'pass',
          description: 'Established session with normal activity'
        });
        totalScore += 15;
      } else {
        checks.push({
          name: 'Session Security',
          status: 'warning',
          description: 'New session - enhanced monitoring active',
          recommendation: 'Complete additional verification steps'
        });
        totalScore += 8;
      }

      // Check 5: Transaction patterns
      const { data: recentTransactions } = await supabase
        .from('transactions')
        .select('quantity, created_at, status')
        .eq('user_id', user.id)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false });

      const hasLargeTransactions = recentTransactions?.some(tx => tx.quantity > 50000);
      const hasFailedTransactions = recentTransactions?.some(tx => tx.status === 'failed');

      if (!hasLargeTransactions && !hasFailedTransactions) {
        checks.push({
          name: 'Transaction Patterns',
          status: 'pass',
          description: 'Normal transaction patterns detected'
        });
        totalScore += 20;
      } else if (hasFailedTransactions) {
        checks.push({
          name: 'Transaction Patterns',
          status: 'warning',
          description: 'Some failed transactions detected',
          recommendation: 'Review failed transactions and account balance'
        });
        totalScore += 10;
      } else {
        checks.push({
          name: 'Transaction Patterns',
          status: 'pass',
          description: 'Large transactions detected - enhanced monitoring active'
        });
        totalScore += 15;
      }

      // Determine overall security level
      const percentage = (totalScore / maxScore) * 100;
      let level: SecuritySummary['level'];
      
      if (percentage >= 85) level = 'excellent';
      else if (percentage >= 70) level = 'good';
      else if (percentage >= 50) level = 'moderate';
      else level = 'poor';

      setSecurity({
        overallScore: Math.round(percentage),
        level,
        checks,
        lastUpdated: new Date().toISOString()
      });

    } catch (error) {
      console.error('Security check failed:', error);
      toast({
        variant: "destructive",
        title: "Security Check Failed",
        description: "Unable to perform security assessment"
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: SecurityCheck['status']) => {
    switch (status) {
      case 'pass': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'fail': return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getSecurityLevelColor = (level: SecuritySummary['level']) => {
    switch (level) {
      case 'excellent': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'good': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'moderate': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'poor': return 'bg-red-500/10 text-red-500 border-red-500/20';
    }
  };

  if (!user) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">
            Please log in to view security status
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            <CardTitle>Security Status</CardTitle>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={performSecurityCheck}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
        <CardDescription>
          Monitor your account security and follow recommendations
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <div className="text-center py-8">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Performing security assessment...</p>
          </div>
        ) : security ? (
          <>
            {/* Overall Score */}
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border-2 border-primary/20">
                <span className="text-2xl font-bold text-primary">{security.overallScore}%</span>
              </div>
              <div>
                <Badge className={getSecurityLevelColor(security.level)}>
                  {security.level.toUpperCase()} SECURITY
                </Badge>
                <p className="text-sm text-muted-foreground mt-2">
                  Last updated: {new Date(security.lastUpdated).toLocaleString()}
                </p>
              </div>
            </div>

            {/* Security Checks */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm">Security Checks</h3>
              {security.checks.map((check, index) => (
                <div key={index} className="flex items-start gap-3 p-3 rounded-lg border">
                  {getStatusIcon(check.status)}
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-sm">{check.name}</h4>
                      <Badge variant={check.status === 'pass' ? 'outline' : 'secondary'}>
                        {check.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {check.description}
                    </p>
                    {check.recommendation && (
                      <Alert className="mt-2">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          {check.recommendation}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Security Tips */}
            <div className="p-4 bg-muted rounded-lg">
              <h3 className="font-semibold text-sm mb-2">Security Tips</h3>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Use strong, unique passwords</li>
                <li>• Enable two-factor authentication when available</li>
                <li>• Regularly review your account activity</li>
                <li>• Never share your wallet passwords or seed phrases</li>
                <li>• Use secure networks for financial transactions</li>
              </ul>
            </div>
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Failed to load security status
          </div>
        )}
      </CardContent>
    </Card>
  );
};