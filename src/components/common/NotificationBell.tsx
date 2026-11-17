import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { NotificationService } from '@/lib/pharmacy-service';
import { useAuth } from '@/hooks/useAuth';

export interface ExtraNotice { id: string; kind: 'warning' | 'info'; title: string; body?: string; link?: string }

const ICON = { success: CheckCircle2, warning: AlertTriangle, info: Info } as Record<string, typeof Info>;
const TONE = { success: 'text-emerald-600', warning: 'text-amber-600', info: 'text-blue-600' } as Record<string, string>;

export function NotificationBell({ extra = [] }: { extra?: ExtraNotice[] }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data: items = [] } = useQuery({ queryKey: ['notifications', user?.id], queryFn: () => NotificationService.list(), enabled: !!user, refetchInterval: 30_000 });

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const unread = items.filter((n) => !n.read_at).length + extra.length;
  const go = async (id: string | null, link?: string | null) => {
    if (id) { await NotificationService.markRead(id).catch(() => {}); void qc.invalidateQueries({ queryKey: ['notifications'] }); }
    if (link) window.location.assign(link);
  };

  return (
    <div className="relative" ref={ref}>
      <button aria-label="Notifications" onClick={() => setOpen((v) => !v)} className="relative p-2 rounded-xl text-slate-500 hover:bg-slate-100 transition-colors">
        <Bell className="w-4 h-4" />
        {unread > 0 && <span className="absolute top-1 right-1 min-w-4 h-4 px-1 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-[70vh] overflow-y-auto bg-white rounded-2xl border border-slate-200 shadow-2xl z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <span className="font-black text-sm text-slate-900">Notifications</span>
            <button className="text-[11px] font-bold text-blue-600 inline-flex items-center gap-1" onClick={async () => { await NotificationService.markAllRead(); void qc.invalidateQueries({ queryKey: ['notifications'] }); }}>
              <CheckCheck className="w-3.5 h-3.5" /> Mark all read</button>
          </div>
          {extra.length + items.length === 0 && <p className="text-xs text-slate-400 text-center py-8">You're all caught up.</p>}
          {[...extra.map((e) => ({ ...e, read_at: null as string | null, created_at: '', body: e.body ?? null, link: e.link ?? null, local: true })), ...items.map((n) => ({ ...n, local: false }))].map((n) => {
            const I = ICON[n.kind] || Info;
            return (
              <button key={n.id} onClick={() => go(n.local ? null : n.id, n.link)} className={`w-full text-left px-4 py-3 flex gap-3 border-b border-slate-50 hover:bg-slate-50 ${n.read_at ? 'opacity-60' : ''}`}>
                <I className={`w-4 h-4 mt-0.5 shrink-0 ${TONE[n.kind] || 'text-blue-600'}`} />
                <span className="min-w-0">
                  <span className="block text-xs font-bold text-slate-900">{n.title}</span>
                  {n.body && <span className="block text-[11px] text-slate-500 truncate">{n.body}</span>}
                  {n.created_at && <span className="block text-[10px] text-slate-400 mt-0.5">{new Date(n.created_at).toLocaleString()}</span>}
                </span>
              </button>);
          })}
        </div>)}
    </div>
  );
}
