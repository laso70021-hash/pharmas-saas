import { describe, it, expect } from 'vitest';
import { batchStatus, availableUnits, notificationGroup } from '@/lib/supplier-portal';
const today = new Date('2026-11-13T10:00:00');
describe('supplier portal rules', () => {
  it('expired batches are expired and never available', () => {
    const b = [{ qty: 100, expiry: '2026-11-12', min: 10 }, { qty: 50, expiry: '2027-12-01', min: 10 }];
    expect(batchStatus(b[0]!, today)).toBe('expired');
    expect(availableUnits(b, today)).toBe(50);
  });
  it('within 90 days is near expiry', () => { expect(batchStatus({ qty: 100, expiry: '2027-02-10', min: 10 }, today)).toBe('near_expiry'); });
  it('at or below minimum is low stock', () => { expect(batchStatus({ qty: 10, expiry: '2028-01-01', min: 10 }, today)).toBe('low'); });
  it('groups notifications', () => {
    expect(notificationGroup('wholesale', 'New wholesale order')).toBe('order');
    expect(notificationGroup('info', 'Payment receipt submitted')).toBe('payment');
  });
});
