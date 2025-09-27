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
    <div className="min-h-[100dvh] w-full bg-background">
      {/* Header */}
      {showHeader && <StandardHeader {...headerProps} />}

      {/* Main Content Container */}
      <main className={`flex-1 ${className}`}>
        <div className="container mx-auto max-w-screen-xl">
          <div className={`
            px-4 sm:px-6 lg:px-8
            ${showBottomNav ? 'pb-[calc(4rem+env(safe-area-inset-bottom))]' : 'pb-4'}
            ${showHeader ? 'pt-2' : 'pt-4'}
            min-h-[calc(100dvh-4rem)]
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