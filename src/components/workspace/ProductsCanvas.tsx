import { useMemo, useState } from 'react';
import { Tag, CircleDollarSign, ShoppingBag, AlertTriangle, CalendarClock, CalendarX, Search, ArrowUpDown, Pill, Eye, MoreVertical, Building2, LayoutGrid, Layers, CalendarDays, Download, ArrowUp, Check } from 'lucide-react';
import type { WsBatch, WsProduct } from '@/lib/pharmacy-types';
import { canvasKpis, canvasRows, type CanvasFilter, type CanvasRow } from '@/lib/product-canvas';
import { filterByRange, type DateRange } from '@/lib/date-range';
import { formatNumber } from '@/lib/utils';
import { cardCls } from './ws-ui';

type SortKey = 'name' | 'quantity' | 'unit' | 'cost' | 'sell' | 'markup' | 'margin' | 'batch';
const pct = (n: number) => `${n.toFixed(2)}%`;
const TONES = ['bg-blue-50 text-blue-600', 'bg-purple-50 text-purple-600', 'bg-emerald-50 text-emerald-600', 'bg-sky-50 text-sky-600', 'bg-rose-50 text-rose-600', 'bg-amber-50 text-amber-600'];
const pillCls = 'h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30';

export function ProductsCanvas({ products, batches, branches, onEdit, onStock, editable }: {
  products: WsProduct[]; batches: WsBatch[]; branches: { id: string; name: string }[];
  onEdit: (p: WsProduct) => void; onStock: (p: WsProduct) => void; editable: boolean;
}) {
  const [filter, setFilter] = useState<CanvasFilter>('all');
  const [q, setQ] = useState('');
  const [branch, setBranch] = useState('');
  const [category, setCategory] = useState('');
  const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const [sort, setSort] = useState<{ k: SortKey; asc: boolean }>({ k: 'name', asc: true });
  const [size, setSize] = useState(20); const [page, setPage] = useState(1);
  const [menu, setMenu] = useState<string | null>(null);
  const [viewing, setViewing] = useState<CanvasRow | null>(null);

  const bBatches = useMemo(() => batches.filter((b) => !branch || b.branch_id === branch), [batches, branch]);
  const k = canvasKpis(products, bBatches);
  const categories = useMemo(() => [...new Set(products.map((p) => p.category).filter(Boolean) as string[])].sort(), [products]);
  const now = new Date(); const thisMonth = products.filter((p) => { const d = new Date(p.created_at); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); }).length;

  const rows = useMemo(() => {
    let r = canvasRows(products, bBatches, filter).map((x) => {
      if (x.batch) return x;
      const qty = branch ? (x.product.stock_by_branch[branch] || 0) : x.quantity;
      const latest = bBatches.filter((b) => b.product_id === x.product.id && b.quantity > 0).sort((a, b) => a.expiry_date.localeCompare(b.expiry_date))[0] ?? null;
      return { ...x, quantity: qty, batch: latest };
    });
    if (category) r = r.filter((x) => x.product.category === category);
    r = r.filter((x) => `${x.product.name} ${x.product.generic_name} ${x.product.sku} ${x.product.barcode ?? ''} ${x.batch?.batch_number ?? ''}`.toLowerCase().includes(q.toLowerCase()));
    if (from || to) {
      const range: DateRange = { preset: 'custom', from: from || null, to: to || null };
      r = filterByRange(r, (x: CanvasRow) => x.batch?.received_date || x.batch?.created_at || x.product.created_at, range);
    }
    const val = (x: CanvasRow): string | number => ({ name: x.product.name, quantity: x.quantity, unit: x.product.dosage_form, cost: x.cost, sell: x.sell, markup: x.markup, margin: x.margin, batch: x.batch?.batch_number ?? '' })[sort.k];
    return [...r].sort((a, b) => { const A = val(a), B = val(b); const c = typeof A === 'number' ? A - (B as number) : String(A).localeCompare(String(B)); return sort.asc ? c : -c; });
  }, [products, bBatches, filter, q, from, to, sort, category, branch]);

  const pages = Math.max(1, Math.ceil(rows.length / size));
  const cur = Math.min(page, pages);
  const shown = rows.slice((cur - 1) * size, cur * size);
  const reset = () => setPage(1);
  const th = (label: string, key: SortKey) => (
    <th className="py-3.5 px-3 font-bold whitespace-nowrap"><button onClick={() => setSort((s) => ({ k: key, asc: s.k === key ? !s.asc : true }))} className="inline-flex items-center gap-1">{label}<ArrowUpDown className="w-3 h-3 opacity-70" /></button></th>);

  const download = () => {
    const head = ['S/N', 'Product', 'Generic', 'Quantity', 'Selling Unit', 'Buying Price (TZS)', 'Selling Price (TZS)', 'Cost Markup %', 'Profit Margin %', 'Batch No'];
    const body = rows.map((r, i) => [i + 1, r.product.name, r.product.generic_name, r.quantity, r.product.dosage_form, r.cost, r.sell, r.markup.toFixed(2), r.margin.toFixed(2), r.batch?.batch_number ?? '']);
    const csv = [head, ...body].map((l) => l.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'pharmacy-products.csv'; a.click(); URL.revokeObjectURL(a.href);
  };

  const card = (label: string, value: string, sub: React.ReactNode, Icon: typeof Tag, tone: string, f?: CanvasFilter) => (
    <button type="button" onClick={() => { if (f) { setFilter(filter === f ? 'all' : f); reset(); } }} className={`${cardCls} p-4 text-left ${f ? 'hover:border-blue-300' : 'cursor-default'} ${f && filter === f ? 'ring-2 ring-blue-500/30 border-blue-300' : ''}`}>
      <div className="flex items-start gap-3"><div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${tone}`}><Icon className="w-5 h-5" /></div><span className="text-sm font-semibold text-slate-800 leading-snug">{label}</span></div>
      <div className="mt-3 text-2xl font-black text-slate-900 tracking-tight">{value}</div>
      <div className="text-xs mt-1">{sub}</div>
    </button>);
  const up = (t: string, c: string) => <span className={`inline-flex items-center gap-1 font-semibold ${c}`}><ArrowUp className="w-3 h-3" />{t}</span>;

  const nums = (() => {
    const s = Math.min(Math.max(1, cur - 2), Math.max(1, pages - 4));
    return Array.from({ length: Math.min(5, pages) }, (_, i) => s + i);
  })();

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {card('Total Stock Value (Selling)', `TZS ${formatNumber(k.sellingValue)}`, <span className="text-slate-500">All Products</span>, Tag, 'bg-purple-50 text-purple-600')}
        {card('Total Stock Value (Buying)', `TZS ${formatNumber(k.buyingValue)}`, <span className="text-slate-500">All Products</span>, CircleDollarSign, 'bg-emerald-50 text-emerald-600')}
        {card('Total Products', formatNumber(products.length), up(`+${thisMonth} this month`, 'text-emerald-600'), ShoppingBag, 'bg-blue-50 text-blue-600', 'all')}
        {card('Out of Stock', formatNumber(k.outOfStock), <span className="text-rose-600 font-semibold">{k.outOfStock} items</span>, AlertTriangle, 'bg-amber-50 text-amber-600', 'out')}
        {card('Expiring Soon (≤ 90 days)', formatNumber(k.expiringSoon), <span className="text-rose-600 font-semibold">{k.expiringSoon} batches</span>, CalendarClock, 'bg-rose-50 text-rose-600', 'expiring')}
        {card('Expired Products', formatNumber(k.expired), k.expired ? <span className="text-rose-600 font-semibold">{k.expired} batches</span> : <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold"><Check className="w-3 h-3" />No expired items</span>, CalendarX, 'bg-slate-100 text-slate-700', 'expired')}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]"><Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" /><input className={`${pillCls} w-full pl-9 font-normal`} placeholder="Search products by name, SKU or barcode..." value={q} onChange={(e) => { setQ(e.target.value); reset(); }} /></div>
        <label className="relative"><Building2 className="w-4 h-4 absolute left-3 top-3 text-slate-500" /><select aria-label="Branch" className={`${pillCls} pl-9 w-44`} value={branch} onChange={(e) => { setBranch(e.target.value); reset(); }}><option value="">All branches</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
        <label className="relative"><LayoutGrid className="w-4 h-4 absolute left-3 top-3 text-slate-500" /><select aria-label="Category" className={`${pillCls} pl-9 w-44`} value={category} onChange={(e) => { setCategory(e.target.value); reset(); }}><option value="">All categories</option>{categories.map((c) => <option key={c}>{c}</option>)}</select></label>
        <label className="relative"><Layers className="w-4 h-4 absolute left-3 top-3 text-slate-500" /><select aria-label="Stock status" className={`${pillCls} pl-9 w-48`} value={filter} onChange={(e) => { setFilter(e.target.value as CanvasFilter); reset(); }}>
          <option value="all">All stock status</option><option value="instock">In stock</option><option value="out">Out of stock</option><option value="expiring">Expiring soon</option><option value="expired">Expired</option></select></label>
        <div className={`${pillCls} flex items-center gap-2 font-normal`}><CalendarDays className="w-4 h-4 text-slate-500" />
          <span className="font-semibold">From:</span><input aria-label="From date" type="date" className="bg-transparent outline-none text-sm" value={from} onChange={(e) => { setFrom(e.target.value); reset(); }} />
          <span className="font-semibold">To:</span><input aria-label="To date" type="date" className="bg-transparent outline-none text-sm" value={to} onChange={(e) => { setTo(e.target.value); reset(); }} /></div>
        <button onClick={download} disabled={!rows.length} title="Download CSV" className={`${pillCls} inline-flex items-center gap-1.5 text-blue-700 border-blue-200 disabled:opacity-50`}><Download className="w-4 h-4" /> CSV</button>
      </div>

      <div className={`${cardCls} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[1040px]">
            <thead className="bg-blue-800 text-white"><tr><th className="py-3.5 px-4 font-bold">S/N</th>{th('Product Details', 'name')}{th('Quantity', 'quantity')}{th('Selling Unit', 'unit')}{th('Buying Price (TZS)', 'cost')}{th('Selling Price (TZS)', 'sell')}{th('Cost Markup', 'markup')}{th('Profit Margin', 'margin')}{th('Batch No', 'batch')}<th className="py-3.5 px-3 font-bold text-center">Actions</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {shown.length === 0 ? <tr><td colSpan={10} className="py-12 text-center text-slate-400 font-semibold">No products match these filters.</td></tr> : shown.map((r, i) => (
                <tr key={r.key} className="hover:bg-slate-50/70">
                  <td className="py-3 px-4 text-slate-700">{(cur - 1) * size + i + 1}</td>
                  <td className="px-3 py-2.5"><div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg overflow-hidden flex items-center justify-center shrink-0 ${TONES[((cur - 1) * size + i) % TONES.length]}`}>{r.product.image_src ? <img src={r.product.image_src} alt={r.product.name} className="w-full h-full object-cover" loading="lazy" /> : <Pill className="w-4 h-4" />}</div>
                    <div><div className="font-bold text-slate-900">{r.product.name}</div><div className="text-xs text-slate-500">{[r.product.generic_name, r.product.strength].filter(Boolean).join(' ') || 'Medicine'}</div></div></div></td>
                  <td className="px-3">{r.quantity <= 0 ? <span className="inline-block min-w-7 text-center rounded-md bg-rose-50 text-rose-600 font-bold px-2 py-0.5">0</span> : <span className="text-slate-800">{formatNumber(r.quantity)}</span>}</td>
                  <td className="px-3 text-slate-700">{r.product.dosage_form || '—'}</td>
                  <td className="px-3 text-slate-800">TZS {formatNumber(r.cost)}</td><td className="px-3 text-slate-800">TZS {formatNumber(r.sell)}</td>
                  <td className={`px-3 font-semibold ${r.markup >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{pct(r.markup)}</td>
                  <td className={`px-3 font-semibold ${r.margin >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{pct(r.margin)}</td>
                  <td className="px-3 text-slate-700">{r.batch?.batch_number ?? '—'}</td>
                  <td className="px-3"><div className="flex justify-center gap-2 relative">
                    <button aria-label={`View ${r.product.name}`} onClick={() => setViewing(r)} className="w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center text-blue-600 hover:bg-blue-50"><Eye className="w-4 h-4" /></button>
                    <button aria-label={`More actions for ${r.product.name}`} onClick={() => setMenu(menu === r.key ? null : r.key)} className="w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50"><MoreVertical className="w-4 h-4" /></button>
                    {menu === r.key && <div className="absolute right-0 top-10 z-20 w-44 bg-white border border-slate-200 rounded-xl shadow-lg py-1 text-left text-sm" onMouseLeave={() => setMenu(null)}>
                      <button className="w-full text-left px-3 py-2 hover:bg-slate-50" onClick={() => { setViewing(r); setMenu(null); }}>View details</button>
                      {editable && <button className="w-full text-left px-3 py-2 hover:bg-slate-50" onClick={() => { onEdit(r.product); setMenu(null); }}>Edit product</button>}
                      {editable && <button className="w-full text-left px-3 py-2 hover:bg-slate-50" onClick={() => { onStock(r.product); setMenu(null); }}>Receive stock</button>}
                      <button className="w-full text-left px-3 py-2 hover:bg-slate-50" onClick={() => { setViewing({ ...r }); setMenu(null); }}>Stock history</button>
                    </div>}
                  </div></td>
                </tr>))}
            </tbody>
          </table>
        </div>
        <div className="p-4 flex flex-wrap items-center justify-between gap-3 text-sm border-t border-slate-200">
          <span className="text-slate-700">Showing {rows.length ? (cur - 1) * size + 1 : 0} – {Math.min(cur * size, rows.length)} of {formatNumber(rows.length)} products</span>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2">Rows per page:<select className={`${pillCls} w-20`} value={size} onChange={(e) => { setSize(Number(e.target.value)); reset(); }}>{[20, 50, 100].map((n) => <option key={n}>{n}</option>)}</select></label>
            <label className="flex items-center gap-2">Go to page:<input type="number" min={1} max={pages} className={`${pillCls} w-20 font-normal`} value={cur} onChange={(e) => setPage(Math.min(pages, Math.max(1, Number(e.target.value) || 1)))} /> of {pages}</label>
            <div className="flex items-center gap-1.5">
              <button className="h-9 px-3 rounded-lg border border-slate-200 font-semibold text-blue-600 disabled:text-slate-300 disabled:bg-slate-50" disabled={cur <= 1} onClick={() => setPage(cur - 1)}>Previous</button>
              {nums.map((n) => <button key={n} onClick={() => setPage(n)} className={`h-9 min-w-9 px-2 rounded-lg border font-semibold ${n === cur ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-200 text-slate-700'}`}>{n}</button>)}
              {pages > 5 && (nums[nums.length - 1] ?? pages) < pages && <><span className="px-1">…</span><button onClick={() => setPage(pages)} className="h-9 min-w-9 px-2 rounded-lg border border-slate-200 font-semibold">{pages}</button></>}
              <button className="h-9 px-3 rounded-lg border border-slate-200 font-semibold text-blue-600 disabled:text-slate-300 disabled:bg-slate-50" disabled={cur >= pages} onClick={() => setPage(cur + 1)}>Next</button>
            </div>
          </div>
        </div>
      </div>

      {viewing && <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4" onClick={() => setViewing(null)}>
        <div className={`${cardCls} w-full max-w-lg p-6 space-y-4`} onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-3"><div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center"><Pill className="w-5 h-5" /></div>
            <div><div className="font-black text-slate-900">{viewing.product.name}</div><div className="text-xs text-slate-500">{viewing.product.generic_name} · SKU {viewing.product.sku || '—'}</div></div></div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><div className="text-xs text-slate-500">Total stock</div><div className="font-bold">{formatNumber(viewing.product.stock)}</div></div>
            <div><div className="text-xs text-slate-500">Category</div><div className="font-bold">{viewing.product.category || '—'}</div></div>
            <div><div className="text-xs text-slate-500">Buying price</div><div className="font-bold">TZS {formatNumber(viewing.cost)}</div></div>
            <div><div className="text-xs text-slate-500">Selling price</div><div className="font-bold">TZS {formatNumber(viewing.sell)}</div></div>
          </div>
          <div><div className="text-xs font-bold text-slate-500 uppercase mb-2">Batches</div>
            <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 text-sm">
              {batches.filter((b) => b.product_id === viewing.product.id).map((b) => <div key={b.id} className="py-2 flex justify-between"><span className="font-semibold">{b.batch_number}</span><span>{formatNumber(b.quantity)} · exp {b.expiry_date}</span></div>)}
              {!batches.some((b) => b.product_id === viewing.product.id) && <div className="py-2 text-slate-400">No stock received yet.</div>}
            </div></div>
          <div className="text-right"><button className="h-10 px-4 rounded-xl bg-blue-600 text-white font-semibold" onClick={() => setViewing(null)}>Close</button></div>
        </div></div>}
    </div>);
}
