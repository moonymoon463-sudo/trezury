import { useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LendingDeposit } from "@/components/lending/LendingDeposit";
import { LendingBorrow } from "@/components/lending/LendingBorrow";
import { LendingProfile } from "@/components/lending/LendingProfile";
import { ContractDeploymentStatus } from "@/components/lending/ContractDeploymentStatus";
import { EnhancedPortfolioAnalytics } from "@/components/lending/EnhancedPortfolioAnalytics";
import { WalletConnector } from "@/components/wallet/WalletConnector";
import BottomNavigation from "@/components/BottomNavigation";
import AurumLogo from "@/components/AurumLogo";

export default function Lending() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const defaultTab = searchParams.get('tab') || 'supply';

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
          <div className="flex-1 flex justify-center pr-6">
            <AurumLogo compact />
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-4 pb-4">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6 space-y-4">
            <p className="text-gray-400 text-center">
              Supply assets to earn yield or borrow against your collateral across multiple chains.
            </p>
            <div className="max-w-2xl mx-auto">
              <WalletConnector />
            </div>
            <ContractDeploymentStatus />
          </div>

          <Tabs defaultValue={defaultTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-4 max-w-2xl mx-auto bg-[#2C2C2E] border-0">
              <TabsTrigger 
                value="supply" 
                className="data-[state=active]:bg-[#f9b006] data-[state=active]:text-black text-gray-400"
              >
                Supply
              </TabsTrigger>
              <TabsTrigger 
                value="borrow"
                className="data-[state=active]:bg-[#f9b006] data-[state=active]:text-black text-gray-400"
              >
                Borrow
              </TabsTrigger>
              <TabsTrigger 
                value="analytics"
                className="data-[state=active]:bg-[#f9b006] data-[state=active]:text-black text-gray-400"
              >
                Analytics
              </TabsTrigger>
              <TabsTrigger 
                value="profile"
                className="data-[state=active]:bg-[#f9b006] data-[state=active]:text-black text-gray-400"
              >
                Profile
              </TabsTrigger>
            </TabsList>

            <TabsContent value="supply" className="mt-8">
              <LendingDeposit />
            </TabsContent>

            <TabsContent value="borrow" className="mt-8">
              <LendingBorrow />
            </TabsContent>

            <TabsContent value="analytics" className="mt-8">
              <EnhancedPortfolioAnalytics />
            </TabsContent>

            <TabsContent value="profile" className="mt-8">
              <LendingProfile />
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
}