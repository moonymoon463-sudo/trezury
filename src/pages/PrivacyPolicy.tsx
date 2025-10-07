import AppLayout from "@/components/AppLayout";
import { Card } from "@/components/ui/card";

const PrivacyPolicy = () => {
  return (
    <AppLayout headerProps={{ title: "Privacy Policy", showBackButton: true, backPath: "/settings" }}>
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <Card className="p-6 md:p-8">
          <h1 className="text-3xl font-bold text-foreground mb-6">Privacy Policy</h1>
          <p className="text-muted-foreground mb-6">Last updated: {new Date().toLocaleDateString()}</p>

          <div className="space-y-6">
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">1. Information We Collect</h2>
              <div className="space-y-3 text-muted-foreground">
                <p>We collect information you provide directly to us, including:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Account information (name, email, phone number)</li>
                  <li>Identity verification documents and information</li>
                  <li>Payment method information</li>
                  <li>Transaction history and preferences</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">2. How We Use Your Information</h2>
              <div className="space-y-3 text-muted-foreground">
                <p>We use the information we collect to:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Provide and maintain our gold trading services</li>
                  <li>Process transactions and manage your account</li>
                  <li>Comply with legal and regulatory requirements</li>
                  <li>Communicate with you about our services</li>
                  <li>Improve our platform and user experience</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">3. Information Sharing</h2>
              <div className="space-y-3 text-muted-foreground">
                <p>We may share your information with:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Service providers who help us operate our platform</li>
                  <li>Financial institutions for payment processing</li>
                  <li>Regulatory authorities when required by law</li>
                  <li>Professional advisors (lawyers, auditors)</li>
                </ul>
                <p>We do not sell or rent your personal information to third parties.</p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">4. Data Security</h2>
              <div className="space-y-3 text-muted-foreground">
                <p>We implement appropriate security measures to protect your personal information, including:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Encryption of data in transit and at rest</li>
                  <li>Regular security audits and monitoring</li>
                  <li>Access controls and authentication systems</li>
                  <li>Secure data storage and backup procedures</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">5. Your Rights</h2>
              <div className="space-y-3 text-muted-foreground">
                <p>You have the right to:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Access and review your personal information</li>
                  <li>Request corrections to inaccurate data</li>
                  <li>Request deletion of your data (subject to legal requirements)</li>
                  <li>Opt out of certain communications</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">6. Contact Us</h2>
              <div className="space-y-3 text-muted-foreground">
                <p>If you have questions about this Privacy Policy, please contact us at:</p>
                <p className="font-medium">
                  Email: <a href="mailto:support@trezury.app" className="text-primary hover:underline">support@trezury.app</a>
                </p>
              </div>
            </section>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
};

export default PrivacyPolicy;