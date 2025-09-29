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
  showBottomNavOnAllScreens?: boolean;
  className?: string;
}

const AppLayout: React.FC<AppLayoutProps> = ({
  children,
  headerProps,
  showHeader = true,
  showBottomNav = true,
  showBottomNavOnAllScreens = false,
  className = ""
}) => {
  const isMobile = useIsMobile();

  return (
    <div className="screen flex flex-col bg-background">
      {/* Header */}
      {showHeader && <StandardHeader {...headerProps} />}

      {/* Main Content Container */}
      <main className={`flex-1 overflow-auto ${className}`}>
        <div className="container mx-auto max-w-none w-full md:max-w-4xl lg:max-w-5xl">
          <div className={`
            px-0 sm:px-0 md:px-6 lg:px-8
            ${showBottomNav ? 'pb-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom)+0.5rem)]' : 'pb-4'}
            ${showHeader ? 'pt-[calc(3rem+max(8px,env(safe-area-inset-top))+0.5rem)] sm:pt-[calc(3.5rem+max(8px,env(safe-area-inset-top))+0.5rem)] lg:pt-[calc(4rem+max(8px,env(safe-area-inset-top))+0.5rem)]' : 'pt-4'}
            min-h-[calc(100dvh-4rem)]
          `}>
            {children}
          </div>
        </div>
      </main>

      {/* Bottom Navigation */}
      {showBottomNav && (showBottomNavOnAllScreens || isMobile) && <BottomNavigation />}
    </div>
  );
};

export default AppLayout;