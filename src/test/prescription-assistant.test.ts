import { describe, expect, it } from 'vitest';
import { canAnalyzePrescription, prescriptionStock, validatePrescriptionMatches, type PrescriptionAnalysis } from '@/lib/prescription-assistant';

describe('Prescription assistant safeguards', () => {
  it('counts only unexpired stock at the selected branch read', () => {
    expect(prescriptionStock([
      { product_id: 'a', quantity: 12, expiry_date: '2027-01-01' },
      { product_id: 'a', quantity: 8, expiry_date: '2026-11-15' },
      { product_id: 'a', quantity: 3, expiry_date: '2026-11-16' },
      { product_id: 'a', quantity: 100, expiry_date: null },
    ], '2026-11-16').get('a')).toBe(15);
  });
  it('never preselects ambiguous medicine matches', () => {
    const draft: PrescriptionAnalysis = { transcription: 'Amoxicillin', warnings: [], medicines: [{ written_name: 'Amoxicillin', product_id: 'a', instructions: '', quantity: null, uncertain: true }] };
    expect(validatePrescriptionMatches(draft, new Set(['a'])).medicines[0]?.product_id).toBeNull();
  });
  it('rejects model-invented product identifiers', () => {
    const draft: PrescriptionAnalysis = { transcription: 'Amoxicillin', warnings: [], medicines: [{ written_name: 'Amoxicillin', product_id: 'other-business', instructions: '', quantity: 1, uncertain: false }] };
    expect(validatePrescriptionMatches(draft, new Set(['our-product'])).medicines[0]?.product_id).toBeNull();
  });
  it('retains exact catalogue matches and written dosage', () => {
    const draft: PrescriptionAnalysis = { transcription: 'Paracetamol 500mg', warnings: [], medicines: [{ written_name: 'Paracetamol 500mg', product_id: 'ours', instructions: '1 tablet twice daily', quantity: 10, uncertain: false }] };
    expect(validatePrescriptionMatches(draft, new Set(['ours'])).medicines[0]).toEqual(draft.medicines[0]);
  });
  it('keeps clinical assistance out of rider and accountant tasks', () => {
    expect(canAnalyzePrescription('delivery_rider')).toBe(false);
    expect(canAnalyzePrescription('accountant')).toBe(false);
    expect(canAnalyzePrescription('pharmacist')).toBe(true);
    expect(canAnalyzePrescription('cashier')).toBe(true);
  });
});