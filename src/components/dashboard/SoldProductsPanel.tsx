import { useEffect, useMemo, useState } from 'react';
import { Download, Search } from 'lucide-react';
import { PharmacyService, type SoldProductRow } from '@/lib/pharmacy-service';
import { formatNumber } from '@/lib/utils';

export function SoldProductsPanel() {
  const [rows, setRows] = useState<SoldProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  useEffect(() => { void PharmacyService.getSoldProducts().then(setRows).finally(() => setLoading(false)); }, []);
  const list = useMemo(() => { const t = q.trim().toLowerCase(); return t ? rows.filter((r) => [r.product, r.business, r.branch, r.invoice].some((v) => v.toLowerCase().includes(t))) : rows; }, [rows, q]);
  const units = list.reduce((a, r) => a + r.quantity, 0);
  const revenue = list.reduce((a, r) => a + r.total, 0);
  const top = Object.entries(list.reduce<Record<string, number>>((m, r) => ({ ...m, [r.product]: (m[r.product] || 0) + r.quantity }), {})).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const exportCsv = () => {
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [['Product', 'Qty', 'Unit price', 'Total', 'Business', 'Branch', 'Invoice', 'Payment', 'Date'], ...list.map((r) => [r.product, r.quantity, r.unit_price, r.total, r.business, r.branch, r.invoice, r.payment_method, r.created_at])].map((l) => l.map(esc).join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'sold-products.csv'; a.click();
  };
  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-lg font-black text-slate-900">Sold Products</h2><p className="text-xs text-slate-500">Every product sold through the platform tills.</p></div>
        <div className="flex gap-2">
          <div className="relative"><Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search product, business, invoice…" className="pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs w-64" /></div>
          <button onClick={exportCsv} className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5"><Download className="w-3.5 h-3.5" /> CSV</button>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-slate-200 p-4"><div className="text-[11px] font-bold text-slate-400 uppercase">Units sold</div><div className="text-xl font-black">{formatNumber(units)}</div></div>
        <div className="rounded-xl border border-slate-200 p-4"><div className="text-[11px] font-bold text-slate-400 uppercase">Revenue</div><div className="text-xl font-black text-emerald-700">TZS {formatNumber(revenue)}</div></div>
        <div className="rounded-xl border border-slate-200 p-4"><div className="text-[11px] font-bold text-slate-400 uppercase">Top sellers</div><div className="text-xs font-semibold text-slate-700">{top.length ? top.map(([n, c]) => `${n} (${c})`).join(', ') : '—'}</div></div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead><tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px] font-bold">{['Product', 'Qty', 'Unit price', 'Total', 'Business / Branch', 'Invoice', 'Payment', 'Date'].map((h) => <th key={h} className="py-2.5 pr-3">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">
            {list.slice(0, 500).map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="py-3 pr-3 font-bold text-slate-900">{r.product}</td>
                <td className="py-3 pr-3">{r.quantity}</td>
                <td className="py-3 pr-3">TZS {formatNumber(r.unit_price)}</td>
                <td className="py-3 pr-3 font-black text-emerald-700">TZS {formatNumber(r.total)}</td>
                <td className="py-3 pr-3">{r.business}<div className="text-slate-400">{r.branch}</div></td>
                <td className="py-3 pr-3 font-mono">{r.invoice}</td>
                <td className="py-3 pr-3 uppercase text-[10px] font-semibold">{r.payment_method}</td>
                <td className="py-3 pr-3 text-slate-500">{new Date(r.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && list.length === 0 && <div className="p-8 text-center text-slate-500 text-xs">No products sold yet.</div>}
        {loading && <div className="p-8 text-center text-slate-500 text-xs">Loading sold products…</div>}
      </div>
    </div>
  );
}
