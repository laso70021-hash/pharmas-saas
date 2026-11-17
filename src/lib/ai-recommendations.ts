export type AlertProduct = { id: string; pharmacy_id: string | null; name: string; min_stock_level: number | null };
export type AlertBatch = { product_id: string; quantity: number; expiry_date: string };
export function operationalRecommendations(products: AlertProduct[], batches: AlertBatch[], today: string) {
  const end = new Date(`${today}T00:00:00Z`); end.setUTCDate(end.getUTCDate() + 90);
  const horizon = end.toISOString().slice(0, 10);
  return products.flatMap(p => {
    const stock = batches.filter(b => b.product_id === p.id && b.quantity > 0);
    const usable = stock.filter(b => b.expiry_date >= today).reduce((n, b) => n + b.quantity, 0);
    const expired = stock.filter(b => b.expiry_date < today).reduce((n, b) => n + b.quantity, 0);
    const expiring = stock.filter(b => b.expiry_date >= today && b.expiry_date <= horizon).reduce((n, b) => n + b.quantity, 0);
    const base = { product_id: p.id, pharmacy_id: p.pharmacy_id };
    return [
      ...(usable <= (p.min_stock_level ?? 0) ? [{ ...base, key: `${p.id}:inventory`, title: `Restock ${p.name}`, description: `${usable} usable units; minimum ${p.min_stock_level ?? 0}. Review supplier availability.`, category: 'inventory' as const, severity: 'action' as const }] : []),
      ...(expired > 0 ? [{ ...base, key: `${p.id}:safety`, title: `Quarantine expired ${p.name}`, description: `${expired} expired units. Do not dispense; review disposal with the pharmacist.`, category: 'safety' as const, severity: 'urgent' as const }] : []),
      ...(expiring > 0 ? [{ ...base, key: `${p.id}:expiry`, title: `Expiry review: ${p.name}`, description: `${expiring} units expire within 90 days. Use first-expiry-first-out for clinically appropriate sales.`, category: 'expiry' as const, severity: 'review' as const }] : []),
    ];
  });
}