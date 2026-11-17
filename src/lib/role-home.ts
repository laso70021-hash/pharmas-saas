// Which home screen each workspace role gets. Owners, admins and managers keep the
// full business Overview; every other role gets a focused home with only its own work.
import type { WorkspaceRole } from './workspace';
import { deliveryLabel, workflowStatus, type DeliveryJob } from './delivery-service';

export type HomeKind = 'business' | 'cashier' | 'pharmacist' | 'inventory' | 'accountant' | 'rider';
export interface QuickAction { tab: string; label: string; hint: string }

export function riderHomeData(jobs: Pick<DeliveryJob, 'tracking_number' | 'status' | 'rider_id' | 'assignment_state' | 'dropoff_address'>[], userId: string) {
  const available = jobs.filter((job) => workflowStatus(job.status) === 'in_process' && job.assignment_state === 'available' && job.rider_id === null);
  const mine = jobs.filter((job) => job.rider_id === userId);
  const open = mine.filter((job) => !['delivered', 'cancelled', 'returned'].includes(workflowStatus(job.status)));
  const visible = jobs.filter((job) => workflowStatus(job.status) !== 'cancelled' && (
    job.rider_id === userId || (workflowStatus(job.status) === 'in_process' && job.assignment_state === 'available' && job.rider_id === null)
  ));

  return {
    stats: {
      available: available.length,
      assigned: open.length,
      delivered: mine.filter((job) => job.status === 'delivered').length,
    },
    rows: visible.slice(0, 8).map((job) => ({
      label: job.tracking_number,
      sub: job.dropoff_address,
      badge: job.rider_id === userId ? deliveryLabel(job.status, job.assignment_state) : 'Available',
    })),
  };
}

export function homeFor(role: WorkspaceRole): HomeKind {
  switch (role) {
    case 'cashier': return 'cashier';
    case 'pharmacist': return 'pharmacist';
    case 'inventory_manager': return 'inventory';
    case 'accountant': return 'accountant';
    case 'delivery_rider': return 'rider';
    default: return 'business';
  }
}

export const HOME_COPY: Record<Exclude<HomeKind, 'business'>, { title: string; subtitle: string; actions: QuickAction[] }> = {
  cashier: { title: 'Cashier Dashboard', subtitle: 'Your sales and till for today.', actions: [
    { tab: 'pos', label: 'Open Cashier (POS)', hint: 'Start a new sale' },
    { tab: 'shifts', label: 'My Shift', hint: 'Start, pause or hand over' },
    { tab: 'documents', label: 'Receipts & Documents', hint: 'Reprint or share' }] },
  pharmacist: { title: 'Dispenser Dashboard', subtitle: 'Prescriptions waiting, medicines to dispense first and your sales today.', actions: [
    { tab: 'rx', label: 'Prescription Queue', hint: 'Review and dispense' },
    { tab: 'pos', label: 'Cashier (POS)', hint: 'Sell over the counter' },
    { tab: 'stock-alerts:expiry', label: 'Expiring Medicines', hint: 'Dispense these first' }] },
  inventory: { title: 'Inventory Dashboard', subtitle: 'Stock that needs attention and orders on the way.', actions: [
    { tab: 'stock-alerts', label: 'Restock Needed', hint: 'Low and out of stock' },
    { tab: 'restock', label: 'Order from Suppliers', hint: 'Restock your branch' },
    { tab: 'inventory', label: 'Inventory', hint: 'Products and batches' },
    { tab: 'imports', label: 'Bulk Imports', hint: 'Upload a spreadsheet' }] },
  accountant: { title: 'Finance Dashboard', subtitle: 'This month’s sales, expenses and profit.', actions: [
    { tab: 'expenses', label: 'Expenses', hint: 'Record and review' },
    { tab: 'sales-reports', label: 'Sales Reports', hint: 'Detailed sales' },
    { tab: 'documents', label: 'Invoices & Documents', hint: 'Business documents' }] },
  rider: { title: 'Delivery Dashboard', subtitle: 'Claim available deliveries and track the ones assigned to you.', actions: [
    { tab: 'deliveries', label: 'View available deliveries', hint: 'Accept a delivery or update one assigned to you' },
    { tab: 'shifts', label: 'My Shift', hint: 'Start or end your shift' }] },
};
