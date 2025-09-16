import React from 'react';

interface TrezuryLogoProps {
  className?: string;
}

const AurumLogo: React.FC<TrezuryLogoProps> = ({ className = '' }) => {
  return (
    <div className={`flex flex-col items-center ${className}`}>
      {/* Logo Symbol */}
      <div className="border-2 border-foreground p-3 mb-3">
        <div className="grid grid-cols-6 gap-1 w-12 h-8">
          {/* Top row - 2 dots */}
          <div className="col-start-2 w-2 h-2 bg-foreground rounded-full"></div>
          <div className="col-start-5 w-2 h-2 bg-foreground rounded-full"></div>
          
          {/* Middle row - 6 dots */}
          <div className="w-2 h-2 bg-foreground rounded-full"></div>
          <div className="w-2 h-2 bg-foreground rounded-full"></div>
          <div className="w-2 h-2 bg-foreground rounded-full"></div>
          <div className="w-2 h-2 bg-foreground rounded-full"></div>
          <div className="w-2 h-2 bg-foreground rounded-full"></div>
          <div className="w-2 h-2 bg-foreground rounded-full"></div>
          
          {/* Bottom row - 2 dots */}
          <div className="col-start-2 w-2 h-2 bg-foreground rounded-full"></div>
          <div className="col-start-5 w-2 h-2 bg-foreground rounded-full"></div>
        </div>
      </div>
      
      {/* Company Name */}
      <div className="flex flex-col items-center">
        <div className="w-24 h-0.5 bg-foreground mb-1"></div>
        <div className="font-bold text-xl tracking-wider text-foreground px-2">
          TREZURY
        </div>
        <div className="w-24 h-0.5 bg-foreground mt-1 mb-2"></div>
      </div>
      
      {/* Tagline */}
      <div className="text-xs text-muted-foreground tracking-wide">
        Wealth • Security • Growth
      </div>
    </div>
  );
};

export default AurumLogo;