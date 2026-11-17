import { useMemo, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ShoppingCart, CheckCircle2, XCircle, Wallet, Boxes, CalendarClock, AlertTriangle, ArrowRight, Download, Search, Bell, Upload, MessageCircle, Package } from 'lucide-react';
import type { Workspace } from '@/lib/pharmacy-types';
import { WholesaleService, SupplierPortalService, NotificationService, type WholesaleOrder } from '@/lib/pharmacy-service';
import { batchStatus, availableUnits, ORDER_STATUS_LABEL, isConfirmedOrder, notificationGroup, type BatchStatus } from '@/lib/supplier-portal';
import { cardCls, inputCls, ghostBtn, primaryBtn } from './ws-ui';
import { WholesaleChat } from './WholesaleChat';

const tzs = (n: number) => `TZS ${Math.round(n).toLocaleString()}`;
const day = (s: string) => new Date(s).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
const csv = (name: string, rows: (string | number)[][]) => {
  const body = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([body], { type: 'text/csv' })); a.download = name; a.click();
};

function Header({ title, sub, right }: { title: string; sub: string; right?: ReactNode }) {
  return <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-black text-slate-900">{title}</h1><p className="text-sm text-slate-500">{sub}</p></div>{right}</div>;
}
function Kpi({ label, value, Icon, tone, onClick }: { label: string; value: string | number; Icon: typeof ShoppingCart; tone: string; onClick?: () => void }) {
  return <button disabled={!onClick} onClick={onClick} className={`${cardCls} p-4 text-left flex items-center gap-3 enabled:hover:border-blue-300`}>
    <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${tone}`}><Icon className="w-5 h-5" /></span>
    <span className="min-w-0"><span className="block text-[11px] font-bold text-slate-500">{label}</span><span className="block text-lg font-black text-slate-900 truncate">{value}</span></span></button>;
}
const pill: Record<string, string> = { 'Quote requested': 'bg-violet-50 text-violet-700', Quoted: 'bg-violet-50 text-violet-700', Cancelled: 'bg-slate-100 text-slate-500', New: 'bg-blue-50 text-blue-700', Confirmed: 'bg-indigo-50 text-indigo-700', Preparing: 'bg-amber-50 text-amber-700', Dispatched: 'bg-sky-50 text-sky-700', 'In transit': 'bg-sky-50 text-sky-700', Delivered: 'bg-teal-50 text-teal-700', Received: 'bg-emerald-50 text-emerald-700', Rejected: 'bg-rose-50 text-rose-700' };
const StatusPill = ({ s }: { s: string }) => { const l = ORDER_STATUS_LABEL[s] ?? s; return <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${pill[l] ?? 'bg-slate-100 text-slate-600'}`}>{l}</span>; };
const Empty = ({ text }: { text: string }) => <p className="text-sm text-slate-400 py-8 text-center">{text}</p>;

function useOrders(ws: Workspace) { return useQuery({ queryKey: ['wholesale-orders', ws.id, 'supplier'], queryFn: () => WholesaleService.orders(ws.id, 'supplier') }); }
function useBatches(ws: Workspace) { return useQuery({ queryKey: ['supplier-batches', ws.id], queryFn: () => SupplierPortalService.batches(ws.id) }); }

