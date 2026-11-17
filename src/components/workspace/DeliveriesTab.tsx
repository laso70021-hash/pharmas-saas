import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ClientOnly } from '@tanstack/react-router';
import { toast } from 'sonner';
import { MapPin, Truck, Plus, Navigation, PenLine, CheckCircle2, ExternalLink, MessageCircle } from 'lucide-react';
import type { Workspace } from '@/lib/pharmacy-types';
import { canAcceptDelivery, type WorkspaceRole } from '@/lib/workspace';
import { supabase } from '@/lib/supabase-client';
import { DeliveryService, DELIVERY_STAGES, STAGE_LABEL, deliveryLabel, nextStage, workflowStatus, whatsappTrackingUrl, type DeliveryException, type DeliveryJob } from '@/lib/delivery-service';
import { cardCls, Empty, Field, Modal, SectionHeader, errorText, ghostBtn, inputCls, primaryBtn } from './ws-ui';

const DeliveryMap = lazy(() => import('./DeliveryMap'));
const TOKEN = (import.meta.env['VITE_MAPBOX_PUBLIC_TOKEN'] || import.meta.env['VITE_LOVABLE_CONNECTOR_MAPBOX_PUBLIC_TOKEN'] || '') as string;
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
const badge: Record<string, string> = { pending: 'bg-amber-100 text-amber-800', delivered: 'bg-emerald-100 text-emerald-800', cancelled: 'bg-slate-200 text-slate-600' };

function MapBox(props: { pickup?: { lat: number; lng: number } | null; dropoff: { lat: number; lng: number } | null; rider: { lat: number; lng: number } | null; pickupAddress?: string | null; dropoffAddress?: string | null; showRoute?: boolean; routeTarget?: 'pickup' | 'dropoff'; routeFrom?: { lat: number; lng: number } | null; onPick?: (p: { lat: number; lng: number }) => void }) {
  if (!TOKEN) return <div className="h-40 rounded-xl border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center text-xs text-slate-500 text-center px-4">The live map turns on once the Mapbox key is added. Tracking, stages and signatures already work.</div>;
  return <ClientOnly fallback={<div className="h-72 rounded-xl bg-slate-100" />}><Suspense fallback={<div className="h-72 rounded-xl bg-slate-100" />}><DeliveryMap token={TOKEN} {...props} /></Suspense></ClientOnly>;
}

const here = () => new Promise<{ lat: number; lng: number } | null>((res) => {
  if (!navigator.geolocation) return res(null);
  navigator.geolocation.getCurrentPosition((p) => res({ lat: p.coords.latitude, lng: p.coords.longitude }), () => res(null), { enableHighAccuracy: true, timeout: 8000 });
});

