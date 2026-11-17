import { describe, it, expect } from 'vitest';
import { expiryTier, reorderQty } from '@/lib/stock-alerts';
describe('stock alerts', () => {
  it('six months tier', () => { expect(expiryTier(150)).toBe('six_months'); expect(expiryTier(183)).toBe('one_year'); });
  it('one year tier', () => { expect(expiryTier(365)).toBe('one_year'); expect(expiryTier(366)).toBe('ok'); });
  it('expired and critical', () => { expect(expiryTier(0)).toBe('expired'); expect(expiryTier(90)).toBe('critical'); });
  it('reorder to twice minimum', () => { expect(reorderQty(3, 10)).toBe(17); expect(reorderQty(-2, 5)).toBe(10); });
});
