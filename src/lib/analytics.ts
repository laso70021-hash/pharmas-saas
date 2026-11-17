import { recordDayKey } from './date-range';
import type { WsSale, WsExpense, WsBatch } from './pharmacy-types';

export type Granularity = 'day' | 'week' | 'month';
export interface SaleFilter { branchId?: string | null; productIds?: Set<string> | null }

/** Bucket key for a local calendar day key (YYYY-MM-DD). Weeks start Monday. */
export function bucketKey(dayKey: string, g: Granularity): string {
  if (g === 'day') return dayKey;
  if (g === 'month') return dayKey.slice(0, 7);
  const [y = 0, m = 1, d = 1] = dayKey.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - ((dt.getDay() + 6) % 7));
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

/** Revenue and cost of one sale, limited to the chosen products when a product filter is set. */
export function saleFigures(s: WsSale, productIds?: Set<string> | null) {
  if (!productIds) return { revenue: s.total, cost: s.items.reduce((a, i) => a + i.quantity * i.unit_cost, 0) };
  const items = s.items.filter((i) => i.product_id && productIds.has(i.product_id));
  return { revenue: items.reduce((a, i) => a + (i.line_total || 0), 0), cost: items.reduce((a, i) => a + i.quantity * i.unit_cost, 0) };
}

export function filterSales(sales: WsSale[], f: SaleFilter): WsSale[] {
  return sales.filter((s) => (!f.branchId || s.branch_id === f.branchId) && (!f.productIds || s.items.some((i) => i.product_id && f.productIds!.has(i.product_id))));
}

export interface TrendPoint { key: string; sales: number; gross: number; expenses: number; net: number; count: number }

export function trend(sales: WsSale[], expenses: WsExpense[], g: Granularity, productIds?: Set<string> | null): TrendPoint[] {
  const m = new Map<string, TrendPoint>();
  const get = (k: string) => m.get(k) ?? (m.set(k, { key: k, sales: 0, gross: 0, expenses: 0, net: 0, count: 0 }), m.get(k)!);
  for (const s of sales) {
    const d = recordDayKey(s.created_at); if (!d) continue;
    const p = get(bucketKey(d, g)); const f = saleFigures(s, productIds);
    p.sales += f.revenue; p.gross += f.revenue - f.cost; p.count += 1;
  }
  for (const e of expenses) {
    const d = recordDayKey(e.expense_date); if (!d) continue;
    get(bucketKey(d, g)).expenses += e.amount;
  }
  return [...m.values()].sort((a, b) => a.key.localeCompare(b.key)).map((p) => ({ ...p, net: p.gross - p.expenses }));
}

export function sumBy<T>(rows: T[], key: (r: T) => string, value: (r: T) => number) {
  const m = new Map<string, number>();
  for (const r of rows) m.set(key(r), (m.get(key(r)) || 0) + value(r));
  return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

/** Units and revenue per product across sales. */
export function productSales(sales: WsSale[], productIds?: Set<string> | null) {
  const m = new Map<string, { id: string; units: number; revenue: number }>();
  for (const s of sales) for (const i of s.items) {
    if (!i.product_id || (productIds && !productIds.has(i.product_id))) continue;
    const p = m.get(i.product_id) ?? { id: i.product_id, units: 0, revenue: 0 };
    p.units += i.quantity; p.revenue += i.line_total || 0; m.set(i.product_id, p);
  }
  return [...m.values()].sort((a, b) => b.revenue - a.revenue);
}

export const EXPIRY_BUCKETS = ['Expired', '0–30 days', '31–90 days', '91–180 days', '180+ days'] as const;
export function expiryBucket(days: number): (typeof EXPIRY_BUCKETS)[number] {
  if (days <= 0) return 'Expired';
  if (days <= 30) return '0–30 days';
  if (days <= 90) return '31–90 days';
  if (days <= 180) return '91–180 days';
  return '180+ days';
}
export function expiryAnalysis(batches: Pick<WsBatch, 'quantity' | 'days_to_expiry' | 'cost_per_unit'>[]) {
  return EXPIRY_BUCKETS.map((name) => {
    const rows = batches.filter((b) => b.quantity > 0 && expiryBucket(b.days_to_expiry) === name);
    return { name, batches: rows.length, value: rows.reduce((a, b) => a + b.quantity * b.cost_per_unit, 0) };
  });
}

export function toCsv(rows: Record<string, string | number>[]): string {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0] ?? {});
  const esc = (v: string | number) => { const t = String(v); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c] ?? '')).join(','))].join('\n');
}
