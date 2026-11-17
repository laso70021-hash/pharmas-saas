// Subscription rules shared by the signup form, the account page and the admin panel.
// The database applies the same rules (plan_yearly_price, create_registration, review_registration).

export const TRIAL_DAYS = 30;
export const TRIAL_PLAN_SLUG = 'starter';

export type AccountStatus = 'pending' | 'trial' | 'active' | 'expired' | 'suspended' | 'rejected';
export type BillingChoice = 'trial' | 'monthly' | 'annual';
export type PaidCycle = 'monthly' | 'annual';
export const EXPIRY_WARNING_DAYS = 7;

interface PricedPlan {
  slug: string;
  price_tzs_monthly: number;
  price_tzs_annual: number;
}

/** Exact yearly price set for the plan (a full-year total). 0 means custom pricing. */
export function yearlyPrice(plan: PricedPlan): number {
  return plan.price_tzs_annual || (plan.price_tzs_monthly || 0) * 12;
}

/** What one year would cost at the normal monthly rate (used to show savings). */
export function undiscountedYearlyPrice(plan: PricedPlan): number {
  return (plan.price_tzs_monthly || 0) * 12;
}

export function isCustomPriced(plan: PricedPlan): boolean {
  return yearlyPrice(plan) === 0;
}

/** Every plan can begin with the free 30-day trial. */
export function offersTrial(_planSlug: string): boolean {
  return true;
}

export function resolveBillingChoice(planSlug: string, requested: BillingChoice): BillingChoice {
  return offersTrial(planSlug) ? requested : 'annual';
}

interface StatusRow {
  status: string;
  trial_ends_at?: string | null;
  subscription_ends_at?: string | null;
}

/** Status as the customer experiences it today: a trial or year that has run out counts as expired. */
export function effectiveStatus(row: StatusRow, now: Date = new Date()): AccountStatus {
  const s = row.status;
  if (s === 'trial') {
    if (!row.trial_ends_at || new Date(row.trial_ends_at) <= now) return 'expired';
    return 'trial';
  }
  if (s === 'active') {
    if (row.subscription_ends_at && new Date(row.subscription_ends_at) <= now) return 'expired';
    return 'active';
  }
  if (s === 'pending' || s === 'suspended' || s === 'rejected' || s === 'expired') return s;
  return 'pending';
}

export function daysLeft(dateIso: string | null | undefined, now: Date = new Date()): number {
  if (!dateIso) return 0;
  const ms = new Date(dateIso).getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

/** End of the current service window: trial end for trials, paid end otherwise. */
export function serviceEndsAt(row: StatusRow & { billing_choice?: string | null }): string | null {
  if (row.status === 'trial') return row.trial_ends_at ?? null;
  if (row.status === 'active') return row.subscription_ends_at ?? null;
  return row.subscription_ends_at || row.trial_ends_at || null;
}

/** Running trial or paid period that ends within the warning window. */
export function isExpiringSoon(row: StatusRow, now: Date = new Date(), days = EXPIRY_WARNING_DAYS): boolean {
  const st = effectiveStatus(row, now);
  if (st !== 'trial' && st !== 'active') return false;
  const end = serviceEndsAt(row);
  return !!end && new Date(end).getTime() - now.getTime() <= days * 86_400_000;
}

/** Amount for one paid period of a plan. */
export function cyclePrice(plan: PricedPlan, cycle: PaidCycle): number {
  return cycle === 'monthly' ? plan.price_tzs_monthly || 0 : yearlyPrice(plan);
}

/** Quick admin extension: add one month or one year after the later of today and the current end. */
export function extendEnd(currentEnd: string | null | undefined, cycle: PaidCycle, now: Date = new Date()): Date {
  const base = currentEnd && new Date(currentEnd) > now ? new Date(currentEnd) : new Date(now);
  const d = new Date(base);
  if (cycle === 'monthly') d.setMonth(d.getMonth() + 1); else d.setFullYear(d.getFullYear() + 1);
  return d;
}

export function formatTokens(n: number | null | undefined): string {
  if (n == null) return 'Unlimited';
  return n >= 1_000_000 ? `${n / 1_000_000}M` : n >= 1000 ? `${Math.round(n / 1000)}K` : String(n);
}

export const STATUS_LABELS: Record<AccountStatus, string> = {
  pending: 'Waiting for approval',
  trial: 'Free trial',
  active: 'Active (paid)',
  expired: 'Expired',
  suspended: 'Suspended',
  rejected: 'Not approved',
};

export const PAYMENT_METHODS = [
  { value: 'mpesa', label: 'M-Pesa' },
  { value: 'tigopesa', label: 'Tigo Pesa (Mixx by Yas)' },
  { value: 'airtel_money', label: 'Airtel Money' },
  { value: 'halopesa', label: 'HaloPesa' },
  { value: 'bank_transfer', label: 'Bank transfer' },
] as const;

export function paymentMethodLabel(value: string): string {
  return PAYMENT_METHODS.find((m) => m.value === value)?.label ?? value.replace(/_/g, ' ');
}

/** Expiry reminder for the in-app bell: shown 7 days and 1 day before the trial/paid year ends, and once expired. */
export function expiryReminder(endIso: string | null | undefined, now: Date = new Date()): { level: 'week' | 'day' | 'expired'; days: number } | null {
  if (!endIso) return null;
  const d = daysLeft(endIso, now);
  if (d <= 0) return { level: 'expired', days: d };
  if (d <= 1) return { level: 'day', days: d };
  if (d <= 7) return { level: 'week', days: d };
  return null;
}
