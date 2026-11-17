/** Expiry tiers and sell advice for the Stock Alerts page. */
export type ExpiryTier = 'expired' | 'critical' | 'six_months' | 'one_year' | 'ok';

export function expiryTier(days: number): ExpiryTier {
  if (days <= 0) return 'expired';
  if (days <= 90) return 'critical';
  if (days <= 182) return 'six_months';
  if (days <= 365) return 'one_year';
  return 'ok';
}

export const TIER_LABEL: Record<ExpiryTier, string> = {
  expired: 'Expired', critical: 'Under 3 months', six_months: 'Under 6 months', one_year: 'Under 1 year', ok: 'Over 1 year',
};

export const TIER_ADVICE: Record<ExpiryTier, string> = {
  expired: 'Remove from shelf now. Do not sell — return to supplier or dispose safely.',
  critical: 'Sell first: dispense before any other batch, offer 30% off or bundles, ask supplier about returns.',
  six_months: 'Push sales: 15–20% discount, place at the counter, recommend to regular patients. Stop reordering.',
  one_year: 'Sell first (FIFO): move to the front of the shelf and dispense before newer batches. Order less.',
  ok: 'Normal selling.',
};

/** Units needed to bring stock back to twice the minimum level. */
export function reorderQty(stock: number, min: number): number {
  return Math.max(0, Math.max(min, 1) * 2 - Math.max(stock, 0));
}
