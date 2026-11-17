import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FileText, Check, X, MessageCircle, Phone, MapPin } from 'lucide-react';
import { WholesaleChat } from './WholesaleChat';
import { QuoteReply, PayQuote } from './QuoteActions';
import { OrderDocument } from './OrderDocument';
import { availableOrderDocs, ORDER_DOC_LABEL, type OrderDocType } from '@/lib/order-documents';
import type { Workspace } from '@/lib/pharmacy-types';
import { WholesaleService, type WholesaleOrder } from '@/lib/pharmacy-service';
import { isReadOnly } from '@/lib/workspace';
import { PlanFeatureGate } from './PlanFeatureGate';
import { Button } from '@/components/ui/button';
import { ORDER_FLOW, ORDER_STATUS_LABEL, supplierNextStep, canReceive } from '@/lib/supplier-portal';
import { formatNumber, formatDateDeterministic } from '@/lib/utils';
import { Empty, SectionHeader, primaryBtn, ghostBtn, cardCls, errorText, inputCls } from './ws-ui';

const STATUS: Record<WholesaleOrder['status'], { l: string; c: string }> = {
  quote_requested: { l: 'Quote requested', c: 'bg-violet-50 text-violet-700' },
  quoted: { l: 'Quote received', c: 'bg-violet-50 text-violet-700' },
  cancelled: { l: 'Cancelled', c: 'bg-slate-100 text-slate-500' },
  payment_submitted: { l: 'Awaiting supplier', c: 'bg-amber-50 text-amber-700' },
  confirmed: { l: 'Payment confirmed', c: 'bg-indigo-50 text-indigo-700' },
  preparing: { l: 'Preparing', c: 'bg-amber-50 text-amber-700' },
  dispatched: { l: 'Dispatched', c: 'bg-sky-50 text-sky-700' },
  in_transit: { l: 'In transit', c: 'bg-sky-50 text-sky-700' },
  delivered: { l: 'Delivered', c: 'bg-teal-50 text-teal-700' },
  completed: { l: 'Received · stocked', c: 'bg-emerald-50 text-emerald-700' },
  rejected: { l: 'Rejected', c: 'bg-rose-50 text-rose-700' },
};

