import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Play, Coffee, RotateCcw, Timer, Square, ArrowRightLeft, FileText } from 'lucide-react';
import type { Workspace } from '@/lib/pharmacy-types';
import { WorkspaceService } from '@/lib/pharmacy-service';
import { ShiftService } from '@/lib/shift-service';
import { breakSeconds, clock, hours, plannedMinutes, workedSeconds, type Shift } from '@/lib/shifts';
import { can } from '@/lib/workspace';
import { formatNumber } from '@/lib/utils';
import { cardCls, Empty, Field, Modal, SectionHeader, errorText, ghostBtn, inputCls, primaryBtn } from './ws-ui';

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
const STATUS: Record<Shift['status'], string> = { active: 'On shift', on_break: 'On break', ended: 'Ended', transferred: 'Handed over' };

function useNow(on: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { if (!on) return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [on]);
  return now;
}

export function ShiftsTab({ ws, userId }: { ws: Workspace; userId: string }) {
  const pid = ws.id; const qc = useQueryClient();
  const manager = ws.role === 'owner' || ws.role === 'manager' || ws.role === 'admin';
  const { data: mine } = useQuery({ queryKey: ['shift', pid, 'mine', userId], queryFn: () => ShiftService.mine(pid, userId) });
  const { data: pending } = useQuery({ queryKey: ['shift', pid, 'pending', userId], queryFn: () => ShiftService.pendingHandover(pid, userId) });
  const { data: shifts = [] } = useQuery({ queryKey: ['shift', pid, 'list'], queryFn: () => ShiftService.list(pid) });
  const { data: branches = [] } = useQuery({ queryKey: ['ws', pid, 'branches'], queryFn: () => WorkspaceService.getBranches(pid) });
  const { data: staff = [] } = useQuery({ queryKey: ['ws', pid, 'staff'], queryFn: () => WorkspaceService.getStaff(pid) });
  const now = useNow(true);
  const [branch, setBranch] = useState(''); const [planned, setPlanned] = useState(8);
  const [dialog, setDialog] = useState<null | 'extend' | 'transfer'>(null);
  const [mins, setMins] = useState(30); const [to, setTo] = useState(''); const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false); const [report, setReport] = useState<string | null>(null);
  const name = (id: string | null) => staff.find((s) => s.user_id === id)?.full_name ?? (id === userId ? 'You' : 'Team member');

  const act = async (a: Parameters<typeof ShiftService.act>[1], o: Parameters<typeof ShiftService.act>[2] = {}, msg = 'Saved') => {
    setBusy(true);
    try { await ShiftService.act(pid, a, o); toast.success(msg); setDialog(null); setNote(''); void qc.invalidateQueries({ queryKey: ['shift', pid] }); }
    catch (e) { toast.error(errorText(e)); } finally { setBusy(false); }
  };

  const visible = manager ? shifts : shifts.filter((s) => s.user_id === userId);
  const worked = mine ? workedSeconds(mine, now) : 0;
  const left = mine ? plannedMinutes(mine) * 60 - worked : 0;

  return (
    <div className="space-y-5">
      <SectionHeader title="Shifts" subtitle="Start, pause, extend and hand over your shift — times come from the server clock" />
      {pending && !mine && <div className="text-xs bg-blue-50 border border-blue-200 text-blue-900 rounded-xl px-4 py-2.5 font-semibold">{name(pending.user_id)} handed a shift to you at {fmt(pending.ended_at)}. Start your shift to accept it — your cover starts from the handover time.</div>}
      <div className={`${cardCls} p-5`}>
        {!mine ? (
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Branch"><select className={`${inputCls} w-48`} value={branch} onChange={(e) => setBranch(e.target.value)}><option value="">{pending ? 'Same as handover' : 'No branch'}</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
            <Field label="Planned hours"><input type="number" min={1} max={16} className={`${inputCls} w-28`} value={planned} onChange={(e) => setPlanned(Number(e.target.value))} /></Field>
            <button className={primaryBtn} disabled={busy} onClick={() => void act('start', { branch, minutes: Math.round(planned * 60) }, pending ? 'Handover accepted, shift started' : 'Shift started')}><Play className="w-3.5 h-3.5" /> Start shift</button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-[11px] font-bold uppercase text-slate-500">{STATUS[mine.status]} · since {fmt(mine.started_at)}</div>
              <div className="text-3xl font-black text-slate-900 tabular-nums">{clock(worked)}</div>
              <div className="text-xs text-slate-500">Break {clock(breakSeconds(mine, now))} · {left >= 0 ? `${clock(left)} left` : `${clock(-left)} over planned`}{mine.extended_minutes ? ` · extended ${mine.extended_minutes} min` : ''}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              {mine.status === 'on_break'
                ? <button className={primaryBtn} disabled={busy} onClick={() => void act('resume', {}, 'Shift resumed')}><RotateCcw className="w-3.5 h-3.5" /> Resume shift</button>
                : <button className={ghostBtn} disabled={busy} onClick={() => void act('break', {}, 'Break started')}><Coffee className="w-3.5 h-3.5" /> Take break</button>}
              <button className={ghostBtn} disabled={busy} onClick={() => setDialog('extend')}><Timer className="w-3.5 h-3.5" /> Extend shift</button>
              <button className={ghostBtn} disabled={busy} onClick={() => setDialog('transfer')}><ArrowRightLeft className="w-3.5 h-3.5" /> Transfer shift</button>
              <button className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-50" disabled={busy} onClick={() => confirm('End your shift now?') && void act('end', {}, 'Shift ended')}><Square className="w-3.5 h-3.5" /> End shift</button>
            </div>
          </div>)}
      </div>

      <div className={`${cardCls} p-5 overflow-x-auto`}>
        <h3 className="font-black text-slate-900 text-sm mb-3">{manager ? 'Team shift history' : 'My shift history'}</h3>
        {visible.length === 0 ? <Empty>No shifts yet.</Empty> : (
          <table className="w-full text-left text-xs min-w-[820px]">
            <thead><tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px] font-bold"><th className="py-2">Employee</th><th>Branch</th><th>Start</th><th>End</th><th>Planned h</th><th>Worked h</th><th>Break h</th><th>Extra h</th><th>Handover</th><th>Status</th><th /></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((s) => { const w = workedSeconds(s, now); return (
                <tr key={s.id}>
                  <td className="py-2.5 font-bold text-slate-900">{name(s.user_id)}</td><td>{branches.find((b) => b.id === s.branch_id)?.name ?? '—'}</td>
                  <td>{fmt(s.started_at)}</td><td>{fmt(s.ended_at)}</td><td>{(plannedMinutes(s) / 60).toFixed(2)}</td><td className="font-bold">{hours(w)}</td>
                  <td>{hours(breakSeconds(s, now))}</td><td>{(s.extended_minutes / 60).toFixed(2)}</td>
                  <td>{s.handover_to ? `→ ${name(s.handover_to)}${s.accepted_at ? ` (accepted ${fmt(s.accepted_at)})` : ' (waiting)'}` : s.handover_from_shift ? 'Took over' : '—'}</td>
                  <td>{STATUS[s.status]}</td>
                  <td className="text-right"><button className={ghostBtn} onClick={() => setReport(s.id)}><FileText className="w-3.5 h-3.5" /> Report</button></td>
                </tr>); })}
            </tbody>
          </table>)}
      </div>

      {manager && <EmployeeSummary shifts={shifts} name={name} now={now} />}

      {dialog === 'extend' && <Modal title="Extend shift" onClose={() => setDialog(null)}>
        <div className="space-y-3">
          <Field label="Extra minutes"><input type="number" min={1} max={720} className={inputCls} value={mins} onChange={(e) => setMins(Number(e.target.value))} /></Field>
          <Field label={manager ? 'Reason (optional)' : 'Authorised by (manager name)'}><input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
          <button className={primaryBtn} disabled={busy} onClick={() => void act('extend', { minutes: mins, note }, 'Shift extended')}>Save extension</button>
        </div></Modal>}
      {dialog === 'transfer' && <Modal title="Transfer shift" onClose={() => setDialog(null)}>
        <div className="space-y-3">
          <Field label="Incoming employee"><select className={inputCls} value={to} onChange={(e) => setTo(e.target.value)}><option value="">Choose…</option>{staff.filter((s) => s.user_id !== userId && s.is_active).map((s) => <option key={s.user_id} value={s.user_id}>{s.full_name}</option>)}</select></Field>
          <Field label="Handover notes"><textarea className={inputCls} rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
          <p className="text-[11px] text-slate-500">Your shift ends now. Their cover starts from this moment; their own acceptance time is recorded when they start.</p>
          <button className={primaryBtn} disabled={busy || !to} onClick={() => void act('transfer', { to, note }, 'Shift handed over')}>Hand over</button>
        </div></Modal>}
      {report && <ShiftReport ws={ws} shift={shifts.find((s) => s.id === report)!} name={name} now={now} onClose={() => setReport(null)} />}
    </div>);
}

