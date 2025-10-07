import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { SupportTicketCard } from '@/components/support/SupportTicketCard';
import { useSupportTickets } from '@/hooks/useSupportTickets';
import { MessageCircle, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatDistanceToNow } from 'date-fns';

export default function SupportTickets() {
  const { tickets, loading } = useSupportTickets();
  const navigate = useNavigate();
  const [selectedTicket, setSelectedTicket] = useState<any>(null);

  const issueTypeLabels: Record<string, string> = {
    'login_issue': 'Login Issue',
    'transaction_issue': 'Transaction Issue',
    'payment_issue': 'Payment Issue',
    'kyc_issue': 'KYC Issue',
    'wallet_issue': 'Wallet Issue',
    'technical_issue': 'Technical Issue',
    'other': 'Other'
  };

  const statusColors: Record<string, string> = {
    'open': 'bg-blue-500/20 text-blue-400 border-blue-500/50',
    'in_progress': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
    'resolved': 'bg-green-500/20 text-green-400 border-green-500/50',
    'closed': 'bg-gray-500/20 text-gray-400 border-gray-500/50'
  };

  const priorityColors: Record<string, string> = {
    'low': 'bg-gray-500/20 text-gray-400 border-gray-500/50',
    'normal': 'bg-blue-500/20 text-blue-400 border-blue-500/50',
    'high': 'bg-orange-500/20 text-orange-400 border-orange-500/50',
    'urgent': 'bg-red-500/20 text-red-400 border-red-500/50'
  };

  if (loading) {
    return (
      <AppLayout headerProps={{ title: "My Support Tickets", showBackButton: true, backPath: "/support" }}>
        <div className="container mx-auto px-4 py-6 max-w-4xl space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32 mb-2" />
                <Skeleton className="h-4 w-full" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout headerProps={{ title: "My Support Tickets", showBackButton: true, backPath: "/support" }}>
      <div className="container mx-auto px-4 py-6 max-w-4xl space-y-6">
        {/* Create New Ticket Button */}
        <Button
          onClick={() => navigate('/support')}
          className="w-full bg-primary text-black font-bold hover:bg-primary/90"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create New Ticket
        </Button>

        {/* Tickets List */}
        {tickets.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <MessageCircle className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No support tickets yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create a ticket when you need help from our support team
              </p>
              <Button onClick={() => navigate('/support')} variant="outline">
                Contact Support
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {tickets.map((ticket) => (
              <SupportTicketCard
                key={ticket.id}
                ticket={ticket}
                onClick={() => setSelectedTicket(ticket)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Ticket Details Modal */}
      <Dialog open={!!selectedTicket} onOpenChange={() => setSelectedTicket(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <span className="text-primary font-mono">{selectedTicket?.ticket_number}</span>
              <Badge className={statusColors[selectedTicket?.status]}>
                {selectedTicket?.status?.replace('_', ' ')}
              </Badge>
              {selectedTicket?.priority !== 'normal' && (
                <Badge className={priorityColors[selectedTicket?.priority]}>
                  {selectedTicket?.priority}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {selectedTicket && (
            <div className="space-y-6 mt-4">
              {/* Ticket Info */}
              <div>
                <h3 className="text-lg font-semibold mb-2">{selectedTicket.subject}</h3>
                <p className="text-sm text-muted-foreground">
                  {issueTypeLabels[selectedTicket.issue_type] || selectedTicket.issue_type}
                </p>
              </div>

              {/* Description */}
              <div>
                <h4 className="font-semibold mb-2">Description:</h4>
                <div className="bg-muted/50 rounded-lg p-4 whitespace-pre-wrap">
                  {selectedTicket.description}
                </div>
              </div>

              {/* Screenshot */}
              {selectedTicket.screenshot_url && (
                <div>
                  <h4 className="font-semibold mb-2">Screenshot:</h4>
                  <img
                    src={selectedTicket.screenshot_url}
                    alt="Support ticket screenshot"
                    className="rounded-lg border max-w-full h-auto"
                  />
                </div>
              )}

              {/* Resolution Notes */}
              {selectedTicket.resolution_notes && (
                <div>
                  <h4 className="font-semibold mb-2">Resolution Notes:</h4>
                  <div className="bg-green-500/10 border border-green-500/50 rounded-lg p-4 whitespace-pre-wrap">
                    {selectedTicket.resolution_notes}
                  </div>
                </div>
              )}

              {/* Timestamps */}
              <div className="text-xs text-muted-foreground space-y-1 pt-4 border-t">
                <p>Created {formatDistanceToNow(new Date(selectedTicket.created_at), { addSuffix: true })}</p>
                <p>Last updated {formatDistanceToNow(new Date(selectedTicket.updated_at), { addSuffix: true })}</p>
                {selectedTicket.resolved_at && (
                  <p className="text-green-400">
                    Resolved {formatDistanceToNow(new Date(selectedTicket.resolved_at), { addSuffix: true })}
                  </p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
