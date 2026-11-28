import type React from 'react';
import { useState } from 'react';
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
  onClick?: (e: React.MouseEvent<HTMLImageElement | SVGSVGElement>) => void;
}

function resolveAssetSrc(assetPath: string): string {
  if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
    if (assetPath.startsWith('/')) {
      return `.${assetPath}`;
    }
  }
  return assetPath;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  variant = 'mark',
  size,
  className = '',
  isDark = false,
  alt = BRAND_CONFIG.brandName,
  onClick,
}) => {
  const [hasError, setHasError] = useState(false);
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

  const finalSrc = resolveAssetSrc(src);

  const style: React.CSSProperties & { WebkitUserDrag?: string; userDrag?: string } = {
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

  if (hasError) {
    const pixelSize = typeof size === 'number' ? size : 32;
    return (
      <svg
        width={pixelSize}
        height={pixelSize}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={style}
        onClick={onClick as React.MouseEventHandler<SVGSVGElement> | undefined}
        onKeyDown={onClick ? (e: React.KeyboardEvent<SVGSVGElement>) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent('click', { bubbles: true })); } } : undefined}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        className={`select-none shrink-0 pointer-events-auto ${className}`}
        aria-label={alt}
      >
        <rect width="32" height="32" rx="8" fill="url(#mahi_logo_grad)" />
        <path
          d="M8 23V9L16 16.5L24 9V23H20.5V14.2L16 18.5L11.5 14.2V23H8Z"
          fill="white"
        />
        <defs>
          <linearGradient id="mahi_logo_grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
            <stop stopColor="#DC2626" />
            <stop offset="1" stopColor="#991B1B" />
          </linearGradient>
        </defs>
      </svg>
    );
  }

  return (
    <img
      src={finalSrc}
      alt={alt}
      style={style}
      draggable={false}
      onDragStart={(e) => e.preventDefault()}
      onError={() => setHasError(true)}
      onClick={onClick}
      onKeyDown={onClick ? (e: React.KeyboardEvent<HTMLImageElement>) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } } : undefined}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={`object-contain select-none shrink-0 pointer-events-auto ${className}`}
      loading="eager"
      decoding="async"
    />
  );
};

export default BrandLogo;
