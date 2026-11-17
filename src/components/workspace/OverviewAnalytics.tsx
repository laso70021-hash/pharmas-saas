import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ResponsiveContainer, ComposedChart, BarChart, Bar, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { Download, X } from 'lucide-react';
import type { Workspace, WsSale, WsExpense, WsProduct, WsBatch, WsBranch, WsStaff } from '@/lib/pharmacy-types';
import { filterByRange, formatDayKey, type DateRange } from '@/lib/date-range';
import { filterSales, trend, sumBy, productSales, expiryAnalysis, toCsv, saleFigures, type Granularity } from '@/lib/analytics';
import { ShiftService } from '@/lib/shift-service';
import { workedSeconds } from '@/lib/shifts';
import { formatNumber } from '@/lib/utils';
import { cardCls } from './ws-ui';

const COLORS = ['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#0EA5E9', '#64748B', '#EC4899'];
const tzs = (v: unknown) => `TZS ${formatNumber(Number(v))}`;
const sel = 'px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700';

function Box({ title, children, onExport }: { title: string; children: React.ReactNode; onExport?: () => void }) {
  return (
    <div className={`${cardCls} p-5`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-black text-slate-900 text-sm">{title}</h3>
        {onExport && <button onClick={onExport} className="text-[11px] font-bold text-blue-600 hover:underline flex items-center gap-1"><Download className="w-3 h-3" />CSV</button>}
      </div>
      <div className="h-64">{children}</div>
    </div>
  );
}
const NoData = () => <div className="h-full flex items-center justify-center text-xs font-semibold text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">No records for these filters.</div>;

function download(name: string, rows: Record<string, string | number>[]) {
  const blob = new Blob([toCsv(rows)], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${name}.csv`; a.click(); URL.revokeObjectURL(a.href);
}

export function OverviewAnalytics({ ws, range, isMounted, allSales, allExpenses, products, batches, branches, staff, showFinance, canSeeStaff }: {
  ws: Workspace; range: DateRange | null; isMounted: boolean; allSales: WsSale[]; allExpenses: WsExpense[]; products: WsProduct[];
  batches: WsBatch[]; branches: WsBranch[]; staff: WsStaff[]; showFinance: boolean; canSeeStaff: boolean;
}) {
  const [g, setG] = useState<Granularity>('day');
  const [branchId, setBranchId] = useState('');
  const [category, setCategory] = useState('');
  const [productId, setProductId] = useState('');
  const { data: shifts = [] } = useQuery({ queryKey: ['shift', ws.id, 'list'], queryFn: () => ShiftService.list(ws.id), enabled: canSeeStaff });

  const categories = useMemo(() => [...new Set(products.map((p) => p.category || 'Uncategorised'))].sort(), [products]);
  const productIds = useMemo(() => {
    if (productId) return new Set([productId]);
    if (category) return new Set(products.filter((p) => (p.category || 'Uncategorised') === category).map((p) => p.id));
    return null;
  }, [productId, category, products]);

  const ranged = filterByRange(allSales, (s) => s.created_at, range);
  const sales = filterSales(ranged, { branchId: branchId || null, productIds });
  // Expenses are not tied to products, so they apply only when no product/category slice is chosen.
  const expenses = productIds ? [] : filterByRange(allExpenses, (e) => e.expense_date, range);
  const points = trend(sales, expenses, g, productIds).map((p) => ({ ...p, label: g === 'month' ? p.key : formatDayKey(p.key).slice(0, 6) }));

  const bName = (id: string | null) => branches.find((b) => b.id === id)?.name ?? 'No branch';
  const pName = new Map(products.map((p) => [p.id, p.name]));
  const branchPerf = branches.map((b) => {
    const rows = filterSales(ranged, { branchId: b.id, productIds });
    const f = rows.reduce((a, s) => { const x = saleFigures(s, productIds); return { r: a.r + x.revenue, c: a.c + x.cost }; }, { r: 0, c: 0 });
    return { id: b.id, name: b.name, sales: f.r, gross: f.r - f.c, count: rows.length };
  });
  const payments = sumBy(sales, (s) => s.payment_method, (s) => saleFigures(s, productIds).revenue);
  const expenseCats = sumBy(expenses, (e) => e.category || 'Other', (e) => e.amount);
  const top = productSales(sales, productIds).slice(0, 8).map((p) => ({ ...p, name: pName.get(p.id) ?? 'Product' }));
  const stockBatches = batches.filter((b) => (!branchId || b.branch_id === branchId) && (!productIds || productIds.has(b.product_id)));
  const expiry = expiryAnalysis(stockBatches);
  const stockByCat = sumBy(stockBatches.filter((b) => b.quantity > 0), (b) => products.find((p) => p.id === b.product_id)?.category || 'Uncategorised', (b) => b.quantity * b.cost_per_unit);
  const staffName = (uid: string) => staff.find((s) => s.user_id === uid)?.full_name || 'Staff';
  const shiftRows = filterByRange(shifts, (s) => s.started_at, range).filter((s) => !branchId || s.branch_id === branchId);
  const staffPerf = sumBy(shiftRows, (s) => staffName(s.user_id), (s) => workedSeconds(s) / 3600).map((r) => ({ name: r.name, hours: Math.round(r.value * 10) / 10 }));

  const filtered = branchId || category || productId;
  const ready = isMounted;

  return (
    <div className="space-y-6">
      <div className={`${cardCls} p-4 flex flex-wrap items-center gap-2`}>
        <span className="text-xs font-black text-slate-900 mr-1">Analytics</span>
        {(['day', 'week', 'month'] as const).map((x) => (
          <button key={x} onClick={() => setG(x)} className={`px-3 py-2 rounded-xl text-xs font-bold ${g === x ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
            {x === 'day' ? 'Daily' : x === 'week' ? 'Weekly' : 'Monthly'}
          </button>
        ))}
        <select aria-label="Branch" className={sel} value={branchId} onChange={(e) => setBranchId(e.target.value)}>
          <option value="">All branches</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select aria-label="Category" className={sel} value={category} onChange={(e) => { setCategory(e.target.value); setProductId(''); }}>
          <option value="">All categories</option>{categories.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select aria-label="Product" className={sel} value={productId} onChange={(e) => setProductId(e.target.value)}>
          <option value="">All products</option>
          {products.filter((p) => !category || (p.category || 'Uncategorised') === category).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {filtered && <button onClick={() => { setBranchId(''); setCategory(''); setProductId(''); }} className="text-xs font-bold text-slate-500 flex items-center gap-1"><X className="w-3 h-3" />Clear</button>}
        <span className="text-[11px] text-slate-400 ml-auto">Tip: click a bar or slice to drill in.</span>
      </div>

      <Box title={showFinance ? 'Sales, gross & net profit' : 'Sales trend'} onExport={() => download('sales-trend', points.map((p) => ({ period: p.key, sales: p.sales, sales_count: p.count, ...(showFinance ? { gross_profit: p.gross, expenses: p.expenses, net_profit: p.net } : {}) })))}>
        {ready && points.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={points} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis dataKey="label" tick={{ fill: '#64748B', fontSize: 10 }} />
              <YAxis tick={{ fill: '#64748B', fontSize: 10 }} tickFormatter={(v) => formatNumber(v)} width={70} />
              <Tooltip formatter={tzs} /><Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="sales" name="Sales" fill="#2563EB" radius={[4, 4, 0, 0]} />
              {showFinance && <Bar dataKey="expenses" name="Expenses" fill="#F43F5E" radius={[4, 4, 0, 0]} />}
              {showFinance && <Line dataKey="gross" name="Gross profit" stroke="#10B981" strokeWidth={2} dot={false} />}
              {showFinance && <Line dataKey="net" name="Net profit" stroke="#8B5CF6" strokeWidth={2} dot={false} />}
            </ComposedChart>
          </ResponsiveContainer>
        ) : <NoData />}
      </Box>
      {showFinance && productIds && <p className="text-[11px] text-slate-400 -mt-4">Expenses are not linked to products, so they are left out while a product or category is selected.</p>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Box title="Branch performance" onExport={() => download('branch-performance', branchPerf.map((b) => ({ branch: b.name, sales: b.sales, sales_count: b.count, ...(showFinance ? { gross_profit: b.gross } : {}) })))}>
          {ready && branchPerf.some((b) => b.count) ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={branchPerf}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="name" tick={{ fill: '#64748B', fontSize: 10 }} /><YAxis tick={{ fill: '#64748B', fontSize: 10 }} tickFormatter={(v) => formatNumber(v)} width={70} />
                <Tooltip formatter={tzs} />
                <Bar dataKey="sales" name="Sales" fill="#2563EB" radius={[4, 4, 0, 0]} cursor="pointer" onClick={(d: { id?: string }) => d.id && setBranchId(d.id === branchId ? '' : d.id)}>
                  {branchPerf.map((b) => <Cell key={b.id} fill={b.id === branchId ? '#1E40AF' : '#2563EB'} />)}
                </Bar>
                {showFinance && <Bar dataKey="gross" name="Gross profit" fill="#10B981" radius={[4, 4, 0, 0]} />}
              </BarChart>
            </ResponsiveContainer>
          ) : <NoData />}
        </Box>
        <Box title="Top products" onExport={() => download('top-products', top.map((p) => ({ product: p.name, units: p.units, revenue: p.revenue })))}>
          {ready && top.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={top} layout="vertical" margin={{ left: 10 }}>
                <XAxis type="number" tick={{ fill: '#64748B', fontSize: 10 }} tickFormatter={(v) => formatNumber(v)} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fill: '#64748B', fontSize: 10 }} />
                <Tooltip formatter={tzs} />
                <Bar dataKey="revenue" name="Revenue" fill="#0EA5E9" radius={[0, 4, 4, 0]} cursor="pointer" onClick={(d: { id?: string }) => d.id && setProductId(d.id === productId ? '' : d.id)} />
              </BarChart>
            </ResponsiveContainer>
          ) : <NoData />}
        </Box>
        <Box title="Payment methods" onExport={() => download('payment-methods', payments.map((p) => ({ method: p.name, amount: p.value })))}>
          {ready && payments.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart><Tooltip formatter={tzs} /><Legend wrapperStyle={{ fontSize: 11 }} />
                <Pie data={payments} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85}>{payments.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie>
              </PieChart>
            </ResponsiveContainer>
          ) : <NoData />}
        </Box>
        {showFinance && (
          <Box title="Expenses by category" onExport={() => download('expenses-by-category', expenseCats.map((p) => ({ category: p.name, amount: p.value })))}>
            {ready && expenseCats.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart><Tooltip formatter={tzs} /><Legend wrapperStyle={{ fontSize: 11 }} />
                  <Pie data={expenseCats} dataKey="value" nameKey="name" outerRadius={85}>{expenseCats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie>
                </PieChart>
              </ResponsiveContainer>
            ) : <NoData />}
          </Box>
        )}
        <Box title="Inventory value by category" onExport={() => download('inventory-value', stockByCat.map((p) => ({ category: p.name, cost_value: p.value })))}>
          {ready && stockByCat.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart><Tooltip formatter={tzs} /><Legend wrapperStyle={{ fontSize: 11 }} />
                <Pie data={stockByCat} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} cursor="pointer" onClick={(d: { name?: string }) => d.name && (setProductId(''), setCategory(d.name === category ? '' : d.name))}>
                  {stockByCat.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          ) : <NoData />}
        </Box>
        <Box title="Expiry analysis (stock at cost)" onExport={() => download('expiry-analysis', expiry.map((e) => ({ window: e.name, batches: e.batches, cost_value: e.value })))}>
          {ready && expiry.some((e) => e.batches) ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={expiry}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="name" tick={{ fill: '#64748B', fontSize: 10 }} /><YAxis tick={{ fill: '#64748B', fontSize: 10 }} tickFormatter={(v) => formatNumber(v)} width={70} />
                <Tooltip formatter={tzs} />
                <Bar dataKey="value" name="Stock value" radius={[4, 4, 0, 0]}>{expiry.map((_, i) => <Cell key={i} fill={['#EF4444', '#F97316', '#F59E0B', '#0EA5E9', '#10B981'][i]} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <NoData />}
        </Box>
        {canSeeStaff && (
          <Box title="Staff hours worked (shifts)" onExport={() => download('staff-hours', staffPerf.map((s) => ({ staff: s.name, hours: s.hours })))}>
            {ready && staffPerf.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={staffPerf}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="name" tick={{ fill: '#64748B', fontSize: 10 }} /><YAxis tick={{ fill: '#64748B', fontSize: 10 }} width={40} />
                  <Tooltip formatter={(v) => `${v} h`} />
                  <Bar dataKey="hours" name="Hours" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <NoData />}
          </Box>
        )}
      </div>
      {branchId && <p className="text-[11px] text-slate-400">Showing {bName(branchId)} only.</p>}
    </div>
  );
}
