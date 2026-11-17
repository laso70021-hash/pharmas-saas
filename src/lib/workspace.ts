// Rules for the pharmacy workspace (owner + staff). The database enforces the same
// rules (can_write_pharmacy, plan-limit triggers); these mirror them for the UI.
import type { AccountStatus } from './billing';

export type StaffRole = 'manager' | 'pharmacist' | 'cashier' | 'accountant' | 'inventory_manager' | 'delivery_rider';
export type WorkspaceRole = 'owner' | 'admin' | StaffRole;

export const STAFF_ROLES: { value: StaffRole; label: string; description: string }[] = [
  { value: 'manager', label: 'Branch Manager', description: 'Runs branches, stock, sales and expenses' },
  { value: 'pharmacist', label: 'Pharmacist / Dispenser', description: 'Medicines, prescriptions and sales' },
  { value: 'cashier', label: 'Cashier', description: 'Sells at the till' },
  { value: 'inventory_manager', label: 'Inventory Manager', description: 'Receives and manages stock' },
  { value: 'accountant', label: 'Accountant', description: 'Expenses and reports' },
  { value: 'delivery_rider', label: 'Delivery Rider', description: 'Delivers customer orders' },
];

export function roleLabel(role: string): string {
  if (role === 'owner') return 'Owner';
  if (role === 'admin') return 'Platform Admin';
  return STAFF_ROLES.find((r) => r.value === role)?.label ?? role.replace(/_/g, ' ');
}

export function canAcceptDelivery(role: WorkspaceRole): boolean {
  return role === 'delivery_rider';
}

export type Ability = 'manageBranches' | 'manageStaff' | 'manageStock' | 'sell' | 'manageExpenses' | 'viewFinance';

const ABILITIES: Record<Ability, WorkspaceRole[]> = {
  manageBranches: ['owner', 'admin', 'manager'],
  manageStaff: ['owner', 'admin'],
  manageStock: ['owner', 'admin', 'manager', 'inventory_manager', 'pharmacist'],
  sell: ['owner', 'admin', 'manager', 'pharmacist', 'cashier'],
  manageExpenses: ['owner', 'admin', 'manager', 'accountant'],
  viewFinance: ['owner', 'admin', 'manager', 'accountant'],
};

/** Accounts that are not on a running trial or paid year are read-only (admins excepted). */
export function isReadOnly(status: AccountStatus, role: WorkspaceRole): boolean {
  if (role === 'admin') return false;
  return status !== 'trial' && status !== 'active';
}

export function can(role: WorkspaceRole, ability: Ability, status: AccountStatus): boolean {
  if (!ABILITIES[ability].includes(role)) return false;
  if (ability === 'viewFinance') return true;
  return !isReadOnly(status, role);
}

export interface PlanLimits {
  max_branches: number;
  max_employees: number;
}

/** True when another branch/staff seat would exceed the plan (999 = unlimited). */
export function limitReached(used: number, max: number): boolean {
  if (max >= 999) return false;
  return used >= max;
}

export function limitLabel(used: number, max: number): string {
  return max >= 999 ? `${used} / Unlimited` : `${used} / ${max}`;
}

export interface SaleForProfit {
  total: number;
  created_at: string;
  items: { quantity: number; unit_cost: number }[];
}

export interface ProfitSummary {
  revenue: number;
  costOfGoods: number;
  grossProfit: number;
  expenses: number;
  netProfit: number;
  marginPct: number;
}

/** Revenue − cost of the items sold = gross profit; minus expenses = net profit. */
export function profitSummary(sales: SaleForProfit[], expenseAmounts: number[]): ProfitSummary {
  const revenue = sales.reduce((a, s) => a + (s.total || 0), 0);
  const costOfGoods = sales.reduce(
    (a, s) => a + s.items.reduce((b, i) => b + (i.quantity || 0) * (i.unit_cost || 0), 0),
    0
  );
  const expenses = expenseAmounts.reduce((a, e) => a + (e || 0), 0);
  const grossProfit = revenue - costOfGoods;
  const netProfit = grossProfit - expenses;
  return {
    revenue,
    costOfGoods,
    grossProfit,
    expenses,
    netProfit,
    marginPct: revenue > 0 ? Math.round((netProfit / revenue) * 1000) / 10 : 0,
  };
}

export const EXPIRY_WARNING_DAYS = 90;

export type StockState = 'out' | 'low' | 'ok';

export function stockState(quantity: number, minLevel: number): StockState {
  if (quantity <= 0) return 'out';
  if (quantity <= minLevel) return 'low';
  return 'ok';
}

export interface CartLine { product_id: string; supplier_id: string; unit_price: number; quantity: number; stock: number }

/** A wholesale order goes to one supplier at a time; quantities are capped by the supplier's stock. */
export function addToCart(cart: CartLine[], item: Omit<CartLine, 'quantity'>, qty = 1): CartLine[] {
  const base = cart.length && cart[0]!.supplier_id !== item.supplier_id ? [] : cart;
  const existing = base.find((l) => l.product_id === item.product_id);
  const next = Math.min(item.stock, (existing?.quantity ?? 0) + qty);
  if (next <= 0) return base.filter((l) => l.product_id !== item.product_id);
  return existing ? base.map((l) => (l.product_id === item.product_id ? { ...l, quantity: next } : l)) : [...base, { ...item, quantity: next }];
}

export function cartTotal(cart: CartLine[]): number {
  return cart.reduce((a, l) => a + l.unit_price * l.quantity, 0);
}

export function canOrderStock(role: WorkspaceRole): boolean {
  return role === 'owner' || role === 'admin' || role === 'manager' || role === 'inventory_manager';
}

/** Cash drawer for one branch/day: expected cash = opening float + cash sales; over/short = counted − expected. */
export function drawerSummary(sales: { total: number; payment_method: string }[], openingFloat: number, counted: number | null) {
  const byMethod: Record<string, number> = {};
  for (const s of sales) byMethod[s.payment_method] = (byMethod[s.payment_method] || 0) + s.total;
  const cashSales = byMethod['cash'] || 0;
  const expectedCash = openingFloat + cashSales;
  return { byMethod, cashSales, expectedCash, total: sales.reduce((a, s) => a + s.total, 0), overShort: counted == null ? null : counted - expectedCash };
}

/** Change due to the customer; null when the cash given doesn't cover the total. */
export function changeDue(total: number, tendered: number): number | null {
  return tendered >= total ? tendered - total : null;
}

/** Where a signed-in non-admin lands: their first own/staff business that is approved (owner first), else their account page. */
export function landingWorkspace<T extends { id: string; role: string; status: string }>(list: T[]): T | null {
  const mine = list.filter((w) => w.role !== 'admin' && !['pending', 'rejected', 'suspended'].includes(w.status));
  return mine.find((w) => w.role === 'owner') ?? mine[0] ?? null;
}