function EmployeeSummary({ shifts, name, now }: { shifts: Shift[]; name: (id: string) => string; now: number }) {
  const by = new Map<string, { n: number; w: number; b: number; e: number; h: number }>();
  for (const s of shifts) { const r = by.get(s.user_id) ?? { n: 0, w: 0, b: 0, e: 0, h: 0 }; r.n++; r.w += workedSeconds(s, now); r.b += breakSeconds(s, now); r.e += s.extended_minutes; if (s.handover_to) r.h++; by.set(s.user_id, r); }
  return (
    <div className={`${cardCls} p-5 overflow-x-auto`}>
      <h3 className="font-black text-slate-900 text-sm mb-3">Hours by employee</h3>
      <table className="w-full text-left text-xs min-w-[560px]"><thead><tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px] font-bold"><th className="py-2">Employee</th><th>Shifts</th><th>Worked h</th><th>Break h</th><th>Extended h</th><th>Handovers</th></tr></thead>
        <tbody className="divide-y divide-slate-100">{[...by.entries()].map(([id, r]) => <tr key={id}><td className="py-2.5 font-bold">{name(id)}</td><td>{r.n}</td><td className="font-bold">{hours(r.w)}</td><td>{hours(r.b)}</td><td>{(r.e / 60).toFixed(2)}</td><td>{r.h}</td></tr>)}</tbody></table>
    </div>);
}

