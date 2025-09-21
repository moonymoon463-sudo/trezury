import { supabase } from "@/integrations/supabase/client";

export interface InstitutionalUser {
  id: string;
  orgName: string;
  adminEmail: string;
  tier: 'standard' | 'premium' | 'enterprise';
  features: string[];
  multiSigRequired: boolean;
  signatories: string[];
  minimumSignatures: number;
  whiteLabelConfig?: {
    brandName: string;
    primaryColor: string;
    logoUrl: string;
    customDomain: string;
  };
}

export interface TeamMember {
  id: string;
  email: string;
  role: 'admin' | 'trader' | 'viewer' | 'analyst';
  permissions: string[];
  addedAt: Date;
  lastActive?: Date;
}

export interface AuditLogEntry {
  id: string;
  userId: string;
  userEmail: string;
  action: string;
  resource: string;
  timestamp: Date;
  details: any;
  ipAddress?: string;
  userAgent?: string;
}

export interface ComplianceReport {
  id: string;
  type: 'monthly' | 'quarterly' | 'annual' | 'custom';
  period: { start: Date; end: Date };
  transactions: number;
  volume: number;
  fees: number;
  riskMetrics: {
    averageHealthFactor: number;
    liquidationEvents: number;
    maxDrawdown: number;
  };
  complianceChecks: {
    kycCompliance: boolean;
    amlScreening: boolean;
    riskLimits: boolean;
    reportingRequirements: boolean;
  };
  generatedAt: Date;
  downloadUrl?: string;
}

export class InstitutionalService {
  static async createInstitutionalAccount(
    orgName: string,
    adminEmail: string,
    tier: 'standard' | 'premium' | 'enterprise' = 'standard'
  ): Promise<InstitutionalUser> {
    try {
      const features = this.getTierFeatures(tier);
      
      const { data, error } = await supabase
        .from('institutional_accounts')
        .insert({
          org_name: orgName,
          admin_email: adminEmail,
          tier,
          features,
          multi_sig_required: tier !== 'standard',
          signatories: [adminEmail],
          minimum_signatures: tier === 'enterprise' ? 2 : 1
        })
        .select()
        .single();

      if (error) throw error;

      const institutionalUser: InstitutionalUser = {
        id: data.id,
        orgName: data.org_name,
        adminEmail: data.admin_email,
        tier: data.tier as 'standard' | 'premium' | 'enterprise',
        features: data.features,
        multiSigRequired: data.multi_sig_required,
        signatories: data.signatories,
        minimumSignatures: data.minimum_signatures,
        whiteLabelConfig: data.white_label_config ? data.white_label_config as {
          brandName: string;
          primaryColor: string;
          logoUrl: string;
          customDomain: string;
        } : undefined
      };

      return institutionalUser;

    } catch (error) {
      console.error('Error creating institutional account:', error);
      throw error;
    }
  }

  private static getTierFeatures(tier: string): string[] {
    const baseFeatures = [
      'portfolio_management',
      'basic_reporting',
      'api_access'
    ];

    const premiumFeatures = [
      ...baseFeatures,
      'advanced_analytics',
      'custom_alerts',
      'priority_support',
      'batch_operations'
    ];

    const enterpriseFeatures = [
      ...premiumFeatures,
      'white_label',
      'multi_sig_support',
      'advanced_compliance',
      'custom_integrations',
      'dedicated_support'
    ];

    switch (tier) {
      case 'premium': return premiumFeatures;
      case 'enterprise': return enterpriseFeatures;
      default: return baseFeatures;
    }
  }

  static async addTeamMember(
    institutionalId: string,
    email: string,
    role: TeamMember['role'],
    permissions: string[]
  ): Promise<TeamMember> {
    try {
      const { data: userData } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .single();

      if (!userData) {
        throw new Error('User not found with that email');
      }

      const { data, error } = await supabase
        .from('team_members')
        .insert({
          institutional_account_id: institutionalId,
          user_id: userData.id,
          email,
          role,
          permissions
        })
        .select()
        .single();

      if (error) throw error;

      const teamMember: TeamMember = {
        id: data.id,
        email: data.email,
        role: data.role as 'admin' | 'trader' | 'viewer' | 'analyst',
        permissions: data.permissions,
        addedAt: new Date(data.added_at),
        lastActive: data.last_active ? new Date(data.last_active) : undefined
      };

      return teamMember;

    } catch (error) {
      console.error('Error adding team member:', error);
      throw error;
    }
  }

