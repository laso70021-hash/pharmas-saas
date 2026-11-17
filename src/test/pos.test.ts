import { describe, expect, it } from 'vitest';
import { changeDue, drawerSummary } from '@/lib/workspace';

describe('cashier till', () => {
  it('expected cash counts only cash sales plus float', () => {
    const d = drawerSummary([{ total: 5000, payment_method: 'cash' }, { total: 3000, payment_method: 'mpesa' }], 10000, 14000);
    expect(d.expectedCash).toBe(15000);
    expect(d.overShort).toBe(-1000);
    expect(d.total).toBe(8000);
  });
  it('change due', () => {
    expect(changeDue(7500, 10000)).toBe(2500);
    expect(changeDue(7500, 5000)).toBeNull();
  });
});
