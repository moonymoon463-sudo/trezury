import React from 'react';
import trezuryLogo from '@/assets/trezury-logo.png';

interface AurumLogoProps {
  className?: string;
  compact?: boolean;
  size?: 'default' | 'header' | 'xs';
}

const AurumLogo: React.FC<AurumLogoProps> = ({ className = '', compact = false, size = 'default' }) => {
  const sizeClasses = {
    xs: 'h-[80px] sm:h-[90px] md:h-[100px]',
    compact: 'h-[100px] sm:h-[110px] md:h-[120px]',
    header: 'h-[140px] sm:h-[160px] md:h-[180px]',
    default: 'h-[180px] sm:h-[210px] md:h-[240px]'
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