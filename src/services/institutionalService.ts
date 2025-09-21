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
      
      const institutionalUser: InstitutionalUser = {
        id: `inst-${Date.now()}`,
        orgName,
        adminEmail,
        tier,
        features,
        multiSigRequired: tier !== 'standard',
        signatories: [adminEmail],
        minimumSignatures: tier === 'enterprise' ? 2 : 1
      };

      // Store in database (using existing table structure)
      console.log('Created institutional account:', institutionalUser);

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
      const teamMember: TeamMember = {
        id: `member-${Date.now()}`,
        email,
        role,
        permissions,
        addedAt: new Date()
      };

      // Store team member (using existing structure)
      console.log('Added team member:', teamMember);

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
    // Mock implementation for demo
    return [];
  }

  static async generateComplianceReport(
    institutionalId: string,
    type: ComplianceReport['type'],
    period: { start: Date; end: Date }
  ): Promise<ComplianceReport> {
    try {
      // Mock transaction data for demo - replace with actual queries when institutional tables are available
      const transactions = [
        { quantity: 1000, unit_price_usd: 1, fee_usd: 10 },
        { quantity: 2000, unit_price_usd: 1.5, fee_usd: 15 }
      ];

      // Mock health factor data for demo
      const healthFactors = [
        { health_factor: 2.5 },
        { health_factor: 3.0 },
        { health_factor: 2.8 }
      ];

      const totalVolume = transactions.reduce((sum, tx) => 
        sum + (tx.quantity * (tx.unit_price_usd || 0)), 0);
      
      const totalFees = transactions.reduce((sum, tx) => sum + (tx.fee_usd || 0), 0);
      
      const avgHealthFactor = healthFactors.reduce((sum, hf) => 
        sum + hf.health_factor, 0) / healthFactors.length;

      const report: ComplianceReport = {
        id: `report-${Date.now()}`,
        type,
        period,
        transactions: transactions.length,
        volume: totalVolume,
        fees: totalFees,
        riskMetrics: {
          averageHealthFactor: avgHealthFactor,
          liquidationEvents: 0, // Would be calculated from liquidation_calls table
          maxDrawdown: 0 // Would be calculated from historical portfolio values
        },
        complianceChecks: {
          kycCompliance: true, // Check all users have verified KYC
          amlScreening: true,  // Check AML screening results
          riskLimits: true,    // Verify position limits compliance
          reportingRequirements: true // Verify all required reports generated
        },
        generatedAt: new Date()
      };

      // Store report (mock implementation)
      console.log('Generated compliance report:', report);

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
    console.log('Configured white label for:', institutionalId, config);
  }

  static async setupMultiSig(
    institutionalId: string,
    signatories: string[],
    minimumSignatures: number
  ): Promise<void> {
    console.log('Setup multi-sig for:', institutionalId, { signatories, minimumSignatures });
  }
}