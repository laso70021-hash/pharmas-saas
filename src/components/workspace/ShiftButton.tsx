import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Play, Coffee, RotateCcw, Square, Timer } from 'lucide-react';
import { ShiftService } from '@/lib/shift-service';
import { clock, workedSeconds } from '@/lib/shifts';
import { errorText } from './ws-ui';

/** Header shortcut: start a shift and watch the live timer from the server start time. */
export function ShiftButton({ pid, userId, onOpen }: { pid: string; userId: string; onOpen: () => void }) {
  const qc = useQueryClient();
  const { data: mine } = useQuery({ queryKey: ['shift', pid, 'mine', userId], queryFn: () => ShiftService.mine(pid, userId) });
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false); const [menu, setMenu] = useState(false);
  useEffect(() => { if (!mine) return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [mine]);
  const act = async (a: 'start' | 'break' | 'resume' | 'end', msg: string) => {
    setBusy(true); setMenu(false);
    try { await ShiftService.act(pid, a, a === 'start' ? { minutes: 480 } : {}); toast.success(msg); void qc.invalidateQueries({ queryKey: ['shift', pid] }); }
    catch (e) { toast.error(errorText(e)); } finally { setBusy(false); }
  };
  if (!mine) return <button disabled={busy} onClick={() => void act('start', 'Shift started')} className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 whitespace-nowrap disabled:opacity-60"><Play className="w-3 h-3" /> <span className="hidden sm:inline">Start shift</span></button>;
  const onBreak = mine.status === 'on_break';
  return (
    <div className="relative">
      <button onClick={() => setMenu((m) => !m)} className={`text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 whitespace-nowrap tabular-nums ${onBreak ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
        <Timer className="w-3 h-3" /> <span className="hidden sm:inline">{onBreak ? 'On break' : 'On shift'} ·</span> {clock(workedSeconds(mine, now))}
      </button>
      {menu && (
        <div className="absolute right-0 mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-lg p-1 z-40 text-xs font-bold text-slate-700">
          {onBreak ? <button disabled={busy} onClick={() => void act('resume', 'Shift resumed')} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-100"><RotateCcw className="w-3.5 h-3.5" /> Resume</button>
            : <button disabled={busy} onClick={() => void act('break', 'Break started')} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-100"><Coffee className="w-3.5 h-3.5" /> Take break</button>}
          <button disabled={busy} onClick={() => { if (window.confirm('End your shift now?')) void act('end', 'Shift ended'); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-rose-50 text-rose-700"><Square className="w-3.5 h-3.5" /> End shift</button>
          <button onClick={() => { setMenu(false); onOpen(); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-100"><Timer className="w-3.5 h-3.5" /> Shift details</button>
        </div>)}
    </div>
  );
}
