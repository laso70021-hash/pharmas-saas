import { useState } from 'react';
import { Copy, Printer, Share2, X } from 'lucide-react';
import { toast } from 'sonner';
import { BRAND } from '@/lib/brand';
import { formatNumber } from '@/lib/utils';

export type ReceiptData = {
  invoice: string; business: string; branch: string; cashier: string; date: Date;
  items: { name: string; strength?: string | undefined; qty: number; price: number }[];
  subtotal: number; discount: number; total: number; method: string; tendered?: number | undefined; change?: number | null; reference?: string; logoUrl?: string | null; trackingUrl?: string | undefined;
};

const PRINT_CSS = (size: '80mm' | 'A4') => `@page{size:${size === '80mm' ? '80mm auto' : 'A4'};margin:${size === '80mm' ? '0' : '14mm'}}
body *{visibility:hidden}#print-area,#print-area *{visibility:visible}#print-area{position:absolute;left:0;top:0;width:${size === '80mm' ? '80mm' : '100%'}}`;

export function ReceiptModal({ data, onClose }: { data: ReceiptData; onClose: () => void }) {
  const [fmt, setFmt] = useState<'thermal' | 'a4'>('thermal');
  const print = (f: 'thermal' | 'a4') => {
    setFmt(f);
    const s = document.createElement('style'); s.textContent = PRINT_CSS(f === 'thermal' ? '80mm' : 'A4');
    document.head.appendChild(s);
    setTimeout(() => { window.print(); s.remove(); }, 50);
  };
  const copyTrackingLink = async () => {
    if (!data.trackingUrl) return;
    try { await navigator.clipboard.writeText(data.trackingUrl); toast.success('Tracking link copied'); }
    catch (e) { toast.error(e instanceof Error ? `Could not copy tracking link: ${e.message}` : 'Could not copy tracking link'); }
  };
  const shareTrackingLink = async () => {
    if (!data.trackingUrl) return;
    try {
      if (!navigator.share) { await copyTrackingLink(); return; }
      await navigator.share({ title: 'Track your delivery', url: data.trackingUrl });
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return;
      toast.error(e instanceof Error ? `Could not share tracking link: ${e.message}` : 'Could not share tracking link');
    }
  };
  const when = data.date.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 gap-2 flex-wrap">
          <div className="flex gap-1 bg-slate-100 rounded-lg p-1 text-sm font-bold">
            {(['thermal', 'a4'] as const).map((f) => <button key={f} onClick={() => setFmt(f)} className={`px-3 py-1.5 rounded-md ${fmt === f ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>{f === 'thermal' ? 'Thermal 80mm' : 'A4 Invoice'}</button>)}
          </div>
          <div className="flex gap-2">
            <button onClick={() => print('thermal')} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold"><Printer className="w-4 h-4" />Print receipt</button>
            <button onClick={() => print('a4')} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 text-sm font-bold"><Printer className="w-4 h-4" />Print A4</button>
            <button onClick={onClose} aria-label="Close" className="p-2 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="overflow-auto p-6 bg-slate-50">
          {data.trackingUrl && <div className="mx-auto mb-4 max-w-[210mm] rounded-xl border border-blue-200 bg-blue-50 p-4">
            <div className="font-bold text-sm text-blue-950">Live delivery tracking</div>
            <p className="mt-1 break-all text-xs text-blue-800">{data.trackingUrl}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={() => void shareTrackingLink()} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white"><Share2 className="w-3.5 h-3.5" />Share link</button>
              <button onClick={() => void copyTrackingLink()} className="inline-flex items-center gap-1.5 rounded-lg border border-blue-300 bg-white px-3 py-2 text-xs font-bold text-blue-800"><Copy className="w-3.5 h-3.5" />Copy link</button>
            </div>
          </div>}
          <div id="print-area" className="mx-auto bg-white text-slate-900">
            {fmt === 'thermal' ? <Thermal d={data} when={when} /> : <A4 d={data} when={when} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function Thermal({ d, when }: { d: ReceiptData; when: string }) {
  return (
    <div className="w-[80mm] mx-auto p-3 font-mono text-[11px] leading-tight">
      <div className="text-center">
        <img src={d.logoUrl || BRAND.logoUrl} alt={d.business} className="h-8 mx-auto mb-1 grayscale object-contain" />
        <div className="font-black text-sm uppercase">{d.business}</div>
        <div>{d.branch}</div>
        <div>{BRAND.phones.join(' / ')}</div>
      </div>
      <div className="border-t border-dashed border-slate-900 my-2" />
      <div>Receipt: {d.invoice}</div><div>Date: {when}</div><div>Cashier: {d.cashier}</div>
      <div className="border-t border-dashed border-slate-900 my-2" />
      {d.items.map((i, k) => (
        <div key={k} className="mb-1">
          <div className="font-bold">{i.name}{i.strength ? ` ${i.strength}` : ''}</div>
          <div className="flex justify-between"><span>{i.qty} x {formatNumber(i.price)}</span><span>{formatNumber(i.qty * i.price)}</span></div>
        </div>
      ))}
      <div className="border-t border-dashed border-slate-900 my-2" />
      <Row l="Subtotal" r={formatNumber(d.subtotal)} />
      {d.discount > 0 && <Row l="Discount" r={`-${formatNumber(d.discount)}`} />}
      <div className="flex justify-between font-black text-sm"><span>TOTAL TZS</span><span>{formatNumber(d.total)}</span></div>
      <Row l={`Paid (${d.method.toUpperCase()})`} r={formatNumber(d.tendered || d.total)} />
      {d.change ? <Row l="Change" r={formatNumber(d.change)} /> : null}
      {d.reference && <Row l="Ref" r={d.reference} />}
      <div className="border-t border-dashed border-slate-900 my-2" />
      <div className="text-center">Asante kwa kununua nasi · Get well soon<br />{BRAND.email}</div>
    </div>
  );
}
const Row = ({ l, r }: { l: string; r: string }) => <div className="flex justify-between"><span>{l}</span><span>{r}</span></div>;

function A4({ d, when }: { d: ReceiptData; when: string }) {
  return (
    <div className="w-full max-w-[210mm] mx-auto p-8 text-sm">
      <div className="flex justify-between items-start border-b-2 border-blue-600 pb-4">
        <div><img src={d.logoUrl || BRAND.logoUrl} alt={d.business} className="h-10 mb-2 object-contain" /><div className="font-black text-lg">{d.business}</div><div className="text-slate-500">{d.branch}</div><div className="text-slate-500">{BRAND.phones.join(' · ')} · {BRAND.email}</div></div>
        <div className="text-right"><div className="text-2xl font-black text-blue-600">TAX INVOICE</div><div className="font-bold">{d.invoice}</div><div className="text-slate-500">{when}</div><span className="inline-block mt-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs">PAID</span></div>
      </div>
      <table className="w-full mt-6">
        <thead><tr className="bg-slate-100 text-left text-xs uppercase text-slate-600"><th className="p-2">#</th><th className="p-2">Item</th><th className="p-2 text-right">Qty</th><th className="p-2 text-right">Unit price</th><th className="p-2 text-right">Total</th></tr></thead>
        <tbody>{d.items.map((i, k) => <tr key={k} className="border-b border-slate-200"><td className="p-2">{k + 1}</td><td className="p-2 font-semibold">{i.name}{i.strength ? ` ${i.strength}` : ''}</td><td className="p-2 text-right">{i.qty}</td><td className="p-2 text-right">{formatNumber(i.price)}</td><td className="p-2 text-right">{formatNumber(i.qty * i.price)}</td></tr>)}</tbody>
      </table>
      <div className="flex justify-end mt-4"><div className="w-64 space-y-1">
        <Row l="Subtotal" r={`TZS ${formatNumber(d.subtotal)}`} />
        {d.discount > 0 && <Row l="Discount" r={`- TZS ${formatNumber(d.discount)}`} />}
        <div className="flex justify-between font-black text-base border-t border-slate-300 pt-1"><span>Total</span><span>TZS {formatNumber(d.total)}</span></div>
        <Row l="Payment method" r={d.method.toUpperCase()} />
        {d.reference && <Row l="Reference" r={d.reference} />}
      </div></div>
      <div className="grid grid-cols-2 gap-8 mt-16 text-xs text-slate-500">
        <div className="border-t border-slate-400 pt-1">Served by: {d.cashier}</div>
        <div className="border-t border-slate-400 pt-1">Authorized signature &amp; stamp</div>
      </div>
      <div className="text-center text-xs text-slate-400 mt-10">Thank you for your business · Powered by {BRAND.name}</div>
    </div>
  );
}
