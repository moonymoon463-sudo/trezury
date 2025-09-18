import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import AurumLogo from "@/components/AurumLogo";

const TermsOfService = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card p-4 border-b">
        <div className="flex items-center">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate("/settings")}
            className="text-foreground hover:bg-muted"
          >
            <ArrowLeft size={24} />
          </Button>
          <div className="flex-1 flex justify-center pr-12">
            <AurumLogo compact />
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-card rounded-lg p-6 shadow-sm">
          <h1 className="text-3xl font-bold text-foreground mb-6">Terms of Service</h1>
          <p className="text-muted-foreground mb-6">Last updated: {new Date().toLocaleDateString()}</p>

          <div className="space-y-6">
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">1. Acceptance of Terms</h2>
              <div className="space-y-3 text-muted-foreground">
                <p>By accessing and using Trezury's services, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.</p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">2. Description of Service</h2>
              <div className="space-y-3 text-muted-foreground">
                <p>Trezury provides a digital platform for:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Buying and selling digital gold tokens</li>
                  <li>Secure wallet management</li>
                  <li>Gold lending and borrowing services</li>
                  <li>Real-time gold price tracking</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">3. User Responsibilities</h2>
              <div className="space-y-3 text-muted-foreground">
                <p>As a user of our platform, you agree to:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Provide accurate and complete information during registration</li>
                  <li>Maintain the security of your account credentials</li>
                  <li>Comply with all applicable laws and regulations</li>
                  <li>Not use our services for illegal or unauthorized purposes</li>
                  <li>Complete identity verification (KYC) when required</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">4. Risk Disclosure</h2>
              <div className="space-y-3 text-muted-foreground">
                <p><strong>Important:</strong> Trading in gold and digital assets involves significant risks:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Gold prices can be highly volatile</li>
                  <li>Past performance does not guarantee future results</li>
                  <li>You may lose some or all of your investment</li>
                  <li>Regulatory changes may affect your investments</li>
                </ul>
                <p>Only invest what you can afford to lose.</p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">5. Fees and Charges</h2>
              <div className="space-y-3 text-muted-foreground">
                <p>We may charge fees for certain services, including:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Transaction fees for buying and selling</li>
                  <li>Withdrawal and deposit fees</li>
                  <li>Interest on lending services</li>
                </ul>
                <p>All applicable fees will be clearly displayed before you complete any transaction.</p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">6. Account Suspension</h2>
              <div className="space-y-3 text-muted-foreground">
                <p>We reserve the right to suspend or terminate your account if:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>You violate these Terms of Service</li>
                  <li>We suspect fraudulent or illegal activity</li>
                  <li>Required by law or regulatory authorities</li>
                  <li>You fail to complete required verification</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">7. Limitation of Liability</h2>
              <div className="space-y-3 text-muted-foreground">
                <p>To the maximum extent permitted by law, Trezury shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of our services.</p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">8. Contact Information</h2>
              <div className="space-y-3 text-muted-foreground">
                <p>For questions about these Terms of Service, contact us at:</p>
                <p>Email: legal@trezury.com</p>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
};

export default TermsOfService;