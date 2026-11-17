import { describe, expect, it } from 'vitest';
import { customRange, filterByRange, isInRange, presetRange, recordDayKey } from '@/lib/date-range';

const NOW = new Date(2026, 10, 10, 11, 0); // 10 Nov 2026

describe('date range filter', () => {
  it('reads both display dates and ISO dates', () => {
    expect(recordDayKey('02 Oct 2026')).toBe('2026-10-02');
    expect(recordDayKey('2026-11-01')).toBe('2026-11-01');
  });

  it('last 30 days covers today and the 29 days before it', () => {
    expect(presetRange('last30', NOW)).toEqual({ preset: 'last30', from: '2026-10-12', to: '2026-11-10' });
  });

  it('includes records on the start and end days', () => {
    const range = customRange('2026-10-02', '2026-11-01');
    expect(isInRange('02 Oct 2026', range)).toBe(true);
    expect(isInRange('01 Nov 2026', range)).toBe(true);
    expect(isInRange('01 Oct 2026', range)).toBe(false);
    expect(isInRange('02 Nov 2026', range)).toBe(false);
  });

  it('swaps a reversed custom range', () => {
    expect(customRange('2026-11-05', '2026-11-01')).toEqual({ preset: 'custom', from: '2026-11-01', to: '2026-11-05' });
  });

  it('all time keeps every record', () => {
    const rows = [{ d: '01 Jan 2020' }, { d: '10 Nov 2026' }];
    expect(filterByRange(rows, (r) => r.d, presetRange('all', NOW))).toHaveLength(2);
  });
});
