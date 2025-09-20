import React from 'react';

interface AurumLogoProps {
  className?: string;
  compact?: boolean;
  size?: 'default' | 'header';
}

const sizeMap = {
  header: {
    vaultBorder: 'border-2 p-2',
    gridWrap: 'grid grid-cols-6 gap-1 w-12 h-8',
    dot: 'w-2 h-2',
    vaultSpacing: 'mb-2',
    nameWrapPad: 'px-4 py-2',
    nameStripeW: 'w-24',
    nameStripeH: 'h-px',
    nameText: 'text-xl',
    tagline: 'text-xs mt-2',
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
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {/* Compact Vault Symbol */}
        <div className="border border-primary p-1 bg-surface-elevated rounded">
          <div className="grid grid-cols-3 gap-0.5 w-4 h-3">
            <div className="col-start-2 w-1 h-1 bg-primary rounded-full"></div>
            <div className="w-1 h-1 bg-primary rounded-full"></div>
            <div className="w-1 h-1 bg-primary rounded-full"></div>
            <div className="w-1 h-1 bg-primary rounded-full"></div>
            <div className="col-start-2 w-1 h-1 bg-primary rounded-full"></div>
          </div>
        </div>
        
        {/* Compact Company Name */}
        <div className="font-bold text-base tracking-wide text-primary">
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