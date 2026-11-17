import { MobileNavigation } from '@/components/common/MobileNavigation';
import { PlanFeatureGate } from './PlanFeatureGate';
import { RecordsTab } from './RecordsTab';
import { AIReportsTab } from './AIReportsTab';
import { SalesReportsTab } from './SalesReportsTab';
import { ImportsTab } from './ImportsTab';
import { BRAND } from '@/lib/brand';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Link } from '@tanstack/react-router';
import { LayoutDashboard, GitBranch, Users2, Boxes, DollarSign, LogOut, AlertTriangle, ShoppingCart, ClipboardList, Store, Pill, Clock, FileText, BarChart3 } from 'lucide-react';
import type { Workspace } from '@/lib/pharmacy-types';
import { can, canOrderStock, isReadOnly, roleLabel, STAFF_ROLES, type WorkspaceRole } from '@/lib/workspace';
import { STATUS_LABELS, expiryReminder } from '@/lib/billing';
import { NotificationBell, type ExtraNotice } from '@/components/common/NotificationBell';
import { ReportButton } from './ReportButton';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BrandingService } from '@/lib/pharmacy-service';
import { toast } from 'sonner';
import { presetRange, type DateRange } from '@/lib/date-range';
import { DateRangeFilter } from '@/components/dashboard/DateRangeFilter';
import { OverviewTab } from './OverviewTab';
import { BranchesTab } from './BranchesTab';
import { StaffTab } from './StaffTab';
import { InventoryTab } from './InventoryTab';
import { ExpensesTab } from './ExpensesTab';
import { MarketplaceTab } from './MarketplaceTab';
import { OrdersTab } from './OrdersTab';
import { PosTab } from './PosTab';
import { DispenserTab } from './DispenserTab';
import { ShiftsTab } from './ShiftsTab';
import { ShiftButton } from './ShiftButton';
import { DeliveriesTab } from './DeliveriesTab';
import { Truck } from 'lucide-react';
import { DocumentsTab } from './DocumentsTab';
import { StockAlertsTab } from './StockAlertsTab';
import { RoleHome } from './RoleHome';
import { CovloTab } from './CovloTab';
import { MarketDemandTab } from './MarketDemandTab';
import { TrendingUp } from 'lucide-react';
import { Bot } from 'lucide-react';
import { SupplierDashboard, InventoryAvailability, SupplierPayments, SupplierReports, SupplierNotifications, SupplierMessages } from './SupplierPortal';
import { Bell, MessageCircle, Wallet, Layers, Upload, Settings as SettingsIcon } from 'lucide-react';
import { homeFor } from '@/lib/role-home';
import type { RestockPrefill } from '@/lib/supplier-match';

const sub = () => () => {};

