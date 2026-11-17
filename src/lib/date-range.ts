// Date-range filtering shared by the dashboards.
// Ranges are inclusive calendar days stored as "YYYY-MM-DD" (local time).

export type DatePreset = 'today' | 'last7' | 'last30' | 'thisMonth' | 'thisYear' | 'all' | 'custom';

export interface DateRange {
  preset: DatePreset;
  /** Inclusive start day "YYYY-MM-DD"; null = no lower bound */
  from: string | null;
  /** Inclusive end day "YYYY-MM-DD"; null = no upper bound */
  to: string | null;
}

export const DATE_PRESETS: { id: DatePreset; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'last7', label: 'Last 7 days' },
  { id: 'last30', label: 'Last 30 days' },
  { id: 'thisMonth', label: 'This month' },
  { id: 'thisYear', label: 'This year' },
  { id: 'all', label: 'All time' },
  { id: 'custom', label: 'Custom' }
];

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

export function toDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(d: Date, days: number): Date {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  copy.setDate(copy.getDate() + days);
  return copy;
}

/**
 * Turns a record date into a "YYYY-MM-DD" day key.
 * Accepts ISO strings ("2026-11-01", "2026-11-01T10:00:00Z") and display dates ("01 Nov 2026").
 */
export function recordDayKey(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();

  const display = /^(\d{1,2})\s+([A-Za-z]{3})[A-Za-z]*\s+(\d{4})/.exec(trimmed);
  if (display) {
    const [, day = '', mon = '', year = ''] = display;
    const month = MONTHS.indexOf(mon.toLowerCase());
    if (month === -1) return null;
    return `${year}-${String(month + 1).padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // Plain date with no time: take as-is (no timezone shift)
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  const parsed = new Date(trimmed);
  if (isNaN(parsed.getTime())) return null;
  return toDayKey(parsed);
}

export function presetRange(preset: DatePreset, now: Date = new Date()): DateRange {
  const today = toDayKey(now);
  switch (preset) {
    case 'today':
      return { preset, from: today, to: today };
    case 'last7':
      return { preset, from: toDayKey(addDays(now, -6)), to: today };
    case 'last30':
      return { preset, from: toDayKey(addDays(now, -29)), to: today };
    case 'thisMonth':
      return { preset, from: toDayKey(new Date(now.getFullYear(), now.getMonth(), 1)), to: today };
    case 'thisYear':
      return { preset, from: `${now.getFullYear()}-01-01`, to: today };
    case 'all':
    case 'custom':
    default:
      return { preset: preset === 'custom' ? 'custom' : 'all', from: null, to: null };
  }
}

/** Builds a custom range; swaps the ends if "from" is after "to". */
export function customRange(from: string | null, to: string | null): DateRange {
  const f = from || null;
  const t = to || null;
  if (f && t && f > t) return { preset: 'custom', from: t, to: f };
  return { preset: 'custom', from: f, to: t };
}

export function isInRange(value: string | null | undefined, range: DateRange | null): boolean {
  if (!range || (!range.from && !range.to)) return true;
  const key = recordDayKey(value);
  if (!key) return false;
  if (range.from && key < range.from) return false;
  if (range.to && key > range.to) return false;
  return true;
}

export function filterByRange<T>(items: T[], getDate: (item: T) => string | null | undefined, range: DateRange | null): T[] {
  if (!range || (!range.from && !range.to)) return items;
  return items.filter((item) => isInRange(getDate(item), range));
}

export function formatDayKey(key: string | null): string {
  if (!key) return '—';
  const [y, m, d] = key.split('-');
  const month = MONTHS[Number(m) - 1] ?? '';
  return `${d} ${month.charAt(0).toUpperCase()}${month.slice(1)} ${y}`;
}

export function rangeLabel(range: DateRange | null): string {
  if (!range || (!range.from && !range.to)) return 'All time';
  return `${formatDayKey(range.from)} – ${formatDayKey(range.to)}`;
}
