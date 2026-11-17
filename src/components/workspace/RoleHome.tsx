import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, ShoppingCart, Pill, AlertTriangle, PackageX, CalendarClock, Truck, Wallet, TrendingUp, Receipt, CheckCircle2, ClipboardList } from 'lucide-react';
import type { Workspace } from '@/lib/pharmacy-types';
import { RoleHomeService } from '@/lib/pharmacy-service';
import { DeliveryService } from '@/lib/delivery-service';
import { HOME_COPY, type HomeKind } from '@/lib/role-home';
import { cardCls } from './ws-ui';

const tzs = (n: number) => `TZS ${Math.round(n).toLocaleString()}`;
type Kpi = { label: string; value: string; Icon: typeof ShoppingCart; tone: string; tab?: string };

export function RoleHome({ ws, userId, kind, onNavigate }: { ws: Workspace; userId: string; kind: Exclude<HomeKind, 'business'>; onNavigate: (tab: string) => void }) {
  const queryClient = useQueryClient();
  const copy = HOME_COPY[kind];
  const { data, isLoading, error } = useQuery({ queryKey: ['role-home', ws.id, userId, kind], queryFn: () => RoleHomeService.load(ws.id, userId, kind), refetchInterval: kind === 'rider' ? 10000 : false });
  useEffect(() => {
    if (kind !== 'rider') return;
    return DeliveryService.subscribe(ws.id, () => { void queryClient.invalidateQueries({ queryKey: ['role-home', ws.id, userId, kind] }); });
  }, [kind, queryClient, userId, ws.id]);
  const s = data?.stats ?? {};
  const n = (k: string) => String(s[k] ?? 0);
  const kpis: Kpi[] = {
    cashier: [
      { label: 'My sales today', value: n('mySalesCount'), Icon: ShoppingCart, tone: 'bg-blue-50 text-blue-600', tab: 'pos' },
      { label: 'My takings today', value: tzs(s["mySalesTotal"] ?? 0), Icon: Wallet, tone: 'bg-emerald-50 text-emerald-600' },
      { label: 'Cash today', value: tzs(data?.byMethod["cash"] ?? 0), Icon: Receipt, tone: 'bg-amber-50 text-amber-600' },
    ],
    pharmacist: [
      { label: 'Prescriptions waiting', value: n('rxPending'), Icon: Pill, tone: 'bg-blue-50 text-blue-600', tab: 'rx' },
      { label: 'Dispensed today', value: n('rxDispensed'), Icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-600', tab: 'rx' },
      { label: 'Expiring ≤ 90 days', value: n('expiring'), Icon: CalendarClock, tone: 'bg-amber-50 text-amber-600', tab: 'stock-alerts:expiry' },
      { label: 'My sales today', value: tzs(s["mySalesTotal"] ?? 0), Icon: Wallet, tone: 'bg-violet-50 text-violet-600', tab: 'pos' },
    ],
    inventory: [
      { label: 'Out of stock', value: n('outOfStock'), Icon: PackageX, tone: 'bg-rose-50 text-rose-600', tab: 'stock-alerts' },
      { label: 'Low stock', value: n('lowStock'), Icon: AlertTriangle, tone: 'bg-amber-50 text-amber-600', tab: 'stock-alerts' },
      { label: 'Expiring ≤ 90 days', value: n('expiring'), Icon: CalendarClock, tone: 'bg-orange-50 text-orange-600', tab: 'stock-alerts:expiry' },
      { label: 'Supplier orders pending', value: n('ordersPending'), Icon: ClipboardList, tone: 'bg-blue-50 text-blue-600', tab: 'orders' },
    ],
    accountant: [
      { label: 'Sales this month', value: tzs(s["monthSales"] ?? 0), Icon: TrendingUp, tone: 'bg-blue-50 text-blue-600', tab: 'sales-reports' },
      { label: 'Number of sales', value: n('monthSalesCount'), Icon: ShoppingCart, tone: 'bg-violet-50 text-violet-600', tab: 'sales-reports' },
      { label: 'Expenses this month', value: tzs(s["monthExpenses"] ?? 0), Icon: Receipt, tone: 'bg-rose-50 text-rose-600', tab: 'expenses' },
      { label: 'Sales minus expenses', value: tzs(s["monthNet"] ?? 0), Icon: Wallet, tone: 'bg-emerald-50 text-emerald-600' },
    ],
    rider: [
      { label: 'Available deliveries', value: n('available'), Icon: Truck, tone: 'bg-blue-50 text-blue-600', tab: 'deliveries' },
      { label: 'My open deliveries', value: n('assigned'), Icon: Truck, tone: 'bg-violet-50 text-violet-600', tab: 'deliveries' },
      { label: 'Delivered', value: n('delivered'), Icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-600', tab: 'deliveries' },
    ],
  }[kind];
  const listTitle = kind === 'rider' ? 'Available and assigned deliveries' : kind === 'pharmacist' || kind === 'inventory' ? 'Dispense / sell first (nearest expiry)' : null;

  return (
    <div className="space-y-4">
      <div><h1 className="text-2xl font-black text-slate-900">{copy.title}</h1><p className="text-sm text-slate-500">{copy.subtitle}</p></div>
      {error && <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm text-rose-800">{error instanceof Error ? error.message : 'Could not load your dashboard'}</div>}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <button key={k.label} disabled={!k.tab} onClick={() => k.tab && onNavigate(k.tab)} className={`${cardCls} p-4 text-left flex items-center gap-3 enabled:hover:border-blue-300`}>
            <span className={`w-10 h-10 rounded-xl flex items-center justify-center ${k.tone}`}><k.Icon className="w-5 h-5" /></span>
            <span><span className="block text-[11px] font-bold text-slate-500">{k.label}</span><span className="block text-lg font-black text-slate-900">{isLoading ? '…' : k.value}</span></span>
          </button>))}
      </div>
      <div className="grid lg:grid-cols-3 gap-4">
        <div className={`${cardCls} p-4 space-y-2`}>
          <h2 className="font-black text-slate-900">Quick actions</h2>
          {copy.actions.map((a) => (
            <button key={a.tab} onClick={() => onNavigate(a.tab)} className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-left">
              <span><span className="block text-sm font-bold text-blue-800">{a.label}</span><span className="block text-[11px] text-blue-600">{a.hint}</span></span><ArrowRight className="w-4 h-4 text-blue-600" />
            </button>))}
        </div>
        {listTitle && (
          <div className={`${cardCls} p-4 lg:col-span-2`}>
            <h2 className="font-black text-slate-900 mb-2">{listTitle}</h2>
            {(data?.rows.length ?? 0) === 0 ? <p className="text-sm text-slate-400 py-6 text-center">{isLoading ? 'Loading…' : 'Nothing here right now.'}</p> : (
              <ul className="divide-y divide-slate-100">{data!.rows.map((r, i) => (
                <li key={i} className="py-2 flex items-center justify-between gap-3 text-sm"><span className="min-w-0"><span className="block font-bold text-slate-800 truncate">{r.label}</span><span className="block text-[11px] text-slate-500">{r.sub}</span></span><span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 whitespace-nowrap capitalize">{r.badge}</span></li>))}</ul>)}
          </div>)}
      </div>
    </div>
  );
}
