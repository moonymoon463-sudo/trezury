import React from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import StandardHeader from '@/components/StandardHeader';
import BottomNavigation from '@/components/BottomNavigation';

interface AppLayoutProps {
  children: React.ReactNode;
  headerProps?: {
    title?: string;
    showBackButton?: boolean;
    backPath?: string;
    onBack?: () => void;
    showRefreshButton?: boolean;
    onRefresh?: () => void;
    isRefreshing?: boolean;
    showSettingsButton?: boolean;
    rightActions?: React.ReactNode;
  };
  showHeader?: boolean;
  showBottomNav?: boolean;
  className?: string;
}

const AppLayout: React.FC<AppLayoutProps> = ({
  children,
  headerProps,
  showHeader = true,
  showBottomNav = true,
  className = ""
}) => {
  const isMobile = useIsMobile();

  return (
    <div className="min-h-[100dvh] w-full overflow-x-hidden bg-background">
      {/* Header */}
      {showHeader && <StandardHeader {...headerProps} />}

      {/* Main Content Container */}
      <main className={`flex-1 w-full ${className}`}>
        <div className="w-full max-w-screen-xl mx-auto">
          <div className={`
            px-3 sm:px-4 md:px-6 lg:px-8
            ${showBottomNav && isMobile 
              ? 'pb-[calc(5rem+max(env(safe-area-inset-bottom),8px))]' 
              : 'pb-4 sm:pb-6'
            }
            ${showHeader ? 'pt-2 sm:pt-3' : 'pt-4 sm:pt-6'}
            min-h-[calc(100dvh-4rem)]
            w-full
          `}>
            {children}
          </div>
        </div>
      </main>

      {/* Bottom Navigation */}
      {showBottomNav && isMobile && <BottomNavigation />}
    </div>
  );
};

export default AppLayout;