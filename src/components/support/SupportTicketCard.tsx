import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SupportTicket } from '@/hooks/useSupportTickets';
import { formatDistanceToNow } from 'date-fns';

interface SupportTicketCardProps {
  ticket: SupportTicket;
  onClick?: () => void;
}

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

export const SupportTicketCard = ({ ticket, onClick }: SupportTicketCardProps) => {
  return (
    <Card
      className="cursor-pointer hover:border-primary/50 transition-colors"
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-primary font-mono text-sm font-bold">
                {ticket.ticket_number}
              </span>
              <Badge className={statusColors[ticket.status]}>
                {ticket.status.replace('_', ' ')}
              </Badge>
              {ticket.priority !== 'normal' && (
                <Badge className={priorityColors[ticket.priority]}>
                  {ticket.priority}
                </Badge>
              )}
            </div>
            <h3 className="text-lg font-semibold text-white truncate">
              {ticket.subject}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {issueTypeLabels[ticket.issue_type] || ticket.issue_type}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
          {ticket.description}
        </p>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Created {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}
          </span>
          {ticket.resolved_at && (
            <span className="text-green-400">
              Resolved {formatDistanceToNow(new Date(ticket.resolved_at), { addSuffix: true })}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
