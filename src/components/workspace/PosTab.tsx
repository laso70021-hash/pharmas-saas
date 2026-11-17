import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Search, Package, Plus, Minus, Trash2, Wallet, ShoppingBag, Truck } from 'lucide-react';
import type { Workspace } from '@/lib/pharmacy-types';
import { BrandingService, PosService, WorkspaceService } from '@/lib/pharmacy-service';
import { DeliveryService } from '@/lib/delivery-service';
import { changeDue, drawerSummary, isReadOnly } from '@/lib/workspace';
import { recordDayKey } from '@/lib/date-range';
import { formatNumber } from '@/lib/utils';
import { ReceiptModal, type ReceiptData } from './ReceiptModal';
import { useAuth } from '@/hooks/useAuth';
import { Empty, Field, inputCls, primaryBtn, ghostBtn, cardCls, errorText } from './ws-ui';

const METHODS = [
  { v: 'cash', l: 'Cash' }, { v: 'mpesa', l: 'M-Pesa' }, { v: 'tigopesa', l: 'Tigo Pesa' }, { v: 'airtel', l: 'Airtel' }, { v: 'card', l: 'Card' },
];
type Line = { id: string; qty: number };

export function PosTab({ ws }: { ws: Workspace }) {
  const pid = ws.id;
  const qc = useQueryClient();
  const { data: products = [] } = useQuery({ queryKey: ['ws', pid, 'products'], queryFn: () => WorkspaceService.getProducts(pid) });
  const { data: branches = [] } = useQuery({ queryKey: ['ws', pid, 'branches'], queryFn: () => WorkspaceService.getBranches(pid) });
  const { data: sales = [] } = useQuery({ queryKey: ['ws', pid, 'sales'], queryFn: () => WorkspaceService.getSales(pid) });
  const open = branches.filter((b) => b.is_active);
  const [branch, setBranch] = useState('');
  useEffect(() => { if (!branch && open.length) setBranch(open.find((b) => b.is_main)?.id || open[0]!.id); }, [open, branch]);
  const [q, setQ] = useState('');
  const [cart, setCart] = useState<Line[]>([]);
  const [method, setMethod] = useState('cash');
  const [discount, setDiscount] = useState('');
  const [tendered, setTendered] = useState('');
  const [reference, setReference] = useState('');
  const [deliveryMode, setDeliveryMode] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [recipient, setRecipient] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const auth = useAuth();
  const readOnly = isReadOnly(ws.status, ws.role);

  const stockHere = (p: (typeof products)[number]) => p.stock_by_branch[branch] || 0;
  const shown = products.filter((p) => p.is_active && `${p.name} ${p.generic_name} ${p.barcode} ${p.sku}`.toLowerCase().includes(q.toLowerCase()));
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const subtotal = cart.reduce((a, l) => a + (byId.get(l.id)?.selling_price || 0) * l.qty, 0);
  const disc = Math.min(Number(discount) || 0, subtotal);
  const total = subtotal - disc;
  const change = method === 'cash' && tendered ? changeDue(total, Number(tendered)) : null;

  const add = (id: string, d: number) => {
    const p = byId.get(id); if (!p) return;
    setCart((c) => {
      const cur = c.find((l) => l.id === id)?.qty || 0;
      const next = Math.min(stockHere(p), cur + d);
      if (d > 0 && next === cur) toast.error(`No more ${p.name} in this branch`);
      if (next <= 0) return c.filter((l) => l.id !== id);
      return cur ? c.map((l) => (l.id === id ? { ...l, qty: next } : l)) : [...c, { id, qty: next }];
    });
  };
  useEffect(() => setCart([]), [branch]);

  const checkout = async () => {
    if (method === 'cash' && tendered && change === null) { toast.error('Cash given is less than the total'); return; }
    if (deliveryMode && !deliveryAddress.trim()) { toast.error('Delivery address is required'); return; }
    setBusy(true);
    try {
      const saleId = await PosService.createSale({ pharmacyId: pid, branchId: branch, items: cart.map((l) => ({ product_id: l.id, quantity: l.qty })), method, discount: disc, reference });
      let trackingUrl: string | undefined;
      if (deliveryMode) {
        try {
          const jobId = await DeliveryService.createForSale(saleId, { dropoff: deliveryAddress, recipient, phone: recipientPhone });
          trackingUrl = new URL(`/track/${encodeURIComponent(jobId)}`, window.location.origin).toString();
          toast.success('Sale saved and submitted to a delivery rider');
          void qc.invalidateQueries({ queryKey: ['deliveries', pid] });
        } catch (err) {
          toast.error(`Sale saved, but delivery submission failed: ${errorText(err)}`);
        }
      } else {
        toast.success(change ? `Sale saved. Change: TZS ${formatNumber(change)}` : 'Sale saved');
      }
      setReceipt({ invoice: `INV-${saleId.slice(0, 8).toUpperCase()}`, business: ws.name, branch: open.find((b) => b.id === branch)?.name || '', logoUrl: await BrandingService.getLogoUrls(ws.id).then((l) => l.branches[branch] || l.main).catch(() => null), cashier: auth.user?.email || 'Cashier', date: new Date(),
        items: cart.map((l) => { const p = byId.get(l.id); return { name: p?.name || '', strength: p?.strength, qty: l.qty, price: p?.selling_price || 0 }; }),
        subtotal, discount: disc, total, method, tendered: Number(tendered) || undefined, change, reference, trackingUrl });
      setCart([]); setDiscount(''); setTendered(''); setReference('');
      setDeliveryMode(false); setDeliveryAddress(''); setRecipient(''); setRecipientPhone('');
      void qc.invalidateQueries({ queryKey: ['ws', pid] });
    } catch (err) { toast.error(errorText(err)); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      {receipt && <ReceiptModal data={receipt} onClose={() => setReceipt(null)} />}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1"><Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input autoFocus className={`${inputCls} pl-9`} placeholder="Search name or scan barcode" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select aria-label="Branch" className={`${inputCls} sm:w-52`} value={branch} onChange={(e) => setBranch(e.target.value)}>
          {open.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <button className={ghostBtn} onClick={() => setDrawer((v) => !v)}><Wallet className="w-3.5 h-3.5" /> Cash drawer</button>
      </div>
      {drawer && <CashDrawer sales={sales.filter((s) => s.branch_id === branch && recordDayKey(s.created_at) === recordDayKey(new Date().toISOString()))} />}

      <div className="grid lg:grid-cols-[1fr_340px] gap-4 items-start">
        {open.length === 0 ? <Empty>Add a branch first — sales come out of a branch's stock.</Empty> : shown.length === 0 ? <Empty>No products found.</Empty> : (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
            {shown.map((p) => { const s = stockHere(p); return (
              <button key={p.id} disabled={s <= 0 || readOnly} onClick={() => add(p.id, 1)}
                className={`${cardCls} overflow-hidden text-left flex flex-col disabled:opacity-50 hover:border-blue-400 transition-colors`}>
                <div className="aspect-[4/3] bg-slate-100 flex items-center justify-center w-full">
                  {p.image_src ? <img src={p.image_src} alt={p.name} className="w-full h-full object-cover" loading="lazy" /> : <Package className="w-8 h-8 text-slate-300" />}
                </div>
                <div className="p-2.5 space-y-0.5">
                  <div className="font-bold text-sm leading-tight">{p.name} {p.strength}</div>
                  <div className="text-sm font-black text-blue-600">TZS {formatNumber(p.selling_price)}</div>
                  <div className={`text-[11px] font-bold ${s > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{s > 0 ? `${s} left` : 'Out of stock'}{p.is_prescription_required ? ' · Rx' : ''}</div>
                </div>
              </button>); })}
          </div>)}

        <div className={`${cardCls} p-4 space-y-3 lg:sticky lg:top-4`}>
          <div className="font-black text-sm flex items-center gap-2"><ShoppingBag className="w-4 h-4" /> Current sale</div>
          {cart.length === 0 ? <p className="text-xs text-slate-400">Tap products to add them.</p> : (
            <ul className="space-y-2">{cart.map((l) => { const p = byId.get(l.id)!; return (
              <li key={l.id} className="flex items-center gap-2 text-xs">
                <span className="flex-1 font-semibold">{p.name}</span>
                <button aria-label="Less" onClick={() => add(l.id, -1)}><Minus className="w-3.5 h-3.5" /></button>
                <span className="w-6 text-center font-black">{l.qty}</span>
                <button aria-label="More" onClick={() => add(l.id, 1)}><Plus className="w-3.5 h-3.5" /></button>
                <span className="w-16 text-right font-bold">{formatNumber(p.selling_price * l.qty)}</span>
                <button aria-label="Remove" onClick={() => add(l.id, -l.qty)}><Trash2 className="w-3.5 h-3.5 text-slate-400" /></button>
              </li>); })}</ul>)}
          <Field label="Discount (TZS)"><input type="number" min={0} className={inputCls} value={discount} onChange={(e) => setDiscount(e.target.value)} /></Field>
          <div className="flex justify-between border-t pt-2 text-base font-black"><span>Total</span><span>TZS {formatNumber(total)}</span></div>
          <div className="grid grid-cols-2 gap-1.5">{METHODS.map((m) => (
            <button key={m.v} onClick={() => setMethod(m.v)} className={`px-2 py-1.5 rounded-lg border text-[11px] font-bold ${method === m.v ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200'}`}>{m.l}</button>))}
            <button type="button" aria-pressed={deliveryMode} onClick={() => setDeliveryMode((v) => !v)}
              className={`px-2 py-1.5 rounded-lg border text-[11px] font-bold flex items-center justify-center gap-1 ${deliveryMode ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200'}`}>
              <Truck className="w-3.5 h-3.5 shrink-0" /> Submit to Delivery Rider
            </button>
          </div>
          {method === 'cash' ? (
            <Field label="Cash given" hint={change !== null ? `Change: TZS ${formatNumber(change)}` : undefined}>
              <input type="number" min={0} className={inputCls} value={tendered} onChange={(e) => setTendered(e.target.value)} /></Field>
          ) : (
            <Field label="Transaction reference"><input className={inputCls} value={reference} onChange={(e) => setReference(e.target.value)} /></Field>)}
          {deliveryMode && <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
            <Field label="Delivery address"><input className={inputCls} value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} placeholder="Street, area, city" /></Field>
            <Field label="Receiver name (optional)"><input className={inputCls} value={recipient} onChange={(e) => setRecipient(e.target.value)} /></Field>
            <Field label="Receiver phone (optional)"><input className={inputCls} value={recipientPhone} onChange={(e) => setRecipientPhone(e.target.value)} /></Field>
          </div>}
          <button className={`${primaryBtn} w-full justify-center py-3 text-sm`} disabled={busy || cart.length === 0 || readOnly || !branch || (deliveryMode && !deliveryAddress.trim())} onClick={checkout}>
            {busy ? 'Saving…' : deliveryMode ? `Charge TZS ${formatNumber(total)} & Submit to Rider` : `Charge TZS ${formatNumber(total)}`}</button>
        </div>
      </div>
    </div>
  );
}

function CashDrawer({ sales }: { sales: { total: number; payment_method: string }[] }) {
  const [float, setFloat] = useState('');
  const [counted, setCounted] = useState('');
  const d = drawerSummary(sales, Number(float) || 0, counted === '' ? null : Number(counted));
  return (
    <div className={`${cardCls} p-4 grid sm:grid-cols-4 gap-3 text-xs`}>
      <div><div className="text-slate-500">Today's sales ({sales.length})</div><div className="font-black text-base">TZS {formatNumber(d.total)}</div>
        <div className="text-slate-500 mt-1">{Object.entries(d.byMethod).map(([m, v]) => `${m}: ${formatNumber(v)}`).join(' · ') || '—'}</div></div>
      <Field label="Opening float"><input type="number" min={0} className={inputCls} value={float} onChange={(e) => setFloat(e.target.value)} /></Field>
      <Field label="Counted cash"><input type="number" min={0} className={inputCls} value={counted} onChange={(e) => setCounted(e.target.value)} /></Field>
      <div><div className="text-slate-500">Expected cash</div><div className="font-black text-base">TZS {formatNumber(d.expectedCash)}</div>
        {d.overShort !== null && <div className={`font-bold ${d.overShort < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{d.overShort === 0 ? 'Balanced' : d.overShort < 0 ? `Short ${formatNumber(-d.overShort)}` : `Over ${formatNumber(d.overShort)}`}</div>}</div>
    </div>
  );
}
