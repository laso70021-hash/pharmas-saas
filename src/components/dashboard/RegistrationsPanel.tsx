import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Layers, Building2, Truck, Search, Check, X, CalendarPlus, FileText, ExternalLink, CalendarClock, AlertTriangle } from 'lucide-react';
import { PharmacyService } from '@/lib/pharmacy-service';
import { formatNumber, formatDateDeterministic } from '@/lib/utils';
import { STATUS_LABELS, TRIAL_DAYS, daysLeft, extendEnd, isExpiringSoon, paymentMethodLabel, serviceEndsAt, type AccountStatus } from '@/lib/billing';
import type { BusinessRegistration } from '@/lib/pharmacy-types';

export const REGISTRATIONS_QUERY_KEY = ['admin-registrations'] as const;

export function useRegistrations(enabled = true) {
  return useQuery({
    queryKey: REGISTRATIONS_QUERY_KEY,
    queryFn: () => PharmacyService.getRegistrations(),
    enabled,
  });
}

const TABS: { id: 'needs-action' | 'expiring' | AccountStatus | 'all'; label: string }[] = [
  { id: 'needs-action', label: 'Needs action' },
  { id: 'expiring', label: 'Expiring soon' },
  { id: 'pending', label: 'Pending' },
  { id: 'trial', label: 'Trial' },
  { id: 'active', label: 'Active' },
  { id: 'expired', label: 'Expired' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'all', label: 'All' },
];

const statusBadge: Record<AccountStatus, string> = {
  pending: 'bg-amber-100 text-amber-800',
  trial: 'bg-blue-100 text-blue-800',
  active: 'bg-emerald-100 text-emerald-800',
  expired: 'bg-rose-100 text-rose-800',
  suspended: 'bg-slate-200 text-slate-700',
  rejected: 'bg-rose-100 text-rose-800',
};

export function needsAction(r: BusinessRegistration): boolean {
  return r.effective_status === 'pending' || r.payments.some((p) => p.status === 'pending');
}

