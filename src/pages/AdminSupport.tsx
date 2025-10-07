import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import StandardHeader from '@/components/StandardHeader';
import BottomNavigation from '@/components/BottomNavigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAdmin } from '@/hooks/useAdmin';
import { Search, Filter, MessageCircle, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

interface Ticket {
  id: string;
  ticket_number: string;
  user_id: string;
  user_email: string;
  issue_type: string;
  subject: string;
  description: string;
  screenshot_url?: string;
  status: string;
  priority: string;
  assigned_to?: string;
  resolution_notes?: string;
  created_at: string;
  updated_at: string;
  resolved_at?: string;
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

export default function AdminSupport() {
  const navigate = useNavigate();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      navigate('/');
      return;
    }

    if (isAdmin) {
      fetchTickets();
    }
  }, [isAdmin, adminLoading, navigate]);

  const fetchTickets = async () => {
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTickets((data || []) as Ticket[]);
    } catch (error: any) {
      console.error('Error fetching tickets:', error);
      toast.error('Failed to load tickets');
    } finally {
      setLoading(false);
    }
  };

  const updateTicketStatus = async (ticketId: string, newStatus: string) => {
    setUpdating(true);
    try {
      const updates: any = {
        status: newStatus
      };

      if (newStatus === 'resolved' || newStatus === 'closed') {
        updates.resolved_at = new Date().toISOString();
        if (resolutionNotes) {
          updates.resolution_notes = resolutionNotes;
        }
      }

      const { error } = await supabase
        .from('support_tickets')
        .update(updates)
        .eq('id', ticketId);

      if (error) throw error;

      // Send status update email
      await supabase.functions.invoke('send-support-email', {
        body: {
          ticket_id: ticketId,
          type: 'status_update'
        }
      });

      toast.success('Ticket status updated');
      fetchTickets();
      setSelectedTicket(null);
      setResolutionNotes('');
    } catch (error: any) {
      console.error('Error updating ticket:', error);
      toast.error('Failed to update ticket');
    } finally {
      setUpdating(false);
    }
  };

  const filteredTickets = tickets.filter(ticket => {
    const matchesSearch = 
      ticket.ticket_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.user_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.subject.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || ticket.priority === priorityFilter;
    
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const groupedTickets = {
    open: filteredTickets.filter(t => t.status === 'open'),
    in_progress: filteredTickets.filter(t => t.status === 'in_progress'),
    resolved: filteredTickets.filter(t => t.status === 'resolved'),
    closed: filteredTickets.filter(t => t.status === 'closed')
  };

  if (adminLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading support tickets...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <StandardHeader title="Support Tickets" />

      <div className="container mx-auto px-4 py-6 max-w-7xl space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-blue-400" />
                <span className="text-sm text-muted-foreground">Open</span>
              </div>
              <div className="text-2xl font-bold">{groupedTickets.open.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4 text-yellow-400" />
                <span className="text-sm text-muted-foreground">In Progress</span>
              </div>
              <div className="text-2xl font-bold">{groupedTickets.in_progress.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-4 w-4 text-green-400" />
                <span className="text-sm text-muted-foreground">Resolved</span>
              </div>
              <div className="text-2xl font-bold">{groupedTickets.resolved.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <XCircle className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-muted-foreground">Closed</span>
              </div>
              <div className="text-2xl font-bold">{groupedTickets.closed.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Ticket #, email, subject..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priorities</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tickets Tabs */}
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="all">All ({filteredTickets.length})</TabsTrigger>
            <TabsTrigger value="open">Open ({groupedTickets.open.length})</TabsTrigger>
            <TabsTrigger value="in_progress">In Progress ({groupedTickets.in_progress.length})</TabsTrigger>
            <TabsTrigger value="resolved">Resolved ({groupedTickets.resolved.length})</TabsTrigger>
            <TabsTrigger value="closed">Closed ({groupedTickets.closed.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-4 mt-4">
            {filteredTickets.map(ticket => (
              <Card key={ticket.id} className="cursor-pointer hover:border-primary/50" onClick={() => setSelectedTicket(ticket)}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-primary font-mono text-sm font-bold">{ticket.ticket_number}</span>
                        <Badge className={statusColors[ticket.status]}>{ticket.status.replace('_', ' ')}</Badge>
                        <Badge className={priorityColors[ticket.priority]}>{ticket.priority}</Badge>
                      </div>
                      <h3 className="text-lg font-semibold mb-1 truncate">{ticket.subject}</h3>
                      <p className="text-sm text-muted-foreground">{issueTypeLabels[ticket.issue_type]}</p>
                      <p className="text-xs text-muted-foreground mt-2">From: {ticket.user_email}</p>
                    </div>
                    <div className="text-xs text-muted-foreground text-right">
                      {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {['open', 'in_progress', 'resolved', 'closed'].map(status => (
            <TabsContent key={status} value={status} className="space-y-4 mt-4">
              {groupedTickets[status as keyof typeof groupedTickets].map(ticket => (
                <Card key={ticket.id} className="cursor-pointer hover:border-primary/50" onClick={() => setSelectedTicket(ticket)}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-primary font-mono text-sm font-bold">{ticket.ticket_number}</span>
                          <Badge className={priorityColors[ticket.priority]}>{ticket.priority}</Badge>
                        </div>
                        <h3 className="text-lg font-semibold mb-1 truncate">{ticket.subject}</h3>
                        <p className="text-sm text-muted-foreground">{issueTypeLabels[ticket.issue_type]}</p>
                        <p className="text-xs text-muted-foreground mt-2">From: {ticket.user_email}</p>
                      </div>
                      <div className="text-xs text-muted-foreground text-right">
                        {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
          ))}
        </Tabs>
      </div>

      {/* Ticket Details Modal */}
      <Dialog open={!!selectedTicket} onOpenChange={() => setSelectedTicket(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <span className="text-primary font-mono">{selectedTicket?.ticket_number}</span>
              <Badge className={statusColors[selectedTicket?.status || 'open']}>
                {selectedTicket?.status?.replace('_', ' ')}
              </Badge>
              <Badge className={priorityColors[selectedTicket?.priority || 'normal']}>
                {selectedTicket?.priority}
              </Badge>
            </DialogTitle>
          </DialogHeader>

          {selectedTicket && (
            <div className="space-y-6 mt-4">
              {/* User Info */}
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-semibold mb-2">User Information</h4>
                <p className="text-sm text-muted-foreground">Email: {selectedTicket.user_email}</p>
                <p className="text-sm text-muted-foreground">User ID: {selectedTicket.user_id}</p>
              </div>

              {/* Ticket Details */}
              <div>
                <h3 className="text-lg font-semibold mb-2">{selectedTicket.subject}</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {issueTypeLabels[selectedTicket.issue_type]}
                </p>
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
                    alt="Ticket screenshot"
                    className="rounded-lg border max-w-full h-auto"
                  />
                </div>
              )}

              {/* Resolution Notes */}
              {selectedTicket.status !== 'resolved' && selectedTicket.status !== 'closed' && (
                <div className="space-y-2">
                  <Label>Resolution Notes (Optional)</Label>
                  <Textarea
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    placeholder="Add notes about the resolution..."
                    rows={4}
                  />
                </div>
              )}

              {selectedTicket.resolution_notes && (
                <div>
                  <h4 className="font-semibold mb-2">Resolution Notes:</h4>
                  <div className="bg-green-500/10 border border-green-500/50 rounded-lg p-4 whitespace-pre-wrap">
                    {selectedTicket.resolution_notes}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-2 pt-4 border-t">
                {selectedTicket.status === 'open' && (
                  <Button
                    onClick={() => updateTicketStatus(selectedTicket.id, 'in_progress')}
                    disabled={updating}
                    className="bg-yellow-600 hover:bg-yellow-700"
                  >
                    Mark In Progress
                  </Button>
                )}
                {(selectedTicket.status === 'open' || selectedTicket.status === 'in_progress') && (
                  <Button
                    onClick={() => updateTicketStatus(selectedTicket.id, 'resolved')}
                    disabled={updating}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Mark Resolved
                  </Button>
                )}
                {selectedTicket.status === 'resolved' && (
                  <Button
                    onClick={() => updateTicketStatus(selectedTicket.id, 'closed')}
                    disabled={updating}
                    variant="outline"
                  >
                    Close Ticket
                  </Button>
                )}
              </div>

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

      <BottomNavigation />
    </div>
  );
}
