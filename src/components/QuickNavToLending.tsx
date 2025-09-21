import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { TrendingUp } from "lucide-react";

const QuickNavToLending = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Only show on home route where user reported being blocked
  if (location.pathname !== "/") return null;

  return (
    <div className="fixed bottom-24 right-4 z-[100]">
      <Button onClick={() => navigate("/lending?tab=supply")} size="sm">
        <TrendingUp className="mr-2 h-4 w-4" /> Go to Lending
      </Button>
    </div>
  );
};

export default QuickNavToLending;
