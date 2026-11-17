import { describe, it, expect } from 'vitest';
import { matchCatalog, matchScore } from '@/lib/supplier-match';
const cat = [
  { name: 'Amoxicillin', generic_name: 'Amoxicillin', strength: '500mg', unit_price: 1200, stock: 100 },
  { name: 'Amoxil', generic_name: 'Amoxicillin', strength: '250mg', unit_price: 900, stock: 50 },
  { name: 'Paracetamol', generic_name: 'Paracetamol', strength: '500mg', unit_price: 300, stock: 0 },
  { name: 'Amoxicillin', generic_name: 'Amoxicillin', strength: '500mg', unit_price: 1000, stock: 20 },
];
describe('supplier matching', () => {
  it('does not match unrelated medicines', () => { expect(matchScore({ name: 'Paracetamol' }, cat[0]!)).toBe(0); });
  it('ranks exact strength first, then cheapest', () => {
    const r = matchCatalog({ name: 'Amoxicillin', strength: '500mg', quantity: 10 }, cat);
    expect(r.map((x) => x.unit_price)).toEqual([1000, 1200, 900]);
  });
  it('out-of-stock matches come last', () => {
    const r = matchCatalog({ name: 'Paracetamol', quantity: 5 }, [...cat, { name: 'Paracetamol', unit_price: 400, stock: 9 }]);
    expect(r[0]!.stock).toBe(9);
  });
});
