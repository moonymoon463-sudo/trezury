import { useNavigate, useLocation } from "react-router-dom";
import { Home, ShoppingBag, ArrowUpDown, Clock, Settings, TrendingUp } from "lucide-react";

const BottomNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();

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
      id: "lending",
      label: "Lending",
      icon: TrendingUp,
      path: "/lending",
    },
    {
      id: "history",
      label: "History",
      icon: Clock,
      path: "/transactions",
    },
    {
      id: "settings",
      label: "Settings",
      icon: Settings,
      path: "/settings",
    },
  ];

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="bg-[#2C2C2E] px-6 py-4">
      <div className="flex justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          
          return (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              className="flex flex-col items-center space-y-1"
            >
              <Icon 
                size={20} 
                className={active ? "text-[#f9b006]" : "text-gray-400"} 
              />
              <span 
                className={`text-xs ${active ? "text-[#f9b006]" : "text-gray-400"}`}
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