import { describe, expect, it } from 'vitest';
import { expiryReminder } from '@/lib/billing';
const now = new Date('2026-11-10T12:00:00Z');
const plus = (d: number) => new Date(now.getTime() + d * 86400000).toISOString();
describe('expiry reminders', () => {
  it('none beyond 7 days', () => expect(expiryReminder(plus(10), now)).toBeNull());
  it('week warning at 7 days', () => expect(expiryReminder(plus(7), now)?.level).toBe('week'));
  it('day warning at 1 day', () => expect(expiryReminder(plus(1), now)?.level).toBe('day'));
  it('expired after end', () => expect(expiryReminder(plus(-2), now)?.level).toBe('expired'));
});
