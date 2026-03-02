import React from 'react';
import mariviewLogo from '../assets/mariview_logo.png'; // Make sure this file exists

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  collapsed?: boolean;
}

export default function Logo({ className = '', size = 'md', showIcon = true, collapsed = false }: LogoProps) {
  // Map sizes to height values for the image
  const heightMap = {
    sm: 'h-8',
    md: 'h-10',
    lg: 'h-14'
  };

  const containerHeight = heightMap[size];

  if (collapsed) {
    // For collapsed state, show only the icon part (left side) by using object-position
    return (
      <div className={`flex items-center justify-center overflow-hidden ${containerHeight} aspect-square ${className}`}>
        <img
          src={mariviewLogo}
          alt="M"
          className="h-full max-w-none object-cover object-left"
          style={{ width: 'auto', aspectRatio: '3.5/1' }} // Assuming roughly 3.5:1 ratio for full logo, forcing crop
        />
      </div>
    );
  }

  return (
    <div className={`flex items-center ${className}`}>
      <img
        src={mariviewLogo}
        alt="MARIVIEW"
        className={`${containerHeight} w-auto object-contain`}
      />
    </div>
  );
}