export function SupplierDashboard({ ws, onNavigate }: { ws: Workspace; onNavigate: (t: string) => void }) {
  const { data: orders = [] } = useOrders(ws); const { data: batches = [] } = useBatches(ws);
  const month = new Date(); month.setDate(1); month.setHours(0, 0, 0, 0);
  const pending = orders.filter((o) => o.status === 'payment_submitted');
  const confirmedMonth = orders.filter((o) => isConfirmedOrder(o.status) && new Date(o.reviewed_at ?? o.created_at) >= month);
  const near = batches.filter((b) => batchStatus(b) === 'near_expiry').length;
  const top = useMemo(() => { const m = new Map<string, number>(); for (const b of batches) if (batchStatus(b) !== 'expired') m.set(b.name, (m.get(b.name) ?? 0) + b.qty); return [...m].sort((a, b) => b[1] - a[1]).slice(0, 5); }, [batches]);
  const max = top[0]?.[1] ?? 1;
  return <div className="space-y-4">
    <Header title="Supplier Dashboard" sub="Manage pharmacy orders, stock availability, payments and performance." />
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
      <Kpi label="New orders" value={pending.length} Icon={ShoppingCart} tone="bg-blue-50 text-blue-600" onClick={() => onNavigate('orders')} />
      <Kpi label="Confirmed this month" value={confirmedMonth.length} Icon={CheckCircle2} tone="bg-emerald-50 text-emerald-600" onClick={() => onNavigate('orders')} />
      <Kpi label="Sales this month" value={tzs(confirmedMonth.reduce((a, o) => a + o.total_amount, 0))} Icon={Wallet} tone="bg-violet-50 text-violet-600" onClick={() => onNavigate('payments')} />
      <Kpi label="Awaiting payment check" value={tzs(pending.reduce((a, o) => a + o.total_amount, 0))} Icon={Wallet} tone="bg-amber-50 text-amber-600" onClick={() => onNavigate('payments')} />
      <Kpi label="Units available" value={availableUnits(batches).toLocaleString()} Icon={Boxes} tone="bg-sky-50 text-sky-600" onClick={() => onNavigate('availability')} />
      <Kpi label="Near expiry batches" value={near} Icon={CalendarClock} tone="bg-orange-50 text-orange-600" onClick={() => onNavigate('availability')} />
    </div>
    <div className="grid xl:grid-cols-3 gap-4">
      <div className={`${cardCls} p-4 xl:col-span-2 overflow-x-auto`}>
        <div className="flex justify-between mb-2"><h2 className="font-black">Recent Purchase Orders</h2><button onClick={() => onNavigate('orders')} className="text-xs font-bold text-blue-600">View All Orders →</button></div>
        {orders.length === 0 ? <Empty text="No orders yet." /> : <table className="w-full text-sm"><thead className="text-[11px] text-slate-500 text-left"><tr><th className="py-1">Order No.</th><th>Pharmacy</th><th>Items</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
          <tbody>{orders.slice(0, 6).map((o) => <tr key={o.id} className="border-t border-slate-100"><td className="py-2 font-bold text-blue-600">{o.order_number}</td><td>{o.buyer_name}</td><td>{o.items.length}</td><td>{tzs(o.total_amount)}</td><td><StatusPill s={o.status} /></td><td>{day(o.created_at)}</td></tr>)}</tbody></table>}
      </div>
      <div className={`${cardCls} p-4 space-y-2`}>
        <h2 className="font-black">Quick Actions</h2>
        {[['inventory', 'Add Product'], ['imports', 'Import Bulk Medicines'], ['orders', 'Confirm Orders'], ['invoices', 'Create Invoice'], ['messages', 'Messages']].map(([t, l]) =>
          <button key={t} onClick={() => onNavigate(t!)} className="w-full flex justify-between items-center px-3 py-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-sm font-bold text-blue-800">{l}<ArrowRight className="w-4 h-4" /></button>)}
      </div>
      <div className={`${cardCls} p-4`}>
        <div className="flex justify-between mb-2"><h2 className="font-black">Top Available Medicines</h2><button onClick={() => onNavigate('availability')} className="text-xs font-bold text-blue-600">View Stock →</button></div>
        {top.length === 0 ? <Empty text="No stock yet." /> : top.map(([n, q]) => <div key={n} className="flex items-center gap-2 text-xs py-1"><span className="w-32 truncate font-bold">{n}</span><span className="flex-1 h-2 rounded bg-slate-100"><span className="block h-2 rounded bg-blue-600" style={{ width: `${(q / max) * 100}%` }} /></span><span className="w-20 text-right">{q.toLocaleString()} units</span></div>)}
      </div>
      <div className={`${cardCls} p-4 xl:col-span-2`}>
        <div className="flex justify-between mb-2"><h2 className="font-black">Recent Payments</h2><button onClick={() => onNavigate('payments')} className="text-xs font-bold text-blue-600">View All →</button></div>
        {orders.length === 0 ? <Empty text="No payments yet." /> : orders.slice(0, 5).map((o) => <div key={o.id} className="flex justify-between text-sm border-t border-slate-100 py-2"><span>{o.order_number} · {o.buyer_name}</span><span className="font-bold">{tzs(o.total_amount)}</span><StatusPill s={o.status} /></div>)}
      </div>
    </div>
  </div>;
}

