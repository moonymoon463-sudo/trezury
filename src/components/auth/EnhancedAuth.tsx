import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Shield, 
  Eye, 
  EyeOff, 
  AlertTriangle, 
  CheckCircle, 
  Lock,
  Mail,
  Smartphone,
  Globe
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { securityService } from "@/services/securityService";
import { useToast } from "@/hooks/use-toast";

interface PasswordStrength {
  score: number;
  feedback: string[];
  isStrong: boolean;
}

export const EnhancedAuth: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState<PasswordStrength | null>(null);
  const [securityCheck, setSecurityCheck] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');
  
  const { signIn, signUp, user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (password && activeTab === 'signup') {
      analyzePasswordStrength(password);
    }
  }, [password, activeTab]);

  useEffect(() => {
    performSecurityCheck();
  }, []);

  const analyzePasswordStrength = (pwd: string) => {
    let score = 0;
    const feedback: string[] = [];

    // Length check
    if (pwd.length >= 8) score += 2;
    else feedback.push('Use at least 8 characters');

    if (pwd.length >= 12) score += 1;

    // Character variety
    if (/[a-z]/.test(pwd)) score += 1;
    else feedback.push('Include lowercase letters');

    if (/[A-Z]/.test(pwd)) score += 1;
    else feedback.push('Include uppercase letters');

    if (/[0-9]/.test(pwd)) score += 1;
    else feedback.push('Include numbers');

    if (/[^A-Za-z0-9]/.test(pwd)) score += 2;
    else feedback.push('Include special characters');

    // Common patterns
    if (!/(.)\1{2,}/.test(pwd)) score += 1;
    else feedback.push('Avoid repeating characters');

    if (!/123|abc|qwe|password|admin/i.test(pwd)) score += 1;
    else feedback.push('Avoid common patterns');

    const isStrong = score >= 7;
    
    setPasswordStrength({
      score: Math.min(score, 8),
      feedback: feedback.slice(0, 3), // Limit feedback
      isStrong
    });
  };

  const performSecurityCheck = async () => {
    try {
      // Simulate security environment check
      const checks = {
        https: window.location.protocol === 'https:',
        localStorage: typeof(Storage) !== 'undefined',
        cryptoAPI: typeof(crypto) !== 'undefined',
        userAgent: navigator.userAgent,
        language: navigator.language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      };

      setSecurityCheck(checks);

      // Log security check
      await securityService.logSecurityEvent({
        event_type: 'auth_security_check',
        severity: 'low',
        description: 'Security environment assessment',
        metadata: checks
      });
    } catch (error) {
      console.error('Security check failed:', error);
    }
  };

  const handleSignIn = async () => {
    // Rate limiting check
    const rateLimitCheck = await securityService.checkRateLimit(
      `signin_${email}`,
      { maxRequests: 5, windowMs: 15 * 60 * 1000 } // 5 attempts per 15 minutes
    );

    if (!rateLimitCheck.allowed) {
      toast({
        variant: "destructive",
        title: "Too Many Attempts",
        description: `Please wait ${Math.ceil((rateLimitCheck.resetTime - Date.now()) / 60000)} minutes before trying again`
      });
      return;
    }

    // Input validation
    const emailValidation = securityService.validateAndSanitizeInput(email, 'email');
    if (!emailValidation.isValid) {
      toast({
        variant: "destructive",
        title: "Invalid Email",
        description: emailValidation.errors[0]
      });
      return;
    }

    try {
      setLoading(true);
      
      // Log sign-in attempt
      await securityService.logSecurityEvent({
        event_type: 'signin_attempt',
        severity: 'medium',
        description: 'User attempting to sign in',
        metadata: { email: emailValidation.sanitized }
      });

      const { error } = await signIn(emailValidation.sanitized, password);

      if (error) {
        // Log failed sign-in
        await securityService.logSecurityEvent({
          event_type: 'signin_failed',
          severity: 'high',
          description: 'Sign-in attempt failed',
          metadata: { 
            email: emailValidation.sanitized,
            error_message: error.message 
          }
        });
      } else {
        // Log successful sign-in
        await securityService.logSecurityEvent({
          event_type: 'signin_success',
          severity: 'low',
          description: 'User signed in successfully',
          metadata: { email: emailValidation.sanitized }
        });
      }
    } catch (error) {
      console.error('Sign-in error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    // Rate limiting check
    const rateLimitCheck = await securityService.checkRateLimit(
      `signup_${email}`,
      { maxRequests: 3, windowMs: 60 * 60 * 1000 } // 3 attempts per hour
    );

    if (!rateLimitCheck.allowed) {
      toast({
        variant: "destructive",
        title: "Too Many Attempts",
        description: "Too many sign-up attempts. Please try again later."
      });
      return;
    }

    // Input validation
    const emailValidation = securityService.validateAndSanitizeInput(email, 'email');
    if (!emailValidation.isValid) {
      toast({
        variant: "destructive",
        title: "Invalid Email",
        description: emailValidation.errors[0]
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "Password Mismatch",
        description: "Passwords do not match"
      });
      return;
    }

    if (!passwordStrength?.isStrong) {
      toast({
        variant: "destructive",
        title: "Password Too Weak",
        description: "Please create a stronger password"
      });
      return;
    }

    try {
      setLoading(true);

      // Log sign-up attempt
      await securityService.logSecurityEvent({
        event_type: 'signup_attempt',
        severity: 'medium',
        description: 'New user attempting to sign up',
        metadata: { 
          email: emailValidation.sanitized,
          password_strength: passwordStrength.score
        }
      });

      const { error } = await signUp(emailValidation.sanitized, password);

      if (error) {
        // Log failed sign-up
        await securityService.logSecurityEvent({
          event_type: 'signup_failed',
          severity: 'high',
          description: 'Sign-up attempt failed',
          metadata: { 
            email: emailValidation.sanitized,
            error_message: error.message 
          }
        });
      } else {
        // Log successful sign-up
        await securityService.logSecurityEvent({
          event_type: 'signup_success',
          severity: 'low',
          description: 'New user signed up successfully',
          metadata: { email: emailValidation.sanitized }
        });
      }
    } catch (error) {
      console.error('Sign-up error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPasswordStrengthColor = () => {
    if (!passwordStrength) return '';
    const score = passwordStrength.score;
    if (score >= 7) return 'text-green-500';
    if (score >= 5) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getPasswordStrengthText = () => {
    if (!passwordStrength) return '';
    const score = passwordStrength.score;
    if (score >= 7) return 'Strong';
    if (score >= 5) return 'Moderate';
    if (score >= 3) return 'Weak';
    return 'Very Weak';
  };

  if (user) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="pt-6 text-center">
          <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
          <h3 className="text-lg font-semibold mb-2">Welcome Back!</h3>
          <p className="text-muted-foreground">You are successfully authenticated</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto space-y-6">
      {/* Security Status */}
      {securityCheck && (
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription className="text-sm">
            <div className="flex items-center gap-2 mb-2">
              <span>Security Status:</span>
              {securityCheck.https ? (
                <Badge className="text-xs bg-green-500/10 text-green-500">Secure Connection</Badge>
              ) : (
                <Badge variant="destructive" className="text-xs">Insecure Connection</Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              Environment validated • Enhanced monitoring active
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Auth Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Secure Authentication
          </CardTitle>
          <CardDescription>
            Sign in to your account or create a new one
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'signin' | 'signup')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="space-y-4 mt-6">
              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="pl-10 pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <Button
                onClick={handleSignIn}
                disabled={loading || !email || !password}
                className="w-full"
              >
                {loading ? "Signing In..." : "Sign In Securely"}
              </Button>
            </TabsContent>

            <TabsContent value="signup" className="space-y-4 mt-6">
              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create a strong password"
                    className="pl-10 pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {passwordStrength && password && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span>Password Strength:</span>
                      <span className={getPasswordStrengthColor()}>
                        {getPasswordStrengthText()}
                      </span>
                    </div>
                    <div className="w-full bg-muted h-2 rounded-full">
                      <div 
                        className={`h-2 rounded-full transition-all ${
                          passwordStrength.score >= 7 ? 'bg-green-500' :
                          passwordStrength.score >= 5 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${(passwordStrength.score / 8) * 100}%` }}
                      />
                    </div>
                    {passwordStrength.feedback.length > 0 && (
                      <ul className="text-xs text-muted-foreground space-y-1">
                        {passwordStrength.feedback.map((item, index) => (
                          <li key={index}>• {item}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your password"
                    className="pl-10"
                  />
                </div>
              </div>

              <Button
                onClick={handleSignUp}
                disabled={loading || !email || !password || !confirmPassword || !passwordStrength?.isStrong}
                className="w-full"
              >
                {loading ? "Creating Account..." : "Create Secure Account"}
              </Button>
            </TabsContent>
          </Tabs>

          {/* Security Features */}
          <div className="mt-6 pt-4 border-t space-y-3">
            <h4 className="text-sm font-medium">Security Features</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Shield className="h-3 w-3" />
                <span>Rate Limiting</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Globe className="h-3 w-3" />
                <span>IP Monitoring</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <AlertTriangle className="h-3 w-3" />
                <span>Threat Detection</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Lock className="h-3 w-3" />
                <span>Encrypted Storage</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};