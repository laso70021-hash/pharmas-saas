export interface Shift {
  id: string; pharmacy_id: string; branch_id: string | null; user_id: string; status: 'active' | 'on_break' | 'ended' | 'transferred';
  started_at: string; ended_at: string | null; scheduled_minutes: number; extended_minutes: number; break_seconds: number;
  break_started_at: string | null; handover_to: string | null; handover_from_shift: string | null; accepted_at: string | null; note: string | null;
}

/** Seconds worked = elapsed minus breaks (including a break still running). */
export function workedSeconds(s: Pick<Shift, 'started_at' | 'ended_at' | 'break_seconds' | 'break_started_at'>, now: number = Date.now()): number {
  const end = s.ended_at ? Date.parse(s.ended_at) : now;
  const openBreak = s.break_started_at ? Math.max(0, (end - Date.parse(s.break_started_at)) / 1000) : 0;
  return Math.max(0, Math.floor((end - Date.parse(s.started_at)) / 1000 - s.break_seconds - openBreak));
}
export function breakSeconds(s: Pick<Shift, 'ended_at' | 'break_seconds' | 'break_started_at'>, now: number = Date.now()): number {
  const end = s.ended_at ? Date.parse(s.ended_at) : now;
  return s.break_seconds + (s.break_started_at ? Math.max(0, Math.floor((end - Date.parse(s.break_started_at)) / 1000)) : 0);
}
/** Planned minutes including approved extensions. */
export const plannedMinutes = (s: Pick<Shift, 'scheduled_minutes' | 'extended_minutes'>) => s.scheduled_minutes + s.extended_minutes;
export function clock(sec: number) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), x = sec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}`;
}
export const hours = (sec: number) => (sec / 3600).toFixed(2);
