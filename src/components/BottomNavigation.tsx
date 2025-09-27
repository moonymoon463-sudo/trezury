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
      className="fixed bottom-0 inset-x-0 z-50 h-16 bg-background/90 backdrop-blur border-t pb-[max(env(safe-area-inset-bottom),0px)]"
    >
      <div className="grid grid-cols-6 w-full h-full">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          
          return (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              className="flex flex-col items-center justify-center gap-1 leading-none"
            >
                <Icon 
                  className={`w-6 h-6 ${active ? "text-primary" : "text-muted-foreground"}`} 
                />
                <span 
                  className={`text-xs opacity-80 ${active ? "text-primary" : "text-muted-foreground"}`}
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