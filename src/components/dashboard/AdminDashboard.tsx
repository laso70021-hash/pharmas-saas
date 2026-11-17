import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase-client';
import { refreshRecommendations } from '@/lib/recommendations.functions';
import { MobileNavigation } from '@/components/common/MobileNavigation';
import { RecordActions } from '@/components/common/RecordActions';
import { toast } from 'sonner';
import { BRAND } from '@/lib/brand';
import { NotificationBell } from '@/components/common/NotificationBell';
import React, { useState, useEffect } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { Link } from '@tanstack/react-router';
import {
  LayoutDashboard,
  Building2,
  Users2,
  GitBranch,
  Pill,
  Boxes,
  Receipt,
  ShoppingCart,
  UserCheck,
  Truck,
  DollarSign,
  BarChart3,
  CreditCard,
  Sliders,
  Sparkles,
  Settings,
  FileText,
  HelpCircle,
  Bell,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  Package,
  Layers,
  AlertTriangle,
  Bot,
  ScanLine,
  ShieldCheck,
  CheckCircle2,
  Search,
  Filter,
  Plus,
  Send,
  RefreshCw,
  ExternalLink,
  ShieldAlert,
  Check,
  Eye,
  MoreVertical,
  Activity,
  CalendarDays,
  FileCheck2,
  LogOut,
  Zap,
  Trash2,
  Phone,
  Mail,
  MapPin,
  Clock,
  CheckSquare
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import {
  Pharmacy,
  Branch,
  Customer,
  ProductItem,
  InventoryBatch,
  Supplier,
  SaleTransaction,
  PurchaseOrder,
  ExpenseRecord,
  UserProfile,
  SupportTicket,
  AIFeatureState,
  AIRecommendationItem,
  SystemHealthItem,
  ActivityLogItem,
  SalesDataPoint,
  SubscriptionPlan
} from '@/lib/pharmacy-types';
import { PharmacyService } from '@/lib/pharmacy-service';
import { formatNumber, formatDateDeterministic } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { askPharmacyAssistant } from '@/lib/ai-assistant.functions';
import { RegistrationsPanel, useRegistrations, needsAction } from '@/components/dashboard/RegistrationsPanel';
import { daysLeft as billingDaysLeft, isExpiringSoon, serviceEndsAt } from '@/lib/billing';
import { STATUS_LABELS } from '@/lib/billing';
import { filterByRange, presetRange, recordDayKey, formatDayKey, type DateRange } from '@/lib/date-range';
import { SoldProductsPanel } from '@/components/dashboard/SoldProductsPanel';
import { DateRangeFilter } from '@/components/dashboard/DateRangeFilter';
import covloIcon from '@/assets/brand/covlo.png';

interface AdminDashboardProps {
  onBackToLanding: () => void;
  plans: SubscriptionPlan[];
}

const emptySubscribe = () => () => {};

export default function AdminDashboard({ onBackToLanding, plans }: AdminDashboardProps) {
  const { user, profile, isSuperAdmin, signOut } = useAuth();
  const askAssistant = useServerFn(askPharmacyAssistant);
  const refreshAI = useServerFn(refreshRecommendations);
  const [aiCounts, setAiCounts] = useState<{ requests: number | null; scans: number | null }>({ requests: null, scans: null });
  const [recommendationsBusy, setRecommendationsBusy] = useState(false);
  const [recommendationError, setRecommendationError] = useState('');
  const loadAICounts = async () => {
    const [requests, scans] = await Promise.all([
      supabase.from('ai_request_logs').select('id', { count: 'exact', head: true }),
      supabase.from('ai_request_logs').select('id', { count: 'exact', head: true }).eq('status', 'success').in('feature_slug', ['invoice_scan','prescription']),
    ]);
    setAiCounts({ requests: requests.error ? null : requests.count, scans: scans.error ? null : scans.count });
  };
  const updateRecommendations = async () => {
    setRecommendationsBusy(true); setRecommendationError('');
    try { await refreshAI(); setRecommendations(await PharmacyService.getRecommendations()); await loadAICounts(); }
    catch (error) { setRecommendationError(error instanceof Error ? error.message : 'Could not generate live recommendations.'); }
    finally { setRecommendationsBusy(false); }
  };
  const { data: registrations = [], isSuccess: registrationsLoaded } = useRegistrations(isSuperAdmin);
  const pendingRegistrations = registrations.filter(needsAction).length;

  const isMounted = React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  // Navigation State
  const [activeNav, setActiveNav] = useState('dashboard');
  const [productsOpen, setProductsOpen] = useState(false);

  // Core Data States (Direct from Supabase)
  const [allPharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [allCustomers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [batches, setBatches] = useState<InventoryBatch[]>([]);
  const [allSales, setSales] = useState<SaleTransaction[]>([]);
  const [allPurchases, setPurchases] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [allExpenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [allUsers, setUsers] = useState<UserProfile[]>([]);
  const [aiFeatures, setAiFeatures] = useState<AIFeatureState[]>([]);
  const [recommendations, setRecommendations] = useState<AIRecommendationItem[]>([]);
  const [systemHealth, setSystemHealth] = useState<SystemHealthItem[]>([]);
  const [allAuditLogs, setAuditLogs] = useState<ActivityLogItem[]>([]);
  const [allTickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState('');

  // Date Range filter — set after mount so server and browser agree on "today"
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  useEffect(() => {
    setDateRange(presetRange('last30'));
  }, []);

  const pharmacies = filterByRange(allPharmacies, (p) => p.registered_at, dateRange);
  const customers = filterByRange(allCustomers, (c) => c.created_at, dateRange);
  const sales = filterByRange(allSales, (s) => s.created_at, dateRange);
  const purchases = filterByRange(allPurchases, (po) => po.order_date || po.created_at, dateRange);
  const expenses = filterByRange(allExpenses, (e) => e.expense_date || e.created_at, dateRange);
  const users = filterByRange(allUsers, (u) => u.created_at, dateRange);
  const auditLogs = filterByRange(allAuditLogs, (a) => a.time, dateRange);
  const tickets = filterByRange(allTickets, (t) => t.created_at, dateRange);

  // Sections where the date filter applies, with "shown / total" counts
  const dateScopedCounts: Record<string, [number, number]> = {
    dashboard: [sales.length + purchases.length, allSales.length + allPurchases.length],
    businesses: [pharmacies.length, allPharmacies.length],
    users: [users.length, allUsers.length],
    orders: [sales.length, allSales.length],
    purchases: [purchases.length, allPurchases.length],
    customers: [customers.length, allCustomers.length],
    expenses: [expenses.length, allExpenses.length],
    reports: [sales.length + expenses.length + purchases.length, allSales.length + allExpenses.length + allPurchases.length],
    'audit-logs': [auditLogs.length, allAuditLogs.length],
    support: [tickets.length, allTickets.length]
  };

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOption, setFilterOption] = useState('all');
  const [salesTrendFilter, setSalesTrendFilter] = useState<'sales' | 'orders'>('sales');

  // AI Assistant Chat State
  const [chatMessages, setChatMessages] = useState<
    { sender: 'user' | 'assistant'; text: string; time: string }[]
  >([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Modals
  const [showAddPharmacyModal, setShowAddPharmacyModal] = useState(false);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [showAddTicketModal, setShowAddTicketModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Form Fields
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formAllergies, setFormAllergies] = useState('');
  const [formChronic, setFormChronic] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formDescription, setFormDescription] = useState('');

  // Load All Live Supabase Data
  const loadAllData = async () => {
    setLoading(true);
    setDataError('');
    void loadAICounts();
    try {
      const [
        phData,
        brData,
        cuData,
        prData,
        baData,
        saData,
        poData,
        suData,
        exData,
        usData,
        aiData,
        reData,
        heData,
        auData,
        tiData
      ] = await Promise.all([
        PharmacyService.getPharmacies(),
        PharmacyService.getBranches(),
        PharmacyService.getCustomers(),
        PharmacyService.getProducts(),
        PharmacyService.getInventoryBatches(),
        PharmacyService.getSales(),
        PharmacyService.getPurchases(),
        PharmacyService.getSuppliers(),
        PharmacyService.getExpenses(),
        PharmacyService.getUsers(),
        PharmacyService.getAIFeatures(),
        PharmacyService.getRecommendations(),
        PharmacyService.getSystemHealth(),
        PharmacyService.getAuditLogs(),
        PharmacyService.getSupportTickets()
      ]);

      setPharmacies(phData);
      setBranches(brData);
      setCustomers(cuData);
      setProducts(prData);
      setBatches(baData);
      setSales(saData);
      setPurchases(poData);
      setSuppliers(suData);
      setExpenses(exData);
      setUsers(usData);
      setAiFeatures(aiData);
      setRecommendations(reData);
      setSystemHealth(heData);
      setAuditLogs(auData);
      setTickets(tiData);
    } catch (err) {
      console.warn('Data load error:', err);
      setDataError(err instanceof Error ? err.message : 'Backend data could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isSubscribed = true;
    async function initFetch() {
      try {
        const [
          phData,
          brData,
          cuData,
          prData,
          baData,
          saData,
          poData,
          suData,
          exData,
          usData,
          aiData,
          reData,
          heData,
          auData,
          tiData
        ] = await Promise.all([
          PharmacyService.getPharmacies(),
          PharmacyService.getBranches(),
          PharmacyService.getCustomers(),
          PharmacyService.getProducts(),
          PharmacyService.getInventoryBatches(),
          PharmacyService.getSales(),
          PharmacyService.getPurchases(),
          PharmacyService.getSuppliers(),
          PharmacyService.getExpenses(),
          PharmacyService.getUsers(),
          PharmacyService.getAIFeatures(),
          PharmacyService.getRecommendations(),
          PharmacyService.getSystemHealth(),
          PharmacyService.getAuditLogs(),
          PharmacyService.getSupportTickets()
        ]);

        if (isSubscribed) {
          setPharmacies(phData);
          setBranches(brData);
          setCustomers(cuData);
          setProducts(prData);
          setBatches(baData);
          setSales(saData);
          setPurchases(poData);
          setSuppliers(suData);
          setExpenses(exData);
          setUsers(usData);
          setAiFeatures(aiData);
          setRecommendations(reData);
          setSystemHealth(heData);
          setAuditLogs(auData);
          setTickets(tiData);
        }
      } catch (err) {
        console.warn('Initial fetch error:', err);
        if (isSubscribed) setDataError(err instanceof Error ? err.message : 'Backend data could not be loaded.');
      } finally {
        if (isSubscribed) {
          setLoading(false);
        }
      }
    }
    void initFetch();
    return () => {
      isSubscribed = false;
    };
  }, []);

  // Live KPI Calculations derived strictly from Supabase records
  const totalPharmaciesCount = allPharmacies.length;
  const totalUsersCount = allUsers.length;
  const totalSalesVolume = sales.reduce((acc, curr) => acc + (curr.total || 0), 0);
  const totalOrdersCount = sales.length + purchases.length;
  const totalPlatformRevenue = registrationsLoaded ? registrations.flatMap((r) => r.payments).filter((p) => p.status === 'confirmed').reduce((sum, p) => sum + p.amount_tzs, 0) : null;
  const stockAlertsCount = batches.filter((b) => (b.days_to_expiry ?? 100) <= 90 || b.quantity <= 20).length;

  // Chart Data: filtered sales grouped per day, oldest first
  const salesByDay = new Map<string, SalesDataPoint>();
  for (const s of sales) {
    const key = recordDayKey(s.created_at);
    if (!key) continue;
    const point = salesByDay.get(key) ?? { date: formatDayKey(key).slice(0, 6), sales: 0, orders: 0, revenue: 0 };
    point.sales += s.total || 0;
    point.orders += 1;
    salesByDay.set(key, point);
  }
  const salesTrendData: SalesDataPoint[] = [...salesByDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, p]) => p);

  const planCounts = new Map<string, number>();
  for (const pharmacy of allPharmacies) {
    planCounts.set(pharmacy.plan, (planCounts.get(pharmacy.plan) ?? 0) + 1);
  }
  const planColors = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B'];
  const planChartData = [...planCounts].map(([name, value], i) => ({
    name, value, color: planColors[i % planColors.length],
  }));

  // Actions
  const handleToggleAIFeature = async (slug: string, currentVal: boolean) => {
    const success = await PharmacyService.toggleAIFeature(slug, currentVal);
    if (success) {
      setAiFeatures((prev) =>
        prev.map((f) => (f.slug === slug ? { ...f, is_enabled: !f.is_enabled } : f))
      );
    }
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    const res = await PharmacyService.addCustomer({
      full_name: formName,
      phone: formPhone,
      email: formEmail,
      address: formAddress,
      allergies: formAllergies || 'None',
      chronic_conditions: formChronic || 'None'
    });

    if (res.data) {
      setCustomers((prev) => [res.data!, ...prev]);
      setShowAddCustomerModal(false);
      setFormName('');
      setFormPhone('');
      setFormEmail('');
      setFormAddress('');
      setFormAllergies('');
      setFormChronic('');
    } else {
      alert(`Customer could not be saved: ${res.error}`);
    }
  };

  const handleDeleteCustomer = async (id: string) => {
    if (!confirm('Are you sure you want to remove this customer record?')) return;
    const ok = await PharmacyService.deleteCustomer(id);
    if (ok) {
      setCustomers((prev) => prev.filter((c) => c.id !== id));
      if (selectedCustomer?.id === id) setSelectedCustomer(null);
    }
  };

  const handleCreatePharmacy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    const res = await PharmacyService.addPharmacy({
      name: formName,
      owner_name: formDescription || 'Owner',
      owner_email: formEmail,
      phone: formPhone,
      city: formAddress || 'Dar es Salaam'
    });

    if (res.data) {
      setPharmacies((prev) => [res.data!, ...prev]);
      setShowAddPharmacyModal(false);
      setFormName('');
      setFormEmail('');
      setFormPhone('');
      setFormAddress('');
      setFormDescription('');
    } else {
      alert(`Pharmacy could not be registered: ${res.error}`);
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    const res = await PharmacyService.addProduct({
      name: formName,
      generic_name: formDescription,
      dosage: formCategory.trim(),
      cost_price: Number(formAllergies) || 0,
      selling_price: Number(formAmount) || 0
    });

    if (res.data) {
      setProducts((prev) => [res.data!, ...prev]);
      setShowAddProductModal(false);
      setFormName('');
      setFormDescription('');
      setFormCategory('');
      setFormAmount('');
      setFormAllergies('');
    } else {
      alert(`Product could not be added: ${res.error}`);
    }
  };

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    const res = await PharmacyService.addSupplier({
      name: formName,
      contact_name: formDescription,
      email: formEmail,
      phone: formPhone,
      address: formAddress
    });

    if (res.data) {
      setSuppliers((prev) => [res.data!, ...prev]);
      setShowAddSupplierModal(false);
      setFormName('');
      setFormEmail('');
      setFormPhone('');
      setFormAddress('');
      setFormDescription('');
    } else {
      alert(`Supplier could not be added: ${res.error}`);
    }
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCategory || !formAmount) return;

    const res = await PharmacyService.addExpense({
      category: formCategory,
      amount: Number(formAmount),
      description: formDescription,
      expense_date: new Date().toISOString().slice(0, 10)
    });

    if (res.data) {
      setExpenses((prev) => [res.data!, ...prev]);
      setShowAddExpenseModal(false);
      setFormCategory('');
      setFormAmount('');
      setFormDescription('');
    } else {
      alert(`Expense could not be saved: ${res.error}`);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    const res = await PharmacyService.createSupportTicket({
      subject: formName,
      description: formDescription,
      category: formCategory || 'technical',
      priority: 'medium'
    });

    if (res.data) {
      setTickets((prev) => [res.data!, ...prev]);
      setShowAddTicketModal(false);
      setFormName('');
      setFormDescription('');
      setFormCategory('');
    } else {
      alert(`Ticket could not be submitted: ${res.error}`);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputMessage.trim() || isAiLoading) return;

    const userText = inputMessage;
    setInputMessage('');
    const newMsg = {
      sender: 'user' as const,
      text: userText,
      time: 'Just now'
    };
    setChatMessages((prev) => [...prev, newMsg]);
    setIsAiLoading(true);

    try {
      const data = await askAssistant({
        data: {
          prompt: userText,
          context: {
            totalPharmacies: totalPharmaciesCount,
            totalSales: totalSalesVolume,
            stockAlerts: stockAlertsCount,
            customersCount: customers.length,
            suppliersCount: suppliers.length
          }
        }
      });
      setChatMessages((prev) => [
        ...prev,
        {
          sender: 'assistant',
          text: data.reply || 'Data analyzed from platform records.',
          time: 'Just now'
        }
      ]);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        {
          sender: 'assistant',
          text: `Telemetry: ${totalPharmaciesCount} pharmacies, TZS ${formatNumber(totalSalesVolume)} sales, ${stockAlertsCount} stock alerts.`,
          time: 'Just now'
        }
      ]);
    } finally {
      setIsAiLoading(false);
    }
  };

  // 18 Sidebar Navigation Items
  const navItems: {
    id: string;
    label: string;
    icon: typeof LayoutDashboard;
    badge?: string;
    hasSub?: boolean;
    isOpen?: boolean;
    toggle?: () => void;
  }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    {
      id: 'registrations',
      label: 'Registrations & Approvals',
      icon: FileCheck2,
      ...(pendingRegistrations > 0 ? { badge: String(pendingRegistrations) } : {})
    },
    { id: 'businesses', label: 'Businesses (Pharmacies)', icon: Building2 },
    { id: 'users', label: 'Users & Roles', icon: Users2 },
    { id: 'branches', label: 'Branches', icon: GitBranch },
    {
      id: 'products',
      label: 'Products & Catalogue',
      icon: Pill,
      hasSub: true,
      isOpen: productsOpen,
      toggle: () => setProductsOpen(!productsOpen)
    },
    { id: 'inventory', label: 'Inventory Oversight', icon: Boxes },
    { id: 'orders', label: 'Orders & Sales', icon: Receipt },
    { id: 'sold-products', label: 'Sold Products', icon: Pill },
    { id: 'purchases', label: 'Purchases', icon: ShoppingCart },
    { id: 'customers', label: 'Customers', icon: UserCheck },
    { id: 'suppliers', label: 'Suppliers', icon: Truck },
    { id: 'expenses', label: 'Expenses', icon: DollarSign },
    { id: 'reports', label: 'Reports & Analytics', icon: BarChart3 },
    { id: 'subscriptions', label: 'Subscriptions & Billing', icon: CreditCard },
    { id: 'plans', label: 'Plans & Entitlements', icon: Sliders },
    { id: 'ai-features', label: 'AI Features', icon: Sparkles, badge: 'Active' },
    { id: 'settings', label: 'System Settings', icon: Settings },
    { id: 'audit-logs', label: 'Audit Logs', icon: FileText },
    { id: 'support', label: 'Support & Help Center', icon: HelpCircle }
  ];

  const navigation = (
      <aside className="w-full h-full max-h-screen bg-[#0F172A] text-slate-300 flex flex-col shrink-0 border-r border-slate-800 select-none">
        {/* Brand Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={BRAND.dashboardLogoUrl} alt="Afyadawa" className="h-auto w-36 max-h-8 object-contain object-left" />
            <div>
              <div className="text-xs text-blue-400 font-bold tracking-wider leading-none">
                Pharmacy AI
              </div>
            </div>
          </div>
          <span className="bg-blue-900/60 text-blue-300 border border-blue-700/40 text-[10px] font-bold px-2 py-0.5 rounded-full">
            Admin
          </span>
        </div>

        {/* Navigation List (All 18 Items) */}
        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-4 space-y-1 text-xs font-semibold custom-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeNav === item.id;

            return (
              <div key={item.id}>
                <button
                  onClick={() => {
                    setActiveNav(item.id);
                    if (item.toggle) item.toggle();
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all text-left group ${
                    isActive
                      ? 'bg-[#2563EB] text-white shadow-sm font-bold'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      className={`w-4 h-4 shrink-0 transition-transform ${
                        isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {item.badge && (
                      <span className="bg-blue-500 text-white text-[9px] font-bold px-1.5 py-0.2 rounded-full uppercase">
                        {item.badge}
                      </span>
                    )}
                    {item.hasSub && (
                      <ChevronDown
                        className={`w-3.5 h-3.5 transition-transform ${
                          item.isOpen ? 'rotate-180' : ''
                        }`}
                      />
                    )}
                  </div>
                </button>

                {/* Submenu for Products & Catalogue */}
                {item.hasSub && item.isOpen && (
                  <div className="ml-7 pl-2 border-l border-slate-700 my-1 space-y-1 text-[11px]">
                    <button
                      onClick={() => setActiveNav('products')}
                      className="w-full text-left py-1 text-slate-400 hover:text-white flex items-center gap-2"
                    >
                      <span>Medicines List</span>
                    </button>
                    <button
                      onClick={() => {
                        setActiveNav('products');
                        setShowAddProductModal(true);
                      }}
                      className="w-full text-left py-1 text-slate-400 hover:text-white flex items-center gap-2"
                    >
                      <span>Add Product</span>
                    </button>
                    <button
                      onClick={() => setActiveNav('inventory')}
                      className="w-full text-left py-1 text-slate-400 hover:text-white flex items-center gap-2"
                    >
                      <span>Dosage & Categories</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Sidebar Footer Card */}
        <div className="p-3 border-t border-slate-800 shrink-0 bg-[#0F172A]">
          <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs">
            <div className="flex items-center justify-between text-white font-bold mb-1">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <span>Super Admin</span>
              </div>
              <button
                onClick={signOut}
                title="Sign Out"
                className="text-slate-400 hover:text-rose-400 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mb-2 truncate font-mono">
              {profile?.email || user?.email || 'admin@swahivo.com'}
            </p>
            <button
              onClick={onBackToLanding}
              className="w-full py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              <span>Public Website</span>
            </button>
          </div>
        </div>
      </aside>
  );

  return (
    <div className="min-h-screen bg-[#F4F6FA] text-slate-900 flex font-sans antialiased">
      {/* 1. DARK NAVY SIDEBAR */}
      <div className="hidden xl:flex w-64 shrink-0 sticky top-0 h-screen self-start">{navigation}</div>

      {/* 2. MAIN DASHBOARD CONTENT */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Header Bar */}
        <header className="h-16 bg-white border-b border-slate-200 px-3 sm:px-6 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sticky top-0 z-30 shadow-xs">
          {/* Breadcrumbs */}
          <div className="flex min-w-0 items-center gap-2 text-xs font-semibold text-slate-500">
            <MobileNavigation title="Admin navigation">{navigation}</MobileNavigation>
            <LayoutDashboard className="hidden sm:block w-3.5 h-3.5 shrink-0 text-slate-400" />
            <span className="text-slate-400">/</span>
            <span className="capitalize truncate text-slate-800 font-bold">
              {navItems.find((n) => n.id === activeNav)?.label || 'Dashboard'}
            </span>
          </div>

          {/* Right User Bar */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                setLoading(true);
                void loadAllData();
              }}
              title="Refresh data"
              className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <span className="hidden lg:flex bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold px-2.5 py-1 rounded-full items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Platform Admin
            </span>

            <NotificationBell
              extra={registrations
                .filter((r) => isExpiringSoon(r) || (r.effective_status === 'expired' && serviceEndsAt(r) && Date.now() - new Date(serviceEndsAt(r)!).getTime() < 30 * 86_400_000))
                .slice(0, 20)
                .map((r) => ({
                  id: `expiry-${r.id}`,
                  kind: 'warning' as const,
                  title: r.effective_status === 'expired' ? `${r.name} has expired` : `${r.name} expires in ${billingDaysLeft(serviceEndsAt(r))} day(s)`,
                  body: `${r.plan_name} · ${r.billing_choice === 'trial' ? 'trial' : r.billing_choice} · open Registrations & Approvals to extend`,
                }))}
            />

            {/* Profile Avatar & Details */}
            <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200">
              <div className="w-8 h-8 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center shadow-sm">
                DA
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-xs font-bold text-slate-900 leading-tight">
                  {profile?.full_name || 'Dukadawa Admin'}
                </div>
                <div className="text-[10px] text-slate-500 font-medium">System Administrator</div>
              </div>
              <button
                onClick={signOut}
                className="text-slate-400 hover:text-rose-600 p-1"
                title="Logout"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </header>

        {/* Dashboard Body */}
        <main className="p-6 space-y-6 max-w-[1600px] w-full mx-auto">
          {/* Sub Header & Date Range */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                {activeNav === 'dashboard'
                  ? 'System Administration Dashboard'
                  : navItems.find((n) => n.id === activeNav)?.label}
              </h1>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {activeNav === 'dashboard'
                  ? 'Platform overview, pharmacies, users, sales and system health.'
                  : `Live records and operations for ${navItems.find((n) => n.id === activeNav)?.label}.`}
              </p>
            </div>

            {dateScopedCounts[activeNav] && (
              <DateRangeFilter value={dateRange} onChange={setDateRange} />
            )}
          </div>

          {dateScopedCounts[activeNav] &&
            dateRange &&
            (dateRange.from || dateRange.to) &&
            dateScopedCounts[activeNav][0] < dateScopedCounts[activeNav][1] && (
              <div className="flex flex-wrap items-center justify-between gap-2 bg-blue-50 border border-blue-100 rounded-xl px-4 py-2 text-xs text-blue-900">
                <span className="font-semibold">
                  Showing {dateScopedCounts[activeNav][0]} of {dateScopedCounts[activeNav][1]} records in the selected dates.
                </span>
                <button
                  type="button"
                  onClick={() => setDateRange(presetRange('all'))}
                  className="font-bold text-blue-700 hover:underline"
                >
                  Show all time
                </button>
              </div>
            )}

          {/* ========================================================
              MODULE 1: DASHBOARD OVERVIEW
             ======================================================== */}
          {activeNav === 'dashboard' && (
            <>
              {pendingRegistrations > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-bold text-amber-900">
                    <FileCheck2 className="w-4 h-4" />
                    {pendingRegistrations} registration{pendingRegistrations > 1 ? 's' : ''} or payment{pendingRegistrations > 1 ? 's' : ''} waiting for your approval
                  </div>
                  <button
                    onClick={() => setActiveNav('registrations')}
                    className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold"
                  >
                    Review now
                  </button>
                </div>
              )}

              {dataError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                Backend data could not be loaded: {dataError}
                <Button variant="outline" size="sm" className="ml-3" onClick={() => void loadAllData()}>Retry</Button>
              </div>}
              {/* 6 KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-500">Total Pharmacies</span>
                    <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                      <Building2 className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-slate-900">{totalPharmaciesCount}</span>
                    <span className="text-[11px] font-bold text-emerald-600">+{pharmacies.length} in period</span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-medium mt-1">Tenant businesses</div>
                </div>

                <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-500">Total Users</span>
                    <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                      <Users2 className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-slate-900">{totalUsersCount}</span>
                    <span className="text-[11px] font-bold text-emerald-600">+{users.length} in period</span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-medium mt-1">All platform users</div>
                </div>

                <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-500">Total Sales (All)</span>
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <ShoppingCart className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-lg font-black text-slate-900 tracking-tight">
                    <span className="text-xs text-slate-500 font-bold mr-1">TZS</span>
                    {formatNumber(totalSalesVolume)}
                  </div>
                  <div className="text-[11px] text-slate-400 font-medium mt-1">From POS sales</div>
                </div>

                <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-500">Total Orders</span>
                    <div className="w-8 h-8 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
                      <Package className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-slate-900">{totalOrdersCount}</span>
                    <span className="text-[11px] font-bold text-emerald-600">Transactions</span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-medium mt-1">Sales & POs</div>
                </div>

                <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-500">Platform Revenue</span>
                    <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <Layers className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-lg font-black text-slate-900 tracking-tight">
                    <span className="text-xs text-slate-500 font-bold mr-1">TZS</span>
                    {totalPlatformRevenue === null ? 'Unavailable' : formatNumber(totalPlatformRevenue)}
                  </div>
                  <div className="text-[11px] text-slate-400 font-medium mt-1">Confirmed subscriptions (all time)</div>
                </div>

                <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-500">Stock Alerts (All)</span>
                    <div className="w-8 h-8 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-slate-900">{stockAlertsCount}</span>
                    <span className="text-[11px] font-bold text-red-500">Flagged</span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-medium mt-1">Low / expiring</div>
                </div>
              </div>

              {/* AI Insights & AI Features Active */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-6 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs">
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    <h3 className="font-extrabold text-sm text-slate-900">AI Insights</h3>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center mb-1.5">
                        <Bot className="w-4 h-4" />
                      </div>
                      <div className="text-[11px] font-semibold text-slate-500">AI Requests</div>
                      <div className="font-extrabold text-base text-slate-900 mt-1">
                        {aiCounts.requests ?? '—'}
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="w-7 h-7 rounded-lg bg-red-100 text-red-600 flex items-center justify-center mb-1.5">
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                      <div className="text-[11px] font-semibold text-slate-500">Safety Alerts</div>
                      <div className="font-extrabold text-base text-slate-900 mt-1">
                        {recommendations.filter((r) => r.category === 'safety').length}
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center mb-1.5">
                        <Boxes className="w-4 h-4" />
                      </div>
                      <div className="text-[11px] font-semibold text-slate-500">Restock Recom.</div>
                      <div className="font-extrabold text-base text-slate-900 mt-1">
                        {recommendations.filter((r) => r.category === 'inventory').length}
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center mb-1.5">
                        <ScanLine className="w-4 h-4" />
                      </div>
                      <div className="text-[11px] font-semibold text-slate-500">OCR Docs</div>
                      <div className="font-extrabold text-base text-slate-900 mt-1">
                        {aiCounts.scans ?? '—'}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-6 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-blue-600" />
                      <h3 className="font-extrabold text-sm text-slate-900">AI Features Active</h3>
                    </div>
                    <button
                      onClick={() => setActiveNav('ai-features')}
                      className="text-xs font-bold text-blue-600 hover:text-blue-800"
                    >
                      Manage AI Features →
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {aiFeatures.filter(feat => feat.slug !== 'fraud-detection').map((feat) => (
                      <div
                        key={feat.slug}
                        className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                            <Sparkles className="w-3.5 h-3.5" />
                          </div>
                          <span className="text-xs font-bold text-slate-800 truncate max-w-[90px]">
                            {feat.name}
                          </span>
                        </div>
                        <button
                          onClick={() => handleToggleAIFeature(feat.slug, feat.is_enabled)}
                          className={`w-9 h-5 rounded-full transition-colors p-0.5 flex items-center ${
                            feat.is_enabled ? 'bg-emerald-500 justify-end' : 'bg-slate-300 justify-start'
                          }`}
                        >
                          <div className="w-4 h-4 rounded-full bg-white shadow-xs"></div>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Charts & System Health */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-7 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-blue-600" />
                      <h3 className="font-extrabold text-sm text-slate-900">Platform Sales Trend</h3>
                    </div>
                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-bold">
                      {(['sales', 'orders'] as const).map((filter) => (
                        <button
                          key={filter}
                          onClick={() => setSalesTrendFilter(filter)}
                          className={`px-3 py-1 rounded-md transition-all capitalize ${
                            salesTrendFilter === filter
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {filter === 'sales' ? 'Total Sales' : filter}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="h-64 w-full">
                    {isMounted && salesTrendData.length === 0 ? (
                      <div className="h-full w-full rounded-xl bg-slate-50 border border-dashed border-slate-200 flex items-center justify-center text-xs font-semibold text-slate-400">
                        No sales recorded in the selected dates
                      </div>
                    ) : isMounted ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={salesTrendData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                          <XAxis dataKey="date" tick={{ fill: '#64748B', fontSize: 10 }} />
                          <YAxis
                            tick={{ fill: '#64748B', fontSize: 10 }}
                            tickFormatter={(val) =>
                              salesTrendFilter === 'orders' ? `${val}` : `${(val / 1000000).toFixed(1)}M`
                            }
                          />
                          <Tooltip
                            formatter={(value: any) => [
                              salesTrendFilter === 'orders' ? `${value} Orders` : `TZS ${formatNumber(value)}`,
                              salesTrendFilter === 'sales' ? 'Total Sales' : 'Orders'
                            ]}
                            contentStyle={{ backgroundColor: '#0F172A', borderRadius: '10px', color: '#fff', fontSize: '12px' }}
                          />
                          <Line
                            type="monotone"
                            dataKey={salesTrendFilter}
                            stroke="#2563EB"
                            strokeWidth={2.5}
                            dot={{ r: 3, fill: '#2563EB' }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full w-full bg-slate-50/60 rounded-xl animate-pulse" />
                    )}
                  </div>
                </div>

                <div className="lg:col-span-5 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <PieChart className="w-4 h-4 text-blue-600" />
                      <h3 className="font-extrabold text-sm text-slate-900">Pharmacies by Plan</h3>
                    </div>
                    <button onClick={() => setActiveNav('plans')} className="text-xs font-bold text-blue-600 hover:text-blue-800">
                      View Plans →
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                    <div className="sm:col-span-6 relative h-48 flex items-center justify-center">
                      {isMounted ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={planChartData}
                              cx="50%"
                              cy="50%"
                              innerRadius={50}
                              outerRadius={75}
                              paddingAngle={3}
                              dataKey="value"
                            >
                              {planChartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="w-32 h-32 rounded-full border-4 border-slate-100 flex items-center justify-center" />
                      )}
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-xl font-black text-slate-900 leading-none">
                          {totalPharmaciesCount}
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">
                          Pharmacies
                        </span>
                      </div>
                    </div>

                    <div className="sm:col-span-6 space-y-1.5 text-xs">
                      {planChartData.map((item) => (
                        <div key={item.name} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }}></span>
                            <span className="text-slate-700 font-medium">{item.name}</span>
                          </div>
                          <div className="font-bold text-slate-900">{item.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* AI Assistant & Recent Activities */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-8 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-purple-600" />
                      <h3 className="font-extrabold text-sm text-slate-900">AI Recommendations</h3>
                    </div>
                    <Button variant="outline" size="sm" disabled={recommendationsBusy} onClick={() => void updateRecommendations()}>{recommendationsBusy ? 'Analyzing…' : 'Refresh recommendations'}</Button>
                  </div>

                  {recommendationError && <p role="alert" className="text-sm text-destructive mb-3">{recommendationError}</p>}
                  {recommendations.length > 0 ? (
                    <div className="space-y-2.5">
                      {recommendations.map((rec) => (
                        <div
                          key={rec.id}
                          className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex items-start gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                              <AlertTriangle className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <div className="font-bold text-slate-900">{rec.title}</div>
                              <div className="text-[11px] text-slate-500 mt-0.5">{rec.description}</div>
                            </div>
                          </div>
                          <span className="px-2.5 py-1 bg-blue-600 text-white font-bold rounded-lg text-[10px]">
                            {rec.badge_label}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-slate-500 text-xs bg-slate-50 rounded-xl">
                      No saved recommendations. Refresh to analyze current stock and expiry records.
                    </div>
                  )}
                </div>

                <div className="lg:col-span-4 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                      <div className="flex items-center gap-2">
                        <img src={covloIcon} alt="Covlo" className="w-5 h-5 rounded-full object-cover" />
                        <h3 className="font-extrabold text-sm text-slate-900">AI Assistant</h3>
                      </div>
                      <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full">
                        OpenRouter
                      </span>
                    </div>

                    <div className="space-y-3 max-h-56 overflow-y-auto text-xs pr-1 custom-scrollbar">
                      {chatMessages.map((msg, idx) => (
                        <div
                          key={idx}
                          className={`p-3 rounded-xl ${
                            msg.sender === 'user'
                              ? 'bg-blue-50 text-blue-950 ml-4 border border-blue-100'
                              : 'bg-slate-50 text-slate-800 mr-2 border border-slate-200/70'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1 text-[10px] font-bold text-slate-400">
                            <span>{msg.sender === 'user' ? 'You' : 'Covlo AI'}</span>
                            <span>{msg.time}</span>
                          </div>
                          <div className="whitespace-pre-wrap leading-relaxed text-[11px]">{msg.text}</div>
                        </div>
                      ))}
                      {isAiLoading && (
                        <div className="p-2.5 bg-slate-50 rounded-xl text-xs text-slate-500 animate-pulse flex items-center gap-2">
                          <Bot className="w-4 h-4 text-blue-600 animate-spin" />
                          <span>Querying platform database...</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <form onSubmit={handleSendMessage} className="mt-3 relative">
                    <input
                      type="text"
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      placeholder="Ask anything about pharmacy operations..."
                      className="w-full pl-3 pr-10 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs shadow-2xs"
                    />
                    <button
                      type="submit"
                      disabled={isAiLoading || !inputMessage.trim()}
                      className="absolute right-1.5 top-1.5 p-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </form>
                </div>
              </div>
            </>
          )}

          {activeNav === 'registrations' && <RegistrationsPanel />}

          {/* ========================================================
              MODULE 2: BUSINESSES (PHARMACIES)
             ======================================================== */}
          {activeNav === 'businesses' && (
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-lg font-black text-slate-900">Registered Pharmacies</h2>
                  <p className="text-xs text-slate-500">
                    Live multi-tenant pharmacy registry (`pharmacies`).
                  </p>
                </div>
                <button
                  onClick={() => setShowAddPharmacyModal(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-2 shadow-sm"
                >
                  <Plus className="w-4 h-4" /> Register New Pharmacy
                </button>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by pharmacy name, city or email..."
                    className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-300 text-xs"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px] font-bold">
                      <th className="py-2.5">Pharmacy Name</th>
                      <th className="py-2.5">City & Address</th>
                      <th className="py-2.5">Contact</th>
                      <th className="py-2.5">Status</th>
                      <th className="py-2.5">Registered</th>
                      <th className="py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pharmacies
                      .filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
                      .map((ph) => (
                        <tr key={ph.id} className="hover:bg-slate-50">
                          <td className="py-3 font-bold text-slate-900 flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-blue-600" />
                            <span>{ph.name}</span>
                          </td>
                          <td className="py-3 text-slate-600">{ph.city}</td>
                          <td className="py-3">
                            <div className="text-slate-800">{ph.owner_email}</div>
                            <div className="text-[11px] text-slate-400">{ph.phone}</div>
                          </td>
                          <td className="py-3">
                            <span
                              className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                                ph.status === 'Active'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {ph.status}
                            </span>
                          </td>
                          <td className="py-3 text-slate-500">{ph.registered_at}</td>
                          <td className="py-3 text-right whitespace-nowrap">
                            <RecordActions kind="pharmacies" record={{...ph,email:ph.owner_email}} onChanged={()=>void PharmacyService.getPharmacies().then(setPharmacies)} />
                            <Link
                              to="/pharmacy"
                              search={{ id: ph.id }}
                              className="px-2.5 py-1 mr-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg text-[11px] inline-block"
                            >
                              Open
                            </Link>
                            <button
                              onClick={async () => {
                                await PharmacyService.togglePharmacyStatus(ph.id, ph.status);
                                setPharmacies((prev) =>
                                  prev.map((p) =>
                                    p.id === ph.id
                                      ? { ...p, status: p.status === 'Active' ? 'Suspended' : 'Active' }
                                      : p
                                  )
                                );
                              }}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-[11px]"
                            >
                              {ph.status === 'Active' ? 'Suspend' : 'Activate'}
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                {pharmacies.length === 0 && (
                  <div className="p-8 text-center text-slate-500 text-xs">
                    No pharmacies registered yet. Click &quot;Register New Pharmacy&quot;.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================
              MODULE 3: USERS & ROLES
             ======================================================== */}
          {activeNav === 'users' && (
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs space-y-6">
              <div>
                <h2 className="text-lg font-black text-slate-900">User Profiles & Role Permissions</h2>
                <p className="text-xs text-slate-500">
                  Verified accounts and role assignments.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px] font-bold">
                      <th className="py-2.5">User</th>
                      <th className="py-2.5">Role</th>
                      <th className="py-2.5">Phone</th>
                      <th className="py-2.5">Platform Privilege</th>
                      <th className="py-2.5">Joined</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50">
                        <td className="py-3 font-bold text-slate-900">
                          <div>{u.full_name || 'User'}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{u.email}</div>
                        </td>
                        <td className="py-3">
                          <select
                            aria-label={`Role for ${u.full_name}`}
                            className="bg-blue-50 text-blue-700 px-2 py-1 rounded-md font-bold text-[11px] border border-blue-100"
                            value={u.system_role}
                            onChange={async (e) => {
                              const role = e.target.value as UserProfile['system_role'];
                              try {
                                await PharmacyService.setUserRole(u.id, role);
                                setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, system_role: role, is_super_admin: role === 'super_admin' } : x)));
                                toast.success('Role updated');
                              } catch (err: any) {
                                toast.error(err?.message || 'Could not change role');
                              }
                            }}
                          >
                            {[['super_admin','Platform Admin'],['pharmacy_owner','Pharmacy Owner'],['supplier','Supplier'],['manager','Manager'],['pharmacist','Pharmacist'],['cashier','Cashier'],['accountant','Accountant'],['inventory_manager','Inventory Manager'],['delivery_rider','Delivery Rider']].map(([v,l]) => (
                              <option key={v} value={v}>{l}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-3 text-slate-600">{u.phone}</td>
                        <td className="py-3">
                          {u.is_super_admin ? (
                            <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded-md font-bold text-[10px]">
                              Super Admin
                            </span>
                          ) : (
                            <span className="text-slate-500 text-[11px]">Standard Tenant</span>
                          )}
                        </td>
                        <td className="py-3 text-slate-500">{u.created_at}</td>
                        <td><RecordActions kind="profiles" record={{...u}} onChanged={()=>void PharmacyService.getUsers().then(setUsers)} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {users.length === 0 && (
                  <div className="p-8 text-center text-slate-500 text-xs">
                    No user profiles found in `profiles`.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================
              MODULE 4: BRANCHES
             ======================================================== */}
          {activeNav === 'branches' && (
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-black text-slate-900">Pharmacy Branches</h2>
                  <p className="text-xs text-slate-500">
                    Branch locations from `branches`.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px] font-bold">
                      <th className="py-2.5">Branch Name</th>
                      <th className="py-2.5">Branch Code</th>
                      <th className="py-2.5">Address</th>
                      <th className="py-2.5">Phone</th>
                      <th className="py-2.5">Type</th>
                      <th className="py-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {branches.map((b) => (
                      <tr key={b.id} className="hover:bg-slate-50">
                        <td className="py-3 font-bold text-slate-900 flex items-center gap-2">
                          <GitBranch className="w-4 h-4 text-blue-600" />
                          <span>{b.name}</span>
                        </td>
                        <td className="py-3 font-mono text-slate-600">{b.code}</td>
                        <td className="py-3 text-slate-600">{b.address || '—'}</td>
                        <td className="py-3 text-slate-600">{b.phone || '—'}</td>
                        <td className="py-3">
                          {b.is_main ? (
                            <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-md">
                              Main Branch
                            </span>
                          ) : (
                            <span className="text-slate-500 text-[11px]">Sub-Branch</span>
                          )}
                        </td>
                        <td className="py-3">
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-md">
                            {b.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {branches.length === 0 && (
                  <div className="p-8 text-center text-slate-500 text-xs">
                    No branches recorded yet in `branches`.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================
              MODULE 5: PRODUCTS & CATALOGUE
             ======================================================== */}
          {activeNav === 'products' && (
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-lg font-black text-slate-900">Medicines Registry & Catalogue</h2>
                  <p className="text-xs text-slate-500">
                    Live products from `products` table.
                  </p>
                </div>
                <button
                  onClick={() => setShowAddProductModal(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-2 shadow-sm"
                >
                  <Plus className="w-4 h-4" /> Add New Medicine
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px] font-bold">
                      <th className="py-2.5">Medicine Name</th>
                      <th className="py-2.5">Dosage / Strength</th>
                      <th className="py-2.5">SKU</th>
                      <th className="py-2.5">Selling Price</th>
                      <th className="py-2.5">Cost Price</th>
                      <th className="py-2.5">Prescription</th>
                      <th className="py-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {products.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="py-3 font-bold text-slate-900">
                          <div>{p.name}</div>
                          <div className="text-[10px] text-slate-400 font-normal">{p.generic_name}</div>
                        </td>
                        <td className="py-3 font-semibold text-slate-800">{p.dosage}</td>
                        <td className="py-3 font-mono text-[11px] text-slate-500">{p.sku}</td>
                        <td className="py-3 font-bold text-blue-600">TZS {formatNumber(p.selling_price)}</td>
                        <td className="py-3 text-slate-600">TZS {formatNumber(p.cost_price)}</td>
                        <td className="py-3">
                          {p.is_prescription_required ? (
                            <span className="bg-red-50 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded-md">
                              Rx Required
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">OTC</span>
                          )}
                        </td>
                        <td className="py-3">
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-md">
                            Active
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {products.length === 0 && (
                  <div className="p-8 text-center text-slate-500 text-xs">
                    No products found in products. Click &quot;Add New Medicine&quot;.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================
              MODULE 6: INVENTORY OVERSIGHT
             ======================================================== */}
          {activeNav === 'inventory' && (
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs space-y-6">
              <div>
                <h2 className="text-lg font-black text-slate-900">Inventory Oversight & Batches</h2>
                <p className="text-xs text-slate-500">
                  Batches, quantities, and automated expiry tracking from `inventory_batches`.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px] font-bold">
                      <th className="py-2.5">Batch Number</th>
                      <th className="py-2.5">Product ID</th>
                      <th className="py-2.5">Stock Quantity</th>
                      <th className="py-2.5">Unit Cost</th>
                      <th className="py-2.5">Expiry Date</th>
                      <th className="py-2.5">Risk Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {batches.map((b) => (
                      <tr key={b.id} className="hover:bg-slate-50">
                        <td className="py-3 font-mono font-bold text-slate-900">{b.batch_number}</td>
                        <td className="py-3 font-mono text-slate-500">{b.product_id.slice(0, 8)}...</td>
                        <td className="py-3 font-bold text-slate-900">{b.quantity} units</td>
                        <td className="py-3 text-slate-600">TZS {formatNumber(b.cost_per_unit)}</td>
                        <td className="py-3 text-slate-800 font-semibold">{b.expiry_date}</td>
                        <td className="py-3">
                          {(b.days_to_expiry ?? 100) <= 90 ? (
                            <span className="bg-red-100 text-red-800 text-[10px] font-bold px-2 py-0.5 rounded-md">
                              Expires in {b.days_to_expiry} days
                            </span>
                          ) : (
                            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-md">
                              Safe
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {batches.length === 0 && (
                  <div className="p-8 text-center text-slate-500 text-xs">
                    No inventory batches recorded yet in `inventory_batches`.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================
              MODULE 7: ORDERS & SALES (POS)
             ======================================================== */}
          {activeNav === 'sold-products' && <SoldProductsPanel />}

          {activeNav === 'orders' && (
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs space-y-6">
              <div>
                <h2 className="text-lg font-black text-slate-900">Orders & Point of Sale (POS) Transactions</h2>
                <p className="text-xs text-slate-500">
                  Transactions retrieved directly from `sales` table.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px] font-bold">
                      <th className="py-2.5">Invoice #</th>
                      <th className="py-2.5">Subtotal</th>
                      <th className="py-2.5">Discount</th>
                      <th className="py-2.5">Total Amount</th>
                      <th className="py-2.5">Payment Method</th>
                      <th className="py-2.5">Status</th>
                      <th className="py-2.5">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sales.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <td className="py-3 font-bold font-mono text-slate-900">{s.invoice_number}</td>
                        <td className="py-3 text-slate-600">TZS {formatNumber(s.subtotal)}</td>
                        <td className="py-3 text-slate-400">TZS {formatNumber(s.discount)}</td>
                        <td className="py-3 font-black text-emerald-700">TZS {formatNumber(s.total)}</td>
                        <td className="py-3 uppercase font-semibold text-slate-700 text-[10px]">
                          {s.payment_method}
                        </td>
                        <td className="py-3">
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-md capitalize">
                            {s.payment_status}
                          </span>
                        </td>
                        <td className="py-3 text-slate-500">{s.created_at}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {sales.length === 0 && (
                  <div className="p-8 text-center text-slate-500 text-xs">
                    No sales transactions found in `sales`.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================
              MODULE 8: PURCHASES
             ======================================================== */}
          {activeNav === 'purchases' && (
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs space-y-6">
              <div>
                <h2 className="text-lg font-black text-slate-900">Purchase Orders to Suppliers</h2>
                <p className="text-xs text-slate-500">
                  Procurement records from `purchase_orders`.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px] font-bold">
                      <th className="py-2.5">PO Number</th>
                      <th className="py-2.5">Order Date</th>
                      <th className="py-2.5">Total Amount</th>
                      <th className="py-2.5">Status</th>
                      <th className="py-2.5">Delivery Expected</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {purchases.map((po) => (
                      <tr key={po.id} className="hover:bg-slate-50">
                        <td className="py-3 font-mono font-bold text-slate-900">{po.order_number}</td>
                        <td className="py-3 text-slate-600">{po.order_date}</td>
                        <td className="py-3 font-bold text-slate-900">TZS {formatNumber(po.total_amount)}</td>
                        <td className="py-3">
                          <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-md capitalize">
                            {po.status}
                          </span>
                        </td>
                        <td className="py-3 text-slate-500">{po.expected_delivery_date || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {purchases.length === 0 && (
                  <div className="p-8 text-center text-slate-500 text-xs">
                    No purchase orders in `purchase_orders`.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================
              MODULE 9: CUSTOMERS (COMPLETED OPERATIONAL MODULE!)
             ======================================================== */}
          {activeNav === 'customers' && (
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-lg font-black text-slate-900">Customer Records & Profiles</h2>
                  <p className="text-xs text-slate-500">
                    Real customer registry from `customers` table with medical histories.
                  </p>
                </div>
                <button
                  onClick={() => setShowAddCustomerModal(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-2 shadow-sm"
                >
                  <Plus className="w-4 h-4" /> Add New Customer
                </button>
              </div>

              {/* Search & Stats */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by customer name, phone number, or email..."
                    className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-300 text-xs"
                  />
                </div>
              </div>

              {/* Customers Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px] font-bold">
                      <th className="py-2.5">Customer Name</th>
                      <th className="py-2.5">Phone</th>
                      <th className="py-2.5">Email</th>
                      <th className="py-2.5">Address</th>
                      <th className="py-2.5">Allergies</th>
                      <th className="py-2.5">Chronic Conditions</th>
                      <th className="py-2.5">Registered</th>
                      <th className="py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {customers
                      .filter((c) =>
                        c.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        (c.phone && c.phone.includes(searchQuery))
                      )
                      .map((c) => (
                        <tr key={c.id} className="hover:bg-slate-50">
                          <td className="py-3 font-bold text-slate-900 flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                              {c.full_name.charAt(0)}
                            </div>
                            <span>{c.full_name}</span>
                          </td>
                          <td className="py-3 text-slate-700 font-medium">{c.phone}</td>
                          <td className="py-3 text-slate-500">{c.email}</td>
                          <td className="py-3 text-slate-600">{c.address}</td>
                          <td className="py-3">
                            <span className="bg-amber-50 text-amber-800 text-[10px] font-semibold px-2 py-0.5 rounded">
                              {c.allergies}
                            </span>
                          </td>
                          <td className="py-3">
                            <span className="bg-purple-50 text-purple-800 text-[10px] font-semibold px-2 py-0.5 rounded">
                              {c.chronic_conditions}
                            </span>
                          </td>
                          <td className="py-3 text-slate-400">{c.created_at}</td>
                          <td className="py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <RecordActions kind="customers" record={{...c}} onChanged={()=>void PharmacyService.getCustomers().then(setCustomers)} />
                              <button
                                onClick={() => setSelectedCustomer(c)}
                                className="p-1.5 hover:bg-slate-200 rounded text-slate-600"
                                title="View Customer Details"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>

                {customers.length === 0 && (
                  <div className="p-8 text-center text-slate-500 text-xs">
                    No customers found in customers. Click &quot;Add New Customer&quot; above.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================
              MODULE 10: SUPPLIERS
             ======================================================== */}
          {activeNav === 'suppliers' && (
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-lg font-black text-slate-900">Wholesale Suppliers Directory</h2>
                  <p className="text-xs text-slate-500">
                    Supplier records from `suppliers` table.
                  </p>
                </div>
                <button
                  onClick={() => setShowAddSupplierModal(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-2 shadow-sm"
                >
                  <Plus className="w-4 h-4" /> Add New Supplier
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px] font-bold">
                      <th className="py-2.5">Supplier Name</th>
                      <th className="py-2.5">Contact Person</th>
                      <th className="py-2.5">Phone</th>
                      <th className="py-2.5">Email</th>
                      <th className="py-2.5">Tax ID</th>
                      <th className="py-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {suppliers.map((sup) => (
                      <tr key={sup.id} className="hover:bg-slate-50">
                        <td className="py-3 font-bold text-slate-900 flex items-center gap-2">
                          <Truck className="w-4 h-4 text-blue-600" />
                          <span>{sup.name}</span>
                        </td>
                        <td className="py-3 text-slate-700">{sup.contact_name}</td>
                        <td className="py-3 text-slate-600">{sup.phone}</td>
                        <td className="py-3 text-slate-500">{sup.email}</td>
                        <td className="py-3 font-mono text-[11px] text-slate-400">{sup.tax_id}</td>
                        <td><RecordActions kind="suppliers" record={{...sup}} onChanged={()=>void PharmacyService.getSuppliers().then(setSuppliers)} /></td>
                        <td className="py-3">
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-md">
                            Active
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {suppliers.length === 0 && (
                  <div className="p-8 text-center text-slate-500 text-xs">
                    No suppliers found in suppliers. Click &quot;Add New Supplier&quot;.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================
              MODULE 11: EXPENSES
             ======================================================== */}
          {activeNav === 'expenses' && (
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-lg font-black text-slate-900">Operating Expenses</h2>
                  <p className="text-xs text-slate-500">
                    Expense tracking from `expenses` table.
                  </p>
                </div>
                <button
                  onClick={() => setShowAddExpenseModal(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-2 shadow-sm"
                >
                  <Plus className="w-4 h-4" /> Record New Expense
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px] font-bold">
                      <th className="py-2.5">Category</th>
                      <th className="py-2.5">Amount (TZS)</th>
                      <th className="py-2.5">Description</th>
                      <th className="py-2.5">Expense Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {expenses.map((exp) => (
                      <tr key={exp.id} className="hover:bg-slate-50">
                        <td className="py-3 font-bold text-slate-900">{exp.category}</td>
                        <td className="py-3 font-black text-rose-600">TZS {formatNumber(exp.amount)}</td>
                        <td className="py-3 text-slate-600">{exp.description}</td>
                        <td className="py-3 text-slate-500">{exp.expense_date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {expenses.length === 0 && (
                  <div className="p-8 text-center text-slate-500 text-xs">
                    No expense records found in `expenses`.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================
              MODULE 12: REPORTS & ANALYTICS
             ======================================================== */}
          {activeNav === 'reports' && (
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs space-y-6">
              <div>
                <h2 className="text-lg font-black text-slate-900">Reports & Analytics Engine</h2>
                <p className="text-xs text-slate-500">
                  Aggregated financial and inventory telemetry across the entire pharmacy network.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-xs font-bold text-slate-500">Gross Sales Volume</div>
                  <div className="text-xl font-black text-slate-900 mt-1">TZS {formatNumber(totalSalesVolume)}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Calculated from completed POS sales</div>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-xs font-bold text-slate-500">Total Operational Expenses</div>
                  <div className="text-xl font-black text-rose-600 mt-1">
                    TZS {formatNumber(expenses.reduce((a, b) => a + b.amount, 0))}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Recorded pharmacy overheads</div>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-xs font-bold text-slate-500">Procurement Outlay</div>
                  <div className="text-xl font-black text-slate-900 mt-1">
                    TZS {formatNumber(purchases.reduce((a, b) => a + b.total_amount, 0))}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Purchase orders delivered</div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================
              MODULE 13: SUBSCRIPTIONS & BILLING
             ======================================================== */}
          {activeNav === 'subscriptions' && (
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs space-y-6">
              <div>
                <h2 className="text-lg font-black text-slate-900">Tenant Subscriptions & Billing Status</h2>
                <p className="text-xs text-slate-500">
                  Real-time pharmacy tier plans and recurring billing statuses.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px] font-bold">
                      <th className="py-2.5">Business</th>
                      <th className="py-2.5">Active Plan</th>
                      <th className="py-2.5">Yearly Fee</th>
                      <th className="py-2.5">Billing Status</th>
                      <th className="py-2.5">Ends</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {registrations.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="py-3 font-bold text-slate-900">
                          {r.name}
                          <span className="ml-2 text-[10px] font-semibold text-slate-400">
                            {r.business_type === 'supplier' ? 'Supplier' : 'Pharmacy'}
                          </span>
                        </td>
                        <td className="py-3">
                          <span className="bg-purple-100 text-purple-800 text-[10px] font-bold px-2 py-0.5 rounded-md">
                            {r.plan_name}
                          </span>
                        </td>
                        <td className="py-3 font-bold text-slate-800">
                          {r.yearly_price ? `TZS ${formatNumber(r.yearly_price)} /yr` : 'Custom'}
                        </td>
                        <td className="py-3">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                              r.effective_status === 'active'
                                ? 'bg-emerald-100 text-emerald-800'
                                : r.effective_status === 'trial'
                                  ? 'bg-blue-100 text-blue-800'
                                  : r.effective_status === 'pending'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {STATUS_LABELS[r.effective_status]}
                          </span>
                        </td>
                        <td className="py-3 text-slate-500">
                          {r.effective_status === 'trial' || (r.effective_status === 'expired' && r.billing_choice === 'trial')
                            ? formatDateDeterministic(r.trial_ends_at || '')
                            : r.subscription_ends_at
                              ? formatDateDeterministic(r.subscription_ends_at)
                              : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {registrations.length === 0 && (
                  <div className="p-8 text-center text-slate-500 text-xs">No subscriptions yet.</div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================
              MODULE 14: PLANS & ENTITLEMENTS
             ======================================================== */}
          {activeNav === 'plans' && (
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs space-y-6">
              <div>
                <h2 className="text-lg font-black text-slate-900">Subscription Plans & Tier Entitlements</h2>
                <p className="text-xs text-slate-500">
                  Plans loaded directly from `subscription_plans`.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {plans.map((p) => (
                  <div key={p.id} className="p-5 rounded-2xl border border-slate-200 bg-slate-50 space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-extrabold text-base text-slate-900">{p.name}</h3>
                        <p className="text-xs text-slate-500">{p.support_tier}</p>
                      </div>
                      <span className="text-[10px] bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full uppercase">
                        {p.slug}
                      </span>
                    </div>

                    <div className="text-2xl font-black text-slate-900">
                      TZS {formatNumber(p.price_tzs_monthly)}
                      <span className="text-xs text-slate-500 font-medium"> /mo</span>
                    </div>

                    <div className="space-y-1.5 text-xs text-slate-700 pt-2 border-t border-slate-200">
                      <div>• Up to {p.max_branches} branch(es)</div>
                      <div>• Up to {p.max_employees} staff seats</div>
                      <div>• AI Insights: {p.has_ai_insights ? '✅ Enabled' : '❌ Not included'}</div>
                      <div>• Advanced Forecasting: {p.has_advanced_ai_forecasting ? '✅ Enabled' : '❌ Not included'}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================
              MODULE 15: AI FEATURES
             ======================================================== */}
          {activeNav === 'ai-features' && (
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs space-y-6">
              <div>
                <h2 className="text-lg font-black text-slate-900">AI Platform Capabilities</h2>
                <p className="text-xs text-slate-500">
                  Feature flags persisted directly to `ai_features`.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {aiFeatures.filter(feat => feat.slug !== 'fraud-detection').map((feat) => (
                  <div key={feat.slug} className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                          <Sparkles className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-bold text-sm text-slate-900">{feat.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{feat.slug}</div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleToggleAIFeature(feat.slug, feat.is_enabled)}
                        className={`w-10 h-6 rounded-full transition-colors p-0.5 flex items-center ${
                          feat.is_enabled ? 'bg-emerald-500 justify-end' : 'bg-slate-300 justify-start'
                        }`}
                      >
                        <div className="w-5 h-5 rounded-full bg-white shadow-xs"></div>
                      </button>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed">{feat.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================
              MODULE 16: SYSTEM SETTINGS
             ======================================================== */}
          {activeNav === 'settings' && (
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs space-y-6">
              <div>
                <h2 className="text-lg font-black text-slate-900">Platform Settings</h2>
                <p className="text-xs text-slate-500">
                  Configuration retrieved from `platform_settings`.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                <div className="space-y-4 p-4 rounded-xl border border-slate-200 bg-slate-50">
                  <h3 className="font-bold text-sm text-slate-900">Brand & Localization</h3>
                  <div>
                    <label className="block text-slate-500 font-bold mb-1">Platform Name</label>
                    <input type="text" readOnly value="Swahivo" className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 font-semibold" />
                  </div>
                  <div>
                    <label className="block text-slate-500 font-bold mb-1">Currency</label>
                    <input type="text" readOnly value="TZS (Tanzanian Shilling)" className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 font-semibold" />
                  </div>
                </div>

                <div className="space-y-4 p-4 rounded-xl border border-slate-200 bg-slate-50">
                  <h3 className="font-bold text-sm text-slate-900">Database & Security</h3>
                  <div>
                    <label className="block text-slate-500 font-bold mb-1">Database</label>
                    <input type="text" readOnly value="Secure cloud database" className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 font-mono text-[11px]" />
                  </div>
                  <div>
                    <label className="block text-slate-500 font-bold mb-1">Designated Super Admin UID</label>
                    <input type="text" readOnly value="10c0fa24-c344-4cbb-b07e-d6d27825a205" className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 font-mono text-[11px]" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================
              MODULE 17: AUDIT LOGS
             ======================================================== */}
          {activeNav === 'audit-logs' && (
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs space-y-6">
              <div>
                <h2 className="text-lg font-black text-slate-900">Security & Administrative Audit Logs</h2>
                <p className="text-xs text-slate-500">
                  Authoritative records from `audit_logs` table.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px] font-bold">
                      <th className="py-2.5">Event Description</th>
                      <th className="py-2.5">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50">
                        <td className="py-3 font-semibold text-slate-800">{log.title}</td>
                        <td className="py-3 text-slate-500 font-mono text-[11px]">{log.time}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {auditLogs.length === 0 && (
                  <div className="p-8 text-center text-slate-500 text-xs">
                    No audit records logged yet in `audit_logs`..
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================
              MODULE 18: SUPPORT & HELP CENTER
             ======================================================== */}
          {activeNav === 'support' && (
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-lg font-black text-slate-900">Support & Help Desk Tickets</h2>
                  <p className="text-xs text-slate-500">
                    Support queue from `support_tickets`.
                  </p>
                </div>
                <button
                  onClick={() => setShowAddTicketModal(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-2 shadow-sm"
                >
                  <Plus className="w-4 h-4" /> Open New Ticket
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px] font-bold">
                      <th className="py-2.5">Ticket #</th>
                      <th className="py-2.5">Subject</th>
                      <th className="py-2.5">Category</th>
                      <th className="py-2.5">Priority</th>
                      <th className="py-2.5">Status</th>
                      <th className="py-2.5">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {tickets.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50">
                        <td className="py-3 font-mono font-bold text-slate-900">{t.ticket_number}</td>
                        <td className="py-3 font-semibold text-slate-800">{t.subject}</td>
                        <td className="py-3 uppercase text-[10px] text-slate-600 font-bold">{t.category}</td>
                        <td className="py-3">
                          <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                            {t.priority}
                          </span>
                        </td>
                        <td className="py-3">
                          <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded capitalize">
                            {t.status}
                          </span>
                        </td>
                        <td className="py-3 text-slate-500">{t.created_at}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {tickets.length === 0 && (
                  <div className="p-8 text-center text-slate-500 text-xs">
                    No support tickets open. Click &quot;Open New Ticket&quot; to create one.
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ========================================================
          MODAL: ADD NEW CUSTOMER
         ======================================================== */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-900 text-base">Add New Customer</h3>
              <button onClick={() => setShowAddCustomerModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleCreateCustomer} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Fatma Salum"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="+255 7..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="email@example.com"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Physical Address</label>
                <input
                  type="text"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  placeholder="e.g. Mikocheni B, Dar es Salaam"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Known Drug Allergies</label>
                <input
                  type="text"
                  value={formAllergies}
                  onChange={(e) => setFormAllergies(e.target.value)}
                  placeholder="e.g. Penicillin, Sulfa drugs (or None)"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Chronic Medical Conditions</label>
                <input
                  type="text"
                  value={formChronic}
                  onChange={(e) => setFormChronic(e.target.value)}
                  placeholder="e.g. Hypertension, Type 2 Diabetes"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddCustomerModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-sm"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: VIEW CUSTOMER DETAILS
         ======================================================== */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">
                  {selectedCustomer.full_name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">{selectedCustomer.full_name}</h3>
                  <div className="text-[11px] text-slate-400">Customer ID: {selectedCustomer.id.slice(0, 8)}</div>
                </div>
              </div>
              <button onClick={() => setSelectedCustomer(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center gap-2 text-slate-700">
                <Phone className="w-4 h-4 text-slate-400" />
                <span>{selectedCustomer.phone || 'No phone recorded'}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-700">
                <Mail className="w-4 h-4 text-slate-400" />
                <span>{selectedCustomer.email || 'No email recorded'}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-700">
                <MapPin className="w-4 h-4 text-slate-400" />
                <span>{selectedCustomer.address || 'No address recorded'}</span>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <div className="font-bold text-slate-800 mb-1">Clinical Profile:</div>
                <div className="p-2.5 rounded-xl bg-amber-50 text-amber-900 border border-amber-200 mb-2">
                  <span className="font-bold">Allergies: </span>
                  {selectedCustomer.allergies}
                </div>
                <div className="p-2.5 rounded-xl bg-purple-50 text-purple-900 border border-purple-200">
                  <span className="font-bold">Chronic Conditions: </span>
                  {selectedCustomer.chronic_conditions}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-slate-500 text-[11px]">
                <span>Registered: {selectedCustomer.created_at}</span>
                <button
                  onClick={() => handleDeleteCustomer(selectedCustomer.id)}
                  className="text-rose-600 font-bold hover:underline"
                >
                  Delete Profile
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: ADD PHARMACY
         ======================================================== */}
      {showAddPharmacyModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-900 text-base">Register New Pharmacy</h3>
              <button onClick={() => setShowAddPharmacyModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleCreatePharmacy} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Pharmacy / Business Name *</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Upanga Health Pharmacy"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Owner Name</label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="e.g. Dr. Frank Mbise"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Contact Email</label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="pharmacy@example.com"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Phone</label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="+255 7..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">City / Region</label>
                <input
                  type="text"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  placeholder="Dar es Salaam"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddPharmacyModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-sm"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: ADD MEDICINE PRODUCT
         ======================================================== */}
      {showAddProductModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-900 text-base">Add Medicine to Catalogue</h3>
              <button onClick={() => setShowAddProductModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleCreateProduct} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Medicine Commercial Name *</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Ciprofloxacin 500mg"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Generic Name</label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="e.g. Ciprofloxacin Hydrochloride"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Dosage Form</label>
                  <input
                    type="text"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    placeholder="e.g. 500mg Tablets"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Selling Price (TZS) *</label>
                  <input
                    type="number"
                    required
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    placeholder="2500"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddProductModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-sm"
                >
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: ADD SUPPLIER
         ======================================================== */}
      {showAddSupplierModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-900 text-base">Add New Supplier</h3>
              <button onClick={() => setShowAddSupplierModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleCreateSupplier} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Supplier Company Name *</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Harleys Pharma Tanzania"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Contact Person</label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="e.g. Joseph Mwalimu"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="sales@supplier.co.tz"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Phone</label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="+255 7..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddSupplierModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-sm"
                >
                  Save Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: ADD EXPENSE
         ======================================================== */}
      {showAddExpenseModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-900 text-base">Record Operating Expense</h3>
              <button onClick={() => setShowAddExpenseModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleCreateExpense} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Expense Category *</label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                >
                  <option value="">Select Category...</option>
                  <option value="Rent & Utilities">Rent & Utilities</option>
                  <option value="Staff Salaries">Staff Salaries</option>
                  <option value="Packaging & Bags">Packaging & Bags</option>
                  <option value="Cold Chain Power">Cold Chain Power</option>
                  <option value="Transport & Logistics">Transport & Logistics</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Amount (TZS) *</label>
                <input
                  type="number"
                  required
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  placeholder="e.g. 250000"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Notes / Description</label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Monthly backup generator fuel"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddExpenseModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-sm"
                >
                  Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: ADD SUPPORT TICKET
         ======================================================== */}
      {showAddTicketModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-900 text-base">Open Support Ticket</h3>
              <button onClick={() => setShowAddTicketModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleCreateTicket} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Ticket Subject *</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Barcode scanner synchronization issue"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Category</label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                >
                  <option value="technical">Technical / POS</option>
                  <option value="billing">Billing & Subscription</option>
                  <option value="clinical">Clinical Drug Database</option>
                  <option value="account">Account & Permission</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={3}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Provide details on the error message or issue observed..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddTicketModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-sm"
                >
                  Submit Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
