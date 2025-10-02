import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ArrowLeft, Shield, CheckCircle, XCircle, Clock, Eye, EyeOff } from 'lucide-react';
import { useAdmin } from '@/hooks/useAdmin';
import BottomNavigation from '@/components/BottomNavigation';
import AurumLogo from '@/components/AurumLogo';
import { maskFullName } from '@/utils/piiMasking';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAdminSessionTimeout } from '@/hooks/useAdminSessionTimeout';

interface KYCSubmission {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  kyc_status: string;
  kyc_submitted_at: string | null;
  kyc_verified_at: string | null;
  kyc_rejection_reason: string | null;
}

const AdminKYC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAdmin, loading, getKYCSubmissions, updateKYCStatus } = useAdmin();
  const [submissions, setSubmissions] = useState<KYCSubmission[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<KYCSubmission | null>(null);
  const [reviewDialog, setReviewDialog] = useState(false);
  const [reviewStatus, setReviewStatus] = useState<string>('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [unmaskedIds, setUnmaskedIds] = useState<Set<string>>(new Set());
  
  // Implement admin session timeout (15 minutes of inactivity)
  useAdminSessionTimeout(isAdmin, 15);

  useEffect(() => {
    if (!isAdmin && !loading) {
      navigate('/');
      return;
    }

    const fetchSubmissions = async () => {
      const kycList = await getKYCSubmissions();
      setSubmissions(kycList);
    };

    if (isAdmin) {
      fetchSubmissions();
    }
  }, [isAdmin, loading, getKYCSubmissions, navigate]);

  const handleReview = (submission: KYCSubmission) => {
    setSelectedSubmission(submission);
    setReviewStatus(submission.kyc_status);
    setRejectionReason(submission.kyc_rejection_reason || '');
    setReviewDialog(true);
  };

  const handleTogglePII = async (submissionId: string) => {
    const submission = submissions.find(s => s.id === submissionId);
    if (!submission) return;

    const isCurrentlyMasked = !unmaskedIds.has(submissionId);

    if (isCurrentlyMasked) {
      // Unmasking - show PII
      setUnmaskedIds(prev => new Set([...prev, submissionId]));
      
      toast({
        title: "⚠️ PII Visible",
        description: "Viewing sensitive personal information. This action is logged.",
        variant: "destructive",
      });
      
      // Log PII access to audit_log
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('audit_log').insert({
          user_id: user.id,
          table_name: 'profiles',
          operation: 'ADMIN_PII_VIEW',
          sensitive_fields: ['first_name', 'last_name'],
          metadata: {
            target_user_id: submissionId,
            target_email: submission.email,
            action: 'unmask_pii',
            timestamp: new Date().toISOString()
          }
        });
      }
      
      // Auto-mask after 30 seconds for security
      setTimeout(() => {
        setUnmaskedIds(current => {
          const updated = new Set(current);
          updated.delete(submissionId);
          return updated;
        });
        toast({
          title: "Auto-masked",
          description: "PII automatically hidden after 30 seconds.",
        });
      }, 30000);
    } else {
      // Masking - hide PII
      setUnmaskedIds(prev => {
        const updated = new Set(prev);
        updated.delete(submissionId);
        return updated;
      });
      
      toast({
        title: "PII Masked",
        description: "Personal information hidden for security.",
      });
    }
  };

  const handleUpdateStatus = async () => {
    if (!selectedSubmission) return;

    const success = await updateKYCStatus(
      selectedSubmission.id, 
      reviewStatus, 
      reviewStatus === 'rejected' ? rejectionReason : undefined
    );

    if (success) {
      // Refresh submissions
      const kycList = await getKYCSubmissions();
      setSubmissions(kycList);
      setReviewDialog(false);
      setSelectedSubmission(null);
      setRejectionReason('');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'verified':
        return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Verified</Badge>;
      case 'rejected':
        return <Badge className="bg-red-500"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'under_review':
        return <Badge className="bg-blue-500"><Clock className="w-3 h-3 mr-1" />Under Review</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-background">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading KYC submissions...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex h-screen bg-background">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Shield className="w-16 h-16 text-destructive mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-foreground mb-2">Access Denied</h2>
            <p className="text-muted-foreground mb-6">Admin privileges required.</p>
            <Button onClick={() => navigate('/')}>Return to Dashboard</Button>
          </div>
        </div>
      </div>
    );
  }

  const pendingCount = submissions.filter(s => s.kyc_status === 'pending').length;
  const underReviewCount = submissions.filter(s => s.kyc_status === 'under_review').length;
  const verifiedCount = submissions.filter(s => s.kyc_status === 'verified').length;
  const rejectedCount = submissions.filter(s => s.kyc_status === 'rejected').length;

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="p-4 border-b border-border">
        <div className="flex items-center">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate('/admin')}
            className="text-foreground hover:bg-accent"
          >
            <ArrowLeft size={24} />
          </Button>
          <div className="flex items-center gap-3 flex-1 justify-center pr-6">
            <AurumLogo className="w-8 h-8" />
            <h1 className="text-xl font-bold text-foreground">KYC Management</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 overflow-y-auto">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Under Review</CardTitle>
              <Clock className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{underReviewCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Verified</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{verifiedCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Rejected</CardTitle>
              <XCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{rejectedCount}</div>
            </CardContent>
          </Card>
        </div>

        {/* KYC Submissions Table */}
        <Card>
          <CardHeader>
            <CardTitle>KYC Submissions ({submissions.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Verified</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {submissions.map((submission) => {
                    const isPIIVisible = unmaskedIds.has(submission.id);
                    return (
                      <TableRow key={submission.id}>
                        <TableCell className="font-medium">{submission.email}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span>
                              {isPIIVisible 
                                ? (submission.first_name && submission.last_name 
                                    ? `${submission.first_name} ${submission.last_name}`
                                    : 'N/A')
                                : maskFullName(submission.first_name, submission.last_name)
                              }
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleTogglePII(submission.id)}
                              className="h-6 w-6 p-0"
                            >
                              {isPIIVisible ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(submission.kyc_status)}</TableCell>
                        <TableCell>
                          {submission.kyc_submitted_at 
                            ? new Date(submission.kyc_submitted_at).toLocaleDateString()
                            : 'N/A'
                          }
                        </TableCell>
                        <TableCell>
                          {submission.kyc_verified_at 
                            ? new Date(submission.kyc_verified_at).toLocaleDateString()
                            : 'N/A'
                          }
                        </TableCell>
                        <TableCell>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleReview(submission)}
                          >
                            Review
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Review Dialog */}
      <Dialog open={reviewDialog} onOpenChange={setReviewDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Review KYC Submission</DialogTitle>
          </DialogHeader>
          
          {selectedSubmission && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium">User: {selectedSubmission.email}</p>
                <div className="flex items-center gap-2">
                  <p className="text-sm text-muted-foreground">
                    Name: {unmaskedIds.has(selectedSubmission.id)
                      ? (selectedSubmission.first_name && selectedSubmission.last_name 
                          ? `${selectedSubmission.first_name} ${selectedSubmission.last_name}`
                          : 'N/A')
                      : maskFullName(selectedSubmission.first_name, selectedSubmission.last_name)
                    }
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleTogglePII(selectedSubmission.id)}
                    className="h-6 w-6 p-0"
                  >
                    {unmaskedIds.has(selectedSubmission.id) ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  </Button>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Status</label>
                <Select value={reviewStatus} onValueChange={setReviewStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="under_review">Under Review</SelectItem>
                    <SelectItem value="verified">Verified</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {reviewStatus === 'rejected' && (
                <div>
                  <label className="text-sm font-medium">Rejection Reason</label>
                  <Textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Please provide a reason for rejection..."
                    className="mt-1"
                  />
                </div>
              )}

              {selectedSubmission.kyc_rejection_reason && (
                <div>
                  <label className="text-sm font-medium">Previous Rejection Reason</label>
                  <p className="text-sm text-muted-foreground mt-1 p-2 bg-muted rounded">
                    {selectedSubmission.kyc_rejection_reason}
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateStatus}>
              Update Status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BottomNavigation />
    </div>
  );
};

export default AdminKYC;