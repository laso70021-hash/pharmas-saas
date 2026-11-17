// Matches a medicine a pharmacy needs against suppliers' published catalog items.
export interface RestockPrefill { name: string; generic?: string; strength?: string; quantity: number; branchId?: string }

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const words = (s: string) => norm(s).split(' ').filter((w) => w.length > 1);

/** Score 0..1 — 1 when every word of the needed name (and strength) is found in the item. 0 = no match. */
export function matchScore(need: { name: string; generic?: string | undefined; strength?: string | undefined }, item: { name: string; generic_name?: string; strength?: string }): number {
  const hay = ` ${norm(`${item.name} ${item.generic_name ?? ''} ${item.strength ?? ''}`)} `;
  const nameWords = words(need.name);
  const byName = nameWords.length ? nameWords.filter((w) => hay.includes(` ${w} `) || hay.includes(` ${w}`)).length / nameWords.length : 0;
  const byGeneric = need.generic && words(need.generic).length ? words(need.generic).every((w) => hay.includes(` ${w}`)) ? 0.9 : 0 : 0;
  let score = Math.max(byName, byGeneric);
  if (score < 0.6) return 0;
  const sw = need.strength ? words(need.strength) : [];
  if (sw.length && !sw.every((w) => hay.includes(` ${w}`))) score *= 0.7;
  return Math.round(score * 100) / 100;
}

/** Matching in-stock-first items, best match then cheapest. */
export function matchCatalog<T extends { name: string; generic_name?: string; strength?: string; unit_price: number; stock: number }>(need: RestockPrefill, catalog: T[]): (T & { score: number })[] {
  return catalog.map((c) => ({ ...c, score: matchScore(need, c) })).filter((c) => c.score > 0)
    .sort((a, b) => Number(b.stock > 0) - Number(a.stock > 0) || b.score - a.score || a.unit_price - b.unit_price);
}

export interface ListLine { name: string; strength?: string; quantity: number }
const HEAD = { name: ['name', 'product', 'medicine', 'item', 'product name', 'drug'], strength: ['strength', 'dose', 'dosage'], quantity: ['quantity', 'qty', 'units', 'amount', 'needed'] };

/** Turns spreadsheet rows (first row = headers, or plain "name, qty" rows) into purchase-list lines. */
export function parsePurchaseList(rows: string[][]): ListLine[] {
  const clean = rows.map((r) => r.map((c) => String(c ?? '').trim())).filter((r) => r.some(Boolean));
  if (!clean.length) return [];
  const h = clean[0]!.map((c) => c.toLowerCase());
  const col = (k: keyof typeof HEAD) => h.findIndex((c) => HEAD[k].includes(c));
  let ni = col('name'), si = col('strength'), qi = col('quantity'), body = clean.slice(1);
  if (ni < 0) { ni = 0; si = -1; qi = 1; body = clean; }
  const out = new Map<string, ListLine>();
  for (const r of body) {
    const name = r[ni] ?? ''; if (!name) continue;
    const qty = Math.max(1, Math.floor(Number(String(r[qi] ?? '').replace(/[^0-9.]/g, '')) || 1));
    const strength = si >= 0 ? r[si] || undefined : undefined;
    const key = norm(`${name} ${strength ?? ''}`);
    const prev = out.get(key);
    out.set(key, prev ? { ...prev, quantity: prev.quantity + qty } : { name, ...(strength ? { strength } : {}), quantity: qty });
  }
  return [...out.values()];
}

export interface PlanPick<T> { item: T; quantity: number }
/** For each line, fill the quantity from the best-matching suppliers (splitting when one runs short). */
export function planPurchase<T extends { product_id: string; supplier_id: string; name: string; generic_name?: string; strength?: string; unit_price: number; stock: number }>(lines: ListLine[], catalog: T[]) {
  return lines.map((line) => {
    let left = line.quantity; const picks: PlanPick<T>[] = [];
    for (const c of matchCatalog(line, catalog)) {
      if (left <= 0 || c.stock <= 0) break;
      const n = Math.min(left, c.stock); picks.push({ item: c, quantity: n }); left -= n;
    }
    return { line, picks, missing: left, exact: picks.every((p) => (p.item as T & { score: number }).score >= 1) };
  });
}
