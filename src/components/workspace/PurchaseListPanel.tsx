import { useState } from 'react';
import Papa from 'papaparse';
import { toast } from 'sonner';
import { FileUp, CheckCircle2, AlertTriangle, ShoppingCart, X } from 'lucide-react';
import type { CatalogItem } from '@/lib/pharmacy-service';
import { formatNumber } from '@/lib/utils';
import { parsePurchaseList, planPurchase } from '@/lib/supplier-match';
import { primaryBtn, ghostBtn, cardCls } from './ws-ui';

export type PurchasePlan = ReturnType<typeof planPurchase<CatalogItem>>;

async function readRows(f: File): Promise<string[][]> {
  const n = f.name.toLowerCase();
  if (n.endsWith('.csv') || n.endsWith('.txt')) return Papa.parse<string[]>(await f.text(), { skipEmptyLines: 'greedy' }).data;
  if (n.endsWith('.xlsx')) { const { readSheet } = await import('read-excel-file/browser'); return (await readSheet(f)).map((r) => r.map((v) => String(v ?? ''))); }
  throw new Error('Use a .csv or .xlsx file');
}

export function PurchaseListPanel({ catalog, plan, setPlan, ordered, onOrderSupplier, readOnly }: {
  catalog: CatalogItem[]; plan: PurchasePlan | null; setPlan: (p: PurchasePlan | null) => void; ordered: Set<string>;
  onOrderSupplier: (supplierId: string, picks: { item: CatalogItem; quantity: number }[]) => void; readOnly: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const upload = async (f?: File) => {
    if (!f) return; setBusy(true);
    try {
      const lines = parsePurchaseList(await readRows(f));
      if (!lines.length) throw new Error('No products found in the file');
      setPlan(planPurchase(lines, catalog));
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not read file'); } finally { setBusy(false); }
  };
  const template = () => {
    const url = URL.createObjectURL(new Blob(['product,strength,quantity\nParacetamol,500mg,100\nAmoxicillin,250mg,50\n'], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = 'purchase-list-template.csv'; a.click(); URL.revokeObjectURL(url);
  };

  if (!plan) return (
    <div className={`${cardCls} p-4 flex flex-wrap items-center gap-3`}>
      <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center"><FileUp className="w-5 h-5" /></div>
      <div className="flex-1 min-w-[200px]"><div className="font-black text-sm">Upload a shopping list</div>
        <div className="text-xs text-slate-500">CSV or Excel with product, strength and quantity — we find the best suppliers for every line.</div></div>
      <button className={ghostBtn} onClick={template}>Template</button>
      <label className={`${primaryBtn} cursor-pointer ${busy || readOnly ? 'opacity-50 pointer-events-none' : ''}`}><FileUp className="w-3.5 h-3.5" />{busy ? 'Reading…' : 'Upload list'}
        <input type="file" accept=".csv,.xlsx,.txt" className="hidden" onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ''; }} /></label>
    </div>);

  const groups = new Map<string, { name: string; picks: { item: CatalogItem; quantity: number }[] }>();
  for (const r of plan) for (const p of r.picks) {
    const g = groups.get(p.item.supplier_id) ?? { name: p.item.supplier_name, picks: [] };
    g.picks.push(p); groups.set(p.item.supplier_id, g);
  }
  const missing = plan.filter((r) => r.missing > 0);
  return (
    <div className={`${cardCls} p-4 space-y-4`}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1"><div className="font-black text-sm">Shopping list · {plan.length} products · {groups.size} supplier{groups.size === 1 ? '' : 's'}</div>
          <div className="text-xs text-slate-500">Each supplier gets its own order. Send them one by one.</div></div>
        <button className={ghostBtn} onClick={() => setPlan(null)}><X className="w-3.5 h-3.5" /> Clear list</button>
      </div>
      <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="text-left text-slate-500 border-b"><th className="py-1.5">Needed</th><th>Qty</th><th>Matched to</th><th className="text-right">Status</th></tr></thead>
        <tbody>{plan.map((r, i) => <tr key={i} className="border-b last:border-0 align-top">
          <td className="py-1.5 font-bold">{r.line.name} {r.line.strength}</td><td>{r.line.quantity}</td>
          <td>{r.picks.length ? r.picks.map((p) => <div key={p.item.product_id}>{p.quantity} × {p.item.name} {p.item.strength} — {p.item.supplier_name} @ TZS {formatNumber(p.item.unit_price)}</div>) : <span className="text-slate-400">No supplier has it</span>}</td>
          <td className="text-right whitespace-nowrap">{r.missing > 0 ? <span className="text-red-600 font-bold inline-flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{r.missing} short</span>
            : r.exact ? <span className="text-emerald-600 font-bold inline-flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Covered</span>
            : <span className="text-amber-600 font-bold">Check match</span>}</td></tr>)}</tbody></table></div>
      {missing.length > 0 && <div className="text-xs text-red-600">{missing.length} product{missing.length === 1 ? '' : 's'} can't be fully covered by current supplier stock.</div>}
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {[...groups].map(([id, g]) => {
          const total = g.picks.reduce((a, p) => a + p.quantity * p.item.unit_price, 0);
          const done = ordered.has(id);
          return <div key={id} className="rounded-xl border border-slate-200 p-3 space-y-2">
            <div className="font-black text-sm">{g.name}</div>
            <div className="text-xs text-slate-500">{g.picks.length} item{g.picks.length === 1 ? '' : 's'} · TZS {formatNumber(total)}</div>
            {done ? <div className="text-xs font-bold text-emerald-600 inline-flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" />Order sent</div>
              : <button disabled={readOnly} className={primaryBtn} onClick={() => onOrderSupplier(id, g.picks)}><ShoppingCart className="w-3.5 h-3.5" /> Review & order</button>}
          </div>;
        })}
      </div>
    </div>);
}
