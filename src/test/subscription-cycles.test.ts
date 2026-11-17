import { describe, expect, it } from 'vitest';
import { cyclePrice, effectiveStatus, extendEnd, isExpiringSoon } from '@/lib/billing';
import { PLAN_AI_TOKENS } from '@/lib/pharmacy-service';

const now = new Date('2026-11-16T12:00:00Z');
const essential = { slug: 'starter', price_tzs_monthly: 15000, price_tzs_annual: 165000 };

describe('subscription cycles', () => {
  it('monthly payment costs the monthly price, yearly the stored yearly total', () => {
    expect(cyclePrice(essential, 'monthly')).toBe(15000);
    expect(cyclePrice(essential, 'annual')).toBe(165000);
  });
  it('a paid account expires automatically after its end date', () => {
    expect(effectiveStatus({ status: 'active', subscription_ends_at: '2026-11-15T00:00:00Z' }, now)).toBe('expired');
  });
  it('accounts ending within 7 days are flagged as expiring', () => {
    expect(isExpiringSoon({ status: 'active', subscription_ends_at: '2026-11-20T00:00:00Z' }, now)).toBe(true);
    expect(isExpiringSoon({ status: 'trial', trial_ends_at: '2026-12-10T00:00:00Z' }, now)).toBe(false);
  });
  it('extending adds one month after a still-running end date', () => {
    expect(extendEnd('2026-12-01T00:00:00Z', 'monthly', now).toISOString().slice(0, 10)).toBe('2027-01-01');
  });
  it('plan token allowances', () => {
    expect(PLAN_AI_TOKENS).toEqual({ starter: 25000, growth: 100000, professional: 300000, network: 750000, enterprise: null });
  });
});
