import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Upload, X, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useSupportTickets } from '@/hooks/useSupportTickets';
import { toast } from 'sonner';

interface SupportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const issueTypes = [
  { value: 'login_issue', label: 'Login Issue' },
  { value: 'transaction_issue', label: 'Transaction Issue' },
  { value: 'payment_issue', label: 'Payment Issue' },
  { value: 'kyc_issue', label: 'KYC / Verification Issue' },
  { value: 'wallet_issue', label: 'Wallet Issue' },
  { value: 'technical_issue', label: 'Technical Issue' },
  { value: 'other', label: 'Other' }
];

const priorityLevels = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' }
];

export const SupportModal = ({ open, onOpenChange }: SupportModalProps) => {
  const { user } = useAuth();
  const { createTicket, uploadScreenshot, submitting } = useSupportTickets();
  const [formData, setFormData] = useState({
    issue_type: '',
    subject: '',
    description: '',
    priority: 'normal'
  });
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File size must be less than 5MB');
        return;
      }
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error('Only image files are allowed');
        return;
      }
      setScreenshot(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.issue_type || !formData.subject || !formData.description) {
      toast.error('Please fill in all required fields');
      return;
    }

    setUploading(true);
    let screenshot_url: string | undefined;

    // Upload screenshot if provided
    if (screenshot) {
      screenshot_url = (await uploadScreenshot(screenshot)) || undefined;
    }

    const ticket = await createTicket({
      ...formData,
      screenshot_url
    });

    setUploading(false);

    if (ticket) {
      // Reset form
      setFormData({
        issue_type: '',
        subject: '',
        description: '',
        priority: 'normal'
      });
      setScreenshot(null);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Contact Support</DialogTitle>
          <DialogDescription>
            Submit a support ticket and our team will get back to you as soon as possible
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          {/* Email (prefilled, read-only) */}
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              value={user?.email || ''}
              disabled
              className="bg-muted"
            />
          </div>

          {/* Issue Type */}
          <div className="space-y-2">
            <Label htmlFor="issue_type">Issue Type *</Label>
            <Select
              value={formData.issue_type}
              onValueChange={(value) => setFormData({ ...formData, issue_type: value })}
            >
              <SelectTrigger id="issue_type">
                <SelectValue placeholder="Select issue type" />
              </SelectTrigger>
              <SelectContent>
                {issueTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <Select
              value={formData.priority}
              onValueChange={(value) => setFormData({ ...formData, priority: value })}
            >
              <SelectTrigger id="priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {priorityLevels.map((level) => (
                  <SelectItem key={level.value} value={level.value}>
                    {level.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Subject */}
          <div className="space-y-2">
            <Label htmlFor="subject">Subject *</Label>
            <Input
              id="subject"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              placeholder="Brief description of your issue"
              maxLength={200}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Please provide detailed information about your issue..."
              rows={6}
              maxLength={2000}
            />
            <p className="text-xs text-muted-foreground">
              {formData.description.length}/2000 characters
            </p>
          </div>

          {/* Screenshot Upload */}
          <div className="space-y-2">
            <Label htmlFor="screenshot">Screenshot (Optional)</Label>
            <div className="flex items-center gap-4">
              <Input
                id="screenshot"
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => document.getElementById('screenshot')?.click()}
                className="flex items-center gap-2"
              >
                <Upload className="h-4 w-4" />
                {screenshot ? 'Change Screenshot' : 'Upload Screenshot'}
              </Button>
              {screenshot && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>{screenshot.name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setScreenshot(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Max file size: 5MB. Supported formats: JPG, PNG, GIF
            </p>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting || uploading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || uploading}
              className="bg-primary text-black font-bold hover:bg-primary/90"
            >
              {(submitting || uploading) ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {uploading ? 'Uploading...' : 'Submitting...'}
                </>
              ) : (
                'Submit Ticket'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
