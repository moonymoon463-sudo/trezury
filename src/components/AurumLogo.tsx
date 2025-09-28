import React from 'react';

interface AurumLogoProps {
  className?: string;
  compact?: boolean;
  size?: 'default' | 'header';
}

const sizeMap = {
  header: {
    vaultBorder: 'border p-1.5',
    gridWrap: 'grid grid-cols-3 gap-0.5 w-6 h-4',
    dot: 'w-1 h-1',
    vaultSpacing: 'mb-0',
    nameWrapPad: 'px-2 py-0.5',
    nameStripeW: 'w-12',
    nameStripeH: 'h-px',
    nameText: 'text-sm',
    tagline: 'text-xs mt-1',
  },
  default: {
    vaultBorder: 'border-4 p-6',
    gridWrap: 'grid grid-cols-6 gap-2 w-20 h-12',
    dot: 'w-3 h-3',
    vaultSpacing: 'mb-4',
    nameWrapPad: 'px-8 py-4',
    nameStripeW: 'w-32',
    nameStripeH: 'h-1',
    nameText: 'text-3xl',
    tagline: 'text-sm mt-3',
  },
};

const AurumLogo: React.FC<AurumLogoProps> = ({ className = '', compact = false, size = 'default' }) => {
  if (compact) {
    const isHeader = size === 'header';
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {/* Compact Vault Symbol */}
        <div className={`border border-primary ${isHeader ? 'p-0.5' : 'p-1'} bg-surface-elevated rounded`}>
          <div className={`grid grid-cols-3 gap-0.5 ${isHeader ? 'w-3 h-2.5' : 'w-4 h-3'}`}>
            <div className={`col-start-2 ${isHeader ? 'w-0.5 h-0.5' : 'w-1 h-1'} bg-primary rounded-full`}></div>
            <div className={`${isHeader ? 'w-0.5 h-0.5' : 'w-1 h-1'} bg-primary rounded-full`}></div>
            <div className={`${isHeader ? 'w-0.5 h-0.5' : 'w-1 h-1'} bg-primary rounded-full`}></div>
            <div className={`${isHeader ? 'w-0.5 h-0.5' : 'w-1 h-1'} bg-primary rounded-full`}></div>
            <div className={`col-start-2 ${isHeader ? 'w-0.5 h-0.5' : 'w-1 h-1'} bg-primary rounded-full`}></div>
          </div>
        </div>
        
        {/* Compact Company Name */}
        <div className={`font-bold tracking-wide text-primary ${isHeader ? 'text-sm' : 'text-base'}`}>
          TREZURY
        </div>
      </div>
    );
  }

  const s = sizeMap[size];

  return (
    <div className={`flex flex-col items-center ${className}`}>
      {/* Vault Door Symbol */}
      <div className={`${s.vaultBorder} ${s.vaultSpacing} bg-surface-elevated rounded-lg`}>
        <div className={s.gridWrap}>
          {/* Top row - 2 dots */}
          <div className={`col-start-2 ${s.dot} bg-primary rounded-full`}></div>
          <div className={`col-start-5 ${s.dot} bg-primary rounded-full`}></div>
          
          {/* Middle row - 6 dots */}
          <div className={`${s.dot} bg-primary rounded-full`}></div>
          <div className={`${s.dot} bg-primary rounded-full`}></div>
          <div className={`${s.dot} bg-primary rounded-full`}></div>
          <div className={`${s.dot} bg-primary rounded-full`}></div>
          <div className={`${s.dot} bg-primary rounded-full`}></div>
          <div className={`${s.dot} bg-primary rounded-full`}></div>
          
          {/* Bottom row - 2 dots */}
          <div className={`col-start-2 ${s.dot} bg-primary rounded-full`}></div>
          <div className={`col-start-5 ${s.dot} bg-primary rounded-full`}></div>
        </div>
      </div>
      
      {/* Company Name on Dark Background */}
      <div className={`flex flex-col items-center bg-card ${s.nameWrapPad} rounded-lg`}>
        <div className={`${s.nameStripeW} ${s.nameStripeH} bg-primary mb-2`}></div>
        <div className={`font-bold ${s.nameText} tracking-wider text-primary px-4`}>
          TREZURY
        </div>
        <div className={`${s.nameStripeW} ${s.nameStripeH} bg-primary mt-2`}></div>
      </div>
      
      {/* Tagline */}
      <div className={`${s.tagline} text-muted-foreground tracking-wide font-light`}>
        Wealth • Security • Growth
      </div>
    </div>
  );
};

export default AurumLogo;