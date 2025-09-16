import React from 'react';
import trezuryLogo from '@/assets/trezury_logo.svg';

interface TrezuryLogoProps {
  className?: string;
}

const AurumLogo: React.FC<TrezuryLogoProps> = ({ className = '' }) => {
  return (
    <img 
      src={trezuryLogo} 
      alt="TREZURY - Wealth • Security • Growth"
      className={`h-12 w-auto ${className}`}
    />
  );
};

export default AurumLogo;