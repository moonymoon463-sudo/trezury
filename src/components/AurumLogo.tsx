import React from 'react';
import trezuryLogo from '@/assets/trezury-logo.png';

interface AurumLogoProps {
  className?: string;
  compact?: boolean;
  size?: 'default' | 'header';
}

const AurumLogo: React.FC<AurumLogoProps> = ({ className = '', compact = false, size = 'default' }) => {
  const sizeClasses = {
    compact: 'h-[80px] sm:h-[100px] md:h-[120px]',
    header: 'h-[120px] sm:h-[150px] md:h-[180px]',
    default: 'h-[160px] sm:h-[200px] md:h-[240px]'
  };

  const logoSize = compact ? 'compact' : size;
  
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <img 
        src={trezuryLogo} 
        alt="TREZURY Logo" 
        className={`${sizeClasses[logoSize]} w-auto object-contain`}
      />
    </div>
  );
};

export default AurumLogo;