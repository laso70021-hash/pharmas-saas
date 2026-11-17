import { z } from 'zod';

export const invoiceLineSchema = z.object({
  name: z.string().max(200), generic_name: z.string().max(200).nullable(), brand_name: z.string().max(200).nullable(),
  strength: z.string().max(80).nullable(), dosage_form: z.string().max(80).nullable(), category: z.string().max(120).nullable(),
  description: z.string().max(500).nullable(), manufacturer: z.string().max(200).nullable(), unit: z.string().max(40).nullable(),
  packaging: z.string().max(120).nullable(), quantity: z.number().nonnegative().nullable(), unit_cost: z.number().nonnegative().nullable(),
  selling_price: z.number().nonnegative().nullable(), batch_number: z.string().max(80).nullable(), expiry_date: z.string().max(20).nullable(),
  manufacturing_date: z.string().max(20).nullable(), prescription_required: z.boolean().nullable(), corrected: z.string().max(300).nullable(),
});
export const invoiceResultSchema = z.object({
  supplier_name: z.string().max(200).nullable(), invoice_number: z.string().max(80).nullable(), invoice_date: z.string().max(20).nullable(),
  warnings: z.array(z.string().max(500)).max(30), lines: z.array(invoiceLineSchema).max(300),
});
export type InvoiceLine = z.infer<typeof invoiceLineSchema>;
export type InvoiceResult = z.infer<typeof invoiceResultSchema>;

/** Accept only real calendar dates; "MM/YYYY" expiry means the last day of that month. */
export function normalizeDate(v: string | null | undefined): string {
  if (!v) return '';
  const s = v.trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) { const d = new Date(`${s}T00:00:00Z`); return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === s ? s : ''; }
  const monthEnd = (mm: number, yy: number) => (mm >= 1 && mm <= 12 ? new Date(Date.UTC(yy, mm, 0)).toISOString().slice(0, 10) : '');
  m = /^(\d{1,2})[/.-](\d{4})$/.exec(s);
  if (m) return monthEnd(Number(m[1]), Number(m[2]));
  m = /^(\d{4})-(\d{1,2})$/.exec(s);
  if (m) return monthEnd(Number(m[2]), Number(m[1]));
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
  if (m) { const iso = `${m[3]}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}`; return normalizeDate(iso); }
  return '';
}

export function skuFor(line: Pick<InvoiceLine, 'name' | 'strength'>, taken: Set<string>): string {
  const base = ('SWV-' + `${line.name} ${line.strength ?? ''}`.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24)).replace(/-$/, '');
  let sku = base, n = 2;
  while (taken.has(sku.toLowerCase())) sku = `${base}-${n++}`;
  taken.add(sku.toLowerCase());
  return sku;
}

const money = (n: number | null) => (n == null ? '' : String(Math.round(n)));

/** Invoice lines → products import rows. Selling price is only filled when printed on the invoice. */
export function linesToProductRows(lines: InvoiceLine[], supplier: string | null, existingSkus: string[] = []): Record<string, string>[] {
  const taken = new Set(existingSkus.map((s) => s.toLowerCase()));
  return lines.map((l) => ({
    name: l.name, generic_name: l.generic_name ?? '', brand_name: l.brand_name ?? '', category_name: l.category ?? '',
    description: [l.description, l.manufacturer ? `Manufacturer: ${l.manufacturer}` : ''].filter(Boolean).join(' · '),
    sku: skuFor(l, taken), barcode: '', dosage_form: l.dosage_form ?? '', strength: l.strength ?? '',
    unit_of_measurement: l.unit || 'Pack', packaging: l.packaging ?? '', cost_price: money(l.unit_cost), selling_price: money(l.selling_price),
    min_stock_level: '10', supplier_name: supplier ?? '', is_prescription_required: l.prescription_required ? 'true' : 'false', is_active: 'true',
  }));
}

/** Invoice lines → opening-stock rows for one branch, using the SKUs from the product rows. */
export function linesToBatchRows(lines: InvoiceLine[], productRows: Record<string, string>[], branchCode: string, received: string): Record<string, string>[] {
  return lines.map((l, i) => ({
    product_sku: productRows[i]?.['sku'] ?? '', branch_code: branchCode, batch_number: l.batch_number ?? '',
    manufacturing_date: normalizeDate(l.manufacturing_date), expiry_date: normalizeDate(l.expiry_date), received_date: received,
    quantity: l.quantity == null ? '' : String(Math.round(l.quantity)), cost_per_unit: money(l.unit_cost),
  }));
}
