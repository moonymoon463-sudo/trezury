import { useNavigate, useLocation } from "react-router-dom";
import { Home, ShoppingBag, ArrowUpDown, Clock, Settings, TrendingUp, PieChart } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

const BottomNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();

  const navItems = [
    {
      id: "home",
      label: "Home",
      icon: Home,
      path: "/",
    },
    {
      id: "buy-sell",
      label: "Buy/Sell",
      icon: ShoppingBag,
      path: "/buy-sell-hub",
    },
    {
      id: "swap",
      label: "Swap",
      icon: ArrowUpDown,
      path: "/swap",
    },
    {
      id: "portfolio",
      label: "Portfolio",
      icon: PieChart,
      path: "/portfolio",
    },
    {
      id: "history",
      label: "History",
      icon: Clock,
      path: "/transactions",
    },
    {
      id: "settings",
      label: "Profile",
      icon: Settings,
      path: "/settings",
    },
  ];

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <nav className={`fixed bottom-0 inset-x-0 z-[60] bg-card border-t shadow-lg ${
      isMobile 
        ? "px-2 py-[calc(0.25rem+env(safe-area-inset-bottom))] h-12" 
        : "px-6 py-[calc(1rem+env(safe-area-inset-bottom))] h-16"
    }`}>
      <div className="flex justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          
          return (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center justify-center ${isMobile ? "space-y-0" : "space-y-1"} ${isMobile ? "h-10" : "h-12"}`}
            >
              <Icon 
                size={isMobile ? 16 : 20} 
                className={active ? "text-primary" : "text-muted-foreground"} 
              />
              <span 
                className={`${isMobile ? "text-[9px] leading-none" : "text-xs"} ${active ? "text-primary" : "text-muted-foreground"}`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNavigation;