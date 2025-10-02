import { AIChatInterface } from "@/components/portfolio/AIChatInterface";
import StandardHeader from "@/components/StandardHeader";
import BottomNavigation from "@/components/BottomNavigation";

export default function AIChat() {
  return (
    <div className="min-h-screen bg-background">
      <StandardHeader 
        title="Trez AI"
        showBackButton
        backPath="back"
      />

      <main className="pt-[calc(3.5rem+max(8px,env(safe-area-inset-top))+0.5rem)] px-1 sm:px-2 md:px-6 pb-[calc(var(--bottom-nav-height,56px)+env(safe-area-inset-bottom)+0.5rem)]">
        <AIChatInterface
          isCollapsed={false}
        />
      </main>

      <BottomNavigation />
    </div>
  );
}
