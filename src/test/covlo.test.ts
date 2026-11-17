import { describe, it, expect } from 'vitest';
import { COVLO_ROLES, covloPrompts } from '@/lib/covlo';
describe('Covlo roles', () => {
  it('has advice for every requested role', () => {
    for (const r of ['pharmacy_owner','pharmacist','cashier','manager','accountant','supplier','delivery_rider']) expect(COVLO_ROLES[r]).toBeDefined();
  });
  it('falls back to manager prompts for unknown roles', () => { expect(covloPrompts('x')).toEqual(COVLO_ROLES['manager']!.prompts); });
});
import { demandPlan } from '@/lib/covlo';
describe('demand plan', () => {
  it('grows next month by trend and subtracts stock', () => {
    const p = demandPlan({ product: 'Paracetamol', strength: '500mg', units_90d: 300, units_30d: 120, units_prev_30d: 100, pharmacies: 3, your_stock: 50 });
    expect(p.trend).toBe(20); expect(p.expected).toBe(144); expect(p.nextBatch).toBe(94); expect(p.trending).toBe(true);
  });
  it('caps growth at 50% and never suggests negative batches', () => {
    expect(demandPlan({ product: 'x', strength: '', units_90d: 40, units_30d: 30, units_prev_30d: 10, pharmacies: 2, your_stock: 0 }).expected).toBe(45);
    expect(demandPlan({ product: 'x', strength: '', units_90d: 40, units_30d: 10, units_prev_30d: 10, pharmacies: 2, your_stock: 99 }).nextBatch).toBe(0);
  });
});
