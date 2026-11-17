import type { RestockPrefill } from '@/lib/supplier-match';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Package, CalendarClock, AlertTriangle, Search } from 'lucide-react';
import { WorkspaceService } from '@/lib/pharmacy-service';
import type { Workspace } from '@/lib/pharmacy-types';
import { stockState } from '@/lib/workspace';
import { toCsv } from '@/lib/analytics';
import { formatNumber, formatDateDeterministic } from '@/lib/utils';
import { expiryTier, reorderQty, TIER_ADVICE, TIER_LABEL, type ExpiryTier } from '@/lib/stock-alerts';

const card = 'bg-white rounded-2xl border border-slate-200/70 shadow-sm';
const sel = 'h-9 px-3 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700';
const TIER_TONE: Record<ExpiryTier, string> = {
  expired: 'bg-rose-100 text-rose-700', critical: 'bg-rose-50 text-rose-600', six_months: 'bg-orange-50 text-orange-600', one_year: 'bg-amber-50 text-amber-700', ok: 'bg-emerald-50 text-emerald-700',
};

function download(name: string, rows: Record<string, string | number>[]) {
  const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: 'text/csv' }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}

export function StockAlertsTab({ ws, initialView = 'restock', onOrder }: { ws: Workspace; initialView?: 'restock' | 'expiry'; onOrder?: ((prefill?: RestockPrefill) => void) | undefined }) {
  const pid = ws.id;
  const { data: products = [] } = useQuery({ queryKey: ['ws', pid, 'products'], queryFn: () => WorkspaceService.getProducts(pid) });
  const { data: batches = [] } = useQuery({ queryKey: ['ws', pid, 'batches'], queryFn: () => WorkspaceService.getBatches(pid) });
  const { data: branches = [] } = useQuery({ queryKey: ['ws', pid, 'branches'], queryFn: () => WorkspaceService.getBranches(pid) });
  const [view, setView] = useState(initialView);
  const [q, setQ] = useState(''); const [branchId, setBranchId] = useState(''); const [category, setCategory] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'out' | 'low'>('all');
  const [tierFilter, setTierFilter] = useState<'all' | ExpiryTier>('all');

  const catOf = useMemo(() => new Map(products.map((p) => [p.id, p.category || 'Uncategorised'])), [products]);
  const branchName = useMemo(() => new Map(branches.map((b) => [b.id, b.name])), [branches]);
  const categories = [...new Set(products.map((p) => p.category || 'Uncategorised'))].sort();
  const match = (name: string, cat: string) => (!q || name.toLowerCase().includes(q.toLowerCase())) && (!category || cat === category);

  const restock = products.filter((p) => p.is_active)
    .map((p) => { const qty = branchId ? p.stock_by_branch[branchId] ?? 0 : p.stock; return { ...p, qty, state: stockState(qty, p.min_stock_level) }; })
    .filter((p) => p.state !== 'ok' && match(`${p.name} ${p.generic_name}`, p.category || 'Uncategorised'))
    .filter((p) => stockFilter === 'all' || (stockFilter === 'out' ? p.qty <= 0 : p.qty > 0))
    .sort((a, b) => a.qty - b.qty);

  const expiry = batches.filter((b) => b.quantity > 0 && (!branchId || b.branch_id === branchId))
    .map((b) => ({ ...b, tier: expiryTier(b.days_to_expiry), cat: catOf.get(b.product_id) || 'Uncategorised' }))
    .filter((b) => b.tier !== 'ok' && (tierFilter === 'all' || b.tier === tierFilter) && match(b.product_name, b.cat))
    .sort((a, b) => a.days_to_expiry - b.days_to_expiry);

  const counts = { out: restock.filter((p) => p.qty <= 0).length, low: restock.filter((p) => p.qty > 0).length,
    six: expiry.filter((b) => ['expired', 'critical', 'six_months'].includes(b.tier)).length, year: expiry.filter((b) => b.tier === 'one_year').length };
  const filterTag = [branchId && branchName.get(branchId), category, view === 'restock' ? stockFilter : tierFilter].filter((x) => x && x !== 'all').join('_').replace(/\W+/g, '-') || 'all';

  const exportCsv = () => view === 'restock'
    ? download(`restock-${filterTag}.csv`, restock.map((p) => ({ Product: `${p.name} ${p.strength}`.trim(), Category: p.category || 'Uncategorised', SKU: p.sku, Branch: branchId ? branchName.get(branchId) ?? '' : 'All branches', 'Current stock': p.qty, 'Min stock': p.min_stock_level, Status: p.qty <= 0 ? 'Out of stock' : 'Low stock', 'Suggested order': reorderQty(p.qty, p.min_stock_level), 'Unit cost (TZS)': p.cost_price })))
    : download(`expiry-${filterTag}.csv`, expiry.map((b) => ({ Product: b.product_name, Category: b.cat, Batch: b.batch_number, Branch: b.branch_id ? branchName.get(b.branch_id) ?? '' : '', Quantity: b.quantity, 'Expiry date': b.expiry_date, 'Days left': b.days_to_expiry, Window: TIER_LABEL[b.tier], 'Value at cost (TZS)': Math.round(b.quantity * b.cost_per_unit), Recommendation: TIER_ADVICE[b.tier] })));

  const Kpi = ({ label, value, tone, Icon, onClick }: { label: string; value: number; tone: string; Icon: typeof Package; onClick: () => void }) => (
    <button type="button" onClick={onClick} className={`${card} p-3 text-left hover:border-blue-300`}>
      <div className="flex items-center gap-2"><span className={`w-8 h-8 rounded-lg flex items-center justify-center ${tone}`}><Icon className="w-4 h-4" /></span><span className="text-[13px] font-medium text-slate-600">{label}</span></div>
      <div className="mt-1.5 text-2xl font-black text-slate-900 tabular-nums">{value}</div>
    </button>);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-xl font-black text-slate-900 tracking-tight">Stock Alerts</h1>
          <p className="text-sm text-slate-500">Products to restock and batches expiring within 1 year, with selling advice.</p></div>
        <div className="flex gap-2">
          {onOrder && view === 'restock' && <button onClick={() => onOrder()} className="h-9 px-3 rounded-xl border border-blue-200 text-blue-700 text-sm font-bold hover:bg-blue-50">Order from suppliers</button>}
          <button onClick={exportCsv} className="h-9 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold flex items-center gap-1.5"><Download className="w-4 h-4" /> Download filtered list</button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Out of stock" value={counts.out} tone="bg-rose-50 text-rose-600" Icon={AlertTriangle} onClick={() => { setView('restock'); setStockFilter('out'); }} />
        <Kpi label="Low stock" value={counts.low} tone="bg-amber-50 text-amber-700" Icon={Package} onClick={() => { setView('restock'); setStockFilter('low'); }} />
        <Kpi label="Expiring within 6 months" value={counts.six} tone="bg-orange-50 text-orange-600" Icon={CalendarClock} onClick={() => { setView('expiry'); setTierFilter('all'); }} />
        <Kpi label="Expiring within 1 year" value={counts.year} tone="bg-blue-50 text-blue-600" Icon={CalendarClock} onClick={() => { setView('expiry'); setTierFilter('one_year'); }} />
      </div>

      <div className={`${card} p-3 flex flex-wrap items-center gap-2`}>
        <div className="flex rounded-xl bg-slate-100 p-1">
          {(['restock', 'expiry'] as const).map((v) => <button key={v} onClick={() => setView(v)} className={`px-3 py-1.5 rounded-lg text-sm font-bold ${view === v ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600'}`}>{v === 'restock' ? 'Restock needed' : 'Expiring / near expiry'}</button>)}
        </div>
        <label className="relative"><Search className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search product" className={`${sel} pl-8 w-48`} /></label>
        <select aria-label="Branch" className={sel} value={branchId} onChange={(e) => setBranchId(e.target.value)}><option value="">All branches</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
        <select aria-label="Category" className={sel} value={category} onChange={(e) => setCategory(e.target.value)}><option value="">All categories</option>{categories.map((c) => <option key={c}>{c}</option>)}</select>
        {view === 'restock'
          ? <select aria-label="Stock status" className={sel} value={stockFilter} onChange={(e) => setStockFilter(e.target.value as typeof stockFilter)}><option value="all">Out + low stock</option><option value="out">Out of stock</option><option value="low">Low stock</option></select>
          : <select aria-label="Expiry window" className={sel} value={tierFilter} onChange={(e) => setTierFilter(e.target.value as typeof tierFilter)}><option value="all">All within 1 year</option>{(['expired', 'critical', 'six_months', 'one_year'] as const).map((t) => <option key={t} value={t}>{TIER_LABEL[t]}</option>)}</select>}
      </div>

      <div className={`${card} overflow-x-auto`}>
        {view === 'restock' ? (
          <table className="w-full text-sm"><thead><tr className="bg-[#1E3A8A] text-white text-xs">{['Product', 'Category', 'Current', 'Min.', 'Status', 'Suggested order', 'Advice', ...(onOrder ? [''] : [])].map((h) => <th key={h} className="text-left font-semibold px-3 py-2">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">{restock.length === 0 ? <tr><td colSpan={8} className="px-3 py-8 text-center text-slate-400 font-semibold">Nothing needs restocking for these filters.</td></tr> : restock.map((p) => (
              <tr key={p.id}><td className="px-3 py-2 font-semibold text-slate-800">{p.name}{p.strength ? ` ${p.strength}` : ''}</td><td className="px-3 py-2 text-slate-600">{p.category || 'Uncategorised'}</td>
                <td className="px-3 py-2 tabular-nums">{p.qty}</td><td className="px-3 py-2 tabular-nums">{p.min_stock_level}</td>
                <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${p.qty <= 0 ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-700'}`}>{p.qty <= 0 ? 'Out of stock' : 'Low stock'}</span></td>
                <td className="px-3 py-2 tabular-nums font-bold">{reorderQty(p.qty, p.min_stock_level)}</td>
                <td className="px-3 py-2 text-xs text-slate-600">{p.qty <= 0 ? 'Order now — patients are being turned away.' : 'Order soon before it runs out.'}</td>{onOrder && <td className="px-3 py-2"><button onClick={() => onOrder({ name: p.name, generic: p.generic_name, strength: p.strength, quantity: reorderQty(p.qty, p.min_stock_level), ...(branchId ? { branchId } : {}) })} className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold whitespace-nowrap">Order from suppliers</button></td>}</tr>))}</tbody></table>
        ) : (
          <table className="w-full text-sm"><thead><tr className="bg-[#1E3A8A] text-white text-xs">{['Product', 'Batch', 'Branch', 'Qty', 'Expiry', 'Days left', 'Value (cost)', 'Sell recommendation'].map((h) => <th key={h} className="text-left font-semibold px-3 py-2">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">{expiry.length === 0 ? <tr><td colSpan={8} className="px-3 py-8 text-center text-slate-400 font-semibold">No batches expire within 1 year for these filters.</td></tr> : expiry.map((b) => (
              <tr key={b.id}><td className="px-3 py-2 font-semibold text-slate-800">{b.product_name}<div className="text-[11px] text-slate-400">{b.cat}</div></td><td className="px-3 py-2">{b.batch_number}</td>
                <td className="px-3 py-2 text-slate-600">{b.branch_id ? branchName.get(b.branch_id) ?? '—' : '—'}</td><td className="px-3 py-2 tabular-nums">{b.quantity}</td>
                <td className="px-3 py-2 whitespace-nowrap">{formatDateDeterministic(b.expiry_date)}</td>
                <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-md text-xs font-semibold whitespace-nowrap ${TIER_TONE[b.tier]}`}>{b.days_to_expiry <= 0 ? 'Expired' : `${b.days_to_expiry} days`}</span></td>
                <td className="px-3 py-2 tabular-nums whitespace-nowrap">TZS {formatNumber(Math.round(b.quantity * b.cost_per_unit))}</td>
                <td className="px-3 py-2 text-xs text-slate-600 min-w-[260px]"><span className="font-bold text-slate-800">{TIER_LABEL[b.tier]}: </span>{TIER_ADVICE[b.tier]}</td></tr>))}</tbody></table>
        )}
      </div>
    </div>
  );
}
