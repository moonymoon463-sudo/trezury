import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@4.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const resendApiKey = Deno.env.get('RESEND_API_KEY') || '';
const fromEmail = 'Trezury Support <support@trezury.app>';
const supportEmail = 'support@trezury.app';

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { ticket_id, type } = await req.json();

    // Fetch ticket details
    const { data: ticket, error } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('id', ticket_id)
      .single();

    if (error || !ticket) {
      throw new Error('Ticket not found');
    }

    const resend = new Resend(resendApiKey);

    if (type === 'new_ticket') {
      // Email to support team
      await resend.emails.send({
        from: fromEmail,
        to: [supportEmail],
        subject: `New Support Ticket: ${ticket.ticket_number} - ${ticket.issue_type}`,
        html: getSupportTeamEmailTemplate(ticket)
      });

      // Confirmation email to user
      await resend.emails.send({
        from: fromEmail,
        to: [ticket.user_email],
        subject: `Support Ticket Created: ${ticket.ticket_number}`,
        html: getUserConfirmationTemplate(ticket)
      });
    } else if (type === 'status_update') {
      // Email to user about status change
      await resend.emails.send({
        from: fromEmail,
        to: [ticket.user_email],
        subject: `Ticket ${ticket.ticket_number} - Status Update`,
        html: getStatusUpdateTemplate(ticket)
      });
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

function getSupportTeamEmailTemplate(ticket: any): string {
  const issueTypeLabels: Record<string, string> = {
    'login_issue': 'Login Issue',
    'transaction_issue': 'Transaction Issue',
    'payment_issue': 'Payment Issue',
    'kyc_issue': 'KYC Issue',
    'wallet_issue': 'Wallet Issue',
    'technical_issue': 'Technical Issue',
    'other': 'Other'
  };

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; background-color: #0a0a0a; color: #ffffff; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: linear-gradient(180deg, #1a1a1a 0%, #0f0f0f 100%); border: 1px solid #2a2a2a; border-radius: 12px; overflow: hidden; }
          .header { background: linear-gradient(135deg, #d4af37 0%, #f4e5b8 100%); padding: 32px 24px; text-align: center; }
          .header h1 { margin: 0; color: #000000; font-size: 28px; font-weight: 700; }
          .content { padding: 32px 24px; }
          .ticket-info { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 8px; padding: 20px; margin: 20px 0; }
          .info-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #2a2a2a; }
          .info-row:last-child { border-bottom: none; }
          .label { color: #888888; font-weight: 600; }
          .value { color: #ffffff; font-weight: 400; }
          .priority-high { color: #ef4444; font-weight: 700; }
          .priority-urgent { color: #dc2626; font-weight: 700; }
          .description-box { background: #0f0f0f; border: 1px solid #2a2a2a; border-radius: 8px; padding: 16px; margin: 20px 0; white-space: pre-wrap; }
          .button { display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #d4af37 0%, #f4e5b8 100%); color: #000000; text-decoration: none; border-radius: 8px; font-weight: 700; margin: 20px 0; }
          .footer { text-align: center; padding: 24px; color: #888888; font-size: 12px; border-top: 1px solid #2a2a2a; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎫 New Support Ticket</h1>
          </div>
          <div class="content">
            <p style="font-size: 16px; line-height: 1.6; color: #cccccc;">
              A new support ticket has been submitted and requires your attention.
            </p>
            
            <div class="ticket-info">
              <div class="info-row">
                <span class="label">Ticket Number:</span>
                <span class="value" style="font-weight: 700; color: #d4af37;">${ticket.ticket_number}</span>
              </div>
              <div class="info-row">
                <span class="label">User Email:</span>
                <span class="value">${ticket.user_email}</span>
              </div>
              <div class="info-row">
                <span class="label">Issue Type:</span>
                <span class="value">${issueTypeLabels[ticket.issue_type] || ticket.issue_type}</span>
              </div>
              <div class="info-row">
                <span class="label">Priority:</span>
                <span class="value ${ticket.priority === 'high' ? 'priority-high' : ticket.priority === 'urgent' ? 'priority-urgent' : ''}">${ticket.priority.toUpperCase()}</span>
              </div>
              <div class="info-row">
                <span class="label">Subject:</span>
                <span class="value">${ticket.subject}</span>
              </div>
            </div>

            <div style="margin: 24px 0;">
              <p style="font-weight: 600; color: #ffffff; margin-bottom: 12px;">Description:</p>
              <div class="description-box">${ticket.description}</div>
            </div>

            ${ticket.screenshot_url ? `
              <div style="margin: 24px 0;">
                <p style="font-weight: 600; color: #ffffff; margin-bottom: 12px;">📸 Screenshot attached</p>
              </div>
            ` : ''}

            <div style="text-align: center; margin: 32px 0;">
              <a href="https://app.trezury.app/admin/support" class="button">
                View Ticket in Admin Panel →
              </a>
            </div>
          </div>
          <div class="footer">
            <p>This is an automated notification from Trezury Support System</p>
            <p style="margin-top: 8px;">© 2025 Trezury. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

function getUserConfirmationTemplate(ticket: any): string {
  const issueTypeLabels: Record<string, string> = {
    'login_issue': 'Login Issue',
    'transaction_issue': 'Transaction Issue',
    'payment_issue': 'Payment Issue',
    'kyc_issue': 'KYC Issue',
    'wallet_issue': 'Wallet Issue',
    'technical_issue': 'Technical Issue',
    'other': 'Other'
  };

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; background-color: #0a0a0a; color: #ffffff; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: linear-gradient(180deg, #1a1a1a 0%, #0f0f0f 100%); border: 1px solid #2a2a2a; border-radius: 12px; overflow: hidden; }
          .header { background: linear-gradient(135deg, #d4af37 0%, #f4e5b8 100%); padding: 32px 24px; text-align: center; }
          .header h1 { margin: 0; color: #000000; font-size: 28px; font-weight: 700; }
          .content { padding: 32px 24px; }
          .ticket-box { background: #1a1a1a; border: 1px solid #d4af37; border-radius: 8px; padding: 24px; margin: 20px 0; text-align: center; }
          .ticket-number { font-size: 32px; font-weight: 700; color: #d4af37; margin: 12px 0; }
          .info-text { color: #cccccc; line-height: 1.6; margin: 16px 0; }
          .button { display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #d4af37 0%, #f4e5b8 100%); color: #000000; text-decoration: none; border-radius: 8px; font-weight: 700; margin: 20px 0; }
          .footer { text-align: center; padding: 24px; color: #888888; font-size: 12px; border-top: 1px solid #2a2a2a; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Support Ticket Received</h1>
          </div>
          <div class="content">
            <p style="font-size: 16px; line-height: 1.6; color: #cccccc;">
              Thank you for contacting Trezury Support. We've received your support request and our team will review it shortly.
            </p>
            
            <div class="ticket-box">
              <p style="margin: 0; color: #888888;">Your Ticket Number</p>
              <div class="ticket-number">${ticket.ticket_number}</div>
              <p style="margin: 8px 0 0 0; color: #888888; font-size: 14px;">Please reference this number in any future correspondence</p>
            </div>

            <div style="margin: 24px 0;">
              <p style="font-weight: 600; color: #ffffff;">Issue Type:</p>
              <p class="info-text">${issueTypeLabels[ticket.issue_type] || ticket.issue_type}</p>
              
              <p style="font-weight: 600; color: #ffffff; margin-top: 16px;">Subject:</p>
              <p class="info-text">${ticket.subject}</p>
            </div>

            <div style="background: #0f0f0f; border-left: 4px solid #d4af37; padding: 16px; margin: 24px 0;">
              <p style="margin: 0; color: #cccccc; font-size: 14px;">
                📧 We typically respond within 24-48 hours during business days. You'll receive an email notification when there's an update on your ticket.
              </p>
            </div>

            <div style="text-align: center; margin: 32px 0;">
              <a href="https://app.trezury.app/support/tickets" class="button">
                View My Tickets →
              </a>
            </div>
          </div>
          <div class="footer">
            <p>Need immediate assistance? Reply to this email to add more information to your ticket.</p>
            <p style="margin-top: 8px;">© 2025 Trezury. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

function getStatusUpdateTemplate(ticket: any): string {
  const statusLabels: Record<string, string> = {
    'open': 'Open',
    'in_progress': 'In Progress',
    'resolved': 'Resolved',
    'closed': 'Closed'
  };

  const statusColors: Record<string, string> = {
    'open': '#3b82f6',
    'in_progress': '#f59e0b',
    'resolved': '#10b981',
    'closed': '#6b7280'
  };

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; background-color: #0a0a0a; color: #ffffff; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: linear-gradient(180deg, #1a1a1a 0%, #0f0f0f 100%); border: 1px solid #2a2a2a; border-radius: 12px; overflow: hidden; }
          .header { background: linear-gradient(135deg, #d4af37 0%, #f4e5b8 100%); padding: 32px 24px; text-align: center; }
          .header h1 { margin: 0; color: #000000; font-size: 28px; font-weight: 700; }
          .content { padding: 32px 24px; }
          .status-box { background: #1a1a1a; border: 1px solid ${statusColors[ticket.status]}; border-radius: 8px; padding: 24px; margin: 20px 0; text-align: center; }
          .status-badge { display: inline-block; padding: 8px 20px; background: ${statusColors[ticket.status]}; color: #ffffff; border-radius: 20px; font-weight: 700; font-size: 14px; }
          .button { display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #d4af37 0%, #f4e5b8 100%); color: #000000; text-decoration: none; border-radius: 8px; font-weight: 700; margin: 20px 0; }
          .footer { text-align: center; padding: 24px; color: #888888; font-size: 12px; border-top: 1px solid #2a2a2a; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔔 Ticket Status Update</h1>
          </div>
          <div class="content">
            <p style="font-size: 16px; line-height: 1.6; color: #cccccc;">
              Your support ticket status has been updated.
            </p>
            
            <div class="status-box">
              <p style="margin: 0 0 12px 0; color: #888888;">Ticket: ${ticket.ticket_number}</p>
              <span class="status-badge">${statusLabels[ticket.status]}</span>
            </div>

            ${ticket.resolution_notes ? `
              <div style="background: #0f0f0f; border: 1px solid #2a2a2a; border-radius: 8px; padding: 16px; margin: 24px 0;">
                <p style="font-weight: 600; color: #ffffff; margin-bottom: 12px;">Resolution Notes:</p>
                <p style="color: #cccccc; line-height: 1.6; white-space: pre-wrap;">${ticket.resolution_notes}</p>
              </div>
            ` : ''}

            <div style="text-align: center; margin: 32px 0;">
              <a href="https://app.trezury.app/support/tickets/${ticket.id}" class="button">
                View Ticket Details →
              </a>
            </div>

            ${ticket.status === 'resolved' || ticket.status === 'closed' ? `
              <div style="background: #0f0f0f; border-left: 4px solid #10b981; padding: 16px; margin: 24px 0;">
                <p style="margin: 0; color: #cccccc; font-size: 14px;">
                  ${ticket.status === 'resolved' ? 'We hope this resolves your issue. If you need further assistance, feel free to reply to this ticket.' : 'This ticket has been closed. If you need further assistance, please open a new ticket.'}
                </p>
              </div>
            ` : ''}
          </div>
          <div class="footer">
            <p>Have questions? Reply to this email to update your ticket.</p>
            <p style="margin-top: 8px;">© 2025 Trezury. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}
