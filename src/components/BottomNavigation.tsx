import { useNavigate, useLocation } from "react-router-dom";
import { Home, ShoppingBag, ArrowUpDown, Clock, Settings, TrendingUp, PieChart } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useEffect, useRef } from "react";

const BottomNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const navRef = useRef<HTMLElement>(null);

  // Expose nav height as CSS variable for content padding
  useEffect(() => {
    const updateNavHeight = () => {
      if (navRef.current) {
        const height = navRef.current.offsetHeight;
        document.documentElement.style.setProperty('--bottom-nav-height', `${height}px`);
      }
    };

    updateNavHeight();
    window.addEventListener('resize', updateNavHeight);
    return () => window.removeEventListener('resize', updateNavHeight);
  }, []);

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
      className={`fixed bottom-0 inset-x-0 z-[60] bg-card border-t shadow-lg ${
        isMobile 
          ? "px-1 py-[calc(0.5rem+env(safe-area-inset-bottom))] min-h-[60px]" 
          : "px-6 py-[calc(1rem+env(safe-area-inset-bottom))] min-h-[72px]"
      }`}
    >
      <div className="flex justify-around items-center h-full max-w-full">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          
          return (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center justify-center min-w-0 flex-1 ${
                isMobile ? "gap-1 py-1" : "gap-2 py-2"
              }`}
            >
              <Icon 
                className={`flex-shrink-0 ${
                  isMobile ? "w-5 h-5" : "w-6 h-6"
                } ${active ? "text-primary" : "text-muted-foreground"}`} 
              />
              <span 
                className={`text-center leading-none truncate max-w-full ${
                  isMobile ? "text-[9px]" : "text-xs"
                } ${active ? "text-primary" : "text-muted-foreground"}`}
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