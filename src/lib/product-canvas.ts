import type { WsBatch, WsProduct } from './pharmacy-types';

export const EXPIRING_SOON_DAYS = 90;
export type CanvasFilter = 'instock' | 'all' | 'out' | 'expiring' | 'expired';

/** Markup on cost: (sell - cost) / cost. */
export const costMarkup = (cost: number, sell: number) => (cost > 0 ? ((sell - cost) / cost) * 100 : 0);
/** Margin on price: (sell - cost) / sell. */
export const profitMargin = (cost: number, sell: number) => (sell > 0 ? ((sell - cost) / sell) * 100 : 0);

export interface CanvasRow {
  key: string; product: WsProduct; batch: WsBatch | null;
  quantity: number; cost: number; sell: number; markup: number; margin: number;
}

export function canvasKpis(products: WsProduct[], batches: WsBatch[]) {
  const sellById = new Map(products.map((p) => [p.id, p.selling_price]));
  const live = batches.filter((b) => b.quantity > 0 && b.days_to_expiry >= 0);
  return {
    sellingValue: live.reduce((a, b) => a + b.quantity * (sellById.get(b.product_id) || 0), 0),
    buyingValue: live.reduce((a, b) => a + b.quantity * b.cost_per_unit, 0),
    inStock: products.filter((p) => p.stock > 0).length,
    outOfStock: products.filter((p) => p.is_active && p.stock <= 0).length,
    expiringSoon: live.filter((b) => b.days_to_expiry <= EXPIRING_SOON_DAYS).length,
    expired: batches.filter((b) => b.quantity > 0 && b.days_to_expiry < 0).length,
  };
}

export function canvasRows(products: WsProduct[], batches: WsBatch[], filter: CanvasFilter): CanvasRow[] {
  const byId = new Map(products.map((p) => [p.id, p]));
  const fromBatch = (b: WsBatch): CanvasRow | null => {
    const p = byId.get(b.product_id); if (!p) return null;
    const cost = b.cost_per_unit || p.cost_price;
    return { key: b.id, product: p, batch: b, quantity: b.quantity, cost, sell: p.selling_price, markup: costMarkup(cost, p.selling_price), margin: profitMargin(cost, p.selling_price) };
  };
  const fromProduct = (p: WsProduct): CanvasRow => ({ key: p.id, product: p, batch: null, quantity: p.stock, cost: p.cost_price, sell: p.selling_price, markup: costMarkup(p.cost_price, p.selling_price), margin: profitMargin(p.cost_price, p.selling_price) });
  const pick = (f: (b: WsBatch) => boolean) => batches.filter(f).map(fromBatch).filter((r): r is CanvasRow => !!r);
  if (filter === 'instock') return pick((b) => b.quantity > 0 && b.days_to_expiry >= 0);
  if (filter === 'expiring') return pick((b) => b.quantity > 0 && b.days_to_expiry >= 0 && b.days_to_expiry <= EXPIRING_SOON_DAYS);
  if (filter === 'expired') return pick((b) => b.quantity > 0 && b.days_to_expiry < 0);
  if (filter === 'out') return products.filter((p) => p.is_active && p.stock <= 0).map(fromProduct);
  return products.map(fromProduct);
}