function ShiftReport({ ws, shift, name, now, onClose }: { ws: Workspace; shift: Shift; name: (id: string | null) => string; now: number; onClose: () => void }) {
  const { data: a, isLoading } = useQuery({ queryKey: ['shift', ws.id, 'activity', shift.id], queryFn: () => ShiftService.activity(ws.id, shift.user_id, shift.started_at, shift.ended_at) });
  const rows: [string, string][] = [
    ['Employee', name(shift.user_id)], ['Start', fmt(shift.started_at)], ['End', fmt(shift.ended_at)],
    ['Planned hours', (plannedMinutes(shift) / 60).toFixed(2)], ['Worked hours', hours(workedSeconds(shift, now))], ['Break', clock(breakSeconds(shift, now))],
    ['Extended', `${shift.extended_minutes} min`], ['Handover', shift.handover_to ? `To ${name(shift.handover_to)}` : '—'],
    ['Sales handled', isLoading ? '…' : String(a?.sales ?? 0)], ['Cash taken (sales total)', isLoading ? '…' : `TZS ${formatNumber(a?.revenue ?? 0)}`],
    ['Prescriptions dispensed', isLoading ? '…' : String(a?.rx ?? 0)], ['Stock changes', isLoading ? '…' : String(a?.stock ?? 0)],
    ['Notes', shift.note || '—'],
  ];
  return <Modal title="Shift report" onClose={onClose}>
    <dl className="divide-y divide-slate-100 text-sm">{rows.map(([k, v]) => <div key={k} className="py-2 flex justify-between gap-4"><dt className="text-slate-500">{k}</dt><dd className="font-bold text-slate-900 text-right">{v}</dd></div>)}</dl>
    <button className={`${primaryBtn} mt-4`} onClick={() => window.print()}>Print</button>
  </Modal>;
}
