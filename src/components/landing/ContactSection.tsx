import { useState, type FormEvent } from 'react';
import { z } from 'zod';
import { Mail, Phone, Send, CheckCircle2 } from 'lucide-react';
import { submitContact } from '@/lib/contact.functions';
import { BRAND, telHref } from '@/lib/brand';

const schema = z.object({
  full_name: z.string().trim().min(1, 'Please enter your name').max(120),
  email: z.string().trim().email('Please enter a valid email').max(200),
  phone: z.string().trim().max(40).optional(),
  business_name: z.string().trim().max(160).optional(),
  message: z.string().trim().min(1, 'Please write a message').max(2000),
});

const input = 'w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400';

export default function ContactSection() {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const raw = Object.fromEntries(new FormData(form)) as Record<string, string>;
    const parsed = schema.safeParse(raw);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? 'Check the form'); return; }
    setError(null); setSending(true);
    const v = parsed.data;
    let failed = false;
    try { await submitContact({ data: { ...v, phone: v.phone || null, business_name: v.business_name || null } }); }
    catch { failed = true; }
    setSending(false);
    if (failed) { setError('Could not send your message. Please call or email us.'); return; }
    form.reset(); setSent(true);
  };

  return (
    <section id="contact" className="py-20 bg-slate-50 scroll-mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-5 gap-10">
        <div className="lg:col-span-2 space-y-5">
          <span className="inline-block px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">Contact us</span>
          <h2 className="text-3xl font-extrabold text-blue-950">Talk to our team</h2>
          <p className="text-slate-600">Want a walkthrough, pricing help or a custom plan? Send us a message and we'll get back to you.</p>
          <a href={`mailto:${BRAND.enterpriseEmail}`} className="flex items-center gap-3 text-slate-700 hover:text-blue-600 font-semibold"><Mail className="w-5 h-5 text-blue-600" />{BRAND.enterpriseEmail}</a>
          {BRAND.phones.map((p) => (
            <a key={p} href={telHref(p)} className="flex items-center gap-3 text-slate-700 hover:text-blue-600 font-semibold"><Phone className="w-5 h-5 text-blue-600" />{p}</a>
          ))}
        </div>
        <div className="lg:col-span-3 bg-white rounded-3xl border border-slate-200 shadow-xl p-6 sm:p-8">
          {sent ? (
            <div className="text-center py-12 space-y-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
              <h3 className="text-xl font-bold text-slate-900">Message sent</h3>
              <p className="text-sm text-slate-600">Thank you — our team will contact you soon.</p>
              <button onClick={() => setSent(false)} className="text-sm font-semibold text-blue-600 hover:underline">Send another message</button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="grid sm:grid-cols-2 gap-4">
              <input name="full_name" placeholder="Full name *" className={input} maxLength={120} />
              <input name="email" type="email" placeholder="Email *" className={input} maxLength={200} />
              <input name="phone" placeholder="Phone" className={input} maxLength={40} />
              <input name="business_name" placeholder="Pharmacy / business name" className={input} maxLength={160} />
              <textarea name="message" rows={5} placeholder="How can we help? *" className={`${input} sm:col-span-2`} maxLength={2000} />
              {error && <p className="sm:col-span-2 text-sm text-red-600">{error}</p>}
              <button type="submit" disabled={sending} className="sm:col-span-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2">
                <Send className="w-4 h-4" />{sending ? 'Sending…' : 'Send message'}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
