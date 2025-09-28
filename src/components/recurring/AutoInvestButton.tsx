import { Button } from "@/components/ui/button";
import { Calendar, ArrowUpCircle } from "lucide-react";

interface AutoInvestButtonProps {
  onClick: () => void;
  disabled?: boolean;
  isUnsupportedRegion?: boolean;
}

export const AutoInvestButton = ({ 
  onClick, 
  disabled = false, 
  isUnsupportedRegion = false 
}: AutoInvestButtonProps) => {
  if (isUnsupportedRegion) {
    return (
      <Button 
        variant="outline" 
        className="w-full h-14 text-left justify-start opacity-50 cursor-not-allowed"
        disabled
      >
        <Calendar className="h-5 w-5 mr-3 text-muted-foreground" />
        <div className="flex flex-col items-start">
          <span className="font-medium text-sm">Auto-Invest (Coming Soon)</span>
          <span className="text-xs text-muted-foreground">Not available in your region yet</span>
        </div>
      </Button>
    );
  }

  return (
    <Button 
      onClick={onClick}
      disabled={disabled}
      variant="outline"
      className="w-full h-14 text-left justify-start border-primary/20 hover:border-primary/40 hover:bg-primary/5"
    >
      <ArrowUpCircle className="h-5 w-5 mr-3 text-primary" />
      <div className="flex flex-col items-start">
        <span className="font-medium text-sm">Set up Auto-Invest</span>
        <span className="text-xs text-muted-foreground">Schedule recurring purchases with MoonPay</span>
      </div>
    </Button>
  );
};