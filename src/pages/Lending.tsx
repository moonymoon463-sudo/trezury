import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LendingDeposit } from "@/components/lending/LendingDeposit";
import { LendingProfile } from "@/components/lending/LendingProfile";

export default function Lending() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Multi-Chain Lending</h1>
          <p className="text-lg text-muted-foreground mt-2">
            Lock stablecoins across multiple chains to earn competitive yields. 
            No lock = 0% APY.
          </p>
        </div>

        <Tabs defaultValue="deposit" className="space-y-8">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="deposit">Deposit</TabsTrigger>
            <TabsTrigger value="profile">Profile</TabsTrigger>
          </TabsList>

          <TabsContent value="deposit">
            <LendingDeposit />
          </TabsContent>

          <TabsContent value="profile">
            <LendingProfile />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}