export function DeliveriesTab({ ws, userId, actualRole }: { ws: Workspace; userId: string; actualRole: WorkspaceRole }) {
  const pid = ws.id; const qc = useQueryClient();
  const rider = canAcceptDelivery(actualRole);
  const riderPreview = ws.role === 'delivery_rider' && !rider;
  const canCreate = ['owner', 'admin', 'manager', 'pharmacist', 'cashier', 'inventory_manager'].includes(ws.role);
  const { data: jobs = [], error } = useQuery({ queryKey: ['deliveries', pid], queryFn: () => DeliveryService.list(pid), refetchInterval: 10000 });
  const [filter, setFilter] = useState<'active' | 'mine' | 'done' | 'all'>('active');
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [appOrigin, setAppOrigin] = useState('');
  useEffect(() => { setAppOrigin(window.location.origin); }, []);
  const refresh = useCallback(() => void qc.invalidateQueries({ queryKey: ['deliveries', pid] }), [qc, pid]);
  useEffect(() => DeliveryService.subscribe(pid, refresh), [pid, refresh]);
  const acceptFromList = async (jobId: string) => {
    setAcceptingId(jobId);
    try {
      await DeliveryService.accept(jobId);
      toast.success('Delivery accepted. Open it to start the pickup and update each stage.');
      await qc.invalidateQueries({ queryKey: ['deliveries', pid] });
      setOpenId(jobId);
    } catch (e) { toast.error(errorText(e)); }
    finally { setAcceptingId(null); }
  };
  const shown = jobs.filter((j) => filter === 'all' || (filter === 'done' ? ['delivered', 'cancelled', 'returned'].includes(workflowStatus(j.status)) : filter === 'mine' ? j.rider_id === userId : !['delivered', 'cancelled', 'returned'].includes(workflowStatus(j.status))));
  const open = jobs.find((j) => j.id === openId) ?? null;

  return (
    <div className="space-y-4">
      <SectionHeader title="Deliveries & Tracking" subtitle="Every order gets a tracking number. Riders accept, update each stage, and the receiver signs on delivery." action={canCreate ? <button className={primaryBtn} onClick={() => setCreating(true)}><Plus className="w-4 h-4" /> New delivery</button> : undefined} />
      {riderPreview && <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">Role preview only: accepting deliveries requires this account to be an active Delivery Rider in this business.</p>}
      <div className="flex flex-wrap gap-2">
        {(['active', 'mine', 'done', 'all'] as const).map((f) => <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-full text-xs font-bold ${filter === f ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>{{ active: 'In progress', mine: 'My deliveries', done: 'Completed', all: 'All' }[f]}</button>)}
      </div>
      {error && <p className="text-sm text-rose-700">{errorText(error)} — if this is new, the delivery setup file still needs to run in Supabase.</p>}
      {shown.length === 0 ? <Empty>{rider && filter === 'active' ? 'No deliveries waiting for a rider. New orders will appear here when the business dispatches them.' : 'No deliveries here yet.'}</Empty> : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((j) => {
            const trackingPath = `/track/${encodeURIComponent(j.id)}`;
            const trackingUrl = appOrigin ? new URL(trackingPath, appOrigin).toString() : '';
            const whatsappUrl = trackingUrl ? whatsappTrackingUrl(j.recipient_phone, j.tracking_number, trackingUrl, j.recipient_name) : null;
            return <div key={j.id} className={`${cardCls} p-4 hover:border-blue-300`}>
              <button onClick={() => setOpenId(j.id)} className="w-full text-left">
                <div className="flex items-center justify-between gap-2"><span className="font-mono text-xs font-black text-slate-900">{j.tracking_number}</span><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badge[workflowStatus(j.status)] ?? 'bg-blue-100 text-blue-800'}`}>{deliveryLabel(j.status, j.assignment_state)}</span></div>
                <div className="mt-2 text-sm font-semibold text-slate-800 flex gap-1.5"><MapPin className="w-4 h-4 text-rose-500 shrink-0" />{j.dropoff_address}</div>
                <div className="mt-1 text-xs text-slate-500">{j.recipient_name ?? 'Receiver'} · {j.buyer_pharmacy_id === pid ? 'Incoming to you' : 'Outgoing'} · {fmt(j.created_at)}</div>
                <Progress status={j.status} />
              </button>
              <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                {rider && j.pharmacy_id === pid && j.rider_id === null && j.assignment_state === 'available' && workflowStatus(j.status) === 'in_process' &&
                  <button type="button" className={`${primaryBtn} text-xs`} disabled={acceptingId === j.id} onClick={() => void acceptFromList(j.id)}>
                    <Truck className="h-3.5 w-3.5" />{acceptingId === j.id ? 'Accepting…' : 'Accept delivery'}
                  </button>}
                {j.rider_id === userId && !['delivered', 'cancelled', 'returned'].includes(workflowStatus(j.status)) &&
                  <button type="button" className={`${ghostBtn} text-xs`} onClick={() => setOpenId(j.id)}>Open route &amp; update status</button>}
                <a href={trackingPath} target="_blank" rel="noreferrer" className={`${ghostBtn} text-xs`}><ExternalLink className="h-3.5 w-3.5" />Tracking link</a>
                {whatsappUrl
                  ? <a href={whatsappUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100"><MessageCircle className="h-3.5 w-3.5" />WhatsApp customer</a>
                  : <span title="Add a valid customer phone number with country code to share on WhatsApp" className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-400"><MessageCircle className="h-3.5 w-3.5" />WhatsApp unavailable</span>}
              </div>
            </div>;
          })}
        </div>)}
      {creating && <CreateDelivery ws={ws} onClose={() => setCreating(false)} onDone={(id) => { setCreating(false); refresh(); setOpenId(id); }} />}
      {open && <DeliveryDetail job={open} ws={ws} userId={userId} rider={rider} onClose={() => setOpenId(null)} onChange={refresh} />}
    </div>
  );
}

function Progress({ status }: { status: DeliveryJob['status'] }) {
  const current = workflowStatus(status);
  const i = DELIVERY_STAGES.indexOf(current);
  return <div className="mt-3 flex gap-1">{DELIVERY_STAGES.map((s, k) => <div key={s} className={`h-1.5 flex-1 rounded-full ${['cancelled', 'failed', 'returning', 'returned'].includes(current) ? 'bg-slate-200' : k <= i ? 'bg-blue-600' : 'bg-slate-200'}`} />)}</div>;
}

function CreateDelivery({ ws, onClose, onDone }: { ws: Workspace; onClose: () => void; onDone: (id: string) => void }) {
  const { data: orders = [] } = useQuery({
    queryKey: ['deliveries', ws.id, 'orders'], enabled: ws.business_type === 'supplier',
    queryFn: async () => { const r = await (supabase as any).from('wholesale_orders').select('id,order_number,status,contact_name,contact_phone,delivery_address').eq('supplier_id', ws.id).not('status', 'in', '(rejected,cancelled,received,quote_requested)').order('created_at', { ascending: false }).limit(100); if (r.error) throw new Error(r.error.message); return r.data as { id: string; order_number: string; status: string; contact_name: string | null; contact_phone: string | null; delivery_address: string | null }[]; },
  });
  const [f, setF] = useState({ order: '', dropoff: '', recipient: '', phone: '', note: '' });
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const pickOrder = (id: string) => { const o = orders.find((x) => x.id === id); setF((s) => ({ ...s, order: id, dropoff: o?.delivery_address ?? s.dropoff, recipient: o?.contact_name ?? s.recipient, phone: o?.contact_phone ?? s.phone })); };
  const save = async () => {
    setBusy(true);
    try { const id = await DeliveryService.create(ws.id, { ...f, order: f.order || null, lat: pin?.lat ?? null, lng: pin?.lng ?? null }); toast.success('Delivery created with a tracking number'); onDone(id); }
    catch (e) { toast.error(errorText(e)); } finally { setBusy(false); }
  };
  return (
    <Modal title="New delivery" onClose={onClose} wide>
      <div className="space-y-3">
        {ws.business_type === 'supplier' && <Field label="Wholesale order (optional)"><select className={inputCls} value={f.order} onChange={(e) => pickOrder(e.target.value)}><option value="">No linked order</option>{orders.map((o) => <option key={o.id} value={o.id}>{o.order_number} · {o.status}</option>)}</select></Field>}
        <Field label="Delivery address"><input className={inputCls} value={f.dropoff} onChange={(e) => setF({ ...f, dropoff: e.target.value })} placeholder="Street, area, city" /></Field>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Receiver name"><input className={inputCls} value={f.recipient} onChange={(e) => setF({ ...f, recipient: e.target.value })} /></Field>
          <Field label="Receiver phone"><input className={inputCls} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
        </div>
        <Field label="Note for rider"><input className={inputCls} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
        <div className="text-[11px] font-bold text-slate-500 uppercase">Drop-off pin {pin ? `(${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)})` : '— tap the map to place it'}</div>
        <MapBox dropoff={pin} rider={null} showRoute={false} onPick={setPin} />
        <div className="flex justify-end gap-2"><button className={ghostBtn} onClick={onClose}>Cancel</button><button className={primaryBtn} disabled={busy || !f.dropoff.trim()} onClick={() => void save()}>Create & get tracking number</button></div>
      </div>
    </Modal>
  );
}

function DeliveryDetail({ job: j, ws, userId, rider, onClose, onChange }: { job: DeliveryJob; ws: Workspace; userId: string; rider: boolean; onClose: () => void; onChange: () => void }) {
  const { data: events = [] } = useQuery({ queryKey: ['deliveries', ws.id, 'events', j.id, j.status], queryFn: () => DeliveryService.events(j.id) });
  const [busy, setBusy] = useState(false); const [signing, setSigning] = useState(false);
  const [locationError, setLocationError] = useState('');
  const status = workflowStatus(j.status);
  const mine = j.rider_id === userId; const next = nextStage(status);
  const manager = ['owner', 'admin', 'manager'].includes(ws.role) && j.pharmacy_id === ws.id;
  const live = mine && j.assignment_state === 'assigned' && ['in_process', 'pickup', 'in_transit', 'arrived', 'returning'].includes(status);

  // While the assigned rider has this open, share their position every ~20s.
  useEffect(() => {
    if (!live) return;
    if (!navigator.geolocation) { setLocationError('This device does not support live location sharing.'); return; }
    setLocationError('');
    let last = 0;
    const id = navigator.geolocation.watchPosition((p) => {
      if (Date.now() - last < 20000) return;
      last = Date.now();
      void DeliveryService.ping(j.id, p.coords.latitude, p.coords.longitude).then(onChange).catch((e) => {
        const message = errorText(e);
        setLocationError(message);
        toast.error(`Could not share rider location: ${message}`);
      });
    }, (e) => setLocationError(e.message || 'Allow location access to share live rider position.'), { enableHighAccuracy: true });
    return () => navigator.geolocation.clearWatch(id);
  }, [live, j.id, onChange]);

  const act = async (nextStatus: DeliveryJob['status'], extra: { signature?: string; signedName?: string } = {}) => {
    setBusy(true);
    try { const p = await here(); await DeliveryService.advance(j.id, nextStatus, { lat: p?.lat ?? null, lng: p?.lng ?? null, ...extra }); toast.success(STAGE_LABEL[nextStatus]); setSigning(false); onChange(); }
    catch (e) { toast.error(errorText(e)); } finally { setBusy(false); }
  };
  const accept = async () => {
    setBusy(true);
    try { await DeliveryService.accept(j.id); toast.success('Delivery accepted'); onChange(); }
    catch (e) { toast.error(errorText(e)); } finally { setBusy(false); }
  };
  const recordException = async (action: DeliveryException, prompt: string) => {
    const reason = window.prompt(prompt);
    if (!reason?.trim()) return;
    setBusy(true);
    try { await DeliveryService.exception(j.id, action, reason.trim()); toast.success('Delivery updated'); onChange(); }
    catch (e) { toast.error(errorText(e)); } finally { setBusy(false); }
  };
  const arriveAtPickup = async () => {
    setBusy(true);
    try { const p = await here(); await DeliveryService.arriveAtPickup(j.id, p?.lat ?? null, p?.lng ?? null); toast.success('Pickup arrival recorded'); onChange(); }
    catch (e) { toast.error(errorText(e)); } finally { setBusy(false); }
  };
  const dropoff = j.dropoff_lat != null && j.dropoff_lng != null ? { lat: j.dropoff_lat, lng: j.dropoff_lng } : null;
  const pickup = j.pickup_lat != null && j.pickup_lng != null ? { lat: j.pickup_lat, lng: j.pickup_lng } : null;
  const riderPt = j.rider_lat != null && j.rider_lng != null ? { lat: j.rider_lat, lng: j.rider_lng } : null;

  return (
    <Modal title={`Tracking ${j.tracking_number}`} onClose={onClose} wide>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-xs"><span className={`font-bold px-2 py-0.5 rounded-full ${badge[status] ?? 'bg-blue-100 text-blue-800'}`}>{deliveryLabel(j.status, j.assignment_state)}</span>{riderPt && <span className="text-slate-500 flex items-center gap-1"><Navigation className="w-3 h-3" /> Rider seen {fmt(j.rider_seen_at)}</span>}</div>
        <Progress status={j.status} />
        <MapBox pickup={pickup} dropoff={dropoff} rider={riderPt} pickupAddress={j.pickup_address} dropoffAddress={j.dropoff_address}
          routeTarget={['in_process', 'pickup'].includes(status) ? 'pickup' : 'dropoff'} routeFrom={riderPt} />
        {live && locationError && <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">Live location: {locationError}</p>}
        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          <div><div className="text-[11px] font-bold text-slate-500 uppercase">From</div>{j.pickup_address || '—'}</div>
          <div><div className="text-[11px] font-bold text-slate-500 uppercase">To</div>{j.dropoff_address}<div className="text-xs text-slate-500">{j.recipient_name} {j.recipient_phone}</div></div>
          {j.note && <div className="sm:col-span-2 text-xs text-slate-600">Note: {j.note}</div>}
          {j.exception_reason && <div className="sm:col-span-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Delivery update: {j.exception_reason}</div>}
        </div>
        {j.status === 'delivered' && j.signature && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
            <div className="text-xs font-bold text-emerald-800 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Received by {j.signed_name} · {fmt(j.delivered_at)}</div>
            <img src={j.signature} alt={`Signature of ${j.signed_name}`} className="mt-2 h-24 bg-white rounded-lg border border-emerald-100" />
          </div>)}
        <div>
          <div className="text-[11px] font-bold text-slate-500 uppercase mb-1">History</div>
          <ol className="space-y-1.5">{events.map((e) => <li key={e.id} className="text-xs text-slate-700 flex gap-2"><span className="w-28 shrink-0 text-slate-400">{fmt(e.created_at)}</span><span className="font-semibold capitalize">{(e.action || STAGE_LABEL[e.status as DeliveryJob['status']] || e.status).replaceAll('_', ' ')}</span>{e.note && <span className="text-slate-500">— {e.note}</span>}</li>)}</ol>
        </div>
        {signing ? <SignatureCapture busy={busy} defaultName={j.recipient_name ?? ''} onCancel={() => setSigning(false)} onSave={(sig, name) => void act('delivered', { signature: sig, signedName: name })} /> : (
          <div className="flex flex-wrap gap-2 justify-end">
            {manager && !['delivered', 'cancelled', 'returned'].includes(status) && <button className={ghostBtn} disabled={busy} onClick={() => void recordException('cancel', 'Why are you cancelling this delivery?')}>Cancel delivery</button>}
            {manager && ['in_process', 'pickup'].includes(status) && j.assignment_state === 'assigned' && <button className={ghostBtn} disabled={busy} onClick={() => void recordException('reassign', 'Why does this delivery need reassignment?')}>Reassign rider</button>}
            {rider && status === 'in_process' && j.assignment_state === 'available' && j.pharmacy_id === ws.id && <button className={primaryBtn} disabled={busy} onClick={() => void accept()}><Truck className="w-4 h-4" /> Accept delivery</button>}
            {mine && next && next !== 'delivered' && status !== 'pickup' && <button className={primaryBtn} disabled={busy} onClick={() => void act(next)}>Mark {STAGE_LABEL[next].toLowerCase()}</button>}
            {mine && status === 'pickup' && !j.pickup_arrived_at && <button className={primaryBtn} disabled={busy} onClick={() => void arriveAtPickup()}><MapPin className="w-4 h-4" /> Arrived at pickup</button>}
            {mine && status === 'pickup' && j.pickup_arrived_at && next && <button className={primaryBtn} disabled={busy} onClick={() => void act(next)}>Confirm collected</button>}
            {mine && next === 'delivered' && <button className={primaryBtn} disabled={busy} onClick={() => setSigning(true)}><PenLine className="w-4 h-4" /> Receiver signs</button>}
            {mine && ['in_process', 'pickup', 'in_transit', 'arrived'].includes(status) && <button className={ghostBtn} disabled={busy} onClick={() => void recordException('failed', 'Describe the delivery issue')}>Report issue</button>}
            {mine && status === 'failed' && <button className={primaryBtn} disabled={busy} onClick={() => void recordException('start_return', 'Add a reason before returning to the pharmacy')}>Start return</button>}
            {mine && status === 'returning' && <button className={primaryBtn} disabled={busy} onClick={() => void recordException('returned', 'Confirm the return to the pharmacy')}>Confirm returned</button>}
          </div>)}
      </div>
    </Modal>
  );
}

function SignatureCapture({ busy, defaultName, onCancel, onSave }: { busy: boolean; defaultName: string; onCancel: () => void; onSave: (dataUrl: string, name: string) => void }) {
  const ref = useRef<HTMLCanvasElement>(null); const drawing = useRef(false); const [inked, setInked] = useState(false); const [name, setName] = useState(defaultName);
  useEffect(() => { const c = ref.current; if (!c) return; c.width = c.offsetWidth; c.height = 160; const g = c.getContext('2d')!; g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height); g.lineWidth = 2.5; g.lineCap = 'round'; g.strokeStyle = '#0f172a'; }, []);
  const pos = (e: React.PointerEvent) => { const r = ref.current!.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] as const; };
  const down = (e: React.PointerEvent) => { drawing.current = true; ref.current!.setPointerCapture(e.pointerId); const g = ref.current!.getContext('2d')!; const [x, y] = pos(e); g.beginPath(); g.moveTo(x, y); };
  const move = (e: React.PointerEvent) => { if (!drawing.current) return; const g = ref.current!.getContext('2d')!; const [x, y] = pos(e); g.lineTo(x, y); g.stroke(); setInked(true); };
  const clear = () => { const c = ref.current!; const g = c.getContext('2d')!; g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height); setInked(false); };
  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 space-y-2">
      <div className="text-xs font-bold text-slate-900">Receiver signs below to confirm they got the order</div>
      <canvas ref={ref} onPointerDown={down} onPointerMove={move} onPointerUp={() => (drawing.current = false)} className="w-full h-40 rounded-lg border border-slate-300 bg-white touch-none" />
      <Field label="Receiver full name"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <div className="flex justify-end gap-2"><button className={ghostBtn} onClick={clear}>Clear</button><button className={ghostBtn} onClick={onCancel}>Back</button><button className={primaryBtn} disabled={busy || !inked || !name.trim()} onClick={() => onSave(ref.current!.toDataURL('image/png'), name.trim())}>Confirm delivered</button></div>
    </div>
  );
}
