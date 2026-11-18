import type { CSSProperties } from 'react';

export type ShareBrand = 'whatsapp' | 'facebook' | 'messenger' | 'x' | 'telegram';

const brandIcons: Record<ShareBrand, { slug: string; color: string }> = {
  whatsapp: { slug: 'whatsapp', color: 'FFFFFF' },
  facebook: { slug: 'facebook', color: 'FFFFFF' },
  messenger: { slug: 'facebookmessenger', color: 'FFFFFF' },
  x: { slug: 'x', color: 'FFFFFF' },
  telegram: { slug: 'telegram', color: 'FFFFFF' },
};

interface BrandShareIconProps {
  brand: ShareBrand;
  label: string;
  className?: string;
  style?: CSSProperties;
}

export const BrandShareIcon = ({ brand, label, className, style }: BrandShareIconProps) => {
  const icon = brandIcons[brand];

  return (
    <img
      src={`https://cdn.simpleicons.org/${icon.slug}/${icon.color}`}
      alt={`Logo officiel de ${label}`}
      aria-hidden="false"
      loading="eager"
      decoding="async"
      draggable={false}
      className={className}
      style={style}
    />
  );
};
