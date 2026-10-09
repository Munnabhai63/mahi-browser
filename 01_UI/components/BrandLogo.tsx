import React from 'react';
import {
  BRAND_CONFIG,
  PRIMARY_LOGO,
  RED_MARK,
  DARK_MARK,
  APP_ICON,
} from '../../10_CONFIG/brand-config.js';

export interface BrandLogoProps {
  variant?: 'mark' | 'full' | 'primary' | 'dark' | 'icon' | 'mono';
  size?: number | string;
  className?: string;
  isDark?: boolean;
  alt?: string;
  onClick?: (e: React.MouseEvent<HTMLImageElement>) => void;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  variant = 'mark',
  size,
  className = '',
  isDark = false,
  alt = BRAND_CONFIG.brandName,
  onClick,
}) => {
  let src: string = RED_MARK;

  if (variant === 'full' || variant === 'primary') {
    src = PRIMARY_LOGO; // ASSET A: Primary Full Logo with Wordmark
  } else if (variant === 'icon') {
    src = APP_ICON;     // ASSET D: Red Square Squircle App Icon
  } else if (variant === 'dark') {
    src = DARK_MARK;    // ASSET C: Black + Red Dragon Mark
  } else {
    // variant === 'mark' or fallback
    src = isDark ? DARK_MARK : RED_MARK;
  }

  const style: React.CSSProperties & { [key: string]: any } = {
    objectFit: 'contain',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    WebkitUserDrag: 'none',
    userDrag: 'none',
  };

  if (typeof size === 'number') {
    style.width = `${size}px`;
    style.height = `${size}px`;
  }

  return (
    <img
      src={src}
      alt={alt}
      style={style}
      draggable={false}
      onDragStart={(e) => e.preventDefault()}
      onClick={onClick}
      className={`object-contain select-none shrink-0 pointer-events-auto ${className}`}
      loading="eager"
      decoding="async"
    />
  );
};

export default BrandLogo;
