import { describe, expect, it } from 'vitest';
import { can, isReadOnly, limitReached, profitSummary, stockState } from '@/lib/workspace';

describe('pharmacy workspace rules', () => {
  it('expired accounts become read-only for the owner', () => {
    expect(isReadOnly('expired', 'owner')).toBe(true);
    expect(can('owner', 'manageStock', 'expired')).toBe(false);
  });

  it('trial and paid accounts can be changed', () => {
    expect(can('owner', 'manageStock', 'trial')).toBe(true);
    expect(can('owner', 'manageBranches', 'active')).toBe(true);
  });

  it('the platform admin can act even when the account expired', () => {
    expect(can('admin', 'manageStaff', 'expired')).toBe(true);
  });

  it('only the owner (or admin) invites staff', () => {
    expect(can('manager', 'manageStaff', 'active')).toBe(false);
    expect(can('owner', 'manageStaff', 'active')).toBe(true);
  });

  it('cashiers sell but cannot change stock', () => {
    expect(can('cashier', 'sell', 'active')).toBe(true);
    expect(can('cashier', 'manageStock', 'active')).toBe(false);
  });

  it('Starter allows 1 branch and 3 staff; Enterprise is unlimited', () => {
    expect(limitReached(1, 1)).toBe(true);
    expect(limitReached(2, 3)).toBe(false);
    expect(limitReached(3, 3)).toBe(true);
    expect(limitReached(500, 999)).toBe(false);
  });

  it('net profit = sales − cost of items sold − expenses', () => {
    const s = profitSummary(
      [{ total: 10_000, created_at: '2026-11-01', items: [{ quantity: 4, unit_cost: 1_500 }] }],
      [2_000]
    );
    expect(s.grossProfit).toBe(4_000);
    expect(s.netProfit).toBe(2_000);
    expect(s.marginPct).toBe(20);
  });

  it('flags out-of-stock and low stock', () => {
    expect(stockState(0, 10)).toBe('out');
    expect(stockState(10, 10)).toBe('low');
    expect(stockState(11, 10)).toBe('ok');
  });
});
