import { useNavigate, useLocation } from "react-router-dom";
import { Home, ShoppingBag, ArrowUpDown, Clock, Settings, TrendingUp, PieChart } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useEffect, useRef } from "react";

const BottomNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const navRef = useRef<HTMLElement>(null);


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
    <nav 
      ref={navRef}
      id="bottom-nav"
      className="fixed bottom-0 inset-x-0 z-50 h-14 bg-background backdrop-blur border-t border-border overflow-visible pb-[max(env(safe-area-inset-bottom),0px)] shadow-sm"
    >
      <div className="flex items-center justify-around h-full px-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          
          return (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              className="flex flex-col items-center justify-center gap-0.5 leading-none min-w-0 flex-1 py-1.5 px-1 min-h-[44px]"
            >
              <Icon 
                className={`w-5 h-5 flex-shrink-0 ${active ? "text-primary" : "text-muted-foreground"}`} 
              />
              <span 
                className={`text-xs text-center leading-tight truncate max-w-full ${active ? "text-primary" : "text-muted-foreground"}`}
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