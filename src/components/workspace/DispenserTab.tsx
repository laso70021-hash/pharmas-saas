import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, Check, X, FileText } from 'lucide-react';
import type { Workspace } from '@/lib/pharmacy-types';
import { PrescriptionService, WorkspaceService, type Prescription, type RxItem } from '@/lib/pharmacy-service';
import { can, isReadOnly } from '@/lib/workspace';
import { formatNumber, formatDateDeterministic } from '@/lib/utils';
import { Modal, Field, Empty, SectionHeader, inputCls, primaryBtn, ghostBtn, cardCls, errorText } from './ws-ui';
import { PrescriptionAssistant } from './PrescriptionAssistant';
import { PlanFeatureGate } from './PlanFeatureGate';

const STATUS = { pending: 'bg-amber-50 text-amber-700', dispensed: 'bg-emerald-50 text-emerald-700', rejected: 'bg-rose-50 text-rose-700' } as const;
const LABEL = { pending: 'Waiting', dispensed: 'Dispensed', rejected: 'Rejected' } as const;

export function DispenserTab({ ws, userId }: { ws: Workspace; userId: string }) {
  const pid = ws.id;
  const qc = useQueryClient();
  const { data: list = [], isLoading } = useQuery({ queryKey: ['ws', pid, 'rx'], queryFn: () => PrescriptionService.list(pid) });
  const { data: products = [] } = useQuery({ queryKey: ['ws', pid, 'products'], queryFn: () => WorkspaceService.getProducts(pid) });
  const { data: branches = [] } = useQuery({ queryKey: ['ws', pid, 'branches'], queryFn: () => WorkspaceService.getBranches(pid) });
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [method, setMethod] = useState<Record<string, string>>({});
  const readOnly = isReadOnly(ws.status, ws.role);
  const canDispense = ['owner', 'admin', 'manager', 'pharmacist'].includes(ws.role);
  const price = new Map(products.map((p) => [p.id, p.selling_price]));
  const branchName = new Map(branches.map((b) => [b.id, b.name]));
  const shown = filter === 'pending' ? list.filter((r) => r.status === 'pending') : list;

  const act = async (rx: Prescription, d: 'dispense' | 'reject') => {
    setBusy(rx.id);
    try {
      await PrescriptionService.review(rx.id, d, method[rx.id] || 'cash', '');
      toast.success(d === 'dispense' ? 'Dispensed and recorded as a sale' : 'Prescription rejected');
      void qc.invalidateQueries({ queryKey: ['ws', pid] });
    } catch (err) { toast.error(errorText(err)); } finally { setBusy(null); }
  };

  return (
    <div className="space-y-4">
      <SectionHeader title="Prescription queue" subtitle="Log prescriptions as patients arrive; a pharmacist checks and dispenses — stock and sales update automatically."
        action={<div className="flex gap-2">
          <button className={ghostBtn} onClick={() => setFilter(filter === 'pending' ? 'all' : 'pending')}>{filter === 'pending' ? 'Show all' : 'Waiting only'}</button>
          <button className={primaryBtn} disabled={readOnly || !can(ws.role, 'sell', ws.status)} onClick={() => setAdding(true)}><Plus className="w-3.5 h-3.5" /> New prescription</button>
        </div>} />
      {isLoading ? <Empty>Loading…</Empty> : shown.length === 0 ? <Empty>{filter === 'pending' ? 'No patients waiting.' : 'No prescriptions yet.'}</Empty> : shown.map((rx) => {
        const total = rx.items.reduce((a, i) => a + (price.get(i.product_id) || 0) * i.quantity, 0);
        return (
          <div key={rx.id} className={`${cardCls} p-4 space-y-3`}>
            <div className="flex flex-wrap justify-between gap-2">
              <div>
                <div className="font-black text-sm flex items-center gap-2"><FileText className="w-4 h-4 text-blue-600" />{rx.patient_name}{rx.patient_phone && <span className="text-xs font-semibold text-slate-500">· {rx.patient_phone}</span>}</div>
                <div className="text-[11px] text-slate-500">{formatDateDeterministic(rx.created_at)} · {rx.branch_id ? branchName.get(rx.branch_id) : '—'}{rx.prescriber && ` · Dr. ${rx.prescriber}`}</div>
              </div>
              <span className={`text-[11px] font-bold px-2.5 py-1 h-fit rounded-full ${STATUS[rx.status]}`}>{LABEL[rx.status]}</span>
            </div>
            <ul className="text-xs divide-y divide-slate-100">{rx.items.map((i, k) => (
              <li key={k} className="py-1.5 flex justify-between gap-2"><span><b>{i.quantity} × {i.name}</b>{i.instructions && <span className="text-slate-500"> — {i.instructions}</span>}</span><span>{formatNumber((price.get(i.product_id) || 0) * i.quantity)}</span></li>))}</ul>
            {rx.notes && <p className="text-xs text-slate-600">Notes: {rx.notes}</p>}
            {rx.status === 'pending' && canDispense && (
              <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                <span className="text-sm font-black">TZS {formatNumber(total)}</span>
                <select aria-label="Payment" className={`${inputCls} sm:w-40`} value={method[rx.id] || 'cash'} onChange={(e) => setMethod({ ...method, [rx.id]: e.target.value })}>
                  <option value="cash">Cash</option><option value="mpesa">M-Pesa</option><option value="tigopesa">Tigo Pesa</option><option value="airtel">Airtel</option><option value="card">Card</option>
                </select>
                <button className={primaryBtn} disabled={busy === rx.id || readOnly} onClick={() => act(rx, 'dispense')}><Check className="w-3.5 h-3.5" /> Dispense & charge</button>
                <button className={ghostBtn} disabled={busy === rx.id || readOnly} onClick={() => act(rx, 'reject')}><X className="w-3.5 h-3.5" /> Reject</button>
              </div>)}
          </div>);
      })}
      {adding && <NewRx ws={ws} pharmacyId={pid} products={products.filter((p) => p.is_active)} branches={branches.filter((b) => b.is_active)}
        onClose={() => setAdding(false)}
        onSave={async (input) => { await PrescriptionService.add(pid, userId, input); toast.success('Added to the queue'); setAdding(false); void qc.invalidateQueries({ queryKey: ['ws', pid, 'rx'] }); }} />}
    </div>
  );
}

