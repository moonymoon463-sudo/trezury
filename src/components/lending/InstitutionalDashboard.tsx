import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Building2, Users, Shield, FileText, Download, Plus, Settings,
  TrendingUp, AlertTriangle, CheckCircle, Clock, Eye
} from "lucide-react";
import { InstitutionalService, TeamMember, AuditLogEntry, ComplianceReport } from "@/services/institutionalService";
import { useToast } from "@/hooks/use-toast";

export function InstitutionalDashboard() {
  const { toast } = useToast();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [complianceReports, setComplianceReports] = useState<ComplianceReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberRole, setNewMemberRole] = useState<TeamMember['role']>("viewer");

  // Mock institutional account data
  const institutionalAccount = {
    id: "inst-demo",
    orgName: "DeFi Capital Partners",
    tier: "enterprise" as const,
    features: ["white_label", "multi_sig_support", "advanced_compliance"],
    multiSigRequired: true,
    signatories: ["admin@example.com", "cto@example.com"],
    minimumSignatures: 2
  };

  useEffect(() => {
    loadTeamMembers();
    loadAuditLog();
    loadComplianceReports();
  }, []);

  const loadTeamMembers = async () => {
    // Mock data - replace with actual API call
    setTeamMembers([
      {
        id: "member-1",
        email: "admin@example.com",
        role: "admin",
        permissions: ["full_access"],
        addedAt: new Date("2024-01-15"),
        lastActive: new Date()
      },
      {
        id: "member-2", 
        email: "trader1@example.com",
        role: "trader",
        permissions: ["trade", "view_positions"],
        addedAt: new Date("2024-02-01"),
        lastActive: new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago
      }
    ]);
  };

  const loadAuditLog = async () => {
    // Mock data - replace with actual API call
    setAuditLog([
      {
        id: "audit-1",
        userId: "user-1",
        userEmail: "trader1@example.com",
        action: "SUPPLY",
        resource: "user_supplies",
        timestamp: new Date(Date.now() - 30 * 60 * 1000),
        details: { asset: "USDC", amount: 10000 },
        ipAddress: "192.168.1.100"
      },
      {
        id: "audit-2",
        userId: "user-2",
        userEmail: "admin@example.com",
        action: "ADD_TEAM_MEMBER",
        resource: "team_members",
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
        details: { newMember: "analyst@example.com" }
      }
    ]);
  };

  const loadComplianceReports = async () => {
    // Mock data - replace with actual API call
    setComplianceReports([
      {
        id: "report-1",
        type: "monthly",
        period: { 
          start: new Date("2024-03-01"), 
          end: new Date("2024-03-31") 
        },
        transactions: 247,
        volume: 2400000,
        fees: 12000,
        riskMetrics: {
          averageHealthFactor: 3.2,
          liquidationEvents: 0,
          maxDrawdown: 0.08
        },
        complianceChecks: {
          kycCompliance: true,
          amlScreening: true,
          riskLimits: true,
          reportingRequirements: true
        },
        generatedAt: new Date("2024-04-01"),
        downloadUrl: "/reports/monthly-2024-03.pdf"
      }
    ]);
  };

  const addTeamMember = async () => {
    if (!newMemberEmail || !newMemberRole) return;

    try {
      setLoading(true);
      const newMember = await InstitutionalService.addTeamMember(
        institutionalAccount.id,
        newMemberEmail,
        newMemberRole,
        getDefaultPermissions(newMemberRole)
      );

      setTeamMembers([...teamMembers, newMember]);
      setNewMemberEmail("");
      setNewMemberRole("viewer");

      toast({
        title: "Team Member Added",
        description: `${newMemberEmail} has been added as ${newMemberRole}`
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to add team member"
      });
    } finally {
      setLoading(false);
    }
  };

  const generateComplianceReport = async () => {
    try {
      setLoading(true);
      const report = await InstitutionalService.generateComplianceReport(
        institutionalAccount.id,
        "monthly",
        {
          start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          end: new Date()
        }
      );

      setComplianceReports([report, ...complianceReports]);

      toast({
        title: "Report Generated",
        description: "Monthly compliance report has been generated"
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error", 
        description: "Failed to generate compliance report"
      });
    } finally {
      setLoading(false);
    }
  };

  const getDefaultPermissions = (role: TeamMember['role']): string[] => {
    switch (role) {
      case 'admin': return ['full_access'];
      case 'trader': return ['trade', 'view_positions', 'manage_risk'];
      case 'analyst': return ['view_positions', 'view_analytics', 'generate_reports'];
      case 'viewer': return ['view_positions'];
      default: return ['view_positions'];
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-primary/10 text-primary border-primary/20';
      case 'trader': return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'analyst': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      default: return 'bg-muted/10 text-muted-foreground border-muted/20';
    }
  };

  const formatLastActive = (date?: Date) => {
    if (!date) return "Never";
    const diff = Date.now() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return "Just now";
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 rounded-xl border border-border">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">
              Institutional Dashboard
            </h1>
            <p className="text-muted-foreground">
              {institutionalAccount.orgName} • {institutionalAccount.tier} tier
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
              <Building2 className="h-4 w-4 mr-1" />
              Enterprise
            </Badge>
            <Button variant="outline">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Team Members</p>
                <p className="text-xl font-bold">{teamMembers.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Shield className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Multi-Sig Status</p>
                <p className="text-sm font-semibold text-green-600">Active ({institutionalAccount.minimumSignatures}/{institutionalAccount.signatories.length})</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Compliance Reports</p>
                <p className="text-xl font-bold">{complianceReports.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <Eye className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Audit Entries</p>
                <p className="text-xl font-bold">{auditLog.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="team" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="team">Team Management</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="team" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Team Members</CardTitle>
                  <CardDescription>Manage access and permissions for your team</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Email address"
                    value={newMemberEmail}
                    onChange={(e) => setNewMemberEmail(e.target.value)}
                    className="w-48"
                  />
                  <Select value={newMemberRole} onValueChange={(value: TeamMember['role']) => setNewMemberRole(value)}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="trader">Trader</SelectItem>
                      <SelectItem value="analyst">Analyst</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={addTeamMember} disabled={loading}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Permissions</TableHead>
                    <TableHead>Last Active</TableHead>
                    <TableHead>Added</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamMembers.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">{member.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getRoleBadgeColor(member.role)}>
                          {member.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {member.permissions.join(", ")}
                      </TableCell>
                      <TableCell>{formatLastActive(member.lastActive)}</TableCell>
                      <TableCell>{member.addedAt.toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Audit Log</CardTitle>
              <CardDescription>Complete history of all user actions and system events</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Resource</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLog.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="text-sm">
                        {entry.timestamp.toLocaleString()}
                      </TableCell>
                      <TableCell className="font-medium">{entry.userEmail}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{entry.action}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {entry.resource}
                      </TableCell>
                      <TableCell className="text-sm">
                        {JSON.stringify(entry.details)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compliance" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Compliance Reports</CardTitle>
                  <CardDescription>Generate and download compliance reports</CardDescription>
                </div>
                <Button onClick={generateComplianceReport} disabled={loading}>
                  <FileText className="h-4 w-4 mr-2" />
                  Generate Report
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {complianceReports.map((report) => (
                  <Card key={report.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold capitalize">{report.type} Report</h4>
                            <Badge variant="outline">
                              {report.period.start.toLocaleDateString()} - {report.period.end.toLocaleDateString()}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-4 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">Transactions</p>
                              <p className="font-semibold">{report.transactions}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Volume</p>
                              <p className="font-semibold">${report.volume.toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Avg Health Factor</p>
                              <p className="font-semibold">{report.riskMetrics.averageHealthFactor.toFixed(2)}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              {Object.values(report.complianceChecks).every(Boolean) ? (
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              ) : (
                                <AlertTriangle className="h-4 w-4 text-orange-600" />
                              )}
                              <span className="text-sm">
                                {Object.values(report.complianceChecks).every(Boolean) ? 'Compliant' : 'Issues Found'}
                              </span>
                            </div>
                          </div>
                        </div>
                        <Button variant="outline" size="sm">
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Multi-Signature Settings</CardTitle>
                <CardDescription>Configure transaction approval requirements</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="multi-sig">Enable Multi-Signature</Label>
                  <Switch id="multi-sig" checked={institutionalAccount.multiSigRequired} />
                </div>
                <div>
                  <Label>Required Signatures</Label>
                  <Select value={institutionalAccount.minimumSignatures.toString()}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 of {institutionalAccount.signatories.length}</SelectItem>
                      <SelectItem value="2">2 of {institutionalAccount.signatories.length}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Signatories</Label>
                  <div className="space-y-2 mt-2">
                    {institutionalAccount.signatories.map((signatory, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
                        <span className="text-sm">{signatory}</span>
                        <Badge variant="outline">Active</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>White Label Configuration</CardTitle>
                <CardDescription>Customize branding for your organization</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="brand-name">Brand Name</Label>
                  <Input id="brand-name" placeholder="Your Company Name" />
                </div>
                <div>
                  <Label htmlFor="primary-color">Primary Color</Label>
                  <Input id="primary-color" type="color" defaultValue="#0ea5e9" />
                </div>
                <div>
                  <Label htmlFor="logo-url">Logo URL</Label>
                  <Input id="logo-url" placeholder="https://example.com/logo.png" />
                </div>
                <div>
                  <Label htmlFor="custom-domain">Custom Domain</Label>
                  <Input id="custom-domain" placeholder="defi.yourcompany.com" />
                </div>
                <Button className="w-full">
                  Save Configuration
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}