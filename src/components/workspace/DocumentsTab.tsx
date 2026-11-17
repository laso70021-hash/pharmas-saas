import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FilePlus2, Printer, Trash2, Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase-client';
import type { Workspace } from '@/lib/pharmacy-types';
import { BrandingService, WorkspaceService } from '@/lib/pharmacy-service';
import { DocumentService, DOC_LABEL, type BizDoc, type DocLine, type DocType } from '@/lib/document-service';
import { ean13Bits } from '@/lib/ean13';
import { BRAND } from '@/lib/brand';
import { can } from '@/lib/workspace';
import { formatNumber } from '@/lib/utils';
import { cardCls, Empty, Field, Modal, SectionHeader, errorText, ghostBtn, inputCls, primaryBtn } from './ws-ui';

const TYPES: DocType[] = ['invoice', 'proforma', 'delivery_note', 'label'];
const STATUSES = ['draft', 'issued', 'sent', 'paid', 'delivered', 'cancelled'];
const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

export function DocumentsTab({ ws }: { ws: Workspace }) {
  const pid = ws.id; const qc = useQueryClient();
  const editable = can(ws.role, 'sell', ws.status) || can(ws.role, 'manageStock', ws.status);
  const { data: docs = [] } = useQuery({ queryKey: ['docs', pid], queryFn: () => DocumentService.list(pid) });
  const [type, setType] = useState<DocType | ''>('');
  const [creating, setCreating] = useState<DocType | null>(null);
  const [open, setOpen] = useState<BizDoc | null>(null);
  const shown = docs.filter((d) => !type || d.doc_type === type);
  const refresh = () => void qc.invalidateQueries({ queryKey: ['docs', pid] });

  return (
    <div className="space-y-5">
      <SectionHeader title="Documents" subtitle="Invoices, proforma invoices, delivery notes and product labels — A4 or thermal" action={editable && (
        <div className="flex flex-wrap gap-2">{TYPES.map((t) => <button key={t} className={t === 'invoice' ? primaryBtn : ghostBtn} onClick={() => setCreating(t)}><FilePlus2 className="w-3.5 h-3.5" /> {DOC_LABEL[t]}</button>)}</div>)} />
      <div className="flex gap-2 text-xs font-bold bg-slate-100 rounded-lg p-0.5 w-fit">
        {(['', ...TYPES] as const).map((t) => <button key={t || 'all'} onClick={() => setType(t)} className={`px-3 py-1.5 rounded-md ${type === t ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}>{t ? DOC_LABEL[t] : 'All'}</button>)}
      </div>
      <div className={`${cardCls} p-5 overflow-x-auto`}>
        {shown.length === 0 ? <Empty>No documents yet.</Empty> : (
          <table className="w-full text-left text-xs min-w-[680px]">
            <thead><tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px] font-bold"><th className="py-2">Number</th><th>Type</th><th>Date</th><th>Customer</th><th>Total</th><th>Status</th><th /></tr></thead>
            <tbody className="divide-y divide-slate-100">{shown.map((d) => (
              <tr key={d.id}>
                <td className="py-2.5 font-bold text-slate-900">{d.doc_number}</td><td>{DOC_LABEL[d.doc_type]}</td><td>{day(d.created_at)}</td>
                <td>{d.customer?.name || '—'}</td><td className="font-bold">TZS {formatNumber(d.total)}</td>
                <td>{editable ? <select aria-label="Status" className="bg-transparent font-semibold capitalize" value={d.status} onChange={async (e) => { try { await DocumentService.setStatus(d.id, e.target.value); toast.success('Status updated'); refresh(); } catch (er) { toast.error(errorText(er)); } }}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select> : <span className="capitalize">{d.status}</span>}</td>
                <td className="text-right"><button className={ghostBtn} onClick={() => setOpen(d)}><Printer className="w-3.5 h-3.5" /> Open</button></td>
              </tr>))}</tbody>
          </table>)}
      </div>
      {creating && <DocForm ws={ws} type={creating} onClose={() => setCreating(null)} onDone={async (id) => { setCreating(null); const list = await qc.fetchQuery({ queryKey: ['docs', pid], queryFn: () => DocumentService.list(pid) }); setOpen(list.find((x) => x.id === id) ?? null); }} />}
      {open && <DocView ws={ws} doc={open} onClose={() => setOpen(null)} />}
    </div>);
}

function DocForm({ ws, type, onClose, onDone }: { ws: Workspace; type: DocType; onClose: () => void; onDone: (id: string) => void }) {
  const pid = ws.id;
  const { data: sales = [] } = useQuery({ queryKey: ['ws', pid, 'sales'], queryFn: () => WorkspaceService.getSales(pid) });
  const { data: products = [] } = useQuery({ queryKey: ['ws', pid, 'products'], queryFn: () => WorkspaceService.getProducts(pid) });
  const { data: batches = [] } = useQuery({ queryKey: ['ws', pid, 'batches'], queryFn: () => WorkspaceService.getBatches(pid) });
  const [mode, setMode] = useState<'sale' | 'manual'>(type === 'proforma' || type === 'label' ? 'manual' : 'sale');
  const [sale, setSale] = useState('');
  const [customer, setCustomer] = useState({ name: '', phone: '', email: '', address: '', tin: '' });
  const [lines, setLines] = useState<DocLine[]>([{ name: '', quantity: 1, unit_price: 0 }]);
  const [discount, setDiscount] = useState(0); const [taxRate, setTaxRate] = useState(0);
  const [payment, setPayment] = useState(''); const [delivery, setDelivery] = useState(''); const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const sub = lines.reduce((a, l) => a + l.quantity * l.unit_price, 0);
  const setLine = (i: number, p: Partial<DocLine>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...p } : l)));
  const pickProduct = (i: number, id: string) => {
    const p = products.find((x) => x.id === id); if (!p) return;
    const b = batches.filter((x) => x.product_id === id && x.quantity > 0).sort((a, c) => a.expiry_date.localeCompare(c.expiry_date))[0];
    setLine(i, { name: p.name, description: [p.strength, p.dosage_form].filter(Boolean).join(' '), unit_price: p.selling_price, barcode: p.barcode, batch: b?.batch_number, expiry: b?.expiry_date });
  };
  const save = async () => {
    setBusy(true);
    try {
      const payload = mode === 'sale' ? { source_sale_id: sale, customer } : { customer, items: lines, discount, tax_rate: taxRate, payment_info: payment, delivery_info: delivery, notes };
      const id = await DocumentService.create(pid, type, payload);
      toast.success(`${DOC_LABEL[type]} created`); onDone(id);
    } catch (e) { toast.error(errorText(e)); } finally { setBusy(false); }
  };
  return (
    <Modal title={`New ${DOC_LABEL[type]}`} onClose={onClose} wide>
      <div className="space-y-4">
        {type !== 'proforma' && type !== 'label' && <div className="flex gap-2 text-xs font-bold bg-slate-100 rounded-lg p-0.5 w-fit">{(['sale', 'manual'] as const).map((m) => <button key={m} onClick={() => setMode(m)} className={`px-3 py-1.5 rounded-md ${mode === m ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}>{m === 'sale' ? 'From a sale' : 'Fill in manually'}</button>)}</div>}
        {type !== 'label' && <div className="grid sm:grid-cols-3 gap-3">
          {(['name', 'phone', 'email', 'address', 'tin'] as const).map((k) => <Field key={k} label={k === 'tin' ? 'Customer TIN' : `Customer ${k}`}><input className={inputCls} value={customer[k]} onChange={(e) => setCustomer({ ...customer, [k]: e.target.value })} /></Field>)}
        </div>}
        {mode === 'sale' ? (
          <Field label="Sale"><select className={inputCls} value={sale} onChange={(e) => setSale(e.target.value)}><option value="">Choose a sale…</option>{sales.slice(0, 200).map((s) => <option key={s.id} value={s.id}>{s.invoice_number} · {day(s.created_at)} · TZS {formatNumber(s.total)}</option>)}</select></Field>
        ) : (<>
          <div className="space-y-2">
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-12 sm:col-span-3"><Field label="Product"><select className={inputCls} value="" onChange={(e) => pickProduct(i, e.target.value)}><option value="">Pick from stock…</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field></div>
                <div className="col-span-6 sm:col-span-3"><Field label="Name"><input className={inputCls} value={l.name} onChange={(e) => setLine(i, { name: e.target.value })} /></Field></div>
                <div className="col-span-3 sm:col-span-2"><Field label={type === 'label' ? 'Labels' : 'Qty'}><input type="number" min={1} className={inputCls} value={l.quantity} onChange={(e) => setLine(i, { quantity: Number(e.target.value) })} /></Field></div>
                <div className="col-span-3 sm:col-span-2"><Field label="Unit price"><input type="number" min={0} className={inputCls} value={l.unit_price} onChange={(e) => setLine(i, { unit_price: Number(e.target.value) })} /></Field></div>
                <div className="col-span-10 sm:col-span-1 text-xs font-bold pb-2">{formatNumber(l.quantity * l.unit_price)}</div>
                <button aria-label="Remove line" className={`${ghostBtn} col-span-2 sm:col-span-1 mb-0.5`} onClick={() => setLines(lines.filter((_, j) => j !== i))}><Trash2 className="w-3.5 h-3.5" /></button>
              </div>))}
            <button className={ghostBtn} onClick={() => setLines([...lines, { name: '', quantity: 1, unit_price: 0 }])}><Plus className="w-3.5 h-3.5" /> Add line</button>
          </div>
          {type !== 'label' && <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Discount (TZS)"><input type="number" min={0} className={inputCls} value={discount} onChange={(e) => setDiscount(Number(e.target.value))} /></Field>
            <Field label="Tax rate %"><input type="number" min={0} max={100} className={inputCls} value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value))} /></Field>
            <Field label="Payment details"><input className={inputCls} value={payment} onChange={(e) => setPayment(e.target.value)} placeholder="e.g. M-Pesa 0771 888 881, due in 7 days" /></Field>
            <Field label="Delivery details"><input className={inputCls} value={delivery} onChange={(e) => setDelivery(e.target.value)} /></Field>
            <div className="sm:col-span-2"><Field label="Notes"><input className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field></div>
          </div>}
          {type !== 'label' && <div className="text-right text-sm font-black">Estimated total TZS {formatNumber(Math.max(0, sub - discount) * (1 + taxRate / 100))}</div>}
        </>)}
        {type === 'proforma' && <p className="text-[11px] text-slate-500">A proforma is a quotation — it does not record a sale or change stock.</p>}
        <button className={primaryBtn} disabled={busy || (mode === 'sale' && !sale)} onClick={() => void save()}>Create {DOC_LABEL[type]}</button>
      </div>
    </Modal>);
}

