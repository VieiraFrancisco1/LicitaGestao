import bannerAgf from '../assets/company-banners/agf.png';
import bannerAmaro from '../assets/company-banners/amaro.png';
import bannerEgr from '../assets/company-banners/egr.png';
import bannerEqv from '../assets/company-banners/eqv.png';
import bannerIcv from '../assets/company-banners/icv.png';
import bannerLm from '../assets/company-banners/lm.png';
import bannerRb from '../assets/company-banners/rb.png';
import bannerRecanto from '../assets/company-banners/recanto.png';
import bannerSecon from '../assets/company-banners/secon.png';
import bannerSerfi from '../assets/company-banners/serfi.png';
import bannerVertical from '../assets/company-banners/vertical.png';
import bannerWhipec from '../assets/company-banners/whipec.png';

const normalizeCompanyName = (value?: string | null) =>
  (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s&]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

const matchesCompany = (name: string, ...aliases: string[]) =>
  aliases.some(
    (alias) =>
      name === alias ||
      name.startsWith(`${alias} `) ||
      name.includes(` ${alias} `) ||
      name.endsWith(` ${alias}`)
  );

export const resolveCompanyBanner = (value?: string | null) => {
  const name = normalizeCompanyName(value);

  if (matchesCompany(name, 'AGF')) return bannerAgf;
  if (matchesCompany(name, 'AMARO', 'AMARO ENGENHARIA', 'AMARO ENGENHARIA LTDA')) return bannerAmaro;
  if (matchesCompany(name, 'EG&R', 'EG R', 'EG & R', 'EGR')) return bannerEgr;
  if (matchesCompany(name, 'EQV', 'EQV EMPREENDIMENTOS')) return bannerEqv;
  if (matchesCompany(name, 'ICV', 'I C V', 'ICV CONSTRUCAO CIVIL')) return bannerIcv;
  if (matchesCompany(name, 'LM', 'LM CONSTRUCOES', 'LM CONSTRUCOES & SERVICOS')) return bannerLm;
  if (matchesCompany(name, 'RB', 'RB EMPREENDIMENTOS')) return bannerRb;
  if (matchesCompany(name, 'RECANTO', 'CONSTRUTORA RECANTO', 'RECANTO CONSTRUTORA')) return bannerRecanto;
  if (matchesCompany(name, 'SECON', 'SECON SERVICOS & CONSTRUCOES', 'SECON SERVICOS E CONSTRUCOES')) return bannerSecon;
  if (matchesCompany(name, 'SERFI', 'SERFI CONSTRUTORA')) return bannerSerfi;
  if (matchesCompany(name, 'VERTICAL', 'VERTICAL ENGENHARIA', 'VERTICAL ENGENHARIA E SERVICOS')) return bannerVertical;
  if (matchesCompany(name, 'WHIPEC', 'WHIPEC EMPREENDIMENTOS')) return bannerWhipec;

  return undefined;
};

export const buildCompanyBannerStyle = (banner?: string) =>
  banner
    ? {
        backgroundImage: `linear-gradient(90deg, rgba(8, 25, 62, 0.18), rgba(8, 25, 62, 0.24)), url(${banner})`,
        backgroundSize: '100% 100%, 70% auto',
        backgroundPosition: 'center, center',
        backgroundRepeat: 'no-repeat, no-repeat',
        backgroundColor: '#0b3978'
      }
    : undefined;
