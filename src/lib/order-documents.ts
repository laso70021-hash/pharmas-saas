import { isConfirmedOrder } from './supplier-portal';
export type OrderDocType = 'quotation' | 'invoice' | 'delivery_note' | 'receipt';
export const ORDER_DOC_LABEL: Record<OrderDocType, string> = { quotation: 'Quotation', invoice: 'Tax Invoice', delivery_note: 'Delivery Note', receipt: 'Payment Receipt' };
/** Which documents exist for an order at its current stage. */
export function availableOrderDocs(status: string): OrderDocType[] {
  if (status === 'quote_requested' || status === 'cancelled') return [];
  if (status === 'quoted' || status === 'rejected') return ['quotation'];
  const docs: OrderDocType[] = ['quotation', 'invoice'];
  if (isConfirmedOrder(status)) docs.push('receipt');
  if (['dispatched', 'in_transit', 'delivered', 'completed'].includes(status)) docs.push('delivery_note');
  return docs;
}
/** Invoice payment stamp: only the supplier's confirmation counts as verified. */
export const paymentStamp = (status: string) => status === 'rejected' ? 'PAYMENT REJECTED' : isConfirmedOrder(status) ? 'PAID · VERIFIED BY SUPPLIER' : 'PAYMENT PROOF SUBMITTED · AWAITING VERIFICATION';
