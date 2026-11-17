// Pure rules for the Supplier Portal screens (kept here so they can be tested).
export type BatchStatus = 'expired' | 'near_expiry' | 'low' | 'in_stock' | 'out';
export function batchStatus(b: { qty: number; expiry: string; min: number }, today = new Date()): BatchStatus {
  const days = Math.floor((new Date(b.expiry + 'T00:00:00').getTime() - new Date(today.toDateString()).getTime()) / 86400000);
  if (days < 0) return 'expired';
  if (b.qty <= 0) return 'out';
  if (days <= 90) return 'near_expiry';
  if (b.qty <= b.min) return 'low';
  return 'in_stock';
}
/** Expired stock is never counted as available to sell. */
export function availableUnits(batches: { qty: number; expiry: string; min: number }[], today = new Date()): number {
  return batches.filter((b) => batchStatus(b, today) !== 'expired').reduce((a, b) => a + Math.max(0, b.qty), 0);
}
export const ORDER_FLOW = ['payment_submitted', 'confirmed', 'preparing', 'dispatched', 'in_transit', 'delivered', 'completed'] as const;
export const ORDER_STATUS_LABEL: Record<string, string> = { quote_requested: 'Quote requested', quoted: 'Quoted', cancelled: 'Cancelled', payment_submitted: 'New', confirmed: 'Confirmed', preparing: 'Preparing', dispatched: 'Dispatched', in_transit: 'In transit', delivered: 'Delivered', completed: 'Received', rejected: 'Rejected' };
/** Supplier's next step for an order (null when it's not theirs to move). */
export function supplierNextStep(status: string): string | null {
  return ({ confirmed: 'preparing', preparing: 'dispatched', dispatched: 'in_transit', in_transit: 'delivered' } as Record<string, string>)[status] ?? null;
}
/** Buyer can confirm receipt (which adds stock) once the goods have left the supplier. */
export const canReceive = (status: string) => ['dispatched', 'in_transit', 'delivered'].includes(status);
/** Payment verified by the supplier = any status from confirmed onward. */
export const isConfirmedOrder = (status: string) => ORDER_FLOW.indexOf(status as never) >= 1;
export function notificationGroup(kind: string, title: string): 'order' | 'payment' | 'inventory' | 'delivery' | 'system' {
  const t = `${kind} ${title}`.toLowerCase();
  if (/payment|receipt|paid|invoice/.test(t)) return 'payment';
  if (/order|wholesale/.test(t)) return 'order';
  if (/stock|expir|batch|inventory/.test(t)) return 'inventory';
  if (/deliver|dispatch/.test(t)) return 'delivery';
  return 'system';
}