export function RegistrationsPanel() {
  const queryClient = useQueryClient();
  const { data: registrations = [], isLoading } = useRegistrations();
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('needs-action');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [changingPlan, setChangingPlan] = useState<string | null>(null);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: registrations.length, 'needs-action': 0 };
    for (const r of registrations) {
      c[r.effective_status] = (c[r.effective_status] || 0) + 1;
      if (needsAction(r)) c['needs-action'] = (c['needs-action'] || 0) + 1;
      if (isExpiringSoon(r)) c['expiring'] = (c['expiring'] || 0) + 1;
    }
    return c;
  }, [registrations]);

  const rows = registrations.filter((r) => {
    if (tab === 'needs-action' && !needsAction(r)) return false;
    if (tab === 'expiring' && !isExpiringSoon(r)) return false;
    if (tab !== 'all' && tab !== 'needs-action' && tab !== 'expiring' && r.effective_status !== tab) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [r.name, r.owner_name, r.email, r.phone, r.city].some((v) => (v || '').toLowerCase().includes(q));
  });

  const run = async (id: string, action: () => Promise<void>, success: string) => {
    setBusyId(id);
    try {
      await action();
      toast.success(success);
      await queryClient.invalidateQueries({ queryKey: REGISTRATIONS_QUERY_KEY });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusyId(null);
    }
  };

  const openReceipt = async (path: string) => {
    try {
      const url = await PharmacyService.getReceiptUrl(path);
      window.open(url, '_blank', 'noopener');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Receipt not available');
    }
  };

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-900">Registrations & Approvals</h2>
          <p className="text-xs text-slate-500">
            New pharmacies and suppliers, their plan and payments. Approve a {TRIAL_DAYS}-day trial, a paid month or a paid year — accounts expire automatically on their end date.
          </p>
        </div>
        <div className="relative sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, owner, phone, city…"
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-xs"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              tab === t.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {t.label} <span className="opacity-70">({counts[t.id] || 0})</span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-xs text-slate-500">Loading registrations…</div>
      ) : rows.length === 0 ? (
        <div className="p-8 text-center text-xs text-slate-500 bg-slate-50 rounded-xl">Nothing here right now.</div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const TypeIcon = r.business_type === 'supplier' ? Truck : Building2;
            const busy = busyId === r.id;
            const pendingPayments = r.payments.filter((p) => p.status === 'pending');
            return (
              <div key={r.id} className="rounded-2xl border border-slate-200 p-4 space-y-3">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                      <TypeIcon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-extrabold text-sm text-slate-900">{r.name}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                          {r.business_type === 'supplier' ? 'Supplier' : 'Pharmacy'}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${statusBadge[r.effective_status]}`}>
                          {STATUS_LABELS[r.effective_status]}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        {r.owner_name || 'Owner'} · {r.email || '—'} · {r.phone || '—'} · {[r.address, r.city].filter(Boolean).join(', ')}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Licence: {r.registration_number || '—'} · TIN: {r.tax_number || '—'} · Registered {formatDateDeterministic(r.created_at)}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs lg:text-right shrink-0">
                    <div className="font-bold text-slate-900">
                      {r.plan_name} · {r.yearly_price ? `TZS ${formatNumber(r.yearly_price)}/yr` : 'Custom price'}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {r.billing_choice === 'trial' ? `${TRIAL_DAYS}-day free trial` : r.billing_choice === 'monthly' ? `Pays monthly · TZS ${formatNumber(r.monthly_price)}/mo` : 'Pays yearly'}
                      {(r.effective_status === 'trial' || r.effective_status === 'active') && serviceEndsAt(r) && ` · ${daysLeft(serviceEndsAt(r))} days left`}
                    </div>
                    {serviceEndsAt(r) && r.effective_status !== 'pending' && (
                      <div className="text-[11px] text-slate-500">
                        {r.subscription_starts_at || r.approved_at ? `${formatDateDeterministic((r.subscription_starts_at || r.approved_at)!)} → ` : 'Ends '}
                        {formatDateDeterministic(serviceEndsAt(r)!)}
                      </div>
                    )}
                    {isExpiringSoon(r) && (
                      <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800">
                        <AlertTriangle className="w-3 h-3" /> Expires in {daysLeft(serviceEndsAt(r))} day(s)
                      </div>
                    )}
                    <div className="hidden">
                    </div>
                  </div>
                </div>

                {pendingPayments.map((p) => (
                  <div key={p.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs">
                    <div className="flex items-center gap-2 text-amber-900">
                      <FileText className="w-4 h-4" />
                      <span>
                        <b>Payment to verify:</b> TZS {formatNumber(p.amount_tzs)} · {paymentMethodLabel(p.method)} · Ref: <b>{p.reference || '—'}</b> · {formatDateDeterministic(p.created_at)}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      {p.receipt_path && (
                        <button onClick={() => void openReceipt(p.receipt_path!)} className="px-2.5 py-1 rounded-lg bg-white border border-amber-300 font-bold text-amber-900 flex items-center gap-1">
                          <ExternalLink className="w-3 h-3" /> Receipt
                        </button>
                      )}
                      <button
                        disabled={busy}
                        onClick={() => void run(r.id, () => PharmacyService.reviewPayment(p.id, 'confirm'), 'Payment confirmed — account active for 12 months.')}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold disabled:opacity-60"
                      >
                        Confirm payment
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => {
                          const note = window.prompt('Why is this payment rejected?') ?? '';
                          if (!note) return;
                          void run(r.id, () => PharmacyService.reviewPayment(p.id, 'reject', note), 'Payment rejected.');
                        }}
                        className="px-2.5 py-1 rounded-lg bg-white border border-rose-200 text-rose-700 font-bold disabled:opacity-60"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}

                <div className="flex flex-wrap gap-2">
                  {(r.effective_status === 'pending' || r.effective_status === 'rejected') && (
                    <button
                      disabled={busy}
                      onClick={() =>
                        void run(
                          r.id,
                          () => PharmacyService.reviewRegistration(r.id, 'approve'),
                          r.billing_choice === 'trial' ? `Approved — ${TRIAL_DAYS}-day trial started.` : 'Approved — paid year started.',
                        )
                      }
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1 disabled:opacity-60"
                    >
                      <Check className="w-3.5 h-3.5" /> Approve{r.billing_choice === 'trial' ? ' & start trial' : ''}
                    </button>
                  )}
                  {r.effective_status === 'pending' && (
                    <button
                      disabled={busy}
                      onClick={() => {
                        const note = window.prompt('Reason for rejecting this registration (shown to the applicant):') ?? '';
                        if (!note) return;
                        void run(r.id, () => PharmacyService.reviewRegistration(r.id, 'reject', note), 'Registration rejected.');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-white border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-1 disabled:opacity-60"
                    >
                      <X className="w-3.5 h-3.5" /> Reject
                    </button>
                  )}
                  {(r.effective_status === 'trial' || (r.effective_status === 'expired' && r.billing_choice === 'trial')) && (
                    <button
                      disabled={busy}
                      onClick={() => void run(r.id, () => PharmacyService.extendTrial(r.id, TRIAL_DAYS), `Trial extended by ${TRIAL_DAYS} days.`)}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1 disabled:opacity-60"
                    >
                      <CalendarPlus className="w-3.5 h-3.5" /> Extend trial +{TRIAL_DAYS} days
                    </button>
                  )}
                  {r.effective_status !== 'rejected' && (
                    <>
                      <button
                        disabled={busy}
                        onClick={() => void run(r.id, () => PharmacyService.setSubscription(r.id, 'monthly', r.effective_status === 'active' && r.subscription_starts_at ? new Date(r.subscription_starts_at) : new Date(), extendEnd(r.effective_status === 'active' ? r.subscription_ends_at : null, 'monthly')), 'Paid month added.')}
                        className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center gap-1 disabled:opacity-60"
                      >
                        <CalendarPlus className="w-3.5 h-3.5" /> +1 month paid
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => void run(r.id, () => PharmacyService.setSubscription(r.id, 'annual', r.effective_status === 'active' && r.subscription_starts_at ? new Date(r.subscription_starts_at) : new Date(), extendEnd(r.effective_status === 'active' ? r.subscription_ends_at : null, 'annual')), 'Paid year added.')}
                        className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center gap-1 disabled:opacity-60"
                      >
                        <CalendarPlus className="w-3.5 h-3.5" /> +1 year paid
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => setEditing(editing === r.id ? null : r.id)}
                        className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1 disabled:opacity-60"
                      >
                        <CalendarClock className="w-3.5 h-3.5" /> Set dates
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => setChangingPlan(changingPlan === r.id ? null : r.id)}
                        className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold flex items-center gap-1 disabled:opacity-60"
                      >
                        <Layers className="w-3.5 h-3.5" /> Change plan
                      </button>
                    </>
                  )}
                  {r.review_note && <span className="text-[11px] text-slate-500 self-center">Note: {r.review_note}</span>}
                </div>
                {changingPlan === r.id && (
                  <ChangePlanForm
                    registration={r}
                    busy={busy}
                    onCancel={() => setChangingPlan(null)}
                    onSave={(planId, label) => void run(r.id, async () => { await PharmacyService.changePlan(r.id, planId); setChangingPlan(null); }, `Plan changed to ${label}.`)}
                  />
                )}
                {editing === r.id && (
                  <SubscriptionDatesForm
                    registration={r}
                    busy={busy}
                    onCancel={() => setEditing(null)}
                    onSave={(cycle, start, end) => void run(r.id, async () => { await PharmacyService.setSubscription(r.id, cycle, start, end); setEditing(null); }, 'Service dates saved.')}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ChangePlanForm({ registration: r, busy, onCancel, onSave }: { registration: BusinessRegistration; busy: boolean; onCancel: () => void; onSave: (planId: string, label: string) => void }) {
  const { data: plans = [] } = useQuery({ queryKey: ['plans'], queryFn: () => PharmacyService.getPlans() });
  const [planId, setPlanId] = useState(r.plan_id ?? '');
  const chosen = plans.find((p) => p.id === planId);
  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 space-y-3">
      <div className="text-xs font-bold text-slate-900">Subscription plan for {r.name} <span className="font-normal text-slate-500">— current: {r.plan_name}. Service dates stay the same.</span></div>
      <select value={planId} onChange={(e) => setPlanId(e.target.value)} className="w-full sm:w-auto px-2 py-1.5 rounded-lg border border-slate-300 text-xs bg-white">
        <option value="" disabled>Choose a plan</option>
        {plans.map((p) => <option key={p.id} value={p.id}>{p.name} · TZS {formatNumber(p.price_tzs_monthly)}/mo · TZS {formatNumber(p.price_tzs_annual)}/yr</option>)}
      </select>
      <div className="flex gap-2">
        <button disabled={busy || !chosen || planId === r.plan_id} onClick={() => chosen && onSave(chosen.id, chosen.name)} className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold disabled:opacity-60">Save plan</button>
        <button onClick={onCancel} className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-bold">Cancel</button>
      </div>
    </div>
  );
}

const toInput = (d: Date) => d.toISOString().slice(0, 10);

function SubscriptionDatesForm({ registration: r, busy, onCancel, onSave }: {
  registration: BusinessRegistration;
  busy: boolean;
  onCancel: () => void;
  onSave: (cycle: 'trial' | 'monthly' | 'annual', start: Date, end: Date) => void;
}) {
  const initialStart = r.subscription_starts_at || r.approved_at || new Date().toISOString();
  const initialEnd = serviceEndsAt(r) || extendEnd(null, 'monthly').toISOString();
  const [cycle, setCycle] = useState<'trial' | 'monthly' | 'annual'>(r.billing_choice);
  const [start, setStart] = useState(toInput(new Date(initialStart)));
  const [end, setEnd] = useState(toInput(new Date(initialEnd)));
  const pickCycle = (c: typeof cycle) => {
    setCycle(c);
    const s = new Date(start);
    const e = new Date(s);
    if (c === 'trial') e.setDate(e.getDate() + TRIAL_DAYS); else if (c === 'monthly') e.setMonth(e.getMonth() + 1); else e.setFullYear(e.getFullYear() + 1);
    setEnd(toInput(e));
  };
  const invalid = !start || !end || new Date(end) <= new Date(start);
  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 space-y-3">
      <div className="text-xs font-bold text-slate-900">Service period for {r.name}</div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <label className="text-[11px] font-bold text-slate-600">Type
          <select value={cycle} onChange={(e) => pickCycle(e.target.value as typeof cycle)} className="mt-1 w-full px-2 py-1.5 rounded-lg border border-slate-300 text-xs bg-white">
            <option value="trial">Free trial</option>
            <option value="monthly">Paid monthly</option>
            <option value="annual">Paid yearly</option>
          </select>
        </label>
        <label className="text-[11px] font-bold text-slate-600">Starts
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="mt-1 w-full px-2 py-1.5 rounded-lg border border-slate-300 text-xs bg-white" />
        </label>
        <label className="text-[11px] font-bold text-slate-600">Ends (account expires after this day)
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="mt-1 w-full px-2 py-1.5 rounded-lg border border-slate-300 text-xs bg-white" />
        </label>
      </div>
      {invalid && <div className="text-[11px] text-rose-700">The end date must be after the start date.</div>}
      <div className="flex gap-2">
        <button
          disabled={busy || invalid}
          onClick={() => onSave(cycle, new Date(`${start}T00:00:00`), new Date(`${end}T23:59:59`))}
          className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold disabled:opacity-60"
        >
          Save & activate
        </button>
        <button onClick={onCancel} className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-bold">Cancel</button>
      </div>
    </div>
  );
}