export function OrdersTab({ ws }: { ws: Workspace }) {
  const side = ws.business_type === 'supplier' ? 'supplier' : 'buyer';
  const qc = useQueryClient();
  const { data: orders = [], isLoading } = useQuery({ queryKey: ['wholesale', 'orders', ws.id, side], queryFn: () => WholesaleService.orders(ws.id, side) });
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const readOnly = isReadOnly(ws.status, ws.role);
  const [chat, setChat] = useState<WholesaleOrder | null>(null);
  const [doc, setDoc] = useState<{ o: WholesaleOrder; t: OrderDocType } | null>(null);
  const ids = orders.map((o) => o.id);
  const { data: events = [] } = useQuery({ queryKey: ['wholesale', 'timeline', ids], queryFn: () => WholesaleService.timeline(ids), enabled: ids.length > 0 });
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['wholesale'] }); void qc.invalidateQueries({ queryKey: ['ws', ws.id] }); };
  const step = async (o: WholesaleOrder, run: () => Promise<void>, ok: string) => {
    setBusy(o.id);
    try { await run(); toast.success(ok); setNotes({ ...notes, [o.id]: '' }); refresh(); } catch (err) { toast.error(errorText(err)); } finally { setBusy(null); }
  };

  const openReceipt = async (path: string) => {
    try { window.open(await WholesaleService.receiptUrl(path), '_blank', 'noopener'); } catch (err) { toast.error(errorText(err)); }
  };
  const review = async (o: WholesaleOrder, d: 'accept' | 'reject') => {
    setBusy(o.id);
    try {
      await WholesaleService.review(o.id, d, notes[o.id] || '');
      toast.success(d === 'accept' ? `Payment confirmed — stock reserved for ${o.buyer_name}.` : 'Order rejected.');
      void qc.invalidateQueries({ queryKey: ['wholesale'] });
      void qc.invalidateQueries({ queryKey: ['ws', ws.id] });
    } catch (err) { toast.error(errorText(err)); } finally { setBusy(null); }
  };

  return (
    <div className="space-y-4">
      <SectionHeader title={side === 'supplier' ? 'Wholesale orders' : 'My supplier orders'}
        subtitle={side === 'supplier' ? 'Check the payment, confirm, then move each order through preparing, dispatch and delivery.' : 'Track each order to your door. Stock is added when you confirm you received it.'} />
      {isLoading ? <Empty>Loading orders…</Empty> : orders.length === 0 ? <Empty>No orders yet.</Empty> : orders.map((o) => (
        <div key={o.id} className={`${cardCls} p-4 space-y-3`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-black text-sm">{o.order_number} · {side === 'supplier' ? o.buyer_name : o.supplier_name}</div>
              <div className="text-[11px] text-slate-500">{formatDateDeterministic(o.created_at)} · deliver to {o.branch_name}</div>
            </div>
            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${STATUS[o.status].c}`}>{STATUS[o.status].l}</span>
          </div>
          {ORDER_FLOW.includes(o.status as never) && (() => {
            const at = ORDER_FLOW.indexOf(o.status as never);
            const ev = events.filter((e) => e.order_id === o.id);
            return <div className="flex items-start overflow-x-auto pb-1">{ORDER_FLOW.map((st, i) => {
              const e = ev.find((x) => x.status === st);
              return <div key={st} className="flex-1 min-w-[72px] flex flex-col items-center text-center relative">
                {i > 0 && <span className={`absolute top-2.5 right-1/2 w-full h-0.5 ${i <= at ? 'bg-blue-600' : 'bg-slate-200'}`} />}
                <span className={`relative z-10 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${i <= at ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'}`}>{i < at || o.status === 'completed' ? '✓' : i + 1}</span>
                <span className={`text-[10px] mt-1 font-bold ${i <= at ? 'text-slate-800' : 'text-slate-400'}`}>{ORDER_STATUS_LABEL[st]}</span>
                {e && <span className="text-[9px] text-slate-400">{formatDateDeterministic(e.created_at)}</span>}
              </div>;
            })}</div>;
          })()}
          {events.filter((e) => e.order_id === o.id && e.note).map((e, k) => <p key={k} className="text-[11px] text-slate-500"><b>{ORDER_STATUS_LABEL[e.status] ?? e.status}:</b> {e.note}</p>)}
          <ul className="text-xs divide-y divide-slate-100">{o.items.map((i, k) => (
            <li key={k} className="flex justify-between py-1"><span>{i.quantity} × {i.product_name} @ {formatNumber(i.unit_price)}</span><span className="font-bold">{formatNumber(i.total_price)}</span></li>))}</ul>
          <div className="grid sm:grid-cols-3 gap-2 text-xs bg-slate-50 rounded-xl p-3">
            <div><span className="text-slate-500">Total</span><div className="font-black">TZS {formatNumber(o.total_amount)}</div></div>
            <div><span className="text-slate-500">{o.payment_method.toUpperCase()} reference</span><div className="font-bold font-mono">{o.payment_reference || '—'}</div></div>
            <div><span className="text-slate-500">Receipt</span><div>{o.receipt_path ? <button className="text-blue-600 font-bold inline-flex items-center gap-1" onClick={() => openReceipt(o.receipt_path!)}><FileText className="w-3.5 h-3.5" />View</button> : '—'}</div></div>
          </div>
          {(o.contact_phone || o.delivery_address) && (
            <div className="text-xs bg-blue-50/60 rounded-xl p-3 space-y-0.5">
              <div className="font-bold text-slate-700">{side === 'supplier' ? o.buyer_name : 'Delivery'}{o.contact_name ? ` · ${o.contact_name}` : ''}</div>
              {o.contact_phone && <a href={`tel:${o.contact_phone}`} className="inline-flex items-center gap-1 text-blue-700 font-semibold mr-3"><Phone className="w-3 h-3" />{o.contact_phone}</a>}
              {o.delivery_address && <span className="inline-flex items-center gap-1 text-slate-600"><MapPin className="w-3 h-3" />{o.delivery_address}</span>}
              {o.delivery_note && <div className="text-slate-500">Note: {o.delivery_note}</div>}
            </div>)}
          <div className="flex flex-wrap gap-2">
            <button className={ghostBtn} onClick={() => setChat(o)}><MessageCircle className="w-3.5 h-3.5" /> Chat about this order</button>
            {availableOrderDocs(o.status).map((t) => <button key={t} className={ghostBtn} onClick={() => setDoc({ o, t })}><FileText className="w-3.5 h-3.5" /> {ORDER_DOC_LABEL[t]}</button>)}
          </div>
          {o.supplier_note && <p className="text-xs text-slate-600">Supplier note: {o.supplier_note}</p>}
          {side === 'supplier' && o.status === 'payment_submitted' && (
            <div className="flex flex-col sm:flex-row gap-2">
              <input className={inputCls} placeholder="Note to pharmacy (optional)" value={notes[o.id] || ''} onChange={(e) => setNotes({ ...notes, [o.id]: e.target.value })} />
              <button className={primaryBtn} disabled={busy === o.id || readOnly} onClick={() => review(o, 'accept')}><Check className="w-3.5 h-3.5" /> Accept & confirm</button>
              <button className={ghostBtn} disabled={busy === o.id || readOnly} onClick={() => review(o, 'reject')}><X className="w-3.5 h-3.5" /> Reject</button>
            </div>)}
          {side === 'supplier' && (o.status === 'quote_requested' || o.status === 'quoted') && <QuoteReply order={o} disabled={readOnly} onDone={refresh} />}
          {side === 'buyer' && (o.status === 'quote_requested' || o.status === 'quoted') && <PayQuote order={o} disabled={readOnly} onDone={refresh} />}
          {side === 'supplier' && supplierNextStep(o.status) && (
            <PlanFeatureGate ws={ws} feature="delivery">
            <div className="flex flex-col sm:flex-row gap-2">
              <input className={inputCls} placeholder="Note e.g. rider name, tracking (optional)" value={notes[o.id] || ''} onChange={(e) => setNotes({ ...notes, [o.id]: e.target.value })} />
              <Button disabled={busy === o.id || readOnly} onClick={() => { const n = supplierNextStep(o.status); if (!n) return; void step(o, () => WholesaleService.advance(o.id, n, notes[o.id] || ''), `Order marked ${ORDER_STATUS_LABEL[n]?.toLowerCase()}.`); }}>
                <Check className="w-3.5 h-3.5" /> Mark {ORDER_STATUS_LABEL[supplierNextStep(o.status) ?? '']?.toLowerCase()}</Button>
            </div></PlanFeatureGate>)}
          {side === 'buyer' && canReceive(o.status) && (
            <div className="flex flex-col sm:flex-row gap-2">
              <input className={inputCls} placeholder="Receiving note (optional)" value={notes[o.id] || ''} onChange={(e) => setNotes({ ...notes, [o.id]: e.target.value })} />
              <button className={primaryBtn} disabled={busy === o.id || readOnly} onClick={() => step(o, () => WholesaleService.receive(o.id, notes[o.id] || ''), `Received — stock added to ${o.branch_name}.`)}>
                <Check className="w-3.5 h-3.5" /> Confirm received & add stock</button>
            </div>)}
        </div>))}
      {chat && <WholesaleChat buyerId={chat.buyer_pharmacy_id} supplierId={chat.supplier_id} side={side} myName={ws.name}
        partnerName={side === 'supplier' ? chat.buyer_name : chat.supplier_name} orderRef={chat.order_number} onClose={() => setChat(null)} />}
      {doc && <OrderDocument order={doc.o} type={doc.t} onClose={() => setDoc(null)} />}
    </div>
  );
}
