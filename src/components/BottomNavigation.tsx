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
      className="fixed bottom-0 inset-x-0 z-50 overflow-visible"
      style={{ height: "var(--bottom-nav-height)" }}
    >
      {/* Background extender to cover safe area */}
      <div 
        className="absolute inset-0 bg-background backdrop-blur border-t border-border shadow-sm"
        style={{ 
          height: "calc(var(--bottom-nav-height) + env(safe-area-inset-bottom))",
          bottom: "calc(-1 * env(safe-area-inset-bottom))"
        }}
      />
      <div className="relative flex items-center justify-evenly h-full px-1 z-10">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          
          return (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              className="flex flex-col items-center justify-center gap-0.5 sm:gap-1 leading-none min-w-0 flex-1 py-1 px-1 min-h-[32px]"
            >
              <Icon 
                className={`w-6 h-6 sm:w-6 sm:h-6 flex-shrink-0 ${active ? "text-primary" : "text-muted-foreground"}`} 
              />
              <span 
                className={`text-[10px] sm:text-xs text-center leading-tight truncate max-w-full ${active ? "text-primary" : "text-muted-foreground"}`}
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