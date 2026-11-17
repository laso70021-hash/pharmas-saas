import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Send, Trash2, Paperclip, X, FileText } from 'lucide-react';
import { prepareAiFile } from '@/lib/image-resize';
import covloIcon from '@/assets/brand/covlo.png';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase-client';
import { askCovlo } from '@/lib/covlo.functions';
import { covloPrompts } from '@/lib/covlo';
import type { Workspace } from '@/lib/pharmacy-types';
import { cardCls } from './ws-ui';

type Msg = { role: 'user' | 'assistant'; content: string };
const ROLE_KEY: Record<string, string> = { owner: 'pharmacy_owner', admin: 'platform_admin' };

export function CovloTab({ ws, userId }: { ws: Workspace; userId: string }) {
  const qc = useQueryClient();
  const role = ws.business_type === 'supplier' && (ws.role === 'owner') ? 'supplier' : ROLE_KEY[ws.role] ?? ws.role;
  const [active, setActive] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState<Msg | null>(null);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<{ name: string; data: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);

  const { data: threads = [] } = useQuery({
    queryKey: ['covlo-threads', ws.id, userId],
    queryFn: async () => { const { data, error } = await supabase.from('covlo_threads').select('id,title,updated_at').eq('pharmacy_id', ws.id).eq('user_id', userId).order('updated_at', { ascending: false }).limit(50); if (error) throw error; return data; },
  });
  const { data: messages = [] } = useQuery({
    queryKey: ['covlo-msgs', active], enabled: Boolean(active),
    queryFn: async () => { const { data, error } = await supabase.from('covlo_messages').select('role,content').eq('thread_id', active!).order('created_at'); if (error) throw error; return data as Msg[]; },
  });
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [messages, pending]);
  useEffect(() => { box.current?.focus(); }, [active, busy]);

  const send = async (text: string) => {
    const att = file;
    const t = text.trim() || (att ? 'Please read this file and tell me what it contains and what I should do in Swahivo.' : ''); if (!t || busy) return;
    setBusy(true); setPending({ role: 'user', content: att ? `${t}\n📎 ${att.name}` : t }); setDraft(''); setFile(null);
    try {
      const r = await askCovlo({ data: { pharmacyId: ws.id, threadId: active, message: t, ...(att ? { attachment: att } : {}) } });
      if (r.error) toast.error(r.error);
      setActive(r.threadId);
      await Promise.all([qc.invalidateQueries({ queryKey: ['covlo-msgs', r.threadId] }), qc.invalidateQueries({ queryKey: ['covlo-threads', ws.id, userId] })]);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Covlo could not answer'); setDraft(t); setFile(att); }
    finally { setPending(null); setBusy(false); }
  };
  const remove = async (id: string) => {
    const { error } = await supabase.from('covlo_threads').delete().eq('id', id);
    if (error) { toast.error('Could not delete'); return; }
    if (active === id) setActive(null);
    void qc.invalidateQueries({ queryKey: ['covlo-threads', ws.id, userId] });
  };
  const shown = pending ? [...messages, pending] : messages;

  return (
    <div className="grid md:grid-cols-[230px_1fr] gap-4 h-[calc(100vh-170px)] min-h-[480px]">
      <aside className={`${cardCls} p-3 flex flex-col gap-2 overflow-hidden`}>
        <button onClick={() => setActive(null)} className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold"><Plus className="w-4 h-4" /> New conversation</button>
        <div className="overflow-y-auto space-y-1">
          {threads.length === 0 && <p className="text-xs text-slate-400 p-2">Your conversations with Covlo appear here. Only you can see them.</p>}
          {threads.map((t) => (
            <div key={t.id} className={`group flex items-center rounded-lg ${active === t.id ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50'}`}>
              <button onClick={() => setActive(t.id)} className="flex-1 text-left text-xs font-semibold px-2 py-2 truncate">{t.title}</button>
              <button onClick={() => void remove(t.id)} aria-label="Delete conversation" className="p-1.5 text-slate-400 hover:text-red-600 opacity-0 group-hover:opacity-100"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
        </div>
      </aside>
      <section className={`${cardCls} flex flex-col overflow-hidden`}>
        <header className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-200">
          <img src={covloIcon} alt="Covlo" className="w-9 h-9 rounded-full object-cover" />
          <div><div className="font-black text-slate-900">Covlo</div><div className="text-[11px] text-slate-500">Say "Kovlo" · your Swahivo assistant for {ws.name}</div></div>
        </header>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {shown.length === 0 && (
            <div className="text-center py-8 space-y-3">
              <p className="text-sm text-slate-600">Ask about sales, stock, expiry, orders or prescriptions. Covlo reads this business's live figures.</p>
              <div className="flex flex-wrap justify-center gap-2">{covloPrompts(role).map((p) => <button key={p} onClick={() => void send(p)} className="text-xs font-semibold px-3 py-1.5 rounded-full border border-slate-300 hover:border-blue-500 hover:text-blue-600">{p}</button>)}</div>
            </div>
          )}
          {shown.map((m, i) => (
            <div key={i} className={m.role === 'user' ? 'flex justify-end' : ''}>
              <div className={m.role === 'user' ? 'max-w-[80%] rounded-2xl bg-blue-600 text-white px-3.5 py-2 text-sm whitespace-pre-wrap' : 'max-w-[90%] text-sm text-slate-800 whitespace-pre-wrap'}>{m.content}</div>
            </div>
          ))}
          {busy && <div className="text-xs text-slate-400 animate-pulse">Covlo is thinking…</div>}
          <div ref={end} />
        </div>
        <form onSubmit={(e) => { e.preventDefault(); void send(draft); }} className="border-t border-slate-200 p-3 space-y-2">
          {file && <div className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-2 py-1 text-xs">{file.data.startsWith('data:image') ? <img src={file.data} alt="" className="h-8 w-8 rounded object-cover" /> : <FileText className="w-4 h-4" />}<span className="max-w-[200px] truncate">{file.name}</span><button type="button" aria-label="Remove attachment" onClick={() => setFile(null)}><X className="w-3.5 h-3.5" /></button></div>}
          <div className="flex gap-2 items-end">
            <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" aria-label="Attach a photo or PDF" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; try { setFile(await prepareAiFile(f)); } catch (err) { toast.error(err instanceof Error ? err.message : 'Could not attach'); } }} />
            <button type="button" onClick={() => fileInput.current?.click()} disabled={busy} aria-label="Upload a photo, invoice or prescription" title="Upload a photo, invoice or prescription" className="h-10 w-10 shrink-0 rounded-xl border border-slate-300 text-slate-600 flex items-center justify-center hover:border-blue-500 hover:text-blue-600 disabled:opacity-40"><Paperclip className="w-4 h-4" /></button>
            <textarea ref={box} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(draft); } }} rows={2} maxLength={4000} placeholder="Ask Covlo about sales, stock or expiry — or upload a photo, invoice or prescription…" className="flex-1 resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
            <button type="submit" disabled={busy || (!draft.trim() && !file)} aria-label="Send" className="h-10 w-10 shrink-0 rounded-xl bg-blue-600 text-white flex items-center justify-center disabled:opacity-40"><Send className="w-4 h-4" /></button>
          </div>
        </form>
      </section>
    </div>
  );
}
