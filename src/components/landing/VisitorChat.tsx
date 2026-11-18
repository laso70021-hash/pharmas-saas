import { useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, X } from 'lucide-react';
import { askVisitorAssistant } from '@/lib/visitor-assistant.functions';
import covloIcon from '@/assets/brand/covlo.png';

type Msg = { role: 'user' | 'assistant'; content: string };
const STARTERS = ['How much does it cost?', 'Is there a free trial?', 'Can I manage many branches?', 'I am a supplier — how do I sell?'];

export function VisitorChat() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [msgs, busy]);
  const send = async (text: string) => {
    const t = text.trim(); if (!t || busy) return;
    const next = [...msgs, { role: 'user' as const, content: t.slice(0, 1200) }];
    setMsgs(next); setDraft(''); setBusy(true);
    try {
      const r = await askVisitorAssistant({ data: { messages: next.slice(-12) } });
      setMsgs([...next, { role: 'assistant', content: r.reply ?? r.error ?? 'Please try again.' }]);
    } catch { setMsgs([...next, { role: 'assistant', content: 'Our assistant is unavailable right now. Call 0771 888 881 or email info@afyadawa.co.tz.' }]); }
    finally { setBusy(false); }
  };
  return (
    <div className="fixed bottom-5 right-5 z-50">
      {open && (
        <div className="mb-3 w-[min(360px,calc(100vw-2.5rem))] h-[min(520px,calc(100vh-7rem))] rounded-2xl bg-white shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
          <div className="flex items-center gap-2.5 px-4 py-3 bg-blue-600 text-white">
            <img src={covloIcon} alt="Covlo" className="w-8 h-8 rounded-full object-cover" />
            <div className="flex-1"><div className="font-bold text-sm">Covlo AI</div><div className="text-[11px] text-blue-100">Ask anything about our service</div></div>
            <button aria-label="Close chat" onClick={() => setOpen(false)}><X className="w-5 h-5" /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-slate-50">
            <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-white border border-slate-200 px-3 py-2 text-sm text-slate-700">Habari! 👋 I can answer questions about Afyadawa — plans, the free trial, features for pharmacies and suppliers.</div>
            {msgs.length === 0 && <div className="flex flex-wrap gap-1.5">{STARTERS.map((s) => <button key={s} onClick={() => void send(s)} className="text-xs font-semibold px-2.5 py-1.5 rounded-full border border-blue-200 text-blue-700 bg-white hover:bg-blue-50">{s}</button>)}</div>}
            {msgs.map((m, i) => <div key={i} className={m.role === 'user' ? 'flex justify-end' : ''}><div className={m.role === 'user' ? 'max-w-[85%] rounded-2xl rounded-tr-sm bg-blue-600 text-white px-3 py-2 text-sm whitespace-pre-wrap' : 'max-w-[85%] rounded-2xl rounded-tl-sm bg-white border border-slate-200 px-3 py-2 text-sm text-slate-700 whitespace-pre-wrap'}>{m.content}</div></div>)}
            {busy && <div className="text-xs text-slate-400 animate-pulse">Typing…</div>}
            <div ref={end} />
          </div>
          <form onSubmit={(e) => { e.preventDefault(); void send(draft); }} className="flex gap-2 p-2.5 border-t border-slate-200">
            <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={1200} placeholder="Type your question…" aria-label="Your question" className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
            <button type="submit" aria-label="Send" disabled={busy || !draft.trim()} className="h-10 w-10 rounded-xl bg-blue-600 text-white flex items-center justify-center disabled:opacity-40"><Send className="w-4 h-4" /></button>
          </form>
        </div>
      )}
      <button onClick={() => setOpen((o) => !o)} aria-label={open ? 'Close chat' : 'Chat with us'} className="ml-auto flex items-center gap-2 rounded-full bg-blue-600 text-white shadow-lg pl-4 pr-5 h-14 hover:bg-blue-700">
        {open ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}<span className="font-bold text-sm hidden sm:inline">{open ? 'Close' : 'Ask us anything'}</span>
      </button>
    </div>
  );
}
