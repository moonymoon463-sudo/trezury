import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Upload, FileText, Camera, CheckCircle, AlertTriangle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface KYCStep {
  id: number;
  title: string;
  description: string;
  completed: boolean;
}

const KYCVerification = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  
  // Form data
  const [personalInfo, setPersonalInfo] = useState({
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    ssn: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    country: "US"
  });
  
  const [documents, setDocuments] = useState({
    frontId: null as File | null,
    backId: null as File | null,
    selfie: null as File | null
  });

  const steps: KYCStep[] = [
    {
      id: 1,
      title: "Personal Information",
      description: "Provide your basic personal details",
      completed: false
    },
    {
      id: 2,
      title: "Document Upload",
      description: "Upload your government-issued ID and selfie",
      completed: false
    },
    {
      id: 3,
      title: "Review & Submit",
      description: "Review your information and submit for verification",
      completed: false
    }
  ];

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user!.id)
        .single();

      if (error) throw error;
      setProfile(data);

      // If already verified, redirect
      if (data.kyc_status === 'verified') {
        toast({
          title: "Already Verified",
          description: "Your identity has already been verified"
        });
        navigate("/settings");
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error);
    }
  };

  const handlePersonalInfoChange = (field: string, value: string) => {
    setPersonalInfo(prev => ({ ...prev, [field]: value }));
  };

  const handleFileUpload = (field: keyof typeof documents, file: File | null) => {
    setDocuments(prev => ({ ...prev, [field]: file }));
  };

  const validatePersonalInfo = () => {
    const required = ['firstName', 'lastName', 'dateOfBirth', 'address', 'city', 'state', 'zipCode'];
    return required.every(field => personalInfo[field as keyof typeof personalInfo].trim() !== '');
  };

  const validateDocuments = () => {
    return documents.frontId && documents.backId && documents.selfie;
  };

  const nextStep = () => {
    if (currentStep === 1 && !validatePersonalInfo()) {
      toast({
        variant: "destructive",
        title: "Incomplete Information",
        description: "Please fill in all required fields"
      });
      return;
    }

    if (currentStep === 2 && !validateDocuments()) {
      toast({
        variant: "destructive",
        title: "Missing Documents",
        description: "Please upload all required documents"
      });
      return;
    }

    setCurrentStep(prev => Math.min(prev + 1, steps.length));
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const uploadDocuments = async () => {
    const uploads = [];
    
    if (documents.frontId) {
      const fileName = `${user!.id}/front_id_${Date.now()}.${documents.frontId.name.split('.').pop()}`;
      uploads.push(
        supabase.storage
          .from('kyc-documents')
          .upload(fileName, documents.frontId)
      );
    }
    
    if (documents.backId) {
      const fileName = `${user!.id}/back_id_${Date.now()}.${documents.backId.name.split('.').pop()}`;
      uploads.push(
        supabase.storage
          .from('kyc-documents')
          .upload(fileName, documents.backId)
      );
    }
    
    if (documents.selfie) {
      const fileName = `${user!.id}/selfie_${Date.now()}.${documents.selfie.name.split('.').pop()}`;
      uploads.push(
        supabase.storage
          .from('kyc-documents')
          .upload(fileName, documents.selfie)
      );
    }
    
    const results = await Promise.allSettled(uploads);
    return results.map(result => result.status === 'fulfilled' ? result.value : null);
  };

  const submitKYC = async () => {
    setLoading(true);
    try {
      // Upload documents to storage first
      const uploadResults = await uploadDocuments();
      
      // Update profile with KYC data and set status to pending
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          first_name: personalInfo.firstName,
          last_name: personalInfo.lastName,
          date_of_birth: personalInfo.dateOfBirth,
          address: personalInfo.address,
          city: personalInfo.city,
          state: personalInfo.state,
          zip_code: personalInfo.zipCode,
          country: personalInfo.country,
          ssn_last_four: personalInfo.ssn,
          kyc_status: 'pending',
          kyc_submitted_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', user!.id);

      if (profileError) throw profileError;

      // Create document records with actual file paths
      const documentPromises = [];
      const docTypes = ['front_id', 'back_id', 'selfie'];
      const docFiles = [documents.frontId, documents.backId, documents.selfie];
      
      uploadResults.forEach((result, index) => {
        if (result?.data && docFiles[index]) {
          documentPromises.push(
            supabase.from('kyc_documents').insert({
              user_id: user!.id,
              document_type: docTypes[index],
              file_name: docFiles[index]!.name,
              file_path: result.data.path,
              upload_status: 'uploaded'
            })
          );
        }
      });

      await Promise.all(documentPromises);

      toast({
        title: "Verification Submitted",
        description: "Your verification has been submitted and is being reviewed. You'll be notified within 24-48 hours."
      });

      navigate("/settings");
    } catch (error) {
      console.error('Failed to submit KYC:', error);
      toast({
        variant: "destructive",
        title: "Submission Failed",
        description: "Failed to submit verification. Please try again."
      });
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="bg-[#2C2C2E] rounded-xl p-4">
            <div className="mb-4">
              <h3 className="text-white text-lg font-bold flex items-center gap-2 mb-2">
                <FileText size={20} />
                Personal Information
              </h3>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName" className="text-gray-300">First Name *</Label>
                  <Input
                    id="firstName"
                    value={personalInfo.firstName}
                    onChange={(e) => handlePersonalInfoChange('firstName', e.target.value)}
                    placeholder="Enter your first name"
                    className="bg-[#1C1C1E] border-gray-600 text-white placeholder-gray-400"
                  />
                </div>
                <div>
                  <Label htmlFor="lastName" className="text-gray-300">Last Name *</Label>
                  <Input
                    id="lastName"
                    value={personalInfo.lastName}
                    onChange={(e) => handlePersonalInfoChange('lastName', e.target.value)}
                    placeholder="Enter your last name"
                    className="bg-[#1C1C1E] border-gray-600 text-white placeholder-gray-400"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="dateOfBirth" className="text-gray-300">Date of Birth *</Label>
                <Input
                  id="dateOfBirth"
                  type="date"
                  value={personalInfo.dateOfBirth}
                  onChange={(e) => handlePersonalInfoChange('dateOfBirth', e.target.value)}
                  className="bg-[#1C1C1E] border-gray-600 text-white"
                />
              </div>

              <div>
                <Label htmlFor="ssn" className="text-gray-300">Social Security Number (Last 4 digits)</Label>
                <Input
                  id="ssn"
                  value={personalInfo.ssn}
                  onChange={(e) => handlePersonalInfoChange('ssn', e.target.value)}
                  placeholder="XXXX"
                  maxLength={4}
                  className="bg-[#1C1C1E] border-gray-600 text-white placeholder-gray-400"
                />
              </div>

              <div>
                <Label htmlFor="address" className="text-gray-300">Address *</Label>
                <Input
                  id="address"
                  value={personalInfo.address}
                  onChange={(e) => handlePersonalInfoChange('address', e.target.value)}
                  placeholder="Enter your street address"
                  className="bg-[#1C1C1E] border-gray-600 text-white placeholder-gray-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="city" className="text-gray-300">City *</Label>
                  <Input
                    id="city"
                    value={personalInfo.city}
                    onChange={(e) => handlePersonalInfoChange('city', e.target.value)}
                    placeholder="Enter your city"
                    className="bg-[#1C1C1E] border-gray-600 text-white placeholder-gray-400"
                  />
                </div>
                <div>
                  <Label htmlFor="state" className="text-gray-300">State *</Label>
                  <Input
                    id="state"
                    value={personalInfo.state}
                    onChange={(e) => handlePersonalInfoChange('state', e.target.value)}
                    placeholder="Enter your state"
                    className="bg-[#1C1C1E] border-gray-600 text-white placeholder-gray-400"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="zipCode" className="text-gray-300">ZIP Code *</Label>
                <Input
                  id="zipCode"
                  value={personalInfo.zipCode}
                  onChange={(e) => handlePersonalInfoChange('zipCode', e.target.value)}
                  placeholder="Enter your ZIP code"
                  className="bg-[#1C1C1E] border-gray-600 text-white placeholder-gray-400"
                />
              </div>

              <div>
                <Label htmlFor="country" className="text-gray-300">Country *</Label>
                <Select value={personalInfo.country} onValueChange={(value) => handlePersonalInfoChange('country', value)}>
                  <SelectTrigger className="bg-[#1C1C1E] border-gray-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#2C2C2E] border-gray-600">
                    <SelectItem value="US" className="text-white hover:bg-gray-700">United States</SelectItem>
                    <SelectItem value="CA" className="text-white hover:bg-gray-700">Canada</SelectItem>
                    <SelectItem value="GB" className="text-white hover:bg-gray-700">United Kingdom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="bg-[#2C2C2E] rounded-xl p-4">
            <div className="mb-4">
              <h3 className="text-white text-lg font-bold flex items-center gap-2 mb-2">
                <Upload size={20} />
                Document Upload
              </h3>
            </div>
            <div className="space-y-6">
              <div className="text-sm text-gray-400 mb-4">
                Please upload clear photos of your government-issued ID and a selfie for verification.
              </div>

              {/* Front of ID */}
              <div className="space-y-2">
                <Label className="text-gray-300">Front of Government ID *</Label>
                <div className="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center bg-[#1C1C1E]">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload('frontId', e.target.files?.[0] || null)}
                    className="hidden"
                    id="frontId"
                  />
                  <label htmlFor="frontId" className="cursor-pointer">
                    <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <p className="text-sm text-gray-400">
                      {documents.frontId ? documents.frontId.name : "Click to upload front of ID"}
                    </p>
                  </label>
                </div>
              </div>

              {/* Back of ID */}
              <div className="space-y-2">
                <Label className="text-gray-300">Back of Government ID *</Label>
                <div className="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center bg-[#1C1C1E]">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload('backId', e.target.files?.[0] || null)}
                    className="hidden"
                    id="backId"
                  />
                  <label htmlFor="backId" className="cursor-pointer">
                    <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <p className="text-sm text-gray-400">
                      {documents.backId ? documents.backId.name : "Click to upload back of ID"}
                    </p>
                  </label>
                </div>
              </div>

              {/* Selfie */}
              <div className="space-y-2">
                <Label className="text-gray-300">Selfie Photo *</Label>
                <div className="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center bg-[#1C1C1E]">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload('selfie', e.target.files?.[0] || null)}
                    className="hidden"
                    id="selfie"
                  />
                  <label htmlFor="selfie" className="cursor-pointer">
                    <Camera className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <p className="text-sm text-gray-400">
                      {documents.selfie ? documents.selfie.name : "Click to upload selfie"}
                    </p>
                  </label>
                </div>
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="bg-[#2C2C2E] rounded-xl p-4">
            <div className="mb-4">
              <h3 className="text-white text-lg font-bold flex items-center gap-2 mb-2">
                <CheckCircle size={20} />
                Review & Submit
              </h3>
            </div>
            <div className="space-y-6">
              <div className="bg-[#1C1C1E] rounded-lg p-4">
                <h4 className="font-semibold mb-2 text-[#f9b006]">Personal Information</h4>
                <div className="text-sm space-y-1">
                  <p className="text-gray-300"><strong>Name:</strong> {personalInfo.firstName} {personalInfo.lastName}</p>
                  <p className="text-gray-300"><strong>Date of Birth:</strong> {personalInfo.dateOfBirth}</p>
                  <p className="text-gray-300"><strong>Address:</strong> {personalInfo.address}, {personalInfo.city}, {personalInfo.state} {personalInfo.zipCode}</p>
                </div>
              </div>

              <div className="bg-[#1C1C1E] rounded-lg p-4">
                <h4 className="font-semibold mb-2 text-[#f9b006]">Documents Uploaded</h4>
                <div className="text-sm space-y-1">
                  <p className="text-gray-300"><strong>Government ID (Front):</strong> {documents.frontId?.name}</p>
                  <p className="text-gray-300"><strong>Government ID (Back):</strong> {documents.backId?.name}</p>
                  <p className="text-gray-300"><strong>Selfie Photo:</strong> {documents.selfie?.name}</p>
                </div>
              </div>

              <div className="bg-[#2C2C2E] border border-[#f9b006]/30 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-[#f9b006] mt-0.5" />
                  <div className="text-sm">
                    <p className="font-semibold text-[#f9b006]">Important Notice</p>
                    <p className="text-gray-300 mt-1">
                      Your information will be securely processed and verified within 24-48 hours. 
                      You'll receive a notification once verification is complete.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
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
            onClick={() => navigate("/")}
            className="text-white hover:bg-gray-800"
          >
            <ArrowLeft size={24} />
          </Button>
          <h1 className="text-xl font-bold text-white flex-1 text-center pr-6">Identity Verification</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 pb-4 overflow-y-auto">
        <div className="max-w-md mx-auto space-y-6">
          {/* Progress Steps */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              {steps.map((step, index) => (
                <div key={step.id} className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                    currentStep >= step.id 
                      ? "bg-[#f9b006] text-black" 
                      : "bg-gray-600 text-gray-300"
                  }`}>
                    {step.id}
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`w-16 h-0.5 mx-2 ${
                      currentStep > step.id ? "bg-[#f9b006]" : "bg-gray-600"
                    }`} />
                  )}
                </div>
              ))}
            </div>
            <div className="text-center">
              <h2 className="font-semibold text-white">{steps[currentStep - 1].title}</h2>
              <p className="text-sm text-gray-400">{steps[currentStep - 1].description}</p>
            </div>
          </div>

          {/* Step Content */}
          {renderStepContent()}

          {/* Navigation Buttons */}
          <div className="flex gap-3 pt-4">
            {currentStep > 1 && (
              <Button 
                variant="outline" 
                onClick={prevStep} 
                className="flex-1 bg-[#2C2C2E] border-gray-600 text-white hover:bg-gray-700"
              >
                Previous
              </Button>
            )}
            
            {currentStep < steps.length ? (
              <Button 
                onClick={nextStep} 
                className="flex-1 bg-[#f9b006] text-black font-bold hover:bg-[#f9b006]/90"
              >
                Next
              </Button>
            ) : (
              <Button 
                onClick={submitKYC} 
                disabled={loading}
                className="flex-1 bg-[#f9b006] text-black font-bold hover:bg-[#f9b006]/90"
              >
                {loading ? "Submitting..." : "Submit for Verification"}
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default KYCVerification;