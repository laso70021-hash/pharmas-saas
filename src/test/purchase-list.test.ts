import { describe, it, expect } from 'vitest';
import { parsePurchaseList, planPurchase } from '@/lib/supplier-match';

const cat = [
  { product_id: 'a', supplier_id: 's1', name: 'Paracetamol', strength: '500mg', unit_price: 100, stock: 30 },
  { product_id: 'b', supplier_id: 's2', name: 'Paracetamol', strength: '500mg', unit_price: 120, stock: 100 },
];
describe('purchase list', () => {
  it('reads headers and merges duplicate lines', () => {
    expect(parsePurchaseList([['Product', 'Strength', 'Qty'], ['Paracetamol', '500mg', '20'], ['paracetamol', '500mg', '30']]))
      .toEqual([{ name: 'Paracetamol', strength: '500mg', quantity: 50 }]);
  });
  it('splits a quantity across suppliers when the cheapest runs short', () => {
    const [r] = planPurchase([{ name: 'Paracetamol', strength: '500mg', quantity: 50 }], cat);
    expect(r!.picks.map((p) => [p.item.supplier_id, p.quantity])).toEqual([['s1', 30], ['s2', 20]]);
    expect(r!.missing).toBe(0);
  });
  it('reports what no supplier can cover', () => {
    expect(planPurchase([{ name: 'Paracetamol', quantity: 200 }], cat)[0]!.missing).toBe(70);
  });
});

import { supplierNextStep, canReceive } from '@/lib/supplier-portal';
describe('order lifecycle', () => {
  it('supplier moves confirmed → preparing → dispatched → in transit → delivered', () => {
    expect(['confirmed', 'preparing', 'dispatched', 'in_transit'].map(supplierNextStep)).toEqual(['preparing', 'dispatched', 'in_transit', 'delivered']);
    expect(supplierNextStep('delivered')).toBeNull();
    expect(supplierNextStep('payment_submitted')).toBeNull();
  });
  it('buyer can receive only after dispatch', () => {
    expect(canReceive('preparing')).toBe(false);
    expect(canReceive('dispatched')).toBe(true);
    expect(canReceive('completed')).toBe(false);
  });
});

import { availableOrderDocs, paymentStamp } from '@/lib/order-documents';
describe('order documents', () => {
  it('delivery note only after dispatch, receipt only after payment is verified', () => {
    expect(availableOrderDocs('payment_submitted')).toEqual(['quotation', 'invoice']);
    expect(availableOrderDocs('confirmed')).toEqual(['quotation', 'invoice', 'receipt']);
    expect(availableOrderDocs('dispatched')).toContain('delivery_note');
  });
  it('invoice says paid only once the supplier verified it', () => {
    expect(paymentStamp('payment_submitted')).toMatch(/AWAITING/);
    expect(paymentStamp('confirmed')).toMatch(/VERIFIED/);
  });
});

describe('quotation documents', () => {
  it('no documents while waiting for prices; quotation once quoted', () => {
    expect(availableOrderDocs('quote_requested')).toEqual([]);
    expect(availableOrderDocs('quoted')).toEqual(['quotation']);
  });
});

import { landingWorkspace } from '@/lib/workspace';
describe('login landing', () => {
  it('owners land on their own approved business, staff on theirs, pending goes to account', () => {
    expect(landingWorkspace([{ id: 'a', role: 'cashier', status: 'active' }, { id: 's', role: 'owner', status: 'trial' }])?.id).toBe('s');
    expect(landingWorkspace([{ id: 'a', role: 'cashier', status: 'active' }])?.id).toBe('a');
    expect(landingWorkspace([{ id: 'p', role: 'owner', status: 'pending' }])).toBeNull();
  });
});
