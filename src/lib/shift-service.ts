import { supabase as typed } from '@/lib/supabase-client';
import type { Shift } from './shifts';
// Tables are newer than the generated types; keep the cast local to this file.
const db = typed as unknown as { from: (t: string) => any; rpc: (f: string, a: object) => any };
const ok = <T,>(r: { data: T; error: { message: string } | null }) => { if (r.error) throw new Error(r.error.message); return r.data; };

export interface ShiftActivity { sales: number; revenue: number; rx: number; stock: number; }

export const ShiftService = {
  async list(pid: string, fromIso?: string): Promise<Shift[]> {
    let q = db.from('employee_shifts').select('*').eq('pharmacy_id', pid).order('started_at', { ascending: false }).limit(500);
    if (fromIso) q = q.gte('started_at', fromIso);
    return ok(await q) ?? [];
  },
  async mine(pid: string, uid: string): Promise<Shift | null> {
    return ok(await db.from('employee_shifts').select('*').eq('pharmacy_id', pid).eq('user_id', uid).is('ended_at', null).maybeSingle());
  },
  async pendingHandover(pid: string, uid: string): Promise<Shift | null> {
    return ok(await db.from('employee_shifts').select('*').eq('pharmacy_id', pid).eq('handover_to', uid).is('accepted_at', null).eq('status', 'transferred').order('ended_at', { ascending: false }).limit(1).maybeSingle());
  },
  async act(pid: string, action: 'start' | 'break' | 'resume' | 'extend' | 'end' | 'transfer', o: { branch?: string | null; minutes?: number; to?: string; note?: string } = {}) {
    return ok(await db.rpc('shift_action', { _pharmacy: pid, _action: action, _branch: o.branch || null, _minutes: o.minutes ?? null, _to_user: o.to || null, _note: o.note || null }));
  },
  /** Work done by one employee during a shift window, from real records. */
  async activity(pid: string, uid: string, from: string, to: string | null): Promise<ShiftActivity> {
    const end = to ?? new Date().toISOString();
    const [s, rx, mv] = await Promise.all([
      db.from('sales').select('total').eq('pharmacy_id', pid).eq('cashier_id', uid).gte('created_at', from).lte('created_at', end),
      db.from('prescriptions').select('id', { count: 'exact', head: true }).eq('pharmacy_id', pid).eq('dispensed_by', uid).gte('dispensed_at', from).lte('dispensed_at', end),
      db.from('stock_movements').select('id', { count: 'exact', head: true }).eq('pharmacy_id', pid).eq('created_by', uid).gte('created_at', from).lte('created_at', end),
    ]);
    const sales = (ok(s) as { total: number }[]) ?? [];
    return { sales: sales.length, revenue: sales.reduce((a, x) => a + Number(x.total || 0), 0), rx: rx.count ?? 0, stock: mv.count ?? 0 };
  },
};
