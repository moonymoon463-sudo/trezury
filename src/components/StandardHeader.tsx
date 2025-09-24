import React from 'react';
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import AurumLogo from "@/components/AurumLogo";

interface StandardHeaderProps {
  onBack?: () => void;
  showBackButton?: boolean;
  rightContent?: React.ReactNode;
  className?: string;
}

const StandardHeader: React.FC<StandardHeaderProps> = ({ 
  onBack, 
  showBackButton = true, 
  rightContent,
  className = ""
}) => {
  return (
    <header className={`h-16 bg-background border-b border-border flex items-center px-4 flex-shrink-0 ${className}`}>
      <div className="w-12 flex justify-start">
        {showBackButton && onBack && (
          <Button 
            variant="ghost" 
            size="icon"
            onClick={onBack}
            className="text-foreground hover:bg-surface-elevated h-10 w-10"
          >
            <ArrowLeft size={20} />
          </Button>
        )}
      </div>
      
      <div className="flex-1 flex justify-center">
        <div className="h-12 flex items-center">
          <AurumLogo compact />
        </div>
      </div>
      
      <div className="w-12 flex justify-end">
        {rightContent}
      </div>
    </header>
  );
};

export default StandardHeader;