import { describe, it, expect } from 'vitest';
import { workedSeconds, breakSeconds, plannedMinutes } from '@/lib/shifts';
const base = { started_at: '2026-01-01T08:00:00Z', ended_at: '2026-01-01T16:00:00Z', break_seconds: 1800, break_started_at: null };
describe('shift timing', () => {
  it('worked time excludes breaks', () => expect(workedSeconds(base)).toBe(8 * 3600 - 1800));
  it('a running break counts toward break time', () => expect(breakSeconds({ ended_at: null, break_seconds: 600, break_started_at: '2026-01-01T10:00:00Z' }, Date.parse('2026-01-01T10:05:00Z'))).toBe(900));
  it('a running break is not worked time', () => expect(workedSeconds({ started_at: '2026-01-01T08:00:00Z', ended_at: null, break_seconds: 0, break_started_at: '2026-01-01T09:00:00Z' }, Date.parse('2026-01-01T09:30:00Z'))).toBe(3600));
  it('extensions add to planned time', () => expect(plannedMinutes({ scheduled_minutes: 480, extended_minutes: 60 })).toBe(540));
});
