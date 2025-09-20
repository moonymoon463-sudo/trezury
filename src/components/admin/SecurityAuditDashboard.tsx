import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Shield, AlertTriangle, Eye, Clock, User, Database } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { piiEncryptionService } from '@/services/piiEncryptionService';

interface SecurityAuditData {
  pii_access_events: any[];
  high_risk_operations: any[];
  suspicious_patterns: any[];
  encryption_status: {
    encrypted_fields: number;
    total_sensitive_fields: number;
    encryption_coverage: number;
  };
  retention_policy_status: {
    records_eligible: number;
    last_retention_run: string;
  };
}

const SecurityAuditDashboard = () => {
  const [auditData, setAuditData] = useState<SecurityAuditData | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const loadSecurityAudit = async () => {
    setLoading(true);
    try {
      // Get PII access events from last 24 hours
      const { data: piiEvents } = await supabase
        .from('audit_log')
        .select('*')
        .contains('sensitive_fields', ['ssn_last_four', 'date_of_birth', 'address', 'phone'])
        .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('timestamp', { ascending: false })
        .limit(50);

      // Get high-risk operations
      const { data: highRiskOps } = await supabase
        .from('security_audit')
        .select('*')
        .gte('risk_score', 7)
        .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('timestamp', { ascending: false })
        .limit(20);

      // Check for suspicious patterns (rapid access)
      const { data: suspiciousPatterns } = await supabase
        .from('audit_log')
        .select('user_id, COUNT(*) as access_count')
        .gte('timestamp', new Date(Date.now() - 60 * 60 * 1000).toISOString())
        .not('user_id', 'is', null);

      // Check encryption status
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, metadata, ssn_last_four, date_of_birth, address, phone')
        .not('ssn_last_four', 'is', null);

      const encryptedFields = profiles?.filter(p => 
        p.metadata && typeof p.metadata === 'object' && 
        (p.metadata as any).encryption_version
      ).length || 0;

      const totalSensitiveFields = profiles?.filter(p => 
        p.ssn_last_four || p.date_of_birth || p.address || p.phone
      ).length || 0;

      setAuditData({
        pii_access_events: piiEvents || [],
        high_risk_operations: highRiskOps || [],
        suspicious_patterns: suspiciousPatterns || [],
        encryption_status: {
          encrypted_fields: encryptedFields,
          total_sensitive_fields: totalSensitiveFields,
          encryption_coverage: totalSensitiveFields > 0 ? (encryptedFields / totalSensitiveFields) * 100 : 0
        },
        retention_policy_status: {
          records_eligible: 0, // Would be calculated based on actual retention policy
          last_retention_run: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Security audit failed:', error);
      toast({
        variant: "destructive",
        title: "Security Audit Failed",
        description: "Unable to load security audit data"
      });
    } finally {
      setLoading(false);
    }
  };

  const runDataRetentionPolicy = async () => {
    setLoading(true);
    try {
      await piiEncryptionService.applyDataRetentionPolicy();
      toast({
        title: "Data Retention Policy Applied",
        description: "Successfully checked and applied data retention policies"
      });
      await loadSecurityAudit();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Retention Policy Failed",
        description: "Unable to apply data retention policy"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSecurityAudit();
    // Auto-refresh every 10 minutes
    const interval = setInterval(loadSecurityAudit, 600000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Audit Dashboard
          </CardTitle>
          <div className="flex gap-2">
            <Button 
              onClick={runDataRetentionPolicy}
              disabled={loading}
              variant="outline"
              size="sm"
            >
              <Database className="h-4 w-4 mr-2" />
              Run Retention Policy
            </Button>
            <Button 
              onClick={loadSecurityAudit}
              disabled={loading}
              size="sm"
            >
              <Eye className="h-4 w-4 mr-2" />
              Refresh Audit
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Encryption Status */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {auditData?.encryption_status.encryption_coverage.toFixed(1)}%
                </div>
                <div className="text-sm text-muted-foreground">Encryption Coverage</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {auditData?.pii_access_events.length}
                </div>
                <div className="text-sm text-muted-foreground">PII Access (24h)</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {auditData?.high_risk_operations.length}
                </div>
                <div className="text-sm text-muted-foreground">High Risk Ops (24h)</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent PII Access Events */}
        <div>
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Recent PII Access Events
          </h4>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {auditData?.pii_access_events.slice(0, 10).map((event, index) => (
              <div key={index} className="flex items-center justify-between p-2 border rounded">
                <div className="flex items-center gap-2">
                  <User className="h-3 w-3" />
                  <span className="text-sm">
                    {event.operation} - {event.sensitive_fields?.join(', ')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </Badge>
                </div>
              </div>
            ))}
            {(!auditData?.pii_access_events || auditData.pii_access_events.length === 0) && (
              <div className="text-center text-muted-foreground text-sm py-4">
                No PII access events in the last 24 hours
              </div>
            )}
          </div>
        </div>

        {/* High Risk Operations */}
        {auditData?.high_risk_operations && auditData.high_risk_operations.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              High Risk Operations
            </h4>
            <div className="space-y-2">
              {auditData.high_risk_operations.slice(0, 5).map((op, index) => (
                <div key={index} className="flex items-center justify-between p-2 border border-red-200 rounded">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-3 w-3 text-red-500" />
                    <span className="text-sm">{op.operation} on {op.table_name}</span>
                  </div>
                  <Badge variant="destructive" className="text-xs">
                    Risk: {op.risk_score}/10
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Data Retention Status */}
        <div className="flex items-center justify-between p-3 bg-muted rounded">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span className="text-sm">Data Retention Policy</span>
          </div>
          <div className="text-sm text-muted-foreground">
            Last run: {auditData?.retention_policy_status.last_retention_run ? 
              new Date(auditData.retention_policy_status.last_retention_run).toLocaleString() : 
              'Never'
            }
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SecurityAuditDashboard;