import React from 'react';
import { cn } from '@/lib/utils';

interface ResponsiveLayoutProps {
  children: React.ReactNode;
  className?: string;
  gridCols?: 'auto' | '1' | '2' | '3' | '4';
  spacing?: 'tight' | 'normal' | 'loose';
}

export const ResponsiveGrid: React.FC<ResponsiveLayoutProps> = ({
  children,
  className = "",
  gridCols = 'auto',
  spacing = 'normal'
}) => {
  const gridClasses = {
    'auto': 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3',
    '1': 'grid-cols-1',
    '2': 'grid-cols-1 sm:grid-cols-2',
    '3': 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    '4': 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
  };

  const spacingClasses = {
    'tight': 'gap-2 sm:gap-3',
    'normal': 'gap-4 sm:gap-6',
    'loose': 'gap-6 sm:gap-8'
  };

  return (
    <div className={cn(
      'grid',
      gridClasses[gridCols],
      spacingClasses[spacing],
      className
    )}>
      {children}
    </div>
  );
};

interface ResponsiveContainerProps {
  children: React.ReactNode;
  className?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const ResponsiveContainer: React.FC<ResponsiveContainerProps> = ({
  children,
  className = "",
  maxWidth = 'xl',
  padding = 'md'
}) => {
  const maxWidthClasses = {
    'sm': 'max-w-screen-sm',
    'md': 'max-w-screen-md',
    'lg': 'max-w-screen-lg',
    'xl': 'max-w-screen-xl',
    'full': 'max-w-full'
  };

  const paddingClasses = {
    'none': '',
    'sm': 'px-2 sm:px-4',
    'md': 'px-4 sm:px-6 lg:px-8',
    'lg': 'px-6 sm:px-8 lg:px-12'
  };

  return (
    <div className={cn(
      'container mx-auto w-full',
      maxWidthClasses[maxWidth],
      paddingClasses[padding],
      className
    )}>
      {children}
    </div>
  );
};

interface ResponsiveStackProps {
  children: React.ReactNode;
  className?: string;
  spacing?: 'tight' | 'normal' | 'loose';
  direction?: 'col' | 'row-responsive';
}

export const ResponsiveStack: React.FC<ResponsiveStackProps> = ({
  children,
  className = "",
  spacing = 'normal',
  direction = 'col'
}) => {
  const spacingClasses = {
    'tight': direction === 'col' ? 'space-y-2' : 'space-y-2 sm:space-y-0 sm:space-x-2',
    'normal': direction === 'col' ? 'space-y-4' : 'space-y-4 sm:space-y-0 sm:space-x-4',
    'loose': direction === 'col' ? 'space-y-6' : 'space-y-6 sm:space-y-0 sm:space-x-6'
  };

  const directionClasses = {
    'col': 'flex flex-col',
    'row-responsive': 'flex flex-col sm:flex-row'
  };

  return (
    <div className={cn(
      directionClasses[direction],
      spacingClasses[spacing],
      className
    )}>
      {children}
    </div>
  );
};