function NewRx({ ws, pharmacyId, products, branches, onClose, onSave }: {
  ws: Workspace;
  pharmacyId: string;
  products: { id: string; name: string; strength: string; is_prescription_required: boolean }[]; branches: { id: string; name: string; is_main: boolean }[];
  onClose: () => void; onSave: (i: { branch_id: string; patient_name: string; patient_phone: string; prescriber: string; notes: string; items: RxItem[] }) => Promise<void>;
}) {
  const [f, setF] = useState({ branch_id: branches.find((b) => b.is_main)?.id || branches[0]?.id || '', patient_name: '', patient_phone: '', prescriber: '', notes: '' });
  const [items, setItems] = useState<RxItem[]>([{ product_id: '', name: '', quantity: 1, instructions: '' }]);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'scan' | 'manual'>('scan');
  const setItem = (k: number, patch: Partial<RxItem>) => setItems(items.map((it, i) => (i === k ? { ...it, ...patch } : it)));
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const valid = items.filter((i) => i.product_id && i.quantity > 0);
    if (!valid.length) { toast.error('Add at least one medicine'); return; }
    setBusy(true);
    try { await onSave({ ...f, items: valid }); } catch (err) { toast.error(errorText(err)); } finally { setBusy(false); }
  };
  return (
    <Modal title="New prescription" onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-3">
        <div role="tablist" aria-label="How to add the prescription" className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
          {([['scan', 'Upload & let Covlo read'], ['manual', 'Fill in manually']] as const).map(([k, label]) => <button key={k} type="button" role="tab" aria-selected={mode === k} onClick={() => setMode(k)} className={`rounded-lg py-2 text-sm font-bold ${mode === k ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}>{label}</button>)}
        </div>
        <Field label="Branch"><select required className={inputCls} value={f.branch_id} onChange={(e) => setF({ ...f, branch_id: e.target.value })}>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
        {mode === 'scan' && <PlanFeatureGate ws={ws} feature="prescription"><PrescriptionAssistant pharmacyId={pharmacyId} branchId={f.branch_id} onDetails={(d) => setF((cur) => ({ ...cur, patient_name: cur.patient_name || d.patient_name || '', prescriber: cur.prescriber || d.prescriber || '', notes: cur.notes || [d.prescription_date ? `Prescribed ${d.prescription_date}` : '', d.notes ?? ''].filter(Boolean).join(' · ') }))} onApply={(approved) => setItems((cur) => [...cur.filter(i => i.product_id), ...approved])} /></PlanFeatureGate>}
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500 pt-2">{mode === 'scan' ? 'Check the details Covlo filled in' : 'Prescription details'}</p>
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="Patient name"><input required className={inputCls} value={f.patient_name} onChange={(e) => setF({ ...f, patient_name: e.target.value })} /></Field>
          <Field label="Phone"><input className={inputCls} value={f.patient_phone} onChange={(e) => setF({ ...f, patient_phone: e.target.value })} /></Field>
          <Field label="Prescribing doctor"><input className={inputCls} value={f.prescriber} onChange={(e) => setF({ ...f, prescriber: e.target.value })} /></Field>
        </div>
        <div className="space-y-2">
          {items.map((it, k) => (
            <div key={k} className="grid grid-cols-[1fr_70px_1fr_auto] gap-2 items-center rounded-xl border border-slate-200 p-2">
              <select aria-label="Medicine" className={inputCls} value={it.product_id} onChange={(e) => { const p = products.find((x) => x.id === e.target.value); setItem(k, { product_id: e.target.value, name: p ? `${p.name} ${p.strength}`.trim() : '' }); }}>
                <option value="">Medicine…</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name} {p.strength}{p.is_prescription_required ? ' (Rx)' : ''}</option>)}
              </select>
              <input aria-label="Quantity" type="number" min={1} className={inputCls} value={it.quantity} onChange={(e) => setItem(k, { quantity: Number(e.target.value) })} />
              <input aria-label="Dosage" className={inputCls} placeholder="e.g. 1 tab 3× daily, 5 days" value={it.instructions} onChange={(e) => setItem(k, { instructions: e.target.value })} />
              <button type="button" aria-label="Remove" onClick={() => setItems(items.filter((_, i) => i !== k))}><Trash2 className="w-4 h-4 text-slate-400" /></button>
            </div>))}
          <button type="button" className={ghostBtn} onClick={() => setItems([...items, { product_id: '', name: '', quantity: 1, instructions: '' }])}><Plus className="w-3.5 h-3.5" /> Add medicine</button>
        </div>
        <Field label="Notes (allergies, diagnosis…)"><textarea className={inputCls} rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
        <button className={`${primaryBtn} w-full justify-center`} disabled={busy}>{busy ? 'Saving…' : 'Add to queue'}</button>
      </form>
    </Modal>
  );
}
