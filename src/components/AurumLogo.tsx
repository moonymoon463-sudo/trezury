import React from 'react';

interface TrezuryLogoProps {
  className?: string;
  compact?: boolean;
}

const AurumLogo: React.FC<TrezuryLogoProps> = ({ className = '', compact = false }) => {
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

  return (
    <div className={`flex flex-col items-center ${className}`}>
      {/* Vault Door Symbol */}
      <div className="border-4 border-primary p-6 mb-4 bg-surface-elevated rounded-lg">
        <div className="grid grid-cols-6 gap-2 w-20 h-12">
          {/* Top row - 2 dots */}
          <div className="col-start-2 w-3 h-3 bg-primary rounded-full"></div>
          <div className="col-start-5 w-3 h-3 bg-primary rounded-full"></div>
          
          {/* Middle row - 6 dots */}
          <div className="w-3 h-3 bg-primary rounded-full"></div>
          <div className="w-3 h-3 bg-primary rounded-full"></div>
          <div className="w-3 h-3 bg-primary rounded-full"></div>
          <div className="w-3 h-3 bg-primary rounded-full"></div>
          <div className="w-3 h-3 bg-primary rounded-full"></div>
          <div className="w-3 h-3 bg-primary rounded-full"></div>
          
          {/* Bottom row - 2 dots */}
          <div className="col-start-2 w-3 h-3 bg-primary rounded-full"></div>
          <div className="col-start-5 w-3 h-3 bg-primary rounded-full"></div>
        </div>
      </div>
      
      {/* Company Name on Dark Background */}
      <div className="flex flex-col items-center bg-card px-8 py-4 rounded-lg">
        <div className="w-32 h-1 bg-primary mb-2"></div>
        <div className="font-bold text-3xl tracking-wider text-primary px-4">
          TREZURY
        </div>
        <div className="w-32 h-1 bg-primary mt-2"></div>
      </div>
      
      {/* Tagline */}
      <div className="text-sm text-muted-foreground tracking-wide mt-3 font-light">
        Wealth • Security • Growth
      </div>
    </div>
  );
};

export default AurumLogo;