const BS_LABEL: Record<BatchStatus, [string, string]> = { in_stock: ['In Stock', 'bg-emerald-50 text-emerald-700'], low: ['Low Stock', 'bg-amber-50 text-amber-700'], near_expiry: ['Near Expiry', 'bg-orange-50 text-orange-700'], expired: ['Expired', 'bg-rose-50 text-rose-700'], out: ['Out of Stock', 'bg-slate-100 text-slate-600'] };
export function InventoryAvailability({ ws }: { ws: Workspace }) {
  const { data: batches = [], isLoading } = useBatches(ws);
  const [q, setQ] = useState(''); const [wh, setWh] = useState(''); const [st, setSt] = useState(''); const [page, setPage] = useState(0);
  const rows = batches.map((b) => ({ ...b, st: batchStatus(b) })).filter((b) => (!q || `${b.name} ${b.batch}`.toLowerCase().includes(q.toLowerCase())) && (!wh || b.warehouse === wh) && (!st || b.st === st));
  const whs = [...new Set(batches.map((b) => b.warehouse))];
  const pageRows = rows.slice(page * 20, page * 20 + 20);
  return <div className="space-y-4">
    <Header title="Inventory Availability" sub="Batch-level stock, expiry tracking and availability across your warehouses." right={<button className={primaryBtn} onClick={() => csv('inventory-availability.csv', [['Medicine', 'Batch', 'Warehouse', 'Units', 'Expiry', 'Reorder level', 'Status'], ...rows.map((r) => [r.name, r.batch, r.warehouse, r.qty, r.expiry, r.min, BS_LABEL[r.st][0]])])}><Download className="w-4 h-4" />Export</button>} />
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      <Kpi label="Units available" value={availableUnits(batches).toLocaleString()} Icon={Boxes} tone="bg-blue-50 text-blue-600" />
      <Kpi label="Batches" value={batches.length} Icon={Package} tone="bg-violet-50 text-violet-600" />
      <Kpi label="Near expiry" value={batches.filter((b) => batchStatus(b) === 'near_expiry').length} Icon={CalendarClock} tone="bg-orange-50 text-orange-600" onClick={() => setSt('near_expiry')} />
      <Kpi label="Low stock" value={batches.filter((b) => batchStatus(b) === 'low').length} Icon={AlertTriangle} tone="bg-amber-50 text-amber-600" onClick={() => setSt('low')} />
      <Kpi label="Expired (not sellable)" value={batches.filter((b) => batchStatus(b) === 'expired').length} Icon={XCircle} tone="bg-rose-50 text-rose-600" onClick={() => setSt('expired')} />
    </div>
    <div className={`${cardCls} p-3 flex flex-wrap gap-2`}>
      <div className="relative flex-1 min-w-[200px]"><Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" /><input className={`${inputCls} pl-9`} placeholder="Search medicine or batch no." value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} /></div>
      <select className={`${inputCls} w-auto`} value={wh} onChange={(e) => setWh(e.target.value)}><option value="">All warehouses</option>{whs.map((w) => <option key={w}>{w}</option>)}</select>
      <select className={`${inputCls} w-auto`} value={st} onChange={(e) => setSt(e.target.value)}><option value="">All stock status</option>{Object.entries(BS_LABEL).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select>
    </div>
    <div className={`${cardCls} overflow-x-auto`}>
      <table className="w-full text-sm"><thead className="bg-[#0F2A5F] text-white text-[11px] text-left"><tr>{['Medicine', 'Batch No.', 'Warehouse', 'Available units', 'Expiry date', 'Reorder level', 'Status'].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}</tr></thead>
        <tbody>{pageRows.map((r) => <tr key={r.id} className="border-t border-slate-100"><td className="px-3 py-2"><div className="font-bold">{r.name}</div><div className="text-[11px] text-slate-500">{r.detail}</div></td><td className="px-3">{r.batch}</td><td className="px-3">{r.warehouse}</td><td className="px-3">{r.qty.toLocaleString()}</td><td className="px-3">{day(r.expiry)}</td><td className="px-3">{r.min}</td><td className="px-3"><span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${BS_LABEL[r.st][1]}`}>{BS_LABEL[r.st][0]}</span></td></tr>)}</tbody></table>
      {rows.length === 0 && <Empty text={isLoading ? 'Loading…' : 'No batches match.'} />}
      <div className="flex justify-between items-center p-3 text-xs text-slate-500">Showing {rows.length ? page * 20 + 1 : 0}–{Math.min(rows.length, page * 20 + 20)} of {rows.length} batches
        <span className="flex gap-2"><button className={ghostBtn} disabled={page === 0} onClick={() => setPage(page - 1)}>Prev</button><button className={ghostBtn} disabled={(page + 1) * 20 >= rows.length} onClick={() => setPage(page + 1)}>Next</button></span></div>
    </div>
  </div>;
}

export function SupplierPayments({ ws }: { ws: Workspace }) {
  const { data: orders = [] } = useOrders(ws);
  const [st, setSt] = useState(''); const [method, setMethod] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const rows = orders.filter((o) => (!st || o.status === st) && (!method || o.payment_method === method));
  const methods = [...new Set(orders.map((o) => o.payment_method))];
  const collected = orders.filter((o) => isConfirmedOrder(o.status)).reduce((a, o) => a + o.total_amount, 0);
  const openReceipt = async (o: WholesaleOrder) => { if (!o.receipt_path) return; setBusy(o.id); try { window.open(await WholesaleService.receiptUrl(o.receipt_path), '_blank'); } finally { setBusy(null); } };
  return <div className="space-y-4">
    <Header title="Payments" sub="Payment proofs from pharmacies; confirming the order on Purchase Orders verifies the payment." right={<button className={primaryBtn} onClick={() => csv('payment-ledger.csv', [['Order', 'Pharmacy', 'Amount', 'Method', 'Reference', 'Submitted', 'Status'], ...rows.map((o) => [o.order_number, o.buyer_name, o.total_amount, o.payment_method, o.payment_reference ?? '', o.created_at, ORDER_STATUS_LABEL[o.status] ?? o.status])])}><Download className="w-4 h-4" />Export Ledger</button>} />
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Kpi label="Total collected (confirmed)" value={tzs(collected)} Icon={Wallet} tone="bg-emerald-50 text-emerald-600" onClick={() => setSt('')} />
      <Kpi label="Waiting for your check" value={tzs(orders.filter((o) => o.status === 'payment_submitted').reduce((a, o) => a + o.total_amount, 0))} Icon={CalendarClock} tone="bg-amber-50 text-amber-600" onClick={() => setSt('payment_submitted')} />
      <Kpi label="Payment methods" value={methods.length} Icon={Wallet} tone="bg-blue-50 text-blue-600" />
      <Kpi label="Paying pharmacies" value={new Set(orders.map((o) => o.buyer_pharmacy_id)).size} Icon={ShoppingCart} tone="bg-violet-50 text-violet-600" />
    </div>
    <div className={`${cardCls} p-3 flex flex-wrap gap-2`}>
      <select className={`${inputCls} w-auto`} value={st} onChange={(e) => setSt(e.target.value)}><option value="">All statuses</option>{Object.entries(ORDER_STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
      <select className={`${inputCls} w-auto`} value={method} onChange={(e) => setMethod(e.target.value)}><option value="">All methods</option>{methods.map((m) => <option key={m}>{m}</option>)}</select>
      <button className={ghostBtn} onClick={() => { setSt(''); setMethod(''); }}>Reset</button>
    </div>
    <div className={`${cardCls} overflow-x-auto`}><table className="w-full text-sm"><thead className="bg-[#0F2A5F] text-white text-[11px] text-left"><tr>{['Order', 'Pharmacy', 'Amount', 'Method', 'Reference', 'Submitted', 'Status', 'Proof'].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}</tr></thead>
      <tbody>{rows.map((o) => <tr key={o.id} className="border-t border-slate-100"><td className="px-3 py-2 font-bold text-blue-600">{o.order_number}</td><td className="px-3">{o.buyer_name}</td><td className="px-3">{tzs(o.total_amount)}</td><td className="px-3 capitalize">{o.payment_method.replace(/_/g, ' ')}</td><td className="px-3">{o.payment_reference || '—'}</td><td className="px-3">{day(o.created_at)}</td><td className="px-3"><StatusPill s={o.status} /></td>
        <td className="px-3">{o.receipt_path ? <button className={ghostBtn} disabled={busy === o.id} onClick={() => void openReceipt(o)}>View</button> : '—'}</td></tr>)}</tbody></table>
      {rows.length === 0 && <Empty text="No payments match." />}</div>
  </div>;
}

export function SupplierReports({ ws }: { ws: Workspace }) {
  const { data: orders = [] } = useOrders(ws);
  const [days, setDays] = useState(30);
  const since = Date.now() - days * 86400000;
  const rows = orders.filter((o) => new Date(o.created_at).getTime() >= since);
  const trend = useMemo(() => { const m = new Map<string, number>(); for (let i = days - 1; i >= 0; i--) m.set(new Date(Date.now() - i * 86400000).toISOString().slice(0, 10), 0); for (const o of rows) { const k = o.created_at.slice(0, 10); if (m.has(k)) m.set(k, m.get(k)! + 1); } return [...m]; }, [rows, days]);
  const peak = Math.max(1, ...trend.map((t) => t[1]));
  const byStatus = Object.keys(ORDER_STATUS_LABEL).map((k) => [ORDER_STATUS_LABEL[k]!, rows.filter((o) => o.status === k).length] as const);
  const products = useMemo(() => { const m = new Map<string, [number, number]>(); for (const o of rows) if (isConfirmedOrder(o.status)) for (const i of o.items) { const c = m.get(i.product_name) ?? [0, 0]; m.set(i.product_name, [c[0] + i.quantity, c[1] + i.total_price]); } return [...m].sort((a, b) => b[1][1] - a[1][1]).slice(0, 8); }, [rows]);
  return <div className="space-y-4">
    <Header title="Reports" sub="Your orders, sales and best-selling products on the marketplace." right={<div className="flex gap-2"><select className={`${inputCls} w-auto`} value={days} onChange={(e) => setDays(Number(e.target.value))}>{[7, 30, 90, 365].map((d) => <option key={d} value={d}>Last {d} days</option>)}</select>
      <button className={primaryBtn} onClick={() => csv(`orders-report-${days}d.csv`, [['Order', 'Pharmacy', 'Items', 'Amount', 'Status', 'Date'], ...rows.map((o) => [o.order_number, o.buyer_name, o.items.length, o.total_amount, ORDER_STATUS_LABEL[o.status] ?? o.status, o.created_at])])}><Download className="w-4 h-4" />Export</button></div>} />
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Kpi label="Orders" value={rows.length} Icon={ShoppingCart} tone="bg-blue-50 text-blue-600" />
      <Kpi label="Confirmed sales" value={tzs(rows.filter((o) => isConfirmedOrder(o.status)).reduce((a, o) => a + o.total_amount, 0))} Icon={Wallet} tone="bg-emerald-50 text-emerald-600" />
      <Kpi label="Rejected" value={rows.filter((o) => o.status === 'rejected').length} Icon={XCircle} tone="bg-rose-50 text-rose-600" />
      <Kpi label="Pharmacies served" value={new Set(rows.map((o) => o.buyer_pharmacy_id)).size} Icon={CheckCircle2} tone="bg-violet-50 text-violet-600" />
    </div>
    <div className="grid lg:grid-cols-3 gap-4">
      <div className={`${cardCls} p-4 lg:col-span-2`}><h2 className="font-black mb-3">Orders Trend</h2>
        <div className="flex items-end gap-px h-40">{trend.map(([d, v]) => <div key={d} title={`${d}: ${v}`} className="flex-1 bg-blue-500/80 rounded-t" style={{ height: `${(v / peak) * 100}%`, minHeight: v ? 4 : 1 }} />)}</div></div>
      <div className={`${cardCls} p-4`}><h2 className="font-black mb-3">Orders by Status</h2>{byStatus.map(([l, n]) => <div key={l} className="flex justify-between text-sm py-1.5 border-t border-slate-100"><span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${pill[l]}`}>{l}</span><span className="font-bold">{n}</span></div>)}</div>
      <div className={`${cardCls} p-4 lg:col-span-3 overflow-x-auto`}><h2 className="font-black mb-2">Top Products (confirmed orders)</h2>
        {products.length === 0 ? <Empty text="No confirmed sales in this period." /> : <table className="w-full text-sm"><thead className="text-[11px] text-slate-500 text-left"><tr><th>Product</th><th>Units sold</th><th>Revenue</th></tr></thead><tbody>{products.map(([n, [u, r]]) => <tr key={n} className="border-t border-slate-100"><td className="py-2 font-bold">{n}</td><td>{u.toLocaleString()}</td><td>{tzs(r)}</td></tr>)}</tbody></table>}</div>
    </div>
  </div>;
}

