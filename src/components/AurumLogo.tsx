import React from 'react';
import trezuryLogo from '@/assets/trezury-logo.png';

interface AurumLogoProps {
  className?: string;
  compact?: boolean;
  size?: 'default' | 'header';
}

const AurumLogo: React.FC<AurumLogoProps> = ({ className = '', compact = false, size = 'default' }) => {
  const sizeClasses = {
    compact: 'h-[165px]',
    header: 'h-24 sm:h-28 lg:h-32',
    default: 'h-28'
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