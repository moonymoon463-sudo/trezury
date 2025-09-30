import React from 'react';
import trezuryLogo from '@/assets/trezury-logo.png';

interface AurumLogoProps {
  className?: string;
  compact?: boolean;
  size?: 'default' | 'header';
}

const AurumLogo: React.FC<AurumLogoProps> = ({ className = '', compact = false, size = 'default' }) => {
  const sizeClasses = {
    compact: 'h-8',
    header: 'h-10',
    default: 'h-16'
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