import { supabase as typed } from '@/lib/supabase-client';
// Tables are newer than the generated types; keep the cast local to this file.
const db = typed as unknown as { from: (t: string) => any; rpc: (f: string, a: object) => any };
const ok = <T,>(r: { data: T; error: { message: string } | null }) => { if (r.error) throw new Error(r.error.message); return r.data; };

export type DeliveryStatus = 'pending' | 'accepted' | 'picked_up' | 'in_process' | 'pickup' | 'in_transit' | 'arrived' | 'delivered' | 'cancelled' | 'failed' | 'returning' | 'returned';
export type DeliveryException = 'failed' | 'start_return' | 'returned' | 'cancel' | 'reassign';
export type DeliveryWorkflowStatus = 'in_process' | 'pickup' | 'in_transit' | 'arrived' | 'delivered' | 'cancelled' | 'failed' | 'returning' | 'returned';
export interface DeliveryJob {
  id: string; tracking_number: string; pharmacy_id: string; buyer_pharmacy_id: string | null; wholesale_order_id: string | null;
  rider_id: string | null; assignment_state: 'available' | 'assigned'; status: DeliveryStatus; pickup_branch_id: string | null; pickup_address: string | null; dropoff_address: string;
  recipient_name: string | null; recipient_phone: string | null; dropoff_lat: number | null; dropoff_lng: number | null;
  pickup_lat: number | null; pickup_lng: number | null; accepted_at: string | null; pickup_started_at: string | null; pickup_arrived_at: string | null;
  collected_at: string | null; destination_arrived_at: string | null; cancelled_at: string | null; failed_at: string | null; returned_at: string | null; exception_reason: string | null;
  rider_lat: number | null; rider_lng: number | null; rider_seen_at: string | null; signature: string | null; signed_name: string | null;
  delivered_at: string | null; note: string | null; created_at: string;
}
export interface DeliveryEvent { id: string; job_id: string; status: string; action: string | null; previous_status: string | null; new_status: string | null; actor_id: string | null; actor_role: string | null; lat: number | null; lng: number | null; note: string | null; created_at: string; }
export interface PublicDeliveryTracking {
  id: string; tracking_number: string; status: DeliveryStatus; workflow_status: DeliveryWorkflowStatus; pickup_address: string | null; dropoff_address: string;
  pickup_lat: number | null; pickup_lng: number | null;
  dropoff_lat: number | null; dropoff_lng: number | null; rider_lat: number | null; rider_lng: number | null;
  rider_seen_at: string | null; created_at: string; pickup_started_at: string | null; pickup_arrived_at: string | null;
  collected_at: string | null; destination_arrived_at: string | null; delivered_at: string | null; cancelled_at: string | null; failed_at: string | null; returned_at: string | null;
}

export const DELIVERY_STAGES: DeliveryWorkflowStatus[] = ['in_process', 'pickup', 'in_transit', 'arrived', 'delivered'];
export const STAGE_LABEL: Record<DeliveryStatus, string> = {
  pending: 'Waiting for rider', accepted: 'Rider accepted', picked_up: 'On the way', in_process: 'Waiting for rider',
  pickup: 'Heading to pickup', in_transit: 'On the way', arrived: 'Arrived', delivered: 'Delivered',
  cancelled: 'Cancelled', failed: 'Delivery issue', returning: 'Returning to pharmacy', returned: 'Returned to pharmacy',
};
export function workflowStatus(status: DeliveryStatus): DeliveryWorkflowStatus {
  if (status === 'pending' || status === 'accepted') return 'in_process';
  if (status === 'picked_up') return 'in_transit';
  return status;
}
export function deliveryLabel(status: DeliveryStatus, assignment?: 'available' | 'assigned'): string {
  const workflow = workflowStatus(status);
  return workflow === 'in_process' && assignment === 'assigned' ? 'Rider accepted' : STAGE_LABEL[workflow];
}

/** The next stage a rider moves to; delivered needs a signature. */
export function nextStage(s: DeliveryStatus): DeliveryStatus | null {
  const i = DELIVERY_STAGES.indexOf(workflowStatus(s));
  return i < 0 || i >= DELIVERY_STAGES.length - 1 ? null : DELIVERY_STAGES[i + 1]!;
}

