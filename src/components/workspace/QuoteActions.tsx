import { useState } from 'react';
import { toast } from 'sonner';
import { Check, X, Upload, Send } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { WholesaleService, type WholesaleOrder } from '@/lib/pharmacy-service';
import { formatNumber } from '@/lib/utils';
import { METHODS } from './MarketplaceTab';
import { Field, Modal, inputCls, primaryBtn, ghostBtn, errorText } from './ws-ui';

/** Supplier: set a price per line, then send (or decline). */
export function QuoteReply({ order: o, disabled, onDone }: { order: WholesaleOrder; disabled: boolean; onDone: () => void }) {
  const [prices, setPrices] = useState<Record<string, string>>(() => Object.fromEntries(o.items.map((i: any) => [i.id, String(i.unit_price)])));
  const [note, setNote] = useState(''); const [busy, setBusy] = useState(false);
  const total = o.items.reduce((a, i: any) => a + (Number(prices[i.id]) || 0) * i.quantity, 0);
  const go = async (decline: boolean) => {
    setBusy(true);
    try {
      await WholesaleService.sendQuote(o.id, o.items.map((i: any) => ({ item_id: i.id, unit_price: Number(prices[i.id]) || 0 })), note, decline);
      toast.success(decline ? 'Request declined.' : 'Quote sent to the pharmacy.'); onDone();
    } catch (e) { toast.error(errorText(e)); } finally { setBusy(false); }
  };
  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-3 space-y-2">
      <div className="text-xs font-black text-violet-800">{o.status === 'quoted' ? 'Quote sent — you can update prices until the pharmacy pays' : 'Set your prices for this request'}</div>
      {o.items.map((i: any) => <div key={i.id} className="flex items-center gap-2 text-xs">
        <span className="flex-1">{i.quantity} × {i.product_name}</span>
        <span className="text-slate-500">TZS</span><input type="number" min={0} className={`${inputCls} w-28`} value={prices[i.id] ?? ''} onChange={(e) => setPrices({ ...prices, [i.id]: e.target.value })} />
      </div>)}
      <div className="text-right text-sm font-black">Quote total TZS {formatNumber(total)}</div>
      <div className="flex flex-col sm:flex-row gap-2">
        <input className={inputCls} placeholder="Note e.g. delivery time, validity" value={note} onChange={(e) => setNote(e.target.value)} />
        <button className={primaryBtn} disabled={busy || disabled} onClick={() => go(false)}><Send className="w-3.5 h-3.5" /> Send quote</button>
        <button className={ghostBtn} disabled={busy || disabled} onClick={() => go(true)}><X className="w-3.5 h-3.5" /> Decline</button>
      </div>
    </div>);
}

/** Buyer: accept a quote by paying, or decline. */
export function PayQuote({ order: o, disabled, onDone }: { order: WholesaleOrder; disabled: boolean; onDone: () => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false);
  const [method, setMethod] = useState('mpesa'); const [reference, setReference] = useState(''); const [file, setFile] = useState<File | null>(null);
  const run = async (accept: boolean) => {
    if (accept && !reference.trim() && !file) { toast.error('Add the transaction reference or attach the receipt.'); return; }
    setBusy(true);
    try {
      await WholesaleService.respondQuote(o.id, accept, accept && user ? { userId: user.id, method, reference, file } : undefined);
      toast.success(accept ? 'Payment proof sent. The supplier will confirm.' : 'Quote declined.'); setOpen(false); onDone();
    } catch (e) { toast.error(errorText(e)); } finally { setBusy(false); }
  };
  if (o.status === 'quote_requested') return (
    <div className="flex items-center gap-2 text-xs text-violet-800 bg-violet-50 rounded-xl p-3"><span className="flex-1">Waiting for the supplier's prices.</span>
      <button className={ghostBtn} disabled={busy || disabled} onClick={() => run(false)}>Cancel request</button></div>);
  return (<>
    <div className="flex flex-wrap items-center gap-2 text-xs bg-violet-50 rounded-xl p-3">
      <span className="flex-1 font-bold text-violet-800">Quote: TZS {formatNumber(o.total_amount)}</span>
      <button className={primaryBtn} disabled={disabled} onClick={() => setOpen(true)}><Check className="w-3.5 h-3.5" /> Accept & pay</button>
      <button className={ghostBtn} disabled={busy || disabled} onClick={() => run(false)}><X className="w-3.5 h-3.5" /> Decline</button>
    </div>
    {open && <Modal title={`Pay quote ${o.order_number}`} onClose={() => !busy && setOpen(false)}>
      <div className="space-y-3">
        <div className="rounded-xl bg-blue-50 px-3 py-2 text-sm font-black text-blue-900">Amount: TZS {formatNumber(o.total_amount)}</div>
        <Field label="Payment method"><div className="grid grid-cols-2 gap-2">{METHODS.map((m) => (
          <button type="button" key={m.v} onClick={() => setMethod(m.v)} className={`px-3 py-2 rounded-xl border text-xs font-bold ${method === m.v ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200'}`}>{m.l}</button>))}</div></Field>
        <Field label="Transaction reference"><input className={inputCls} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. QK72H1XY9" /></Field>
        <Field label="Receipt / screenshot"><label className="flex items-center gap-2 px-3 py-3 rounded-xl border border-dashed border-slate-300 text-xs text-slate-600 cursor-pointer hover:bg-slate-50">
          <Upload className="w-4 h-4" /> {file ? file.name : 'Choose file'}<input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label></Field>
        <button className={`${primaryBtn} w-full justify-center`} disabled={busy} onClick={() => run(true)}>{busy ? 'Sending…' : 'Submit payment proof'}</button>
      </div>
    </Modal>}
  </>);
}