function Barcode({ code }: { code?: string | undefined }) {
  const bits = code ? ean13Bits(code) : null;
  if (!bits) return code ? <div className="text-[9px]">{code}</div> : null;
  return <div><svg viewBox="0 0 95 30" className="w-full h-8" preserveAspectRatio="none">{bits.split('').map((b, i) => (b === '1' ? <rect key={i} x={i} width={1} height={30} fill="currentColor" /> : null))}</svg><div className="text-[9px] text-center tracking-widest">{code}</div></div>;
}

function DocView({ ws, doc, onClose }: { ws: Workspace; doc: BizDoc; onClose: () => void }) {
  const { data: logo } = useQuery({ queryKey: ['logo', ws.id], queryFn: () => BrandingService.getLogoUrl(ws.id) });
  const { data: biz } = useQuery({ queryKey: ['biz', ws.id], queryFn: async () => (await supabase.from('pharmacies').select('name, phone, email, address, city, tax_number').eq('id', ws.id).maybeSingle()).data });
  const { data: hist = [] } = useQuery({ queryKey: ['doc-hist', doc.id], queryFn: () => DocumentService.history(doc.id) });
  const [fmt, setFmt] = useState<'a4' | 'thermal'>('a4');
  const print = () => {
    const s = document.createElement('style');
    s.textContent = `@page{size:${fmt === 'thermal' ? '80mm auto' : 'A4'};margin:${fmt === 'thermal' ? '3mm' : '12mm'}}body *{visibility:hidden}#doc-print,#doc-print *{visibility:visible}#doc-print{position:absolute;left:0;top:0;width:${fmt === 'thermal' ? '74mm' : '100%'}}`;
    document.head.appendChild(s); setTimeout(() => { window.print(); s.remove(); }, 50);
  };
  const thermal = fmt === 'thermal';
  const logoImg = <img src={logo || BRAND.markUrl} alt="Logo" className={thermal ? 'h-10 mx-auto' : 'h-14 object-contain'} />;
  const showPrices = doc.doc_type !== 'delivery_note';

  return (
    <Modal title={`${DOC_LABEL[doc.doc_type]} ${doc.doc_number}`} onClose={onClose} wide>
      <div className="flex flex-wrap gap-2 mb-4">
        {doc.doc_type !== 'label' && (['a4', 'thermal'] as const).map((f) => <button key={f} onClick={() => setFmt(f)} className={fmt === f ? primaryBtn : ghostBtn}>{f === 'a4' ? 'A4' : 'Thermal 80mm'}</button>)}
        <button className={primaryBtn} onClick={print}><Printer className="w-3.5 h-3.5" /> Print / Save as PDF</button>
      </div>
      <div id="doc-print" className={`bg-white text-slate-900 mx-auto ${thermal ? 'w-[300px] text-[11px] font-mono' : 'text-sm'}`}>
        {doc.doc_type === 'label' ? (
          <div className="grid grid-cols-3 gap-2">
            {doc.items.flatMap((l, i) => Array.from({ length: Math.min(200, l.quantity) }, (_, k) => (
              <div key={`${i}-${k}`} className="border border-slate-300 rounded p-2 text-[10px] break-inside-avoid">
                <div className="mb-1">{logoImg}</div><div className="font-black text-xs uppercase">{l.name}</div>
                {l.description && <div>{l.description}</div>}
                <div className="flex justify-between"><span>{l.batch ? `Batch ${l.batch}` : ''}</span><span>{l.expiry ? `Exp ${day(l.expiry)}` : ''}</span></div>
                <div className="font-black">TZS {formatNumber(l.unit_price)}</div>
                <Barcode code={l.barcode} />
                <div className="text-[8px] text-slate-500">{biz?.name ?? ws.name}</div>
              </div>)))}
          </div>
        ) : (
          <div className="space-y-4">
            <div className={thermal ? 'text-center space-y-0.5' : 'flex justify-between items-start gap-4'}>
              <div className={thermal ? '' : 'flex gap-3 items-start'}>{logoImg}<div><div className="font-black text-base">{biz?.name ?? ws.name}</div><div>{[biz?.address, biz?.city].filter(Boolean).join(', ')}</div><div>{[biz?.phone, biz?.email].filter(Boolean).join(' · ')}</div>{biz?.tax_number && <div>TIN {biz.tax_number}</div>}</div></div>
              <div className={thermal ? 'pt-2' : 'text-right'}><div className="font-black text-lg uppercase">{DOC_LABEL[doc.doc_type]}</div><div>No. {doc.doc_number}</div><div>Date {day(doc.created_at)}</div><div className="capitalize">Status {doc.status}</div></div>
            </div>
            {doc.customer?.name && <div className={thermal ? 'border-t border-dashed pt-1' : 'rounded-lg bg-slate-50 p-3'}><div className="font-bold">{doc.doc_type === 'delivery_note' ? 'Deliver to' : 'Bill to'}</div><div>{doc.customer.name}</div>{[doc.customer.address, doc.customer.phone, doc.customer.email].filter(Boolean).map((x) => <div key={x}>{x}</div>)}{doc.customer.tin && <div>TIN {doc.customer.tin}</div>}</div>}
            <table className="w-full text-left">
              <thead><tr className="border-b border-slate-300">{!thermal && <th className="py-1">#</th>}<th>Item</th><th className="text-right">Qty</th>{showPrices && <><th className="text-right">Price</th><th className="text-right">Total</th></>}</tr></thead>
              <tbody>{doc.items.map((l, i) => <tr key={i} className="border-b border-slate-100 align-top">{!thermal && <td className="py-1">{i + 1}</td>}<td><div className="font-semibold">{l.name}</div>{!thermal && l.description && <div className="text-xs text-slate-500">{l.description}{l.batch ? ` · Batch ${l.batch}` : ''}</div>}</td><td className="text-right">{l.quantity}</td>{showPrices && <><td className="text-right">{formatNumber(l.unit_price)}</td><td className="text-right">{formatNumber(l.total ?? l.quantity * l.unit_price)}</td></>}</tr>)}</tbody>
            </table>
            {showPrices && <div className={`ml-auto space-y-0.5 ${thermal ? '' : 'w-64'}`}>
              <div className="flex justify-between"><span>Subtotal</span><span>TZS {formatNumber(doc.subtotal)}</span></div>
              {doc.discount > 0 && <div className="flex justify-between"><span>Discount</span><span>- TZS {formatNumber(doc.discount)}</span></div>}
              {doc.tax > 0 && <div className="flex justify-between"><span>Tax ({doc.tax_rate}%)</span><span>TZS {formatNumber(doc.tax)}</span></div>}
              <div className="flex justify-between font-black text-base border-t border-slate-300 pt-1"><span>Total</span><span>TZS {formatNumber(doc.total)}</span></div>
            </div>}
            {doc.payment_info && <div><span className="font-bold">Payment: </span>{doc.payment_info}</div>}
            {doc.delivery_info && <div><span className="font-bold">Delivery: </span>{doc.delivery_info}</div>}
            {doc.notes && <div>{doc.notes}</div>}
            {doc.doc_type === 'proforma' && <div className="text-xs italic">This is a quotation, not a tax invoice. Prices are valid for 14 days.</div>}
            {doc.doc_type === 'delivery_note' && <div className="grid grid-cols-2 gap-8 pt-8"><div className="border-t border-slate-400 pt-1">Delivered by</div><div className="border-t border-slate-400 pt-1">Received by (name, signature, date)</div></div>}
            <div className="text-center text-[10px] text-slate-500 pt-2">Thank you · Powered by Swahivo</div>
          </div>)}
      </div>
      {hist.length > 0 && <div className="mt-4 text-[11px] text-slate-500">History: {hist.map((h) => `${h.action.replace('status:', '→ ')} (${day(h.created_at)})`).join(' · ')}</div>}
    </Modal>);
}
