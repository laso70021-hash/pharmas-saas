import { useEffect, useRef, useState, type FormEvent } from 'react';
import { MessageCircle, Send, X } from 'lucide-react';
import { supabase } from '@/lib/supabase-client';
import { WholesaleService, type WholesaleMessage } from '@/lib/pharmacy-service';
import { useAuth } from '@/hooks/useAuth';
import { errorText, inputCls, primaryBtn } from './ws-ui';
import { toast } from 'sonner';

/** Live presence of the other business in a buyer⇄supplier thread. One shared room per pair. */
export function usePartnerOnline(buyerId: string, supplierId: string, side: 'buyer' | 'supplier', enabled = true) {
  const { user } = useAuth();
  const [online, setOnline] = useState(false);
  useEffect(() => {
    if (!enabled || !user || !buyerId || !supplierId) return;
    const ch = supabase.channel(`wh-presence:${buyerId}:${supplierId}`, { config: { presence: { key: `${side}:${user.id}` } } });
    ch.on('presence', { event: 'sync' }, () => {
      const other = side === 'buyer' ? 'supplier' : 'buyer';
      setOnline(Object.keys(ch.presenceState()).some((k) => k.startsWith(`${other}:`)));
    }).subscribe((st) => { if (st === 'SUBSCRIBED') void ch.track({ at: Date.now() }); });
    return () => { void supabase.removeChannel(ch); };
  }, [buyerId, supplierId, side, enabled, user]);
  return online;
}

export function OnlineBadge({ online }: { online: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${online ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${online ? 'bg-emerald-500' : 'bg-slate-400'}`} />{online ? 'Online' : 'Offline'}
    </span>
  );
}

export function WholesaleChat({ buyerId, supplierId, side, myName, partnerName, onClose, orderRef }: {
  buyerId: string; supplierId: string; side: 'buyer' | 'supplier'; myName: string; partnerName: string; onClose: () => void; orderRef?: string;
}) {
  const { user } = useAuth();
  const [msgs, setMsgs] = useState<WholesaleMessage[]>([]);
  const [text, setText] = useState(orderRef ? `Re order ${orderRef}: ` : '');
  const [busy, setBusy] = useState(false);
  const online = usePartnerOnline(buyerId, supplierId, side);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    WholesaleService.messages(buyerId, supplierId).then((m) => live && setMsgs(m)).catch(() => {});
    const ch = supabase.channel(`wh-msgs-${buyerId}-${supplierId}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'wholesale_messages', filter: `buyer_pharmacy_id=eq.${buyerId}` }, (p) => {
        const m = p.new as WholesaleMessage;
        if (m.supplier_id !== supplierId) return;
        setMsgs((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      }).subscribe();
    return () => { live = false; void supabase.removeChannel(ch); };
  }, [buyerId, supplierId]);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [msgs]);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const body = text.trim(); if (!body || !user) return;
    setBusy(true);
    try {
      await WholesaleService.sendMessage({ buyerId, supplierId, side, senderId: user.id, senderName: myName, body });
      setText('');
      setMsgs(await WholesaleService.messages(buyerId, supplierId));
    } catch (err) { toast.error(errorText(err)); } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30" onClick={onClose}>
      <div className="w-full sm:w-96 h-full bg-white shadow-xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-slate-200 flex items-center gap-3">
          <MessageCircle className="w-5 h-5 text-blue-600" />
          <div className="flex-1 min-w-0"><div className="font-black text-sm truncate">{partnerName}</div><OnlineBadge online={online} />{orderRef && <span className="ml-2 text-[10px] font-bold text-blue-700 bg-blue-50 rounded-full px-2 py-0.5">Order {orderRef}</span>}</div>
          <button aria-label="Close chat" onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50">
          {msgs.length === 0 && <p className="text-xs text-slate-400 text-center mt-8">No messages yet. Say hello 👋</p>}
          {msgs.map((m) => { const mine = m.sender_side === side; return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${mine ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-800'}`}>
                {!mine && m.sender_name && <div className="text-[10px] font-bold text-slate-500">{m.sender_name}</div>}
                <div className={`whitespace-pre-wrap break-words ${orderRef && !m.body.includes(orderRef) ? 'opacity-60' : ''}`}>{m.body}</div>
                <div className={`text-[10px] mt-0.5 ${mine ? 'text-blue-100' : 'text-slate-400'}`}>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
            </div>); })}
          <div ref={end} />
        </div>
        <form onSubmit={send} className="p-3 border-t border-slate-200 flex gap-2">
          <input className={inputCls} maxLength={2000} placeholder="Type a message…" value={text} onChange={(e) => setText(e.target.value)} />
          <button aria-label="Send" className={primaryBtn} disabled={busy || !text.trim()}><Send className="w-3.5 h-3.5" /></button>
        </form>
      </div>
    </div>
  );
}
