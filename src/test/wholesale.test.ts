import { describe, expect, it } from 'vitest';
import { addToCart, cartTotal } from '@/lib/workspace';

const a = { product_id: 'a', supplier_id: 's1', unit_price: 1000, stock: 5 };
describe('wholesale cart', () => {
  it('caps quantity at supplier stock', () => {
    expect(addToCart([], a, 9)[0]!.quantity).toBe(5);
  });
  it('switching supplier starts a new cart', () => {
    const c = addToCart([], a, 2);
    const d = addToCart(c, { ...a, product_id: 'b', supplier_id: 's2' }, 1);
    expect(d.map((l) => l.product_id)).toEqual(['b']);
  });
  it('totals unit price × quantity', () => {
    expect(cartTotal(addToCart(addToCart([], a, 2), { ...a, product_id: 'b', unit_price: 500 }, 3))).toBe(3500);
  });
});
