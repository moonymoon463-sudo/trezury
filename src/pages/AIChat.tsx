import { AIChatInterface } from "@/components/portfolio/AIChatInterface";
import AppLayout from "@/components/AppLayout";

export default function AIChat() {
  return (
    <AppLayout
      headerProps={{
        title: "Trez AI",
        showBackButton: true,
        backPath: "back"
      }}
      className="flex flex-col flex-1 min-h-0 overflow-hidden"
    >
      <div className="flex-1 min-h-0 px-1 sm:px-2 md:px-4">
        <AIChatInterface
          isCollapsed={false}
        />
      </div>
    </AppLayout>
  );
}
