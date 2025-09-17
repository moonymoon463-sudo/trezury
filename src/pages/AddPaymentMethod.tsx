import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, CreditCard, Building2, Shield, AlertTriangle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const AddPaymentMethod = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("card");

  // Card form data
  const [cardData, setCardData] = useState({
    cardNumber: "",
    expiryMonth: "",
    expiryYear: "",
    cvv: "",
    cardholderName: "",
    billingAddress: "",
    billingCity: "",
    billingState: "",
    billingZip: "",
    billingCountry: "US"
  });

  // Bank form data
  const [bankData, setBankData] = useState({
    accountNumber: "",
    routingNumber: "",
    accountType: "checking",
    accountHolderName: "",
    bankName: ""
  });

  const handleCardDataChange = (field: string, value: string) => {
    setCardData(prev => ({ ...prev, [field]: value }));
  };

  const handleBankDataChange = (field: string, value: string) => {
    setBankData(prev => ({ ...prev, [field]: value }));
  };

  const validateCardForm = () => {
    const required = ['cardNumber', 'expiryMonth', 'expiryYear', 'cvv', 'cardholderName'];
    return required.every(field => cardData[field as keyof typeof cardData].trim() !== '');
  };

  const validateBankForm = () => {
    const required = ['accountNumber', 'routingNumber', 'accountHolderName', 'bankName'];
    return required.every(field => bankData[field as keyof typeof bankData].trim() !== '');
  };

  const addCardPaymentMethod = async () => {
    if (!validateCardForm()) {
      toast({
        variant: "destructive",
        title: "Incomplete Information",
        description: "Please fill in all required card details"
      });
      return;
    }

    setLoading(true);
    try {
      // In a real implementation, this would integrate with a payment processor
      // like Stripe, MoonPay, or similar to securely tokenize the card
      
      // For now, we'll simulate adding a payment method
      const mockExternalId = `card_${Math.random().toString(36).substr(2, 9)}`;
      const last4 = cardData.cardNumber.slice(-4);
      const brand = detectCardBrand(cardData.cardNumber);

      const { error } = await supabase
        .from('payment_methods')
        .insert({
          user_id: user!.id,
          type: 'card',
          provider: 'moonpay',
          external_id: mockExternalId,
          metadata: {
            last4,
            brand,
            exp_month: parseInt(cardData.expiryMonth),
            exp_year: parseInt(cardData.expiryYear)
          }
        });

      if (error) throw error;

      toast({
        title: "Card Added Successfully",
        description: "Your payment method has been added and verified"
      });

      navigate("/payment-methods");
    } catch (error) {
      console.error('Failed to add card:', error);
      toast({
        variant: "destructive",
        title: "Failed to Add Card",
        description: "Please check your card details and try again"
      });
    } finally {
      setLoading(false);
    }
  };

  const addBankPaymentMethod = async () => {
    if (!validateBankForm()) {
      toast({
        variant: "destructive",
        title: "Incomplete Information",
        description: "Please fill in all required bank account details"
      });
      return;
    }

    setLoading(true);
    try {
      // In a real implementation, this would integrate with ACH processors
      // like Plaid, Stripe ACH, or similar
      
      const mockExternalId = `bank_${Math.random().toString(36).substr(2, 9)}`;
      const last4 = bankData.accountNumber.slice(-4);

      const { error } = await supabase
        .from('payment_methods')
        .insert({
          user_id: user!.id,
          type: 'bank_account',
          provider: 'plaid',
          external_id: mockExternalId,
          metadata: {
            last4,
            bank_name: bankData.bankName,
            account_type: bankData.accountType
          }
        });

      if (error) throw error;

      toast({
        title: "Bank Account Added Successfully",
        description: "Your bank account has been added. It may take 1-2 business days to verify."
      });

      navigate("/payment-methods");
    } catch (error) {
      console.error('Failed to add bank account:', error);
      toast({
        variant: "destructive",
        title: "Failed to Add Bank Account",
        description: "Please check your account details and try again"
      });
    } finally {
      setLoading(false);
    }
  };

  const detectCardBrand = (cardNumber: string): string => {
    const number = cardNumber.replace(/\D/g, '');
    
    if (number.match(/^4/)) return 'Visa';
    if (number.match(/^5[1-5]/)) return 'Mastercard';
    if (number.match(/^3[47]/)) return 'American Express';
    if (number.match(/^6/)) return 'Discover';
    
    return 'Unknown';
  };

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = matches && matches[0] || '';
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    if (parts.length) {
      return parts.join(' ');
    } else {
      return v;
    }
  };

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCardNumber(e.target.value);
    if (formatted.replace(/\s/g, '').length <= 16) {
      handleCardDataChange('cardNumber', formatted);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#1C1C1E]">
      {/* Header */}
      <header className="p-4">
        <div className="flex items-center">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate("/payment-methods")}
            className="text-white hover:bg-gray-800"
          >
            <ArrowLeft size={24} />
          </Button>
          <h1 className="text-xl font-bold text-white flex-1 text-center pr-6">Add Payment Method</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 pb-4 overflow-y-auto">
        <div className="max-w-md mx-auto space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="card" className="flex items-center gap-2">
              <CreditCard size={16} />
              Credit Card
            </TabsTrigger>
            <TabsTrigger value="bank" className="flex items-center gap-2">
              <Building2 size={16} />
              Bank Account
            </TabsTrigger>
          </TabsList>

          <TabsContent value="card" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Credit Card Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="cardNumber">Card Number *</Label>
                  <Input
                    id="cardNumber"
                    value={cardData.cardNumber}
                    onChange={handleCardNumberChange}
                    placeholder="1234 5678 9012 3456"
                    maxLength={19}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="expiryMonth">Month *</Label>
                    <Select value={cardData.expiryMonth} onValueChange={(value) => handleCardDataChange('expiryMonth', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="MM" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                          <SelectItem key={month} value={month.toString().padStart(2, '0')}>
                            {month.toString().padStart(2, '0')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="expiryYear">Year *</Label>
                    <Select value={cardData.expiryYear} onValueChange={(value) => handleCardDataChange('expiryYear', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="YYYY" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 20 }, (_, i) => new Date().getFullYear() + i).map(year => (
                          <SelectItem key={year} value={year.toString()}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="cvv">CVV *</Label>
                    <Input
                      id="cvv"
                      value={cardData.cvv}
                      onChange={(e) => handleCardDataChange('cvv', e.target.value)}
                      placeholder="123"
                      maxLength={4}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="cardholderName">Cardholder Name *</Label>
                  <Input
                    id="cardholderName"
                    value={cardData.cardholderName}
                    onChange={(e) => handleCardDataChange('cardholderName', e.target.value)}
                    placeholder="John Doe"
                  />
                </div>

                <div>
                  <Label htmlFor="billingAddress">Billing Address</Label>
                  <Input
                    id="billingAddress"
                    value={cardData.billingAddress}
                    onChange={(e) => handleCardDataChange('billingAddress', e.target.value)}
                    placeholder="123 Main Street"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="billingCity">City</Label>
                    <Input
                      id="billingCity"
                      value={cardData.billingCity}
                      onChange={(e) => handleCardDataChange('billingCity', e.target.value)}
                      placeholder="New York"
                    />
                  </div>
                  <div>
                    <Label htmlFor="billingState">State</Label>
                    <Input
                      id="billingState"
                      value={cardData.billingState}
                      onChange={(e) => handleCardDataChange('billingState', e.target.value)}
                      placeholder="NY"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Button onClick={addCardPaymentMethod} disabled={loading} className="w-full h-12">
              {loading ? "Adding Card..." : "Add Credit Card"}
            </Button>
          </TabsContent>

          <TabsContent value="bank" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Bank Account Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="bankName">Bank Name *</Label>
                  <Input
                    id="bankName"
                    value={bankData.bankName}
                    onChange={(e) => handleBankDataChange('bankName', e.target.value)}
                    placeholder="Chase Bank"
                  />
                </div>

                <div>
                  <Label htmlFor="accountHolderName">Account Holder Name *</Label>
                  <Input
                    id="accountHolderName"
                    value={bankData.accountHolderName}
                    onChange={(e) => handleBankDataChange('accountHolderName', e.target.value)}
                    placeholder="John Doe"
                  />
                </div>

                <div>
                  <Label htmlFor="accountType">Account Type *</Label>
                  <Select value={bankData.accountType} onValueChange={(value) => handleBankDataChange('accountType', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="checking">Checking</SelectItem>
                      <SelectItem value="savings">Savings</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="routingNumber">Routing Number *</Label>
                  <Input
                    id="routingNumber"
                    value={bankData.routingNumber}
                    onChange={(e) => handleBankDataChange('routingNumber', e.target.value)}
                    placeholder="123456789"
                    maxLength={9}
                  />
                </div>

                <div>
                  <Label htmlFor="accountNumber">Account Number *</Label>
                  <Input
                    id="accountNumber"
                    value={bankData.accountNumber}
                    onChange={(e) => handleBankDataChange('accountNumber', e.target.value)}
                    placeholder="1234567890"
                  />
                </div>
              </CardContent>
            </Card>

            <Button onClick={addBankPaymentMethod} disabled={loading} className="w-full h-12">
              {loading ? "Adding Bank Account..." : "Add Bank Account"}
            </Button>
          </TabsContent>
        </Tabs>

        {/* Security Notice */}
        <Card className="bg-muted/30 mt-6">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <h4 className="font-semibold text-foreground mb-1">Your Security is Our Priority</h4>
                <p className="text-sm text-muted-foreground">
                  All payment information is encrypted and processed through our secure payment partners. 
                  We use industry-standard security measures to protect your financial data.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Important Notice */}
        <Card className="bg-yellow-50 border border-yellow-200 mt-4">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div>
                <h4 className="font-semibold text-yellow-800 mb-1">Demo Mode</h4>
                <p className="text-sm text-yellow-700">
                  This is a demo version. No real payment methods will be charged. 
                  In production, this would integrate with MoonPay or similar payment processors.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        </div>
      </main>
    </div>
  );
};

export default AddPaymentMethod;