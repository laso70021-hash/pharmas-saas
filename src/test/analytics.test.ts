import { describe, it, expect } from 'vitest';
import { bucketKey, trend, expiryBucket, saleFigures, filterSales } from '@/lib/analytics';
import type { WsSale } from '@/lib/pharmacy-types';

const sale = (id: string, d: string, branch: string, items: { p: string; q: number; c: number; t: number }[]): WsSale => ({
  id, invoice_number: id, branch_id: branch, payment_method: 'cash', created_at: d,
  total: items.reduce((a, i) => a + i.t, 0), items: items.map((i) => ({ product_id: i.p, quantity: i.q, unit_cost: i.c, line_total: i.t })),
});

describe('analytics', () => {
  it('weeks start on Monday and months group by month', () => {
    expect(bucketKey('2026-11-15', 'week')).toBe('2026-11-09');
    expect(bucketKey('2026-11-09', 'week')).toBe('2026-11-09');
    expect(bucketKey('2026-11-15', 'month')).toBe('2026-11');
  });
  it('net profit = sales - cost of goods - expenses per period', () => {
    const t = trend([sale('a', '2026-11-10T10:00:00', 'b1', [{ p: 'x', q: 2, c: 100, t: 500 }])],
      [{ id: 'e', category: 'Rent', amount: 150, description: '', expense_date: '2026-11-10', created_at: '' }], 'day');
    expect(t[0]).toMatchObject({ sales: 500, gross: 300, expenses: 150, net: 150 });
  });
  it('product filter counts only the chosen product lines', () => {
    const s = sale('a', '2026-11-10T10:00:00', 'b1', [{ p: 'x', q: 1, c: 50, t: 100 }, { p: 'y', q: 1, c: 10, t: 40 }]);
    expect(saleFigures(s, new Set(['y']))).toEqual({ revenue: 40, cost: 10 });
    expect(filterSales([s], { branchId: 'b2' })).toHaveLength(0);
  });
  it('expiry buckets', () => {
    expect(expiryBucket(0)).toBe('Expired');
    expect(expiryBucket(30)).toBe('0–30 days');
    expect(expiryBucket(91)).toBe('91–180 days');
  });
});
