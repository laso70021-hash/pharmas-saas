import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, CartesianGrid, LabelList } from 'recharts';
import { ShoppingCart, Coins, Receipt, TrendingUp, AlertTriangle, CalendarClock, ArrowUpRight, Building2, CreditCard, Layers, Package, ChevronUp, ChevronDown } from 'lucide-react';
import { WorkspaceService } from '@/lib/pharmacy-service';
import type { Workspace } from '@/lib/pharmacy-types';
import { filterByRange, formatDayKey, toDayKey, type DateRange } from '@/lib/date-range';
import { filterSales, trend, sumBy, saleFigures, type Granularity } from '@/lib/analytics';
import { can, stockState, EXPIRY_WARNING_DAYS } from '@/lib/workspace';
import { formatNumber, formatDateDeterministic } from '@/lib/utils';
import { DateRangeFilter } from '@/components/dashboard/DateRangeFilter';

const card = 'bg-white rounded-2xl border border-slate-200/70 shadow-sm';
const COLORS = ['#2563EB', '#14B8A6', '#22C55E', '#F59E0B', '#8B5CF6', '#0EA5E9', '#EF4444', '#64748B'];
const PAY_COLORS = ['#2563EB', '#60A5FA', '#8B5CF6', '#14B8A6', '#F59E0B'];
const tzs = (v: unknown) => `TZS ${formatNumber(Math.round(Number(v) || 0))}`;
const sel = 'h-8 px-3 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 min-w-[160px]';

/** Range of equal length immediately before the selected one (for "vs previous period"). */
function previousRange(r: DateRange | null): DateRange | null {
  if (!r?.from || !r?.to) return null;
  const f = new Date(`${r.from}T00:00:00`), t = new Date(`${r.to}T00:00:00`);
  const days = Math.round((t.getTime() - f.getTime()) / 86400000) + 1;
  const pt = new Date(f); pt.setDate(pt.getDate() - 1);
  const pf = new Date(pt); pf.setDate(pf.getDate() - (days - 1));
  return { preset: 'custom', from: toDayKey(pf), to: toDayKey(pt) };
}
function delta(cur: number, prev: number | null) {
  if (prev === null) return null;
  if (prev === 0) return cur === 0 ? 0 : null;
  return Math.round(((cur - prev) / Math.abs(prev)) * 1000) / 10;
}

function Kpi({ label, value, Icon, tone, change, sub, onClick }: { label: string; value: string; Icon: typeof ShoppingCart; tone: string; change?: number | null; sub?: string | undefined; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`${card} p-3 text-left hover:border-blue-300 hover:shadow transition`}>
      <div className="flex items-center gap-2 mb-1.5">
        <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${tone}`}><Icon className="w-4 h-4" /></span>
        <span className="text-[13px] font-medium text-slate-600">{label}</span>
      </div>
      <div className="text-lg font-black text-slate-900 tracking-tight truncate">{value}</div>
      <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
        {sub !== undefined ? sub : change === undefined || change === null ? 'No previous data' : change === 0 ? 'No change' : (
          <><span className={`font-bold flex items-center ${change > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{change > 0 ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}{change > 0 ? '+' : ''}{change}%</span> vs. previous period</>
        )}
      </div>
    </button>
  );
}

