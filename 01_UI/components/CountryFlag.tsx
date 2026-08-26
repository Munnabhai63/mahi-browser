import React, { useState } from 'react';

interface CountryFlagProps {
  countryCode?: string;
  className?: string;
  showTooltip?: boolean;
}

export const getFlagEmoji = (countryCode?: string): string => {
  if (!countryCode) return '🌐';
  const clean = countryCode.trim().toUpperCase();
  if (clean.length === 2 && /^[A-Z]{2}$/.test(clean)) {
    const codePoints = clean
      .split('')
      .map((char) => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  }
  return '🌐';
};

export const getCountryNameFromCode = (countryCode?: string): string => {
  if (!countryCode) return '';
  const clean = countryCode.trim().toUpperCase();
  if (clean.length === 2) {
    try {
      const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
      return regionNames.of(clean) || clean;
    } catch {
      return clean;
    }
  }
  return countryCode;
};

/**
 * Renders real high-definition country flag images with instant local fallback.
 * Works seamlessly on Windows where emoji regional indicators otherwise display as text letters.
 */
export const CountryFlag: React.FC<CountryFlagProps> = ({
  countryCode,
  className = 'w-5 h-3.5',
  showTooltip = true,
}) => {
  const [imgError, setImgError] = useState(false);
  const code = (countryCode || '').trim().toUpperCase();
  const countryName = getCountryNameFromCode(code);
  const emoji = getFlagEmoji(code);

  if (!code || code === 'UNKNOWN' || code.length !== 2 || !/^[A-Z]{2}$/.test(code)) {
    return <span className="text-base select-none">🌐</span>;
  }

  const tooltip = showTooltip ? (countryName ? `${countryName} (${code})` : `Country: ${code}`) : undefined;

  if (imgError) {
    return (
      <span
        className="inline-flex items-center justify-center text-sm leading-none select-none font-bold"
        title={tooltip}
      >
        {emoji}
      </span>
    );
  }

  return (
    <img
      src={`https://flagcdn.com/w40/${code.toLowerCase()}.png`}
      alt={countryName || code}
      title={tooltip}
      onError={() => setImgError(true)}
      className={`inline-block object-cover rounded-[2px] shadow-[0_1px_2px_rgba(0,0,0,0.2)] border border-black/10 select-none align-middle ${className}`}
      loading="lazy"
    />
  );
};