export function PharmacyWorkspace({ ws: realWs, all, userId, onSwitch, onSignOut }: { ws: Workspace; all: Workspace[]; userId: string; onSwitch: (id: string) => void; onSignOut: () => void }) {
  const [viewAs, setViewAs] = useState<WorkspaceRole | null>(null);
  const ws: Workspace = viewAs ? { ...realWs, role: viewAs } : realWs;
  const canPreview = realWs.role === 'owner' || realWs.role === 'admin';
  const isMounted = useSyncExternalStore(sub, () => true, () => false);
  const [tab, setTabRaw] = useState('overview');
  const [alertView, setAlertView] = useState<'restock' | 'expiry'>('restock');
  const setTab = (t: string) => { if (t.startsWith('stock-alerts')) { setAlertView(t.endsWith(':expiry') ? 'expiry' : 'restock'); setTabRaw('stock-alerts'); } else setTabRaw(t); };
  const [prefill, setPrefill] = useState<RestockPrefill | null>(null);
  const [range, setRange] = useState<DateRange | null>(null);
  useEffect(() => setRange(presetRange('last30')), []);
  const readOnly = isReadOnly(ws.status, ws.role);
  const qc = useQueryClient();
  const { data: logo } = useQuery({ queryKey: ['logo', ws.id], queryFn: () => BrandingService.getLogoUrl(ws.id) });
  const uploadLogo = async (f: File | undefined) => {
    if (!f) return;
    try { await BrandingService.uploadLogo(ws.id, f); toast.success('Logo updated'); void qc.invalidateQueries({ queryKey: ['logo', ws.id] }); void qc.invalidateQueries({ queryKey: ['logos', ws.id] }); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Upload failed'); }
  };
  const rem = isMounted && ws.role === 'owner' ? expiryReminder(ws.status === 'trial' ? ws.trial_ends_at : ws.subscription_ends_at) : null;
  const extra: ExtraNotice[] = rem ? [{ id: 'expiry', kind: 'warning', link: '/account',
    title: rem.level === 'expired' ? 'Your account has expired' : `Your ${ws.status === 'trial' ? 'free trial' : 'yearly plan'} ends in ${rem.days} day${rem.days === 1 ? '' : 's'}`,
    body: 'Pay the yearly plan to keep using every feature.' }] : [];

  const supplierNav = [
    { s: 'Supplier Portal', id: 'overview', label: 'Dashboard', Icon: LayoutDashboard, show: true },
    { s: 'Supplier Portal', id: 'covlo', label: 'Covlo AI', Icon: Bot, show: true },
    { s: 'Supplier Portal', id: 'demand', label: 'Market Demand', Icon: TrendingUp, show: true },
    { s: 'Supplier Portal', id: 'orders', label: 'Purchase Orders', Icon: ShoppingCart, show: true },
    { s: 'Supplier Portal', id: 'inventory', label: 'Product Catalogue', Icon: Boxes, show: true },
    { s: 'Supplier Portal', id: 'imports', label: 'Bulk Import', Icon: Upload, show: can(ws.role, 'manageStock', 'active') },
    { s: 'Supplier Portal', id: 'availability', label: 'Inventory Availability', Icon: Layers, show: true },
    { s: 'Supplier Portal', id: 'deliveries', label: 'Deliveries & Tracking', Icon: Truck, show: true },
    { s: 'Supplier Portal', id: 'invoices', label: 'Invoices', Icon: FileText, show: true },
    { s: 'Supplier Portal', id: 'payments', label: 'Payments', Icon: Wallet, show: can(ws.role, 'viewFinance', ws.status) },
    { s: 'Supplier Portal', id: 'notifications', label: 'Notifications', Icon: Bell, show: true },
    { s: 'Supplier Portal', id: 'reports', label: 'Reports', Icon: BarChart3, show: can(ws.role, 'viewFinance', ws.status) },
    { s: 'Supplier Portal', id: 'ai-reports', label: 'AI Email Reports', Icon: ClipboardList, show: ws.role === 'owner' || ws.role === 'admin' },
    { s: 'Supplier Portal', id: 'messages', label: 'Messages', Icon: MessageCircle, show: true },
    { s: 'Team', id: 'staff', label: 'Staff & Roles', Icon: Users2, show: can(ws.role, 'manageBranches', 'active') },
    { s: 'Team', id: 'branches', label: 'Warehouses', Icon: GitBranch, show: true },
    { s: 'Team', id: 'shifts', label: 'Shifts', Icon: Clock, show: true },
    { s: 'Team', id: 'settings', label: 'Settings', Icon: SettingsIcon, show: ws.role === 'owner' || ws.role === 'admin' },
  ].filter((n) => n.show);

  const pharmacyNav = [
    { s: 'Main', id: 'overview', label: homeFor(ws.role) === 'business' ? 'Overview' : 'Dashboard', Icon: LayoutDashboard, show: true },
    { s: 'Main', id: 'covlo', label: 'Covlo AI', Icon: Bot, show: true },
    { s: 'Main', id: 'pos', label: 'Cashier (POS)', Icon: Store, show: ws.business_type === 'pharmacy' && can(ws.role, 'sell', 'active') },
    { s: 'Main', id: 'rx', label: 'Prescriptions', Icon: Pill, show: ws.business_type === 'pharmacy' && can(ws.role, 'sell', 'active') },
    { s: 'Main', id: 'documents', label: 'Documents', Icon: FileText, show: true },
    { s: 'Inventory & Procurement', id: 'inventory', label: ws.business_type === 'supplier' ? 'Wholesale catalog' : 'Inventory', Icon: Boxes, show: true },
    { s: 'Inventory & Procurement', id: 'stock-alerts', label: 'Stock Alerts', Icon: AlertTriangle, show: true },
    { s: 'Inventory & Procurement', id: 'categories', label: 'Categories', Icon: Boxes, show: can(ws.role, 'manageStock', 'active') },
    { s: 'Inventory & Procurement', id: 'imports', label: 'Bulk Imports', Icon: ClipboardList, show: can(ws.role, 'manageStock', 'active') || can(ws.role, 'manageStaff', 'active') },
    { s: 'Inventory & Procurement', id: 'restock', label: 'Restock (Suppliers)', Icon: ShoppingCart, show: ws.business_type === 'pharmacy' && canOrderStock(ws.role) },
    { s: 'Inventory & Procurement', id: 'orders', label: ws.business_type === 'supplier' ? 'Wholesale orders' : 'Supplier orders', Icon: ClipboardList, show: canOrderStock(ws.role) },
    { s: 'Inventory & Procurement', id: 'suppliers', label: 'Suppliers', Icon: Store, show: can(ws.role, 'manageStock', 'active') },
    { s: 'Operations', id: 'deliveries', label: 'Deliveries & Tracking', Icon: Truck, show: true },
    { s: 'Operations', id: 'branches', label: 'Branches', Icon: GitBranch, show: true },
    { s: 'Operations', id: 'staff', label: 'Staff & Roles', Icon: Users2, show: can(ws.role, 'manageBranches', 'active') },
    { s: 'Operations', id: 'shifts', label: 'Shifts', Icon: Clock, show: true },
    { s: 'Operations', id: 'expenses', label: 'Expenses', Icon: DollarSign, show: can(ws.role, 'viewFinance', ws.status) },
    { s: 'Insights & Reports', id: 'sales-reports', label: 'Sales Reports', Icon: BarChart3, show: true },
    { s: 'Insights & Reports', id: 'ai-reports', label: 'AI Email Reports', Icon: ClipboardList, show: ws.role==='owner'||ws.role==='admin' },
    { s: 'System', id: 'settings', label: 'Settings', Icon: GitBranch, show: ws.role === 'owner' || ws.role === 'admin' },
  ].filter((n) => n.show);
  const nav = ws.business_type === 'supplier' ? supplierNav : pharmacyNav;

  const navigation = (
      <aside className="flex w-full h-full max-h-screen bg-[#0F172A] text-slate-300 flex-col shrink-0">
        <div className="p-4 border-b border-slate-800 flex items-center gap-3 shrink-0">
          <label title={ws.role === 'owner' ? 'Upload logo' : ws.name} className={`w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-black text-xl overflow-hidden shrink-0 ${ws.role === 'owner' ? 'cursor-pointer' : ''}`}>
            {logo ? <img src={logo} alt={`${ws.name} logo`} className="w-full h-full object-contain" /> : <img src={BRAND.markUrl} alt="Afyadawa" className="w-full h-full object-contain" />}
            {ws.role === 'owner' && <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => void uploadLogo(e.target.files?.[0])} />}
          </label>
          <div className="min-w-0">
            <img src={BRAND.dashboardLogoUrl} alt="Afyadawa" className="h-auto w-36 max-h-8 object-contain object-left" />
            <div className="text-[11px] text-blue-400 font-bold">{ws.business_type === 'supplier' ? 'Supplier Dashboard' : 'Pharmacy Dashboard'}</div>
          </div>
        </div>
        <nav className="p-3 space-y-1 flex-1 min-h-0 overflow-y-auto">
          {nav.map((n, i) => (<div key={n.id}>
            {n.s !== nav[i - 1]?.s && <div className="px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">{n.s}</div>}
            <button onClick={() => setTab(n.id)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold ${tab === n.id ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 hover:text-white'}`}>
              <n.Icon className="w-4 h-4" /> {n.label}
            </button></div>))}
        </nav>
        <div className="p-3 border-t border-slate-800 shrink-0 bg-[#0F172A]"><button onClick={onSignOut} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold hover:bg-slate-800"><LogOut className="w-3.5 h-3.5" /> Sign out</button></div>
      </aside>
  );

  return (
    <div className="min-h-screen bg-[#F4F6FA] text-slate-900 flex font-sans antialiased">
      <div className="hidden xl:flex w-60 shrink-0 sticky top-0 h-screen self-start">{navigation}</div>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="bg-white border-b border-slate-200 px-4 sm:px-6 h-16 sticky top-0 z-30 flex items-center justify-between gap-3">
          <MobileNavigation>{navigation}</MobileNavigation>
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 min-w-0 flex-1">
            {all.length > 1 ? (
              <select aria-label="Pharmacy" className="font-black text-slate-900 bg-transparent text-sm w-full sm:w-auto max-w-[220px] min-w-0" value={ws.id} onChange={(e) => onSwitch(e.target.value)}>
                {all.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            ) : <span className="font-black text-slate-900 text-sm truncate">{ws.name}</span>}
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 self-start truncate max-w-full">{ws.plan_name} · {STATUS_LABELS[ws.status]}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0"><ShiftButton pid={realWs.id} userId={userId} onOpen={() => setTab('shifts')} /><NotificationBell extra={extra} />{canPreview ? (
            <select aria-label="Switch role view" title="See the workspace as each role sees it" value={viewAs ?? ''} onChange={(e) => { setViewAs((e.target.value || null) as WorkspaceRole | null); setTabRaw('overview'); }} className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 max-w-[170px]">
              <option value="">{roleLabel(realWs.role)} (full view)</option>
              {STAFF_ROLES.map((r) => <option key={r.value} value={r.value}>View as {r.label}</option>)}
            </select>
          ) : <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 whitespace-nowrap">{roleLabel(ws.role)}</span>}</div>
        </header>


        <main className="p-3 sm:p-4 space-y-4 max-w-[1500px] w-full mx-auto">
          {viewAs && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 flex items-center justify-between gap-3 text-xs font-bold text-amber-900">
              <span>Previewing what a {roleLabel(viewAs)} sees. Actions still use your own permissions.</span>
              <button onClick={() => { setViewAs(null); setTabRaw('overview'); }} className="px-3 py-1 rounded-lg bg-amber-600 text-white">Back to full view</button>
            </div>)}
          {readOnly && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm text-rose-900">
              <div className="flex items-center gap-2 font-bold"><AlertTriangle className="w-4 h-4" />
                {ws.status === 'pending' ? 'Waiting for admin approval — you can look around but not make changes yet.' : `This account is ${STATUS_LABELS[ws.status].toLowerCase()}. Everything is read-only until the yearly payment is confirmed.`}
              </div>
              {ws.role === 'owner' && <Link to="/account" className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold whitespace-nowrap">{ws.status === 'pending' ? 'View status' : 'Pay yearly'}</Link>}
            </div>)}
          {tab === 'expenses' && (
            <div className="flex justify-end gap-2">{can(ws.role, 'viewFinance', 'active') && <ReportButton ws={ws} range={range} />}<DateRangeFilter value={range} onChange={setRange} /></div>)}
          {tab === 'overview' && ws.business_type === 'supplier' && <SupplierDashboard ws={ws} onNavigate={setTab} />}
          {tab === 'availability' && <InventoryAvailability ws={ws} />}
          {tab === 'payments' && <SupplierPayments ws={ws} />}
          {tab === 'reports' && <SupplierReports ws={ws} />}
          {tab === 'notifications' && <SupplierNotifications ws={ws} />}
          {tab === 'messages' && <SupplierMessages ws={ws} />}
          {tab === 'invoices' && <DocumentsTab ws={ws} />}
          {tab === 'overview' && homeFor(ws.role) !== 'business' && ws.business_type === 'pharmacy' && <RoleHome ws={ws} userId={userId} kind={homeFor(ws.role) as Exclude<ReturnType<typeof homeFor>, 'business'>} onNavigate={setTab} />}
          {tab === 'overview' && homeFor(ws.role) === 'business' && ws.business_type === 'pharmacy' && <OverviewTab ws={ws} range={range} onRangeChange={setRange} isMounted={isMounted} onNavigate={setTab} actions={can(ws.role, 'viewFinance', 'active') ? <ReportButton ws={ws} range={range} /> : undefined} />}
          {tab === 'sales-reports' && <SalesReportsTab ws={ws} range={range} onRangeChange={setRange} isMounted={isMounted} actions={can(ws.role, 'viewFinance', 'active') ? <ReportButton ws={ws} range={range} /> : undefined} />}
          {tab === 'ai-reports' && <PlanFeatureGate ws={ws} feature="ai"><AIReportsTab ws={ws} /></PlanFeatureGate>}
          {tab === 'imports' && <ImportsTab ws={ws} />}
          {(['suppliers','categories','settings'] as const).map(module => tab === module && <RecordsTab key={module} ws={ws} module={module} />)}
          {tab === 'inventory' && <InventoryTab ws={ws} userId={userId} onImport={can(ws.role, 'manageStock', 'active') ? () => setTab('imports') : undefined} />}
          {tab === 'stock-alerts' && <StockAlertsTab key={alertView} ws={ws} initialView={alertView} onOrder={ws.business_type === 'pharmacy' && canOrderStock(ws.role) ? (p?: RestockPrefill) => { setPrefill(p ?? null); setTab('restock'); } : undefined} />}
          {tab === 'pos' && <PosTab ws={ws} />}
          {tab === 'demand' && <PlanFeatureGate ws={ws} feature="forecasting"><MarketDemandTab ws={ws} /></PlanFeatureGate>}
          {tab === 'covlo' && <PlanFeatureGate ws={ws} feature="ai"><CovloTab ws={ws} userId={userId} /></PlanFeatureGate>}
          {tab === 'rx' && <DispenserTab ws={ws} userId={userId} />}
          {tab === 'restock' && <MarketplaceTab key={prefill?.name ?? 'all'} ws={ws} userId={userId} prefill={prefill} onClearPrefill={() => setPrefill(null)} onOrdered={() => { setPrefill(null); setTab('orders'); }} />}
          {tab === 'orders' && <OrdersTab ws={ws} />}
          {tab === 'branches' && <BranchesTab ws={ws} />}
          {tab === 'staff' && <StaffTab ws={ws} />}
          {tab === 'documents' && <DocumentsTab ws={ws} />}
          {tab === 'deliveries' && <PlanFeatureGate ws={ws} feature="delivery"><DeliveriesTab ws={ws} userId={userId} actualRole={realWs.role} /></PlanFeatureGate>}
          {tab === 'shifts' && <ShiftsTab ws={ws} userId={userId} />}
          {tab === 'expenses' && <ExpensesTab ws={ws} userId={userId} range={range} />}
        </main>
      </div>
    </div>
  );
}
