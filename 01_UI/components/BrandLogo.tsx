import React from 'react';
import { BRAND_CONFIG } from '../../10_CONFIG/brand-config.js';

export interface BrandLogoProps {
  variant?: 'mark' | 'full' | 'icon' | 'mono';
  size?: number | string;
  className?: string;
  isDark?: boolean;
  alt?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  variant = 'mark',
  size,
  className = '',
  isDark = true,
  alt = BRAND_CONFIG.brandName,
}) => {
  let src: string = BRAND_CONFIG.assets.mark;

  if (variant === 'full') {
    src = isDark ? BRAND_CONFIG.assets.logoDark : BRAND_CONFIG.assets.logoHorizontal;
  } else if (variant === 'icon') {
    src = BRAND_CONFIG.assets.icon;
  } else if (variant === 'mono') {
    src = BRAND_CONFIG.assets.markMono;
  } else {
    src = isDark ? BRAND_CONFIG.assets.markDark : BRAND_CONFIG.assets.markLight;
  }

  const style: React.CSSProperties = {};
  if (typeof size === 'number') {
    style.width = `${size}px`;
    style.height = `${size}px`;
  }

  return (
    <img
      src={src}
      alt={alt}
      style={style}
      className={`object-contain select-none shrink-0 ${className}`}
      loading="eager"
      decoding="async"
    />
  );
};

export default BrandLogo;
