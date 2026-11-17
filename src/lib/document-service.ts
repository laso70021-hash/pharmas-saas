import { supabase as typed } from '@/lib/supabase-client';
const db = typed as unknown as { from: (t: string) => any; rpc: (f: string, a: object) => any };
const ok = <T,>(r: { data: T; error: { message: string } | null }) => { if (r.error) throw new Error(r.error.message); return r.data; };

export type DocType = 'invoice' | 'proforma' | 'delivery_note' | 'label';
export const DOC_LABEL: Record<DocType, string> = { invoice: 'Invoice', proforma: 'Proforma Invoice', delivery_note: 'Delivery Note', label: 'Product Labels' };
export interface DocLine { name: string; description?: string | undefined; quantity: number; unit_price: number; total?: number | undefined; barcode?: string | undefined; batch?: string | undefined; expiry?: string | undefined }
export interface BizDoc {
  id: string; doc_type: DocType; doc_number: string; status: string; customer: { name?: string; phone?: string; email?: string; address?: string; tin?: string };
  items: DocLine[]; subtotal: number; discount: number; tax_rate: number; tax: number; total: number;
  payment_info: string | null; delivery_info: string | null; notes: string | null; source_sale_id: string | null; created_at: string;
}
export const DocumentService = {
  async list(pid: string): Promise<BizDoc[]> { return ok(await db.from('business_documents').select('*').eq('pharmacy_id', pid).order('created_at', { ascending: false }).limit(500)) ?? []; },
  async create(pid: string, type: DocType, payload: object): Promise<string> { return ok(await db.rpc('create_business_document', { _pharmacy: pid, _type: type, _payload: payload })); },
  async setStatus(id: string, status: string) { ok(await db.rpc('set_document_status', { _id: id, _status: status, _note: null })); },
  async history(id: string): Promise<{ action: string; created_at: string }[]> { return ok(await db.from('business_document_events').select('action, created_at').eq('document_id', id).order('created_at')) ?? []; },
};
