import { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { SupportModal } from '@/components/support/SupportModal';
import { MessageCircle, Mail, FileText, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const faqs = [
  {
    question: 'How do I verify my account?',
    answer: 'To verify your account, go to Settings > Profile and complete the KYC verification process. You\'ll need to provide a government-issued ID and proof of address.'
  },
  {
    question: 'What payment methods are supported?',
    answer: 'Trezury supports bank transfers, debit cards, and cryptocurrency deposits via MoonPay integration.'
  },
  {
    question: 'How long do transactions take?',
    answer: 'Most transactions are processed instantly on the blockchain. Bank transfers may take 1-3 business days depending on your bank.'
  },
  {
    question: 'Is my wallet secure?',
    answer: 'Yes, Trezury uses industry-standard encryption and security measures. Your private keys are encrypted with your password and never leave your device in plain text.'
  },
  {
    question: 'How do I reset my password?',
    answer: 'Click "Forgot Password" on the login page and follow the instructions sent to your registered email address.'
  },
  {
    question: 'What are the transaction fees?',
    answer: 'Trezury charges a small platform fee (typically 0.5-1%) plus network gas fees for blockchain transactions. Exact fees are shown before you confirm any transaction.'
  }
];

export default function Support() {
  const [modalOpen, setModalOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <AppLayout headerProps={{ title: "Support & Help", showBackButton: true, backPath: "/settings" }}>
      <div className="container mx-auto px-4 py-6 max-w-4xl space-y-6">
        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setModalOpen(true)}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-primary" />
                Contact Support
              </CardTitle>
              <CardDescription>
                Submit a support ticket and get help from our team
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full bg-primary text-black font-bold hover:bg-primary/90">
                Create Ticket
              </Button>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate('/support/tickets')}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                My Tickets
              </CardTitle>
              <CardDescription>
                View and track your support tickets
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full">
                View Tickets
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              Email Support
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              You can also reach us directly via email:
            </p>
            <a
              href="mailto:support@trezury.app"
              className="text-primary hover:underline font-mono"
            >
              support@trezury.app
            </a>
            <p className="text-xs text-muted-foreground mt-2">
              We typically respond within 24-48 hours during business days
            </p>
          </CardContent>
        </Card>

        {/* FAQ Section */}
        <Card>
          <CardHeader>
            <CardTitle>Frequently Asked Questions</CardTitle>
            <CardDescription>
              Find answers to common questions about Trezury
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq, index) => (
                <AccordionItem key={index} value={`item-${index}`}>
                  <AccordionTrigger className="text-left">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>

        {/* Documentation Links */}
        <Card>
          <CardHeader>
            <CardTitle>Documentation</CardTitle>
            <CardDescription>
              Learn more about using Trezury
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="w-full justify-between" onClick={() => navigate('/terms')}>
              Terms of Service
              <ExternalLink className="h-4 w-4" />
            </Button>
            <Button variant="outline" className="w-full justify-between" onClick={() => navigate('/privacy')}>
              Privacy Policy
              <ExternalLink className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>

      <SupportModal open={modalOpen} onOpenChange={setModalOpen} />
    </AppLayout>
  );
}
