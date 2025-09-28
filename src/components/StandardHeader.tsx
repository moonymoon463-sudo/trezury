import React from 'react';
import { ArrowLeft, RefreshCw, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import AurumLogo from '@/components/AurumLogo';

interface StandardHeaderProps {
  title?: string;
  showBackButton?: boolean;
  backPath?: string;
  onBack?: () => void;
  showRefreshButton?: boolean;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  showSettingsButton?: boolean;
  rightActions?: React.ReactNode;
}

const StandardHeader: React.FC<StandardHeaderProps> = ({
  title,
  showBackButton = false,
  backPath = "/",
  onBack,
  showRefreshButton = false,
  onRefresh,
  isRefreshing = false,
  showSettingsButton = false,
  rightActions
}) => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (backPath === "back") {
      navigate(-1);
    } else {
      navigate(backPath);
    }
  };

  return (
    <header 
      className="fixed top-0 inset-x-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border/50 transition-all duration-200" 
      style={{ height: 'var(--header-height)' }}
    >
      <div className="container mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8 h-full">
        <div className="flex items-center justify-between h-full">
          {/* Left Section */}
          <div className="w-10 sm:w-12 lg:w-14 flex justify-start">
            {showBackButton && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={handleBack}
                className="p-2 sm:p-2.5 lg:p-3 hover:bg-surface-elevated transition-colors duration-200 rounded-full"
              >
                <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5 lg:h-5 lg:w-5" />
              </Button>
            )}
          </div>

          {/* Center Section - Logo or Title */}
          <div className="flex-1 flex justify-center max-w-full overflow-hidden">
            {title ? (
              <h1 className="text-base sm:text-lg lg:text-xl font-semibold text-foreground truncate px-2">
                {title}
              </h1>
            ) : (
              <div className="w-auto max-w-full flex justify-center">
                <AurumLogo compact size="header" />
              </div>
            )}
          </div>

          {/* Right Section */}
          <div className="w-10 sm:w-12 lg:w-14 flex justify-end gap-1">
            {rightActions ? (
              <div className="flex items-center gap-1 max-w-full overflow-hidden">
                {rightActions}
              </div>
            ) : (
              <>
                {showRefreshButton && (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={onRefresh}
                    disabled={isRefreshing}
                    className="p-2 sm:p-2.5 lg:p-3 hover:bg-surface-elevated transition-colors duration-200 rounded-full"
                  >
                    <RefreshCw className={`h-4 w-4 sm:h-5 sm:w-5 lg:h-5 lg:w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
                  </Button>
                )}
                {showSettingsButton && (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => navigate("/settings")}
                    className="p-2 sm:p-2.5 lg:p-3 hover:bg-surface-elevated transition-colors duration-200 rounded-full"
                  >
                    <Settings className="h-4 w-4 sm:h-5 sm:w-5 lg:h-5 lg:w-5" />
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default StandardHeader;