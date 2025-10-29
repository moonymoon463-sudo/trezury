import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Mail, ShieldCheck, Check } from 'lucide-react';
import { useAlchemyAccount } from '@/hooks/useAlchemyAccount';
import { toast } from 'sonner';

interface AlchemyWalletSetupProps {
  onComplete?: (address: string) => void;
}

export const AlchemyWalletSetup = ({ onComplete }: AlchemyWalletSetupProps) => {
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const {
    address,
    isAuthenticated,
    isVerifyingOTP,
    isAwaitingOTPInput,
    sendEmailOTP,
    verifyEmailOTP,
    resendEmailOTP,
    cancelOTPFlow
  } = useAlchemyAccount();

  const handleSendOTP = async () => {
    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    try {
      await sendEmailOTP(email);
      toast.success('Verification code sent to your email');
    } catch (error) {
      console.error('Error sending OTP:', error);
      toast.error('Failed to send verification code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otpCode || otpCode.length < 6) {
      toast.error('Please enter the 6-digit code');
      return;
    }

    setIsLoading(true);
    try {
      await verifyEmailOTP(otpCode);
      toast.success('Wallet created successfully!');
      if (address && onComplete) {
        onComplete(address);
      }
    } catch (error) {
      console.error('Error verifying OTP:', error);
      toast.error('Invalid verification code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setIsLoading(true);
    try {
      await resendEmailOTP();
      toast.success('Verification code resent');
    } catch (error) {
      console.error('Error resending OTP:', error);
      toast.error('Failed to resend code');
    } finally {
      setIsLoading(false);
    }
  };

  // Success state - wallet created
  if (isAuthenticated && address) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-green-500" />
            <CardTitle>Trading Wallet Ready</CardTitle>
          </div>
          <CardDescription>Your Alchemy smart wallet is set up and ready to use</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Check className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium">Wallet Address:</p>
                <p className="text-xs font-mono break-all">{address}</p>
              </div>
            </AlertDescription>
          </Alert>

          <div className="bg-muted/50 p-4 rounded-lg space-y-2">
            <h4 className="font-medium text-sm">Benefits of Your Smart Wallet:</h4>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Email-based recovery (no seed phrases needed)</li>
              <li>Gas sponsorship available for certain transactions</li>
              <li>Enhanced security with account abstraction</li>
              <li>Seamless trading experience on Base network</li>
            </ul>
          </div>

          {onComplete && (
            <Button onClick={() => onComplete(address)} className="w-full">
              Continue to Trading Account Setup
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  // OTP verification state
  if (isAwaitingOTPInput) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Verify Your Email</CardTitle>
          <CardDescription>
            Enter the 6-digit code sent to {email}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Input
              type="text"
              placeholder="Enter 6-digit code"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              maxLength={6}
              className="text-center text-lg tracking-widest"
            />
          </div>

          <Button
            onClick={handleVerifyOTP}
            disabled={isLoading || isVerifyingOTP || otpCode.length < 6}
            className="w-full"
          >
            {isLoading || isVerifyingOTP ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              'Verify Code'
            )}
          </Button>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleResendOTP}
              disabled={isLoading}
              className="flex-1"
            >
              Resend Code
            </Button>
            <Button
              variant="ghost"
              onClick={cancelOTPFlow}
              disabled={isLoading}
              className="flex-1"
            >
              Change Email
            </Button>
          </div>

          <Alert>
            <AlertDescription className="text-xs">
              Check your spam folder if you don't see the email. The code expires in 10 minutes.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // Initial email input state
  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Trading Wallet</CardTitle>
        <CardDescription>
          Set up your smart wallet with just your email - no seed phrases needed
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Mail className="h-4 w-4" />
          <AlertDescription>
            We'll send a verification code to your email. Your wallet will be secured with 
            email-based authentication and can be recovered anytime.
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Input
            type="email"
            placeholder="your.email@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendOTP()}
          />
        </div>

        <Button
          onClick={handleSendOTP}
          disabled={isLoading || !email}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending Code...
            </>
          ) : (
            <>
              <Mail className="mr-2 h-4 w-4" />
              Send Verification Code
            </>
          )}
        </Button>

        <div className="bg-muted/50 p-4 rounded-lg space-y-2">
          <h4 className="font-medium text-sm">Why use an Alchemy Wallet?</h4>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>No seed phrases to remember or lose</li>
            <li>Email-based recovery system</li>
            <li>Smart contract wallet with enhanced security</li>
            <li>Optimized for trading on Base network</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};