  static async getAuditLog(
    institutionalId: string,
    filters?: {
      userId?: string;
      action?: string;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<AuditLogEntry[]> {
    try {
      let query = supabase
        .from('audit_log')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(100);

      if (filters?.userId) {
        query = query.eq('user_id', filters.userId);
      }
      if (filters?.action) {
        query = query.eq('operation', filters.action);
      }
      if (filters?.startDate) {
        query = query.gte('timestamp', filters.startDate.toISOString());
      }
      if (filters?.endDate) {
        query = query.lte('timestamp', filters.endDate.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;

      return data?.map(entry => ({
        id: entry.id,
        userId: entry.user_id,
        userEmail: (entry.metadata as any)?.user_email || 'Unknown',
        action: entry.operation,
        resource: entry.table_name,
        timestamp: new Date(entry.timestamp),
        details: entry.metadata,
        ipAddress: entry.ip_address || '',
        userAgent: entry.user_agent || ''
      })) as AuditLogEntry[] || [];
    } catch (error) {
      console.error('Error fetching audit log:', error);
      return [];
    }
  }

  static async generateComplianceReport(
    institutionalId: string,
    type: ComplianceReport['type'],
    period: { start: Date; end: Date }
  ): Promise<ComplianceReport> {
    try {
      // Get institutional account transactions
      const { data: transactions } = await supabase
        .from('transactions')
        .select('*')
        .gte('created_at', period.start.toISOString())
        .lte('created_at', period.end.toISOString());

      // Get health factor data for risk metrics
      const { data: healthFactors } = await supabase
        .from('user_health_factors')
        .select('*')
        .gte('last_calculated_at', period.start.toISOString())
        .lte('last_calculated_at', period.end.toISOString());

      const totalVolume = transactions?.reduce((sum, tx) => 
        sum + (tx.quantity * (tx.unit_price_usd || 0)), 0) || 0;
      
      const totalFees = transactions?.reduce((sum, tx) => sum + (tx.fee_usd || 0), 0) || 0;
      
      const avgHealthFactor = healthFactors?.length ? 
        healthFactors.reduce((sum, hf) => sum + hf.health_factor, 0) / healthFactors.length : 0;

      // Create compliance report in database
      const { data: reportData, error } = await supabase
        .from('compliance_reports')
        .insert({
          institutional_account_id: institutionalId,
          type,
          period_start: period.start.toISOString(),
          period_end: period.end.toISOString(),
          transactions_count: transactions?.length || 0,
          volume_usd: totalVolume,
          fees_usd: totalFees,
          risk_metrics: {
            averageHealthFactor: avgHealthFactor,
            liquidationEvents: 0,
            maxDrawdown: 0
          },
          compliance_checks: {
            kycCompliance: true,
            amlScreening: true,
            riskLimits: true,
            reportingRequirements: true
          }
        })
        .select()
        .single();

      if (error) throw error;

      const report: ComplianceReport = {
        id: reportData.id,
        type: reportData.type as 'monthly' | 'quarterly' | 'annual' | 'custom',
        period: {
          start: new Date(reportData.period_start),
          end: new Date(reportData.period_end)
        },
        transactions: reportData.transactions_count,
        volume: reportData.volume_usd,
        fees: reportData.fees_usd,
        riskMetrics: reportData.risk_metrics as {
          averageHealthFactor: number;
          liquidationEvents: number;
          maxDrawdown: number;
        },
        complianceChecks: reportData.compliance_checks as {
          kycCompliance: boolean;
          amlScreening: boolean;
          riskLimits: boolean;
          reportingRequirements: boolean;
        },
        generatedAt: new Date(reportData.generated_at),
        downloadUrl: reportData.download_url
      };

      return report;

    } catch (error) {
      console.error('Error generating compliance report:', error);
      throw error;
    }
  }

  static async configureWhiteLabel(
    institutionalId: string,
    config: {
      brandName: string;
      primaryColor: string;
      logoUrl: string;
      customDomain: string;
    }
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('institutional_accounts')
        .update({
          white_label_config: config
        })
        .eq('id', institutionalId);

      if (error) throw error;
      
    } catch (error) {
      console.error('Error configuring white label:', error);
      throw error;
    }
  }

  static async setupMultiSig(
    institutionalId: string,
    signatories: string[],
    minimumSignatures: number
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('institutional_accounts')
        .update({
          signatories,
          minimum_signatures: minimumSignatures,
          multi_sig_required: true
        })
        .eq('id', institutionalId);

      if (error) throw error;
      
    } catch (error) {
      console.error('Error setting up multi-sig:', error);
      throw error;
    }
  }
}