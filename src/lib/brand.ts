import logo from '@/assets/brand/afyadawa_logo.png';
import dashboardLogo from '@/assets/brand/afyadawa_dashboard_logo.png';
import mark from '@/assets/brand/afyadawa_mark.png';

/** Afyadawa brand + public contact details — one source for the site, emails and receipts. */
export const BRAND = {
  name: 'Afyadawa',
  logoUrl: logo,
  dashboardLogoUrl: dashboardLogo,
  markUrl: mark,
  email: 'info@swahivo.com',
  enterpriseEmail: 'hello@swahivo.com',
  phones: ['0771 888 881', '0674 766 586'],
} as const;

export const telHref = (phone: string) => `tel:+255${phone.replace(/\D/g, '').replace(/^0/, '')}`;
