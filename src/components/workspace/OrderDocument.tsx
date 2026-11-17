import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Printer } from 'lucide-react';
import { supabase } from '@/lib/supabase-client';
import { BrandingService } from '@/lib/pharmacy-service';
import type { WholesaleOrder } from '@/lib/pharmacy-service';
import { BRAND } from '@/lib/brand';
import { formatNumber, formatDateDeterministic } from '@/lib/utils';
import { ORDER_DOC_LABEL, paymentStamp, type OrderDocType } from '@/lib/order-documents';
import { Modal, primaryBtn, ghostBtn } from './ws-ui';

export function OrderDocument({ order: o, type, onClose }: { order: WholesaleOrder; type: OrderDocType; onClose: () => void }) {
  const { data: logo } = useQuery({ queryKey: ['logo', o.supplier_id], queryFn: () => BrandingService.getLogoUrl(o.supplier_id) });
  const [fmt, setFmt] = useState<'a4' | 'thermal'>('a4');
  const { data: parties } = useQuery({ queryKey: ['order-parties', o.supplier_id, o.buyer_pharmacy_id], queryFn: async () => {
    const { data } = await supabase.from('pharmacies').select('id, name, phone, email, address, city, tax_number').in('id', [o.supplier_id, o.buyer_pharmacy_id]);
    return { sup: data?.find((p) => p.id === o.supplier_id), buy: data?.find((p) => p.id === o.buyer_pharmacy_id) };
  } });
  const print = () => {
    const s = document.createElement('style');
    s.textContent = `@page{size:${fmt === 'thermal' ? '80mm auto' : 'A4'};margin:${fmt === 'thermal' ? '3mm' : '12mm'}}body *{visibility:hidden}#order-print,#order-print *{visibility:visible}#order-print{position:absolute;left:0;top:0;width:${fmt === 'thermal' ? '74mm' : '100%'}}`;
    document.head.appendChild(s); setTimeout(() => { window.print(); s.remove(); }, 50);
  };
  const t = fmt === 'thermal';
  const sup = parties?.sup, buy = parties?.buy;
  const showPrices = type !== 'delivery_note';
  const no = `${type === 'quotation' ? 'QT' : type === 'invoice' ? 'INV' : type === 'receipt' ? 'RCP' : 'DN'}-${o.order_number}`;
  return (
    <Modal title={ORDER_DOC_LABEL[type]} onClose={onClose}>
      <div className="flex gap-2 mb-3">
        <button className={fmt === 'a4' ? primaryBtn : ghostBtn} onClick={() => setFmt('a4')}>A4</button>
        <button className={fmt === 'thermal' ? primaryBtn : ghostBtn} onClick={() => setFmt('thermal')}>80mm thermal</button>
        <button className={`${primaryBtn} ml-auto`} onClick={print}><Printer className="w-3.5 h-3.5" /> Print / PDF</button>
      </div>
      <div id="order-print" className={`bg-white text-slate-900 border border-slate-200 mx-auto ${t ? 'max-w-[300px] p-3 text-[11px]' : 'p-6 text-xs'}`}>
        <div className={t ? 'text-center space-y-0.5' : 'flex justify-between items-start gap-4'}>
          <div><img src={logo || BRAND.markUrl} alt="Logo" className={t ? 'h-8 mx-auto object-contain' : 'h-10 max-w-40 object-contain'} />
            <div className="font-black text-sm mt-1">{sup?.name ?? o.supplier_name}</div>
            <div>{[sup?.address, sup?.city].filter(Boolean).join(', ')}</div><div>{[sup?.phone, sup?.email].filter(Boolean).join(' · ')}</div>
            {sup?.tax_number && <div>TIN: {sup.tax_number}</div>}</div>
          <div className={t ? 'pt-2' : 'text-right'}><div className="font-black text-lg uppercase">{ORDER_DOC_LABEL[type]}</div>
            <div>No. <b>{no}</b></div><div>Date: {formatDateDeterministic(type === 'quotation' ? o.created_at : o.reviewed_at ?? o.created_at)}</div>
            {type === 'quotation' && <div>Valid 7 days</div>}</div>
        </div>
        <div className={`mt-4 ${t ? '' : 'grid grid-cols-2 gap-4'}`}>
          <div><div className="font-bold text-slate-500 uppercase text-[10px]">{type === 'delivery_note' ? 'Deliver to' : 'Bill to'}</div>
            <div className="font-bold">{buy?.name ?? o.buyer_name}</div>{o.contact_name && <div>Attn: {o.contact_name}</div>}
            <div>{o.delivery_address || [buy?.address, buy?.city].filter(Boolean).join(', ')}</div>
            <div>{o.contact_phone || buy?.phone}</div>{buy?.tax_number && <div>TIN: {buy.tax_number}</div>}
            <div>Branch: {o.branch_name}</div></div>
          {showPrices && <div className={t ? 'mt-2' : ''}><div className="font-bold text-slate-500 uppercase text-[10px]">Payment</div>
            <div>{o.payment_method.toUpperCase()} · Ref {o.payment_reference || '—'}</div>
            {type !== 'quotation' && <div className={`font-black mt-1 ${o.status === 'rejected' ? 'text-rose-600' : 'text-emerald-700'}`}>{paymentStamp(o.status)}</div>}</div>}
        </div>
        <table className="w-full mt-4 border-collapse">
          <thead><tr className="border-b-2 border-slate-800 text-left"><th className="py-1">Item</th><th className="text-right">Qty</th>{showPrices && <><th className="text-right">Price</th><th className="text-right">Amount</th></>}{!showPrices && <th className="text-right">Received ✓</th>}</tr></thead>
          <tbody>{o.items.map((i, k) => <tr key={k} className="border-b border-slate-200"><td className="py-1">{i.product_name}</td><td className="text-right">{i.quantity}</td>
            {showPrices ? <><td className="text-right">{formatNumber(i.unit_price)}</td><td className="text-right">{formatNumber(i.total_price)}</td></> : <td className="text-right">☐</td>}</tr>)}</tbody>
        </table>
        {showPrices && <div className="text-right mt-2 text-sm font-black">Total TZS {formatNumber(o.total_amount)}</div>}
        {o.delivery_note && <p className="mt-3">Note: {o.delivery_note}</p>}
        {type === 'delivery_note' && <div className="grid grid-cols-2 gap-6 mt-8"><div className="border-t border-slate-400 pt-1">Delivered by</div><div className="border-t border-slate-400 pt-1">Received by (name, sign, date)</div></div>}
        <p className="mt-4 text-center text-[10px] text-slate-500">Generated on {BRAND.name} · {BRAND.email}</p>
      </div>
    </Modal>
  );
}