export function whatsappTrackingUrl(phone: string | null, trackingNumber: string, trackingUrl: string, recipientName?: string | null): string | null {
  if (!phone?.trim()) return null;
  let number = phone.replace(/\D/g, '');
  if (number.startsWith('00')) number = number.slice(2);
  if (number.startsWith('0')) number = `255${number.slice(1)}`;
  else if (/^[67]\d{8}$/.test(number)) number = `255${number}`;
  if (number.length < 8 || number.length > 15) return null;
  const greeting = recipientName?.trim() ? `Hi ${recipientName.trim()}, ` : 'Hello, ';
  const text = `${greeting}track your delivery ${trackingNumber}: ${trackingUrl}`;
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

export const DeliveryService = {
  async list(pid: string): Promise<DeliveryJob[]> {
    return ok(await db.from('delivery_jobs').select('*').or(`pharmacy_id.eq.${pid},buyer_pharmacy_id.eq.${pid}`).order('created_at', { ascending: false }).limit(300)) ?? [];
  },
  subscribe(pid: string, onChange: () => void): () => void {
    const channel = typed.channel(`delivery-jobs:${pid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_jobs', filter: `pharmacy_id=eq.${pid}` }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_jobs', filter: `buyer_pharmacy_id=eq.${pid}` }, onChange)
      .subscribe((state) => {
        if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT') console.error(`Delivery realtime channel ${state.toLowerCase()} for business ${pid}`);
      });
    return () => { void typed.removeChannel(channel); };
  },
  async events(jobId: string): Promise<DeliveryEvent[]> {
    return ok(await db.from('delivery_job_events').select('*').eq('job_id', jobId).order('created_at')) ?? [];
  },
  async create(pid: string, o: { order?: string | null; dropoff: string; recipient?: string; phone?: string; lat?: number | null; lng?: number | null; note?: string }) {
    return ok(await db.rpc('create_delivery_job', { _pharmacy: pid, _order: o.order || null, _dropoff: o.dropoff, _recipient: o.recipient || null, _phone: o.phone || null, _lat: o.lat ?? null, _lng: o.lng ?? null, _note: o.note || null })) as string;
  },
  async createForSale(saleId: string, o: { dropoff: string; recipient?: string; phone?: string }) {
    return ok(await db.rpc('create_sale_delivery', { _sale: saleId, _dropoff: o.dropoff, _recipient: o.recipient || null, _phone: o.phone || null, _note: null })) as string;
  },
  async accept(jobId: string) {
    ok(await db.rpc('accept_delivery_offer', { _job: jobId }));
  },
  async publicTracking(jobId: string): Promise<PublicDeliveryTracking | null> {
    return ok(await db.rpc('get_public_delivery_tracking', { _job: jobId })) as PublicDeliveryTracking | null;
  },
  async advance(jobId: string, status: DeliveryStatus, o: { lat?: number | null; lng?: number | null; note?: string; signature?: string; signedName?: string } = {}) {
    ok(await db.rpc('advance_delivery_job', { _job: jobId, _status: status, _lat: o.lat ?? null, _lng: o.lng ?? null, _note: o.note || null, _signature: o.signature || null, _signed_name: o.signedName || null }));
  },
  async arriveAtPickup(jobId: string, lat?: number | null, lng?: number | null) {
    ok(await db.rpc('arrive_delivery_pickup', { _job: jobId, _lat: lat ?? null, _lng: lng ?? null }));
  },
  async exception(jobId: string, action: DeliveryException, reason: string) {
    ok(await db.rpc('delivery_exception', { _job: jobId, _action: action, _reason: reason }));
  },
  async addNote(jobId: string, note: string, lat?: number | null, lng?: number | null) {
    ok(await db.rpc('add_delivery_note', { _job: jobId, _note: note, _lat: lat ?? null, _lng: lng ?? null }));
  },
  async ping(jobId: string, lat: number, lng: number) {
    ok(await db.rpc('ping_delivery_location', { _job: jobId, _lat: lat, _lng: lng }));
  },
};
