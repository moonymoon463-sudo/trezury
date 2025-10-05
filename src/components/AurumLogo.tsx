import React from 'react';
import trezuryLogo from '@/assets/trezury-logo.png';

interface AurumLogoProps {
  className?: string;
  compact?: boolean;
  size?: 'default' | 'header';
}

const AurumLogo: React.FC<AurumLogoProps> = ({ className = '', compact = false, size = 'default' }) => {
  const sizeClasses = {
    compact: 'h-[150px]',
    header: 'h-[150px]',
    default: 'h-[150px]'
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