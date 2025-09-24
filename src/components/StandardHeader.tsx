import React from 'react';
import { ArrowLeft, RefreshCw, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import AurumLogo from '@/components/AurumLogo';

interface StandardHeaderProps {
  showBackButton?: boolean;
  backPath?: string;
  showRefreshButton?: boolean;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  showSettingsButton?: boolean;
  rightActions?: React.ReactNode;
}

const StandardHeader: React.FC<StandardHeaderProps> = ({
  showBackButton = false,
  backPath = "/",
  showRefreshButton = false,
  onRefresh,
  isRefreshing = false,
  showSettingsButton = false,
  rightActions
}) => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (backPath === "back") {
      navigate(-1);
    } else {
      navigate(backPath);
    }
  };

  return (
    <header className="h-16 bg-background border-b border-border px-4 flex-shrink-0">
      <div className="flex items-center justify-between h-full">
        {/* Left Section */}
        <div className="w-12 flex justify-start">
          {showBackButton && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleBack}
              className="p-2 hover:bg-surface-elevated"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
        </div>

        {/* Center Section - Logo */}
        <div className="flex-1 flex justify-center">
          <AurumLogo compact />
        </div>

        {/* Right Section */}
        <div className="w-12 flex justify-end gap-1">
          {rightActions ? (
            rightActions
          ) : (
            <>
              {showRefreshButton && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={onRefresh}
                  disabled={isRefreshing}
                  className="p-2 hover:bg-surface-elevated"
                >
                  <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                </Button>
              )}
              {showSettingsButton && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => navigate("/settings")}
                  className="p-2 hover:bg-surface-elevated"
                >
                  <Settings className="h-5 w-5" />
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default StandardHeader;