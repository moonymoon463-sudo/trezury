import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { CheckCircle2, Circle, ExternalLink, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/utils/logger';

interface ChecklistItem {
  id: string;
  category: 'environment' | 'security' | 'testing' | 'monitoring';
  title: string;
  description: string;
  priority: 'critical' | 'high' | 'medium';
  completed: boolean;
  link?: string;
  autoCheck?: () => Promise<boolean>;
}

export default function ProductionChecklistPage() {
  const [items, setItems] = useState<ChecklistItem[]>([
    {
      id: 'supabase-password',
      category: 'security',
      title: 'Enable Password Protection',
      description: 'Enable leaked password protection and set minimum password length to 8+ characters in Supabase Auth settings',
      priority: 'critical',
      completed: false,
      link: 'https://supabase.com/dashboard/project/auntkvllzejtfqmousxg/auth/providers'
    },
    {
      id: 'rpc-alchemy',
      category: 'environment',
      title: 'Configure Alchemy RPC',
      description: 'Add ALCHEMY_API_KEY to Supabase Edge Functions secrets',
      priority: 'critical',
      completed: false,
      link: 'https://supabase.com/dashboard/project/auntkvllzejtfqmousxg/settings/functions'
    },
    {
      id: 'rpc-infura',
      category: 'environment',
      title: 'Configure Infura RPC',
      description: 'Add INFURA_API_KEY to Supabase Edge Functions secrets',
      priority: 'high',
      completed: false,
      link: 'https://supabase.com/dashboard/project/auntkvllzejtfqmousxg/settings/functions'
    },
    {
      id: '0x-api-key',
      category: 'environment',
      title: 'Configure 0x API Key',
      description: 'Add real 0x API key to environment variables (replace test key)',
      priority: 'critical',
      completed: false,
      autoCheck: async () => {
        const key = import.meta.env.VITE_ZERO_X_API_KEY;
        return key !== 'your_0x_api_key_here' && key?.length > 20;
      }
    },
    {
      id: 'relayer-key',
      category: 'environment',
      title: 'Generate Relayer Private Key',
      description: 'Generate and securely store relayer private key in Supabase secrets',
      priority: 'critical',
      completed: false,
      link: 'https://supabase.com/dashboard/project/auntkvllzejtfqmousxg/settings/functions'
    },
    {
      id: 'rls-check',
      category: 'security',
      title: 'Verify RLS Policies',
      description: 'Run security audit to ensure RLS is enabled on all public tables',
      priority: 'critical',
      completed: false,
      autoCheck: async () => {
        try {
          const { data } = await supabase.rpc('get_system_health_metrics');
          return !!data;
        } catch {
          return false;
        }
      }
    },
    {
      id: 'test-happy-path',
      category: 'testing',
      title: 'Test: Happy Path Swap',
      description: 'Execute successful swap on testnet',
      priority: 'critical',
      completed: false
    },
    {
      id: 'test-idempotency',
      category: 'testing',
      title: 'Test: Idempotency Protection',
      description: 'Verify duplicate swap submission is rejected',
      priority: 'critical',
      completed: false
    },
    {
      id: 'test-chain-id',
      category: 'testing',
      title: 'Test: Chain ID Mismatch',
      description: 'Verify chain ID validation rejects mismatched transactions',
      priority: 'high',
      completed: false
    },
    {
      id: 'test-token-verify',
      category: 'testing',
      title: 'Test: Token Verification',
      description: 'Verify unrecognized tokens are rejected',
      priority: 'high',
      completed: false
    },
    {
      id: 'test-slippage',
      category: 'testing',
      title: 'Test: Slippage Cap',
      description: 'Verify excessive slippage is rejected',
      priority: 'high',
      completed: false
    },
    {
      id: 'monitoring-setup',
      category: 'monitoring',
      title: 'Configure Monitoring Alerts',
      description: 'Set up alerts for success rate < 90%, settlement time > 10min, security failures',
      priority: 'high',
      completed: false,
      link: '/system-health'
    }
  ]);

  useEffect(() => {
    runAutoChecks();
  }, []);

  const runAutoChecks = async () => {
    const updatedItems = await Promise.all(
      items.map(async (item) => {
        if (item.autoCheck) {
          try {
            const result = await item.autoCheck();
            return { ...item, completed: result };
          } catch (error) {
            logger.error(`Auto-check failed for ${item.id}`, error);
          }
        }
        return item;
      })
    );
    setItems(updatedItems);
  };

  const toggleItem = (id: string) => {
    setItems(items.map(item => 
      item.id === id ? { ...item, completed: !item.completed } : item
    ));
  };

  const stats = {
    total: items.length,
    completed: items.filter(i => i.completed).length,
    critical: items.filter(i => i.priority === 'critical' && !i.completed).length
  };

  const progress = (stats.completed / stats.total) * 100;

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
      environment: '🔧',
      security: '🔒',
      testing: '🧪',
      monitoring: '📊'
    };
    return icons[category] || '📋';
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'critical':
        return <Badge variant="destructive">Critical</Badge>;
      case 'high':
        return <Badge variant="outline" className="bg-warning/10 text-warning">High</Badge>;
      case 'medium':
        return <Badge variant="outline">Medium</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Production Deployment Checklist</h1>
        <p className="text-muted-foreground">Complete all items before launching to production</p>
      </div>

      {/* Progress Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-3xl font-bold">{progress.toFixed(0)}%</div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                {stats.completed} of {stats.total} completed
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Critical Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-3xl font-bold text-destructive">{stats.critical}</div>
              <p className="text-sm text-muted-foreground">
                Remaining critical tasks
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Readiness</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.critical === 0 && progress === 100 ? (
                <>
                  <CheckCircle2 className="h-8 w-8 text-success" />
                  <p className="text-sm font-semibold text-success">Ready for Production</p>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-8 w-8 text-warning" />
                  <p className="text-sm font-semibold text-warning">Not Ready</p>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {stats.critical > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {stats.critical} critical item{stats.critical !== 1 ? 's' : ''} remaining. 
            Complete all critical items before production deployment.
          </AlertDescription>
        </Alert>
      )}

      {/* Checklist Items by Category */}
      {['environment', 'security', 'testing', 'monitoring'].map((category) => {
        const categoryItems = items.filter(i => i.category === category);
        if (categoryItems.length === 0) return null;

        return (
          <Card key={category}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <span className="text-2xl">{getCategoryIcon(category)}</span>
                <div>
                  <CardTitle className="capitalize">{category}</CardTitle>
                  <CardDescription>
                    {categoryItems.filter(i => i.completed).length} of {categoryItems.length} completed
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {categoryItems.map((item) => (
                <div 
                  key={item.id}
                  className="flex items-start gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <Checkbox
                    checked={item.completed}
                    onCheckedChange={() => toggleItem(item.id)}
                    className="mt-1"
                  />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <h4 className={`font-semibold ${item.completed ? 'line-through text-muted-foreground' : ''}`}>
                        {item.title}
                      </h4>
                      {getPriorityBadge(item.priority)}
                    </div>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                    {item.link && (
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                        className="text-primary"
                      >
                        <a href={item.link} target={item.link.startsWith('http') ? '_blank' : '_self'} rel="noopener noreferrer">
                          {item.link.startsWith('http') ? 'Open Supabase Dashboard' : 'Go to Page'}
                          <ExternalLink className="h-3 w-3 ml-1" />
                        </a>
                      </Button>
                    )}
                  </div>
                  {item.completed ? (
                    <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