function Panel({ title, sub, Icon, action, onAction, children }: { title: string; sub: string; Icon: typeof ShoppingCart; action: string; onAction: () => void; children: React.ReactNode }) {
  return (
    <div className={`${card} p-3.5 flex flex-col`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0"><Icon className="w-4 h-4" /></span>
          <div className="min-w-0"><h3 className="font-extrabold text-slate-900 text-sm">{title}</h3><p className="text-xs text-slate-500 truncate">{sub}</p></div>
        </div>
        <button onClick={onAction} className="shrink-0 h-8 px-3 rounded-lg border border-slate-200 text-xs font-bold text-blue-700 hover:bg-blue-50 flex items-center gap-1.5">{action}<ArrowUpRight className="w-3.5 h-3.5" /></button>
      </div>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}
const NoData = ({ children }: { children: React.ReactNode }) => <div className="h-full min-h-[140px] flex items-center justify-center text-xs font-semibold text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center px-4">{children}</div>;

export function OverviewTab({ ws, range, onRangeChange, isMounted, onNavigate, actions }: {
  ws: Workspace; range: DateRange | null; onRangeChange: (r: DateRange | null) => void; isMounted: boolean; onNavigate: (tab: string) => void; actions?: React.ReactNode;
}) {
  const pid = ws.id;
  const showFinance = can(ws.role, 'viewFinance', ws.status);
  const canSeeStaff = can(ws.role, 'manageBranches', 'active');
  const { data: allSales = [] } = useQuery({ queryKey: ['ws', pid, 'sales'], queryFn: () => WorkspaceService.getSales(pid), refetchInterval: 60000 });
  const { data: allExpenses = [] } = useQuery({ queryKey: ['ws', pid, 'expenses'], queryFn: () => WorkspaceService.getExpenses(pid) });
  const { data: products = [] } = useQuery({ queryKey: ['ws', pid, 'products'], queryFn: () => WorkspaceService.getProducts(pid) });
  const { data: batches = [] } = useQuery({ queryKey: ['ws', pid, 'batches'], queryFn: () => WorkspaceService.getBatches(pid) });
  const { data: branches = [] } = useQuery({ queryKey: ['ws', pid, 'branches'], queryFn: () => WorkspaceService.getBranches(pid) });
  const { data: staff = [] } = useQuery({ queryKey: ['ws', pid, 'staff'], queryFn: () => WorkspaceService.getStaff(pid), enabled: canSeeStaff });

  const [g, setG] = useState<Granularity>('day');
  const [branchId, setBranchId] = useState('');
  const [category, setCategory] = useState('');
  const openReports = () => onNavigate('sales-reports');

  const categories = useMemo(() => [...new Set(products.map((p) => p.category || 'Uncategorised'))].sort(), [products]);
  const productIds = useMemo(() => category ? new Set(products.filter((p) => (p.category || 'Uncategorised') === category).map((p) => p.id)) : null, [category, products]);
  const catOf = useMemo(() => new Map(products.map((p) => [p.id, p.category || 'Uncategorised'])), [products]);

  const figures = (r: DateRange | null) => {
    const s = filterSales(filterByRange(allSales, (x) => x.created_at, r), { branchId: branchId || null, productIds });
    const ex = productIds || branchId ? [] : filterByRange(allExpenses, (e) => e.expense_date, r);
    const f = s.reduce((a, x) => { const v = saleFigures(x, productIds); return { rev: a.rev + v.revenue, cost: a.cost + v.cost }; }, { rev: 0, cost: 0 });
    const exp = ex.reduce((a, e) => a + e.amount, 0);
    return { sales: s, expensesRows: ex, revenue: f.rev, gross: f.rev - f.cost, expenses: exp, net: f.rev - f.cost - exp };
  };
  const cur = figures(range);
  const prevR = previousRange(range);
  const prev = prevR ? figures(prevR) : null;

  const points = trend(cur.sales, [], g, productIds).map((p) => ({ ...p, label: g === 'month' ? p.key : formatDayKey(p.key).slice(0, 6) }));
  const branchPerf = branches.map((b) => ({
    id: b.id, name: b.name,
    sales: filterSales(filterByRange(allSales, (x) => x.created_at, range), { branchId: b.id, productIds }).reduce((a, s) => a + saleFigures(s, productIds).revenue, 0),
  })).sort((a, b) => b.sales - a.sales);
  const payments = sumBy(cur.sales, (s) => s.payment_method || 'other', (s) => saleFigures(s, productIds).revenue).sort((a, b) => b.value - a.value);
  const payTotal = payments.reduce((a, p) => a + p.value, 0);
  const stock = batches.filter((b) => b.quantity > 0 && (!branchId || b.branch_id === branchId) && (!productIds || productIds.has(b.product_id)));
  const invByCat = sumBy(stock, (b) => catOf.get(b.product_id) || 'Uncategorised', (b) => b.quantity * b.cost_per_unit).sort((a, b) => b.value - a.value).slice(0, 8);

  const scopedProducts = products.filter((p) => p.is_active && (!productIds || productIds.has(p.id)));
  const lowStock = scopedProducts
    .map((p) => ({ ...p, qty: branchId ? p.stock_by_branch[branchId] ?? 0 : p.stock }))
    .filter((p) => stockState(p.qty, p.min_stock_level) !== 'ok')
    .sort((a, b) => a.qty - b.qty);
  const expiring = stock.filter((b) => b.days_to_expiry <= EXPIRY_WARNING_DAYS).sort((a, b) => a.days_to_expiry - b.days_to_expiry);
  const payLabel = (m: string) => m.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-3"><div>
        <h1 className="text-xl font-black text-slate-900 tracking-tight">Overview</h1>
        <p className="text-sm text-slate-500">Business performance and key pharmacy insights at a glance.</p>
      </div>{actions}</div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Kpi label="Sales" value={tzs(cur.revenue)} Icon={ShoppingCart} tone="bg-emerald-50 text-emerald-600" change={delta(cur.revenue, prev?.revenue ?? null)} onClick={openReports} />
        {showFinance ? (<>
          <Kpi label="Gross Profit" value={tzs(cur.gross)} Icon={Coins} tone="bg-violet-50 text-violet-600" change={delta(cur.gross, prev?.gross ?? null)} onClick={openReports} />
          <Kpi label="Expenses" value={tzs(cur.expenses)} Icon={Receipt} tone="bg-rose-50 text-rose-600" change={delta(cur.expenses, prev?.expenses ?? null)} sub={branchId || category ? 'Not split by branch/category' : undefined} onClick={() => onNavigate('expenses')} />
          <Kpi label="Net Profit" value={tzs(cur.net)} Icon={TrendingUp} tone="bg-blue-50 text-blue-600" change={delta(cur.net, prev?.net ?? null)} onClick={openReports} />
        </>) : (
          <Kpi label="Transactions" value={String(cur.sales.length)} Icon={Receipt} tone="bg-blue-50 text-blue-600" sub="Sales in this period" onClick={openReports} />
        )}
        <Kpi label="Low / Out of Stock" value={String(lowStock.length)} Icon={AlertTriangle} tone="bg-amber-50 text-amber-600" sub="Products at or below minimum" onClick={() => onNavigate('inventory')} />
        <Kpi label="Expiring Soon" value={String(expiring.length)} Icon={CalendarClock} tone="bg-orange-50 text-orange-600" sub={`Batches within ${EXPIRY_WARNING_DAYS} days`} onClick={() => onNavigate('inventory')} />
      </div>

      <div className={`${card} p-2 flex flex-wrap items-center gap-2`}>
        <div className="flex gap-1">
          {(['day', 'week', 'month'] as const).map((x) => (
            <button key={x} onClick={() => setG(x)} className={`h-8 px-4 rounded-full text-sm font-bold ${g === x ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
              {x === 'day' ? 'Daily' : x === 'week' ? 'Weekly' : 'Monthly'}
            </button>))}
        </div>
        <select aria-label="Branch" className={sel} value={branchId} onChange={(e) => setBranchId(e.target.value)}>
          <option value="">All branches</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select aria-label="Category" className={sel} value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>{categories.map((c) => <option key={c}>{c}</option>)}
        </select>
        <div className="ml-auto"><DateRangeFilter value={range} onChange={onRangeChange} /></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3">
        <Panel title="Sales Trend" sub={`${g === 'day' ? 'Daily' : g === 'week' ? 'Weekly' : 'Monthly'} sales over the selected period`} Icon={TrendingUp} action="View Full Dashboard" onAction={openReports}>
          <div className="h-44">{isMounted && points.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={points} margin={{ top: 8, right: 12, left: 0, bottom: 0 }} onClick={openReports}>
                <defs><linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2563EB" stopOpacity={0.25} /><stop offset="100%" stopColor="#2563EB" stopOpacity={0.02} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="label" tick={{ fill: '#64748B', fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#CBD5E1' }} />
                <YAxis tick={{ fill: '#64748B', fontSize: 11 }} tickFormatter={(v) => formatNumber(v)} width={64} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v) => [tzs(v), 'Sales']} labelFormatter={(l, p) => `${l} · ${p?.[0]?.payload?.count ?? 0} sale(s)`} />
                <Area type="monotone" dataKey="sales" stroke="#2563EB" strokeWidth={2.5} fill="url(#salesFill)" dot={{ r: 3, fill: '#2563EB' }} activeDot={{ r: 5 }} />
              </AreaChart>
            </ResponsiveContainer>) : <NoData>No sales recorded for these filters. Sales from the cashier appear here.</NoData>}
          </div>
        </Panel>

        <Panel title="Branch Performance" sub="Sales by branch" Icon={Building2} action="View Report" onAction={openReports}>
          <div className="h-44">{isMounted && branchPerf.some((b) => b.sales > 0) ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={branchPerf} margin={{ top: 4, right: 110, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                <XAxis type="number" tick={{ fill: '#64748B', fontSize: 11 }} tickFormatter={(v) => formatNumber(v)} tickLine={false} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fill: '#475569', fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v) => [tzs(v), 'Sales']} cursor={{ fill: '#EFF6FF' }} />
                <Bar dataKey="sales" radius={[0, 4, 4, 0]} barSize={22} cursor="pointer" onClick={(d: { id?: string }) => d?.id && setBranchId(d.id === branchId ? '' : d.id)}>
                  {branchPerf.map((b, i) => <Cell key={b.id} fill={['#2563EB', '#3B82F6', '#93C5FD', '#BFDBFE'][Math.min(i, 3)]} opacity={!branchId || branchId === b.id ? 1 : 0.35} />)}
                  <LabelList dataKey="sales" position="right" formatter={(v: unknown) => tzs(v)} style={{ fill: '#0F172A', fontSize: 11, fontWeight: 700 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>) : <NoData>No branch sales in this period.</NoData>}
          </div>
        </Panel>

        <Panel title="Payment Methods" sub="Sales by payment method" Icon={CreditCard} action="View All" onAction={openReports}>
          {payTotal > 0 && isMounted ? (
            <div className="flex flex-col sm:flex-row items-center gap-4 h-full">
              <div className="relative w-32 h-32 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart><Pie data={payments} dataKey="value" nameKey="name" innerRadius={40} outerRadius={62} startAngle={90} endAngle={-270} stroke="#fff" strokeWidth={2}>
                    {payments.map((p, i) => <Cell key={p.name} fill={PAY_COLORS[i % PAY_COLORS.length]} />)}
                  </Pie><Tooltip formatter={(v, n) => [tzs(v), payLabel(String(n))]} /></PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[11px] font-bold text-slate-700">TZS</span>
                  <span className="text-sm font-black text-slate-900 leading-tight">{formatNumber(Math.round(payTotal))}</span>
                  <span className="text-[11px] text-slate-500">Total Sales</span>
                </div>
              </div>
              <ul className="flex-1 w-full divide-y divide-slate-100 text-xs">
                {payments.map((p, i) => (
                  <li key={p.name} className="py-1.5 grid grid-cols-[1fr_auto_auto] gap-4 items-center">
                    <span className="flex items-center gap-2 font-semibold text-slate-700"><span className="w-2.5 h-2.5 rounded-full" style={{ background: PAY_COLORS[i % PAY_COLORS.length] }} />{payLabel(p.name)}</span>
                    <span className="font-bold text-slate-700 tabular-nums">{(Math.round((p.value / payTotal) * 1000) / 10).toFixed(1)}%</span>
                    <span className="text-slate-600 tabular-nums text-right">{tzs(p.value)}</span>
                  </li>))}
              </ul>
            </div>) : <NoData>No payments in this period.</NoData>}
        </Panel>

        <Panel title="Inventory by Category" sub="Inventory value (cost) by category" Icon={Layers} action="View Report" onAction={openReports}>
          <div className="h-44">{isMounted && invByCat.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={invByCat} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="name" tick={{ fill: '#475569', fontSize: 11 }} tickLine={false} interval={0} />
                <YAxis tick={{ fill: '#64748B', fontSize: 11 }} tickFormatter={(v) => formatNumber(v)} width={72} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v) => [tzs(v), 'Stock value (cost)']} cursor={{ fill: '#F1F5F9' }} />
                <Bar dataKey="value" radius={[3, 3, 0, 0]} cursor="pointer" onClick={(d: { name?: string }) => d?.name && setCategory(d.name === category ? '' : d.name)}>
                  {invByCat.map((c, i) => <Cell key={c.name} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>) : <NoData>No stock on hand for these filters.</NoData>}
          </div>
        </Panel>

        <Panel title="Restock Needed" sub="Products at or below minimum stock level" Icon={Package} action="View All" onAction={() => onNavigate('stock-alerts')}>
          {lowStock.length === 0 ? <NoData>All products are above their minimum stock.</NoData> : (
            <div className="overflow-x-auto"><table className="w-full text-xs">
              <thead><tr className="bg-slate-50 text-slate-600 text-xs"><th className="text-left font-semibold px-2.5 py-1.5">Product</th><th className="text-center font-semibold px-2.5 py-1.5">Current Stock</th><th className="text-center font-semibold px-2.5 py-1.5">Min. Stock</th><th className="text-left font-semibold px-2.5 py-1.5">Status</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{lowStock.slice(0, 4).map((p) => (
                <tr key={p.id} onClick={() => onNavigate('inventory')} className="cursor-pointer hover:bg-blue-50/50">
                  <td className="px-2.5 py-1.5 text-slate-800">{p.name}{p.strength ? ` ${p.strength}` : ''}</td>
                  <td className="px-2.5 py-1.5 text-center tabular-nums">{p.qty}</td>
                  <td className="px-2.5 py-1.5 text-center tabular-nums">{p.min_stock_level}</td>
                  <td className="px-2.5 py-1.5"><span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${p.qty <= 0 ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-700'}`}>{p.qty <= 0 ? 'Out of stock' : 'Low stock'}</span></td>
                </tr>))}</tbody>
            </table></div>)}
        </Panel>

        <Panel title="Expiring Soon" sub={`Batches nearing expiry (within ${EXPIRY_WARNING_DAYS} days)`} Icon={CalendarClock} action="View All" onAction={() => onNavigate('stock-alerts:expiry')}>
          {expiring.length === 0 ? <NoData>No batches expire in the next {EXPIRY_WARNING_DAYS} days.</NoData> : (
            <div className="overflow-x-auto"><table className="w-full text-xs">
              <thead><tr className="bg-slate-50 text-slate-600 text-xs"><th className="text-left font-semibold px-2.5 py-1.5">Product</th><th className="text-left font-semibold px-2.5 py-1.5">Batch No.</th><th className="text-left font-semibold px-2.5 py-1.5">Expiry Date</th><th className="text-left font-semibold px-2.5 py-1.5">Days Left</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{expiring.slice(0, 4).map((b) => (
                <tr key={b.id} onClick={() => onNavigate('inventory')} className="cursor-pointer hover:bg-blue-50/50">
                  <td className="px-2.5 py-1.5 text-slate-800">{b.product_name}</td>
                  <td className="px-2.5 py-1.5 text-slate-700">{b.batch_number}</td>
                  <td className="px-2.5 py-1.5 text-slate-700 whitespace-nowrap">{formatDateDeterministic(b.expiry_date)}</td>
                  <td className="px-2.5 py-1.5"><span className={`px-2 py-0.5 rounded-md text-xs font-semibold whitespace-nowrap ${b.days_to_expiry <= 30 ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-700'}`}>{b.days_to_expiry <= 0 ? 'Expired' : `${b.days_to_expiry} days`}</span></td>
                </tr>))}</tbody>
            </table></div>)}
        </Panel>
      </div>

    </div>
  );
}
