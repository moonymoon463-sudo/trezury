import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@4.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-auth-signature',
};

// Configuration from environment variables
const resendApiKey = Deno.env.get('RESEND_API_KEY') || '';
const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'Trezury <onboarding@resend.dev>';
const hookSecret = Deno.env.get('SEND_EMAIL_HOOK_SECRET') || '';

// Verify webhook signature from Supabase using Web Crypto API
async function verifySignature(payload: string, signature: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signatureData = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(payload)
  );
  
  const expectedSignature = Array.from(new Uint8Array(signatureData))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  return signature === expectedSignature;
}

// Email template functions
function getSignupTemplate(token: string, tokenHash: string, redirectTo: string, supabaseUrl: string): string {
  const verifyLink = `${supabaseUrl}/auth/v1/verify?token=${tokenHash}&type=signup&redirect_to=${redirectTo}`;
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Trezury</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0A0A0B;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #0A0A0B;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #1A1A1B; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.3);">
          
          <!-- Header with Gold Accent -->
          <tr>
            <td style="background: linear-gradient(135deg, #D4AF37 0%, #F4D03F 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #0A0A0B; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">
                Welcome to Trezury
              </h1>
              <p style="margin: 10px 0 0 0; color: #1A1A1B; font-size: 16px;">
                Your Digital Gold Vault
              </p>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="margin: 0 0 20px 0; color: #FFFFFF; font-size: 24px; font-weight: 600;">
                Verify Your Email Address
              </h2>
              
              <p style="margin: 0 0 20px 0; color: #E5E5E5; font-size: 16px; line-height: 1.6;">
                Thank you for signing up with Trezury. To complete your registration and start investing in digital gold, please verify your email address.
              </p>
              
              <p style="margin: 0 0 30px 0; color: #E5E5E5; font-size: 16px; line-height: 1.6;">
                Once verified, a secure wallet will be automatically created for you to store your gold-backed tokens.
              </p>
              
              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="text-align: center; padding: 0 0 30px 0;">
                    <a href="${verifyLink}" style="display: inline-block; background: linear-gradient(135deg, #D4AF37 0%, #F4D03F 100%); color: #0A0A0B; text-decoration: none; font-weight: 600; font-size: 16px; padding: 16px 40px; border-radius: 8px; box-shadow: 0 4px 12px rgba(212, 175, 55, 0.3);">
                      Verify Email Address
                    </a>
                  </td>
                </tr>
              </table>
              
              <!-- Alternative Link -->
              <p style="margin: 0 0 10px 0; color: #A0A0A0; font-size: 14px; line-height: 1.6;">
                If the button doesn't work, copy and paste this link into your browser:
              </p>
              <p style="margin: 0 0 20px 0; word-break: break-all;">
                <a href="${verifyLink}" style="color: #D4AF37; text-decoration: underline; font-size: 13px;">${verifyLink}</a>
              </p>
              
              <!-- Verification Code -->
              <div style="background-color: #0A0A0B; border: 1px solid #2A2A2B; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <p style="margin: 0 0 10px 0; color: #A0A0A0; font-size: 13px; text-align: center;">
                  Or enter this verification code:
                </p>
                <p style="margin: 0; color: #D4AF37; font-size: 24px; font-weight: 700; text-align: center; letter-spacing: 4px; font-family: monospace;">
                  ${token}
                </p>
              </div>
              
              <!-- Security Notice -->
              <p style="margin: 30px 0 0 0; color: #808080; font-size: 13px; line-height: 1.6;">
                If you didn't create a Trezury account, you can safely ignore this email.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #0A0A0B; padding: 30px; text-align: center; border-top: 1px solid #2A2A2B;">
              <p style="margin: 0 0 10px 0; color: #606060; font-size: 13px;">
                © 2025 Trezury. All rights reserved.
              </p>
              <p style="margin: 0; color: #606060; font-size: 13px;">
                Need help? Contact us at <a href="mailto:support@trezury.com" style="color: #D4AF37; text-decoration: none;">support@trezury.com</a>
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

function getPasswordResetTemplate(token: string, tokenHash: string, redirectTo: string, supabaseUrl: string): string {
  const resetLink = `${supabaseUrl}/auth/v1/verify?token=${tokenHash}&type=recovery&redirect_to=${redirectTo}`;
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password - Trezury</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0A0A0B;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #0A0A0B;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #1A1A1B; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.3);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #D4AF37 0%, #F4D03F 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #0A0A0B; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">
                Reset Your Password
              </h1>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="margin: 0 0 20px 0; color: #FFFFFF; font-size: 24px; font-weight: 600;">
                Password Reset Request
              </h2>
              
              <p style="margin: 0 0 20px 0; color: #E5E5E5; font-size: 16px; line-height: 1.6;">
                We received a request to reset your Trezury account password. Click the button below to create a new password.
              </p>
              
              <!-- Warning Box -->
              <div style="background-color: rgba(212, 175, 55, 0.1); border-left: 4px solid #D4AF37; padding: 16px; margin: 0 0 30px 0; border-radius: 4px;">
                <p style="margin: 0; color: #F4D03F; font-size: 14px; font-weight: 600;">
                  ⚠️ This link expires in 1 hour for security reasons.
                </p>
              </div>
              
              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="text-align: center; padding: 0 0 30px 0;">
                    <a href="${resetLink}" style="display: inline-block; background: linear-gradient(135deg, #D4AF37 0%, #F4D03F 100%); color: #0A0A0B; text-decoration: none; font-weight: 600; font-size: 16px; padding: 16px 40px; border-radius: 8px; box-shadow: 0 4px 12px rgba(212, 175, 55, 0.3);">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>
              
              <!-- Alternative Link -->
              <p style="margin: 0 0 10px 0; color: #A0A0A0; font-size: 14px; line-height: 1.6;">
                If the button doesn't work, copy and paste this link into your browser:
              </p>
              <p style="margin: 0 0 30px 0; word-break: break-all;">
                <a href="${resetLink}" style="color: #D4AF37; text-decoration: underline; font-size: 13px;">${resetLink}</a>
              </p>
              
              <!-- Security Notice -->
              <div style="background-color: #0A0A0B; border: 1px solid #2A2A2B; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <p style="margin: 0 0 10px 0; color: #FF6B6B; font-size: 14px; font-weight: 600;">
                  🔒 Security Notice
                </p>
                <p style="margin: 0; color: #A0A0A0; font-size: 13px; line-height: 1.6;">
                  If you didn't request a password reset, please ignore this email. Your password will remain unchanged. For security concerns, contact our support team immediately.
                </p>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #0A0A0B; padding: 30px; text-align: center; border-top: 1px solid #2A2A2B;">
              <p style="margin: 0 0 10px 0; color: #606060; font-size: 13px;">
                © 2025 Trezury. All rights reserved.
              </p>
              <p style="margin: 0; color: #606060; font-size: 13px;">
                Need help? Contact us at <a href="mailto:support@trezury.com" style="color: #D4AF37; text-decoration: none;">support@trezury.com</a>
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

function getEmailChangeTemplate(token: string, tokenHash: string, newEmail: string, redirectTo: string, supabaseUrl: string): string {
  const confirmLink = `${supabaseUrl}/auth/v1/verify?token=${tokenHash}&type=email_change&redirect_to=${redirectTo}`;
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirm Email Change - Trezury</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0A0A0B;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #0A0A0B;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #1A1A1B; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.3);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #D4AF37 0%, #F4D03F 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #0A0A0B; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">
                Confirm Email Change
              </h1>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="margin: 0 0 20px 0; color: #FFFFFF; font-size: 24px; font-weight: 600;">
                Verify Your New Email Address
              </h2>
              
              <p style="margin: 0 0 20px 0; color: #E5E5E5; font-size: 16px; line-height: 1.6;">
                You've requested to change your Trezury account email address. Please confirm your new email to complete this change.
              </p>
              
              <!-- Email Info Box -->
              <div style="background-color: #0A0A0B; border: 1px solid #2A2A2B; border-radius: 8px; padding: 20px; margin: 0 0 30px 0;">
                <p style="margin: 0 0 10px 0; color: #A0A0A0; font-size: 13px;">
                  New email address:
                </p>
                <p style="margin: 0; color: #D4AF37; font-size: 16px; font-weight: 600;">
                  ${newEmail}
                </p>
              </div>
              
              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="text-align: center; padding: 0 0 30px 0;">
                    <a href="${confirmLink}" style="display: inline-block; background: linear-gradient(135deg, #D4AF37 0%, #F4D03F 100%); color: #0A0A0B; text-decoration: none; font-weight: 600; font-size: 16px; padding: 16px 40px; border-radius: 8px; box-shadow: 0 4px 12px rgba(212, 175, 55, 0.3);">
                      Confirm Email Change
                    </a>
                  </td>
                </tr>
              </table>
              
              <!-- Alternative Link -->
              <p style="margin: 0 0 10px 0; color: #A0A0A0; font-size: 14px; line-height: 1.6;">
                If the button doesn't work, copy and paste this link into your browser:
              </p>
              <p style="margin: 0 0 30px 0; word-break: break-all;">
                <a href="${confirmLink}" style="color: #D4AF37; text-decoration: underline; font-size: 13px;">${confirmLink}</a>
              </p>
              
              <!-- Security Notice -->
              <div style="background-color: rgba(212, 175, 55, 0.1); border-left: 4px solid #D4AF37; padding: 16px; margin: 0 0 20px 0; border-radius: 4px;">
                <p style="margin: 0 0 8px 0; color: #F4D03F; font-size: 14px; font-weight: 600;">
                  🔒 Did you authorize this change?
                </p>
                <p style="margin: 0; color: #E5E5E5; font-size: 13px; line-height: 1.6;">
                  If you didn't request this email change, please contact our support team immediately at <a href="mailto:support@trezury.com" style="color: #D4AF37; text-decoration: underline;">support@trezury.com</a>
                </p>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #0A0A0B; padding: 30px; text-align: center; border-top: 1px solid #2A2A2B;">
              <p style="margin: 0 0 10px 0; color: #606060; font-size: 13px;">
                © 2025 Trezury. All rights reserved.
              </p>
              <p style="margin: 0; color: #606060; font-size: 13px;">
                Need help? Contact us at <a href="mailto:support@trezury.com" style="color: #D4AF37; text-decoration: none;">support@trezury.com</a>
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Received auth email webhook request');
    
    const payload = await req.text();
    const signature = req.headers.get('x-supabase-auth-signature') || '';
    
    // Verify webhook signature if secret is configured
    if (hookSecret && signature) {
      const isValid = await verifySignature(payload, signature, hookSecret);
      if (!isValid) {
        console.error('Invalid webhook signature');
        return new Response(
          JSON.stringify({ error: 'Invalid signature' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.log('Webhook signature verified');
    }

    const data = JSON.parse(payload);
    console.log('Webhook data:', { type: data.email_action_type, email: data.user?.email });
    
    const {
      user,
      email_data: { token, token_hash, redirect_to, email_action_type, site_url },
    } = data;

    if (!user?.email) {
      console.error('No user email found in webhook data');
      return new Response(
        JSON.stringify({ error: 'No user email found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get appropriate email template
    let htmlContent: string;
    let subject: string;
    
    const supabaseUrl = site_url || 'https://auntkvllzejtfqmousxg.supabase.co';
    const redirectUrl = redirect_to || `${supabaseUrl}/`;

    switch (email_action_type) {
      case 'signup':
        htmlContent = getSignupTemplate(token, token_hash, redirectUrl, supabaseUrl);
        subject = 'Welcome to Trezury - Verify Your Email';
        break;
      case 'recovery':
        htmlContent = getPasswordResetTemplate(token, token_hash, redirectUrl, supabaseUrl);
        subject = 'Reset Your Trezury Password';
        break;
      case 'email_change':
        htmlContent = getEmailChangeTemplate(token, token_hash, user.email, redirectUrl, supabaseUrl);
        subject = 'Confirm Your New Email - Trezury';
        break;
      default:
        console.error('Unknown email action type:', email_action_type);
        return new Response(
          JSON.stringify({ error: 'Unknown email action type' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    console.log('Sending email via Resend:', { to: user.email, subject, type: email_action_type });

    // Initialize Resend client
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY environment variable is not set');
    }
    
    const resend = new Resend(resendApiKey);

    // Send email via Resend
    const { data: emailData, error } = await resend.emails.send({
      from: fromEmail,
      to: [user.email],
      subject: subject,
      html: htmlContent,
    });

    if (error) {
      console.error('Resend error:', error);
      throw new Error(`Resend API error: ${error.message}`);
    }

    console.log('Resend email sent successfully:', emailData?.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageId: emailData?.id,
        type: email_action_type 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('Error sending email:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to send email',
        details: error.toString()
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
};

serve(handler);
