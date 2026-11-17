import { z } from 'zod';

export const prescriptionResultSchema = z.object({
  transcription: z.string().max(12000),
  patient_name: z.string().max(200).nullable().optional(),
  prescriber: z.string().max(200).nullable().optional(),
  prescription_date: z.string().max(40).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  warnings: z.array(z.string().max(1000)).max(20),
  medicines: z.array(z.object({
    written_name: z.string().max(300),
    product_id: z.string().uuid().nullable(),
    instructions: z.string().max(1000),
    quantity: z.number().int().positive().max(100000).nullable(),
    uncertain: z.boolean(),
  })).max(40),
});
export type PrescriptionAnalysis = z.infer<typeof prescriptionResultSchema>;
export interface PrescriptionStock { product_id: string; quantity: number; expiry_date: string | null }

/** Only unexpired, dated batches are available for dispensing. */
export function prescriptionStock(batches: PrescriptionStock[], today: string): Map<string, number> {
  const stock = new Map<string, number>();
  for (const b of batches) {
    if (b.quantity > 0 && b.expiry_date && b.expiry_date >= today) stock.set(b.product_id, (stock.get(b.product_id) ?? 0) + b.quantity);
  }
  return stock;
}

/** A model cannot invent a catalogue ID. Ambiguous matches stay unselected. */
export function validatePrescriptionMatches(result: PrescriptionAnalysis, productIds: Set<string>): PrescriptionAnalysis {
  return { ...result, medicines: result.medicines.map(m => ({ ...m, product_id: m.product_id && productIds.has(m.product_id) && !m.uncertain ? m.product_id : null })) };
}

export function canAnalyzePrescription(role: string): boolean {
  return ['owner', 'admin', 'manager', 'pharmacist', 'cashier'].includes(role);
}