const GROUP_LABEL = { order: 'Order', payment: 'Payment', inventory: 'Inventory', delivery: 'Delivery', system: 'System' } as const;
export function SupplierNotifications({ ws }: { ws: Workspace }) {
  const qc = useQueryClient();
  const { data = [], refetch } = useQuery({ queryKey: ['supplier-notifications', ws.id], queryFn: () => SupplierPortalService.notifications(ws.id) });
  const [type, setType] = useState(''); const [q, setQ] = useState(''); const [unreadOnly, setUnreadOnly] = useState(false);
  const rows = data.map((n) => ({ ...n, g: notificationGroup(n.kind, n.title) })).filter((n) => (!type || n.g === type) && (!unreadOnly || !n.read_at) && (!q || `${n.title} ${n.body}`.toLowerCase().includes(q.toLowerCase())));
  const done = () => { void refetch(); void qc.invalidateQueries({ queryKey: ['notifications'] }); };
  return <div className="space-y-4">
    <Header title="Notifications Center" sub="Orders, payments, inventory and system notices." right={<button className={primaryBtn} onClick={() => void NotificationService.markAllRead().then(done)}><CheckCircle2 className="w-4 h-4" />Mark all as read</button>} />
    <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
      <Kpi label="Unread" value={data.filter((n) => !n.read_at).length} Icon={Bell} tone="bg-rose-50 text-rose-600" onClick={() => setUnreadOnly(true)} />
      {(Object.keys(GROUP_LABEL) as (keyof typeof GROUP_LABEL)[]).map((g) => <Kpi key={g} label={`${GROUP_LABEL[g]} alerts`} value={data.filter((n) => notificationGroup(n.kind, n.title) === g).length} Icon={Bell} tone="bg-blue-50 text-blue-600" onClick={() => setType(g)} />)}
    </div>
    <div className={`${cardCls} p-3 flex flex-wrap gap-2`}>
      <select className={`${inputCls} w-auto`} value={type} onChange={(e) => setType(e.target.value)}><option value="">All types</option>{Object.entries(GROUP_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
      <label className="flex items-center gap-1 text-xs font-bold"><input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} />Unread only</label>
      <input className={`${inputCls} flex-1 min-w-[200px]`} placeholder="Search notifications" value={q} onChange={(e) => setQ(e.target.value)} />
    </div>
    <div className={`${cardCls} overflow-x-auto`}><table className="w-full text-sm"><thead className="bg-[#0F2A5F] text-white text-[11px] text-left"><tr>{['Type', 'Title', 'Message', 'Time', 'Status', ''].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}</tr></thead>
      <tbody>{rows.map((n) => <tr key={n.id} className="border-t border-slate-100"><td className="px-3 py-2">{GROUP_LABEL[n.g]}</td><td className="px-3 font-bold">{n.title}</td><td className="px-3 text-slate-600">{n.body}</td><td className="px-3 whitespace-nowrap">{new Date(n.created_at).toLocaleString()}</td><td className="px-3">{n.read_at ? 'Read' : <span className="text-blue-700 font-bold">Unread</span>}</td>
        <td className="px-3">{!n.read_at && <button className={ghostBtn} onClick={() => void NotificationService.markRead(n.id).then(done)}>Mark read</button>}</td></tr>)}</tbody></table>
      {rows.length === 0 && <Empty text="No notifications." />}</div>
  </div>;
}

export function SupplierMessages({ ws }: { ws: Workspace }) {
  const { data = [], isLoading } = useQuery({ queryKey: ['supplier-convos', ws.id], queryFn: () => SupplierPortalService.conversations(ws.id), refetchInterval: 15000 });
  const { data: orders = [] } = useOrders(ws);
  const [q, setQ] = useState(''); const [open, setOpen] = useState<{ id: string; name: string } | null>(null);
  const extra = [...new Map(orders.filter((o) => !data.some((c) => c.buyerId === o.buyer_pharmacy_id)).map((o) => [o.buyer_pharmacy_id, o.buyer_name])).entries()];
  const list = data.filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase()));
  return <div className="space-y-4">
    <Header title="Messages" sub="Chat in real time with the pharmacies that order from you." />
    <div className={`${cardCls} p-3 max-w-2xl`}>
      <input className={inputCls} placeholder="Search conversations" value={q} onChange={(e) => setQ(e.target.value)} />
      <ul className="divide-y divide-slate-100 mt-2">
        {list.map((c) => <li key={c.buyerId}><button onClick={() => setOpen({ id: c.buyerId, name: c.name })} className="w-full text-left py-3 px-2 hover:bg-slate-50 rounded-lg flex justify-between gap-3"><span className="min-w-0"><span className="block font-bold">{c.name}</span><span className="block text-xs text-slate-500 truncate">{c.last}</span></span><span className="text-[11px] text-slate-400 whitespace-nowrap">{new Date(c.at).toLocaleString()}</span></button></li>)}
        {extra.map(([id, name]) => <li key={id}><button onClick={() => setOpen({ id, name })} className="w-full text-left py-3 px-2 hover:bg-slate-50 rounded-lg flex items-center gap-2"><MessageCircle className="w-4 h-4 text-blue-600" /><span className="font-bold">{name}</span><span className="text-xs text-slate-500">Start a chat (has ordered from you)</span></button></li>)}
      </ul>
      {list.length + extra.length === 0 && <Empty text={isLoading ? 'Loading…' : 'No conversations yet. Pharmacies can message you from Restock.'} />}
    </div>
    {open && <WholesaleChat buyerId={open.id} supplierId={ws.id} side="supplier" myName={ws.name} partnerName={open.name} onClose={() => setOpen(null)} />}
  </div>;
}
