import { AIChatInterface } from "@/components/portfolio/AIChatInterface";
import StandardHeader from "@/components/StandardHeader";
import BottomNavigation from "@/components/BottomNavigation";

export default function AIChat() {
  return (
    <div className="flex flex-col h-[100dvh] bg-background">
      <StandardHeader 
        title="Trez AI"
        showBackButton
        backPath="back"
      />

      <main className="flex-1 min-h-0 px-1 sm:px-2 md:px-6 pt-2 pb-2">
        <AIChatInterface
          isCollapsed={false}
        />
      </main>

      <BottomNavigation />
    </div>
  );
}
