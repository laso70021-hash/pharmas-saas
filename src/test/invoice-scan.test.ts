import { describe, expect, it } from 'vitest';
import { linesToBatchRows, linesToProductRows, normalizeDate, type InvoiceLine } from '@/lib/invoice-scan';
const line = (p: Partial<InvoiceLine>): InvoiceLine => ({ name: 'Amoxicillin', generic_name: null, brand_name: null, strength: '500mg', dosage_form: 'Capsule', category: 'Antibiotics', description: null, manufacturer: 'Shelys', unit: null, packaging: null, quantity: 20, unit_cost: 1500, selling_price: null, batch_number: 'B1', expiry_date: '08/2027', manufacturing_date: null, prescription_required: true, corrected: null, ...p });
describe('invoice scanning', () => {
  it('MM/YYYY expiry becomes the last day of that month', () => { expect(normalizeDate('08/2027')).toBe('2027-08-31'); expect(normalizeDate('2028-02')).toBe('2028-02-29'); });
  it('rejects impossible dates instead of guessing', () => { expect(normalizeDate('31/02/2027')).toBe(''); expect(normalizeDate('soon')).toBe(''); });
  it('never invents a selling price', () => { expect(linesToProductRows([line({})], 'Shelys')[0]!['selling_price']).toBe(''); });
  it('gives each product a unique SKU and links batches to it', () => {
    const products = linesToProductRows([line({}), line({})], null, ['SWV-AMOXICILLIN-500MG']);
    expect(products.map((p) => p['sku'])).toEqual(['SWV-AMOXICILLIN-500MG-2', 'SWV-AMOXICILLIN-500MG-3']);
    const batches = linesToBatchRows([line({}), line({})], products, 'MAIN', '2026-11-16');
    expect(batches[1]).toMatchObject({ product_sku: 'SWV-AMOXICILLIN-500MG-3', branch_code: 'MAIN', expiry_date: '2027-08-31', quantity: '20', cost_per_unit: '1500' });
  });
});
