import { useState, type FormEvent } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { PharmacyService } from "@/lib/pharmacy-service";
import { formatNumber } from "@/lib/utils";
import { PAYMENT_METHODS, cyclePrice, isCustomPriced, yearlyPrice, type PaidCycle } from "@/lib/billing";
import type { SubscriptionPlan } from "@/lib/pharmacy-types";

const inputClass =
  "w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white";
const labelClass = "block text-xs font-bold text-slate-700 uppercase mb-1";

interface Props {
  userId: string;
  pharmacyId: string;
  plans: SubscriptionPlan[];
  currentPlanSlug: string;
  onSubmitted: () => void;
}

/** Monthly or yearly payment proof: mobile-money / bank reference and/or an uploaded receipt. */
export function PaymentProofForm({ userId, pharmacyId, plans, currentPlanSlug, onSubmitted }: Props) {
  const payable = plans.filter((p) => !isCustomPriced(p));
  const [planSlug, setPlanSlug] = useState(
    payable.some((p) => p.slug === currentPlanSlug) ? currentPlanSlug : payable[0]?.slug || currentPlanSlug,
  );
  const [method, setMethod] = useState<string>("mpesa");
  const [reference, setReference] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [cycle, setCycle] = useState<PaidCycle>("annual");

  const plan = payable.find((p) => p.slug === planSlug);
  const amount = plan ? cyclePrice(plan, cycle) : 0;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!reference.trim() && !file) {
      toast.error("Add the transaction reference or attach the receipt.");
      return;
    }
    setBusy(true);
    try {
      await PharmacyService.submitPayment({ userId, pharmacyId, planSlug, method, reference, file, periodMonths: cycle === "monthly" ? 1 : 12 });
      toast.success("Payment sent for verification.");
      setReference("");
      setFile(null);
      onSubmitted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Payment could not be sent");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Billing period">
        {(["monthly", "annual"] as const).map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={cycle === c}
            onClick={() => setCycle(c)}
            className={`rounded-xl border px-3 py-2.5 text-left text-xs ${cycle === c ? "border-blue-600 bg-blue-50 text-blue-800" : "border-slate-300 bg-white text-slate-700"}`}
          >
            <span className="block font-bold">{c === "monthly" ? "Pay monthly" : "Pay yearly"}</span>
            <span className="block opacity-80">{c === "monthly" ? "Service runs 1 month from approval" : "Service runs 12 months · best value"}</span>
          </button>
        ))}
      </div>
      <p className="text-[11px] text-slate-500">Paying ends any free trial — your paid period starts when the payment is confirmed.</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className={labelClass} htmlFor="pp-plan">Plan</label>
          <select id="pp-plan" className={inputClass} value={planSlug} onChange={(e) => setPlanSlug(e.target.value)}>
            {payable.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.name} — TZS {formatNumber(cycle === "monthly" ? p.price_tzs_monthly : yearlyPrice(p))}/{cycle === "monthly" ? "mo" : "yr"}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="pp-method">Payment method</label>
          <select id="pp-method" className={inputClass} value={method} onChange={(e) => setMethod(e.target.value)}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="pp-ref">Transaction reference</label>
          <input id="pp-ref" className={inputClass} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. QK72HD91LP" />
        </div>
      </div>
      <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer bg-white border border-dashed border-slate-300 rounded-xl px-3 py-3">
        <Upload className="w-4 h-4 text-blue-600" />
        <span className="truncate">{file ? file.name : "Attach receipt or screenshot (image or PDF, max 10 MB)"}</span>
        <input type="file" accept="image/*,application/pdf" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </label>
      <button
        type="submit"
        disabled={busy || !plan}
        className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold text-sm"
      >
        {busy ? "Sending…" : `Send payment of TZS ${formatNumber(amount)} for verification`}
      </button>
    </form>
  );
}
