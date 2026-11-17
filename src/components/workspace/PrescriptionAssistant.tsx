import { useEffect, useRef, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { Mic, Square, ScanLine, UploadCloud, FileText, X, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import covloIcon from '@/assets/brand/covlo.png';
import { analyzePrescription } from '@/lib/prescription-assistant.functions';
import type { RxItem } from '@/lib/pharmacy-service';

interface Recognition {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((event: { results: { [index: number]: { [index: number]: { transcript: string } }; length: number }; resultIndex: number }) => void) | null;
  onerror: (() => void) | null; onend: (() => void) | null;
  start(): void; stop(): void; abort(): void;
}
type VoiceWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };

export type RxDetails = { patient_name?: string | null | undefined; prescriber?: string | null | undefined; prescription_date?: string | null | undefined; notes?: string | null | undefined };
export function PrescriptionAssistant({ pharmacyId, branchId, onApply, onDetails }: { pharmacyId: string; branchId: string; onApply: (items: RxItem[]) => void; onDetails?: (d: RxDetails) => void }) {
  const analyze = useServerFn(analyzePrescription);
  const [text, setText] = useState('');
  const [image, setImage] = useState<string>();
  const [filename, setFilename] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Awaited<ReturnType<typeof analyze>> | null>(null);
  const [review, setReview] = useState<Record<number, { selected: boolean; quantity: string; instructions: string }>>({});
  const voice = useRef<Recognition | null>(null);
  const generation = useRef(0);
  useEffect(() => () => { voice.current?.abort(); generation.current++; }, []);
  useEffect(() => { generation.current++; setResult(null); setReview({}); }, [branchId]);
  const invalidate = () => { generation.current++; setResult(null); setReview({}); };
  const upload = async (file?: File) => {
    invalidate(); setImage(undefined); setFilename(''); setError('');
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type) || file.size > 4 * 1024 * 1024) { setError('Choose a photo (JPG, PNG, WebP) or PDF up to 4 MB.'); return; }
    const reader = new FileReader();
    reader.onerror = () => setError('Could not read this image.');
    reader.onload = () => { if (typeof reader.result === 'string') { setImage(reader.result); setFilename(file.name); } };
    reader.readAsDataURL(file);
  };
  const startVoice = () => {
    if (listening) { voice.current?.stop(); return; }
    const browser = window as VoiceWindow;
    const Constructor = browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
    if (!Constructor) { setError('Voice input is unavailable in this browser. Type or upload the prescription instead.'); return; }
    const recognition = new Constructor(); voice.current = recognition;
    recognition.lang = 'en-TZ'; recognition.continuous = true; recognition.interimResults = false;
    recognition.onresult = e => { let transcript = ''; for (let i = e.resultIndex; i < e.results.length; i++) transcript += `${e.results[i]?.[0]?.transcript ?? ''} `; invalidate(); setText(t => `${t} ${transcript}`.trim()); };
    recognition.onerror = () => { setListening(false); setError('Microphone or voice service unavailable. You can still type.'); };
    recognition.onend = () => setListening(false);
    try { setError(''); recognition.start(); setListening(true); } catch { setError('Could not start voice input.'); }
  };
  const submit = async () => {
    voice.current?.stop(); setBusy(true); setError(''); setResult(null);
    const version = ++generation.current;
    try {
      const next = await analyze({ data: { pharmacyId, branchId, text, image } });
      if (generation.current !== version) return;
      setResult(next);
      onDetails?.({ patient_name: next.analysis.patient_name, prescriber: next.analysis.prescriber, prescription_date: next.analysis.prescription_date, notes: next.analysis.notes });
      setReview(Object.fromEntries(next.analysis.medicines.map((m, i) => [i, { selected: false, quantity: m.quantity == null ? '' : String(m.quantity), instructions: m.instructions }])));
    } catch (e) { if (generation.current === version) setError(e instanceof Error ? e.message : 'Analysis unavailable.'); }
    finally { setBusy(false); }
  };
  const approved = result?.analysis.medicines.flatMap((m, i) => {
    const r = review[i]; const product = result.catalogue.find(p => p.id === m.product_id); const qty = Number(r?.quantity);
    return r?.selected && product && Number.isInteger(qty) && qty > 0 && qty <= product.stock ? [{ product_id: product.id, name: `${product.name} ${product.strength ?? ''}`.trim(), quantity: qty, instructions: r.instructions }] : [];
  }) ?? [];
  const isPdf = image?.startsWith('data:application/pdf');
  return <section className="space-y-4 text-foreground">
    <div className="flex items-start gap-3 rounded-xl bg-blue-50 border border-blue-100 p-3">
      <img src={covloIcon} alt="Covlo" className="w-9 h-9 shrink-0 rounded-full object-cover" />
      <div><h4 className="font-bold text-slate-900">Covlo reads it for you</h4><p className="text-xs text-slate-600">Upload a photo or PDF of the prescription, or type/speak it. Covlo fills the patient, doctor and medicines — you check and confirm. A pharmacist always verifies before dispensing.</p></div>
    </div>
    <label className="flex gap-2 text-xs items-start text-slate-600"><input type="checkbox" checked={consent} disabled={busy} onChange={e => setConsent(e.target.checked)} />I am authorized to send these medicine details to AI and, for voice input, the browser’s speech service.</label>
    {!image ? <label className={`flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center transition ${consent && !busy ? 'border-blue-300 bg-white hover:bg-blue-50 cursor-pointer' : 'border-slate-200 bg-slate-50 opacity-60'}`}>
      <UploadCloud className="size-8 text-blue-600" />
      <span className="text-sm font-bold text-slate-800">Upload prescription photo or PDF</span>
      <span className="text-xs text-slate-500">Tap to take a photo or choose a file · up to 4 MB</span>
      <input aria-label="Prescription image" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" capture="environment" disabled={busy || !consent} onChange={e => void upload(e.target.files?.[0])} className="sr-only" />
    </label> : <div className="flex gap-3 items-center rounded-xl border border-slate-200 p-2">
      {isPdf ? <div className="h-20 w-20 flex items-center justify-center rounded-lg bg-slate-100"><FileText className="size-8 text-slate-500" /></div> : <img src={image} alt="Uploaded prescription" className="h-20 w-20 object-cover rounded-lg border border-border" />}
      <span className="text-xs break-all flex-1">{filename}</span>
      <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => { invalidate(); setImage(undefined); setFilename(''); }}><X />Remove</Button>
    </div>}
    <div className="relative">
      <textarea aria-label="Prescription medicine details" rows={2} maxLength={12000} disabled={busy} value={text} onChange={e => { invalidate(); setText(e.target.value); }} placeholder="Or type what is written, e.g. Amoxicillin 500mg caps, 1×3 for 5 days, 15 caps" className="w-full rounded-xl border border-input bg-background p-3 pr-12 text-sm" />
      <button type="button" aria-label={listening ? 'Stop' : 'Speak'} disabled={!consent || busy} onClick={startVoice} className={`absolute right-2 top-2 h-8 w-8 rounded-full flex items-center justify-center ${listening ? 'bg-red-600 text-white animate-pulse' : 'bg-slate-100 text-slate-600 hover:bg-blue-100'} disabled:opacity-40`}>{listening ? <Square className="size-4" /> : <Mic className="size-4" />}</button>
    </div>
    <Button type="button" className="w-full" disabled={busy || !consent || !branchId || (!text.trim() && !image)} onClick={() => void submit()}><ScanLine />{busy ? 'Analyzing…' : 'Analyze'}</Button>
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    {result && <div className="space-y-3 rounded-xl border border-slate-200 p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">What Covlo read</p>
      <p className="text-xs whitespace-pre-wrap text-slate-700">{result.analysis.transcription}</p>
      {result.analysis.warnings.map((w, i) => <p key={i} className="text-xs text-amber-700 flex gap-1.5"><AlertTriangle className="size-3.5 shrink-0 mt-0.5" />{w}</p>)}
      {result.analysis.medicines.map((m, i) => {
        const product = result.catalogue.find(p => p.id === m.product_id); const r = review[i];
        if (!r) return null;
        return <div key={i} className="rounded-lg bg-slate-50 p-2.5 space-y-2">
          <label className="flex gap-2 text-sm"><input type="checkbox" aria-label={`Approve ${m.written_name}`} checked={r.selected} disabled={!product || product.stock <= 0} onChange={e => setReview({ ...review, [i]: { ...r, selected: e.target.checked } })} /><span className="flex-1"><span className="font-semibold">{m.written_name}</span><span className={`block text-xs ${product ? (product.stock > 0 ? 'text-emerald-700' : 'text-red-600') : 'text-amber-700'}`}>{product ? <>{product.stock > 0 && <CheckCircle2 className="inline size-3 mr-1" />}{product.name} {product.strength ?? ''} · In stock: {product.stock}</> : 'Uncertain or not in your catalogue — choose manually below'}</span></span></label>
          <div className="grid grid-cols-[90px_1fr] gap-2">
            <input aria-label={`Reviewed quantity ${i + 1}`} type="number" min="1" max={product?.stock || undefined} value={r.quantity} onChange={e => setReview({ ...review, [i]: { ...r, quantity: e.target.value } })} className="min-w-0 rounded-md border border-input bg-background p-2 text-xs" placeholder="Quantity" />
            <input aria-label={`Reviewed dosage ${i + 1}`} value={r.instructions} onChange={e => setReview({ ...review, [i]: { ...r, instructions: e.target.value } })} className="min-w-0 rounded-md border border-input bg-background p-2 text-xs" placeholder="Verify written dosage" />
          </div>
        </div>;
      })}
      <Button type="button" size="sm" className="w-full" disabled={!approved.length} onClick={() => { onApply(approved); setResult(null); setReview({}); }}>Use reviewed medicines ({approved.length})</Button>
    </div>}
  </section>;
}
