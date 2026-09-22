import type { ReactNode } from 'react';
import logoAgf from '../assets/company-logos/agf.png';
import logoAmaro from '../assets/company-logos/amaro.png';
import logoEgr from '../assets/company-logos/egr.png';
import logoIcv from '../assets/company-logos/icv.png';
import logoLm from '../assets/company-logos/lm.png';
import logoRecanto from '../assets/company-logos/recanto.png';
import logoSecon from '../assets/company-logos/secon.png';
import logoSerfi from '../assets/company-logos/serfi.png';
import logoVertical from '../assets/company-logos/vertical.png';
import logoWhipec from '../assets/company-logos/whipec.png';

type BrandConfig = {
  key: string;
  shortLabel: string;
  logo?: string;
  aliases: string[];
};

const BRAND_CONFIGS: BrandConfig[] = [
  {
    key: 'rb',
    shortLabel: 'RB',
    aliases: ['RB']
  },
  {
    key: 'vertical',
    shortLabel: 'Vertical',
    logo: logoVertical,
    aliases: ['VERTICAL ENGENHARIA', 'VERTICAL ENGENHARIA E SERVICOS', 'VERTICAL']
  },
  {
    key: 'serfi',
    shortLabel: 'Serfi',
    logo: logoSerfi,
    aliases: ['SERFI CONSTRUTORA', 'SERFI']
  },
  {
    key: 'egr',
    shortLabel: 'EG&R',
    logo: logoEgr,
    aliases: ['EG&R', 'EGR', 'EG R', 'EG&R CONSTRUCOES', 'EG & R CONSTRUCOES']
  },
  {
    key: 'agf',
    shortLabel: 'AGF',
    logo: logoAgf,
    aliases: ['AGF']
  },
  {
    key: 'amaro',
    shortLabel: 'Amaro',
    logo: logoAmaro,
    aliases: ['AMARO ENGENHARIA', 'AMARO ENGENHARIA LTDA', 'AMARO']
  },
  {
    key: 'icv',
    shortLabel: 'ICV',
    logo: logoIcv,
    aliases: ['ICV', 'I C V', 'ICV CONSTRUCOES', 'ICV CONSTRUCAO CIVIL']
  },
  {
    key: 'lm',
    shortLabel: 'LM',
    logo: logoLm,
    aliases: ['LM']
  },
  {
    key: 'secon',
    shortLabel: 'Secon',
    logo: logoSecon,
    aliases: ['SECON']
  },
  {
    key: 'recanto',
    shortLabel: 'Recanto',
    logo: logoRecanto,
    aliases: ['RECANTO', 'CONSTRUTORA RECANTO', 'RECANTO CONSTRUTORA']
  },
  {
    key: 'whipec',
    shortLabel: 'Whipec',
    logo: logoWhipec,
    aliases: ['WHIPEC']
  }
];

function normalizeCompanyName(name?: string | null) {
  return (name ?? '')
    .normalize('NFD')
    .replace(/[^\w\s&]/g, '')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function fallbackInitials(name?: string | null) {
  const tokens = normalizeCompanyName(name)
    .split(' ')
    .filter(Boolean)
    .slice(0, 2);
  if (!tokens.length) return 'EM';
  return tokens.map((token) => token[0]).join('').slice(0, 2);
}

function isAliasMatch(normalizedName: string, alias: string) {
  return (
    normalizedName === alias ||
    normalizedName.startsWith(`${alias} `) ||
    normalizedName.includes(` ${alias} `) ||
    normalizedName.endsWith(` ${alias}`)
  );
}

export function getCompanyBrand(name?: string | null) {
  const normalized = normalizeCompanyName(name);
  return BRAND_CONFIGS.find((item) => item.aliases.some((alias) => isAliasMatch(normalized, alias)));
}

export function getCompanyShortLabel(name?: string | null) {
  return getCompanyBrand(name)?.shortLabel ?? name ?? 'Empresa';
}

export function getCompanyLogo(name?: string | null) {
  return getCompanyBrand(name)?.logo;
}

export function CompanyBrandMark({
  companyName,
  size = 28,
  className = ''
}: {
  companyName?: string | null;
  size?: number;
  className?: string;
}) {
  const brand = getCompanyBrand(companyName);
  const style = { width: `${size}px`, height: `${size}px` };

  if (!brand || !brand.logo) {
    return (
      <span className={`company-brand-mark is-fallback ${className}`.trim()} style={style} aria-hidden="true">
        {brand?.shortLabel ?? fallbackInitials(companyName)}
      </span>
    );
  }

  return (
    <span className={`company-brand-mark has-logo ${className}`.trim()} style={style} aria-hidden="true">
      <img src={brand.logo} alt="" />
    </span>
  );
}

export function CompanyLabel({
  companyName,
  secondary,
  compact = false,
  size = 28,
  trailing
}: {
  companyName?: string | null;
  secondary?: ReactNode;
  compact?: boolean;
  size?: number;
  trailing?: ReactNode;
}) {
  return (
    <span className={`company-label ${compact ? 'compact' : ''}`.trim()}>
      <CompanyBrandMark companyName={companyName} size={size} />
      <span className="company-label-copy">
        <strong>{companyName ?? 'Empresa'}</strong>
        {secondary ? <small>{secondary}</small> : null}
      </span>
      {trailing ? <span className="company-label-trailing">{trailing}</span> : null}
    </span>
  );
}
