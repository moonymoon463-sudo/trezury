import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw, PlayCircle, Clock, AlertCircle } from 'lucide-react';

interface WebhookDLQEntry {
  id: string;
  webhook_id: string;
  event_type: string;
  payload: any;
  retry_count: number;
  last_error: string;
  queued_at: string;
  replayed_at: string | null;
  replay_status: string;
  replay_error: string | null;
}

export const WebhookDLQManager = () => {
  const [dlqEntries, setDlqEntries] = useState<WebhookDLQEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [replayingId, setReplayingId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchDLQEntries = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('webhook_dlq')
        .select('*')
        .order('queued_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setDlqEntries(data || []);
    } catch (error: any) {
      console.error('Failed to fetch DLQ entries:', error);
      toast({
        title: 'Error',
        description: 'Failed to load webhook DLQ',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const replayWebhook = async (dlqId: string) => {
    setReplayingId(dlqId);
    try {
      const { data, error } = await supabase.rpc('replay_webhook_from_dlq', {
        dlq_id: dlqId,
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string; message?: string };

      if (result?.success) {
        toast({
          title: 'Success',
          description: 'Webhook replayed successfully',
        });
        fetchDLQEntries();
      } else {
        throw new Error(result?.error || 'Replay failed');
      }
    } catch (error: any) {
      console.error('Replay error:', error);
      toast({
        title: 'Replay Failed',
        description: error.message || 'Failed to replay webhook',
        variant: 'destructive',
      });
    } finally {
      setReplayingId(null);
    }
  };

  useEffect(() => {
    fetchDLQEntries();
  }, []);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive'> = {
      pending: 'default',
      completed: 'secondary',
      failed: 'destructive',
    };
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 animate-spin" />
            Loading Webhook DLQ...
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Webhook Dead Letter Queue
            </CardTitle>
            <CardDescription>
              Failed webhooks awaiting manual replay ({dlqEntries.length} entries)
            </CardDescription>
          </div>
          <Button onClick={fetchDLQEntries} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {dlqEntries.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No failed webhooks in queue</p>
          </div>
        ) : (
          <div className="space-y-4">
            {dlqEntries.map((entry) => (
              <Card key={entry.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{entry.event_type}</h3>
                        {getStatusBadge(entry.replay_status)}
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>
                          <strong>Webhook ID:</strong> {entry.webhook_id}
                        </p>
                        <p>
                          <strong>Retry Count:</strong> {entry.retry_count}
                        </p>
                        <p>
                          <strong>Queued At:</strong> {formatDate(entry.queued_at)}
                        </p>
                        {entry.replayed_at && (
                          <p>
                            <strong>Replayed At:</strong> {formatDate(entry.replayed_at)}
                          </p>
                        )}
                        {entry.last_error && (
                          <p className="text-destructive">
                            <strong>Error:</strong> {entry.last_error}
                          </p>
                        )}
                        {entry.replay_error && (
                          <p className="text-destructive">
                            <strong>Replay Error:</strong> {entry.replay_error}
                          </p>
                        )}
                      </div>
                      <details className="mt-2">
                        <summary className="text-sm cursor-pointer text-primary hover:underline">
                          View Payload
                        </summary>
                        <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto max-h-40">
                          {JSON.stringify(entry.payload, null, 2)}
                        </pre>
                      </details>
                    </div>
                    <div className="ml-4">
                      {entry.replay_status === 'pending' && (
                        <Button
                          onClick={() => replayWebhook(entry.id)}
                          disabled={replayingId === entry.id}
                          size="sm"
                        >
                          {replayingId === entry.id ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <PlayCircle className="h-4 w-4 mr-2" />
                          )}
                          Replay
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
