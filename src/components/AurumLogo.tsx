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
        <div className="border-2 border-[hsl(var(--aurum-gold))] p-1 bg-slate-900/50 rounded">
          <div className="grid grid-cols-3 gap-1 w-6 h-4">
            <div className="col-start-2 w-1 h-1 bg-[hsl(var(--aurum-gold))] rounded-full"></div>
            <div className="w-1 h-1 bg-[hsl(var(--aurum-gold))] rounded-full"></div>
            <div className="w-1 h-1 bg-[hsl(var(--aurum-gold))] rounded-full"></div>
            <div className="w-1 h-1 bg-[hsl(var(--aurum-gold))] rounded-full"></div>
            <div className="col-start-2 w-1 h-1 bg-[hsl(var(--aurum-gold))] rounded-full"></div>
          </div>
        </div>
        
        {/* Compact Company Name */}
        <div className="font-bold text-lg tracking-wider text-[hsl(var(--aurum-gold))]">
          TREZURY
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center ${className}`}>
      {/* Vault Door Symbol */}
      <div className="border-4 border-[hsl(var(--aurum-gold))] p-6 mb-4 bg-slate-900/50 rounded-lg">
        <div className="grid grid-cols-6 gap-2 w-20 h-12">
          {/* Top row - 2 dots */}
          <div className="col-start-2 w-3 h-3 bg-[hsl(var(--aurum-gold))] rounded-full"></div>
          <div className="col-start-5 w-3 h-3 bg-[hsl(var(--aurum-gold))] rounded-full"></div>
          
          {/* Middle row - 6 dots */}
          <div className="w-3 h-3 bg-[hsl(var(--aurum-gold))] rounded-full"></div>
          <div className="w-3 h-3 bg-[hsl(var(--aurum-gold))] rounded-full"></div>
          <div className="w-3 h-3 bg-[hsl(var(--aurum-gold))] rounded-full"></div>
          <div className="w-3 h-3 bg-[hsl(var(--aurum-gold))] rounded-full"></div>
          <div className="w-3 h-3 bg-[hsl(var(--aurum-gold))] rounded-full"></div>
          <div className="w-3 h-3 bg-[hsl(var(--aurum-gold))] rounded-full"></div>
          
          {/* Bottom row - 2 dots */}
          <div className="col-start-2 w-3 h-3 bg-[hsl(var(--aurum-gold))] rounded-full"></div>
          <div className="col-start-5 w-3 h-3 bg-[hsl(var(--aurum-gold))] rounded-full"></div>
        </div>
      </div>
      
      {/* Company Name on Dark Navy Background */}
      <div className="flex flex-col items-center bg-slate-900 px-8 py-4 rounded-lg">
        <div className="w-32 h-1 bg-[hsl(var(--aurum-gold))] mb-2"></div>
        <div className="font-bold text-3xl tracking-wider text-[hsl(var(--aurum-gold))] px-4">
          TREZURY
        </div>
        <div className="w-32 h-1 bg-[hsl(var(--aurum-gold))] mt-2"></div>
      </div>
      
      {/* Tagline */}
      <div className="text-sm text-muted-foreground tracking-wide mt-3 font-light">
        Wealth • Security • Growth
      </div>
    </div>
  );
};

export default AurumLogo;