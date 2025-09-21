import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LendingMarkets } from "@/components/lending/LendingMarkets";
import { UserPositions } from "@/components/lending/UserPositions";
import { ActionModal } from "@/components/lending/ActionModal";
import { PoolAsset } from "@/hooks/useLendingOperations";
import BottomNavigation from "@/components/BottomNavigation";
import AurumLogo from "@/components/AurumLogo";

export default function Lending() {
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalAction, setModalAction] = useState<'supply' | 'borrow' | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<PoolAsset | null>(null);

  const handleSupply = (asset: PoolAsset) => {
    setSelectedAsset(asset);
    setModalAction('supply');
    setModalOpen(true);
  };

  const handleBorrow = (asset: PoolAsset) => {
    setSelectedAsset(asset);
    setModalAction('borrow');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalAction(null);
    setSelectedAsset(null);
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
          <div className="flex-1 flex justify-center pr-6">
            <AurumLogo compact />
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-4 pb-4">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <p className="text-gray-400 text-center">
              Supply assets to earn yield or borrow against your collateral.
            </p>
          </div>

          <Tabs defaultValue="markets" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto bg-muted">
              <TabsTrigger value="markets" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                Markets
              </TabsTrigger>
              <TabsTrigger value="positions" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                Your Positions
              </TabsTrigger>
            </TabsList>

            <TabsContent value="markets" className="mt-8">
              <LendingMarkets 
                onSupply={handleSupply}
                onBorrow={handleBorrow}
              />
            </TabsContent>

            <TabsContent value="positions" className="mt-8">
              <UserPositions />
            </TabsContent>
          </Tabs>

          <ActionModal
            isOpen={modalOpen}
            onClose={closeModal}
            action={modalAction}
            asset={selectedAsset}
          />
        </div>
      </main>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
}