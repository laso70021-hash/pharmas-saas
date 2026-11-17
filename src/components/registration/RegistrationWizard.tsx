import { Button } from '@/components/ui/button';
import { optimizeLogo, fileToDataUrl } from '@/lib/image-resize';
import { useMemo, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, Truck, Check, ArrowLeft, ArrowRight, Sparkles, Upload } from "lucide-react";
import { PharmacyService } from "@/lib/pharmacy-service";
import { formatNumber } from "@/lib/utils";
import {
  PAYMENT_METHODS,
  TRIAL_DAYS,
  isCustomPriced,
  offersTrial,
  resolveBillingChoice,
  undiscountedYearlyPrice,
  yearlyPrice,
  type BillingChoice,
} from "@/lib/billing";
import type { BusinessType, RegistrationInput } from "@/lib/pharmacy-types";

export interface AccountFields {
  fullName: string;
  email: string;
  password: string;
}

interface Props {
  /** "signup" also collects email + password; "complete" is for a signed-in account without a business yet. */
  mode: "signup" | "complete";
  initialPlan?: string | undefined;
  defaultName?: string | undefined;
  busy?: boolean;
  onSubmit: (data: { registration: RegistrationInput; account: AccountFields; receipt: File | null; logo: string | null }) => void | Promise<void>;
}

const inputClass =
  "w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white";
const labelClass = "block text-xs font-bold text-slate-700 uppercase mb-1";

const STEPS = ["Account type", "Plan", "Details", "Review & submit"] as const;

export function RegistrationWizard({ mode, initialPlan, defaultName, busy, onSubmit }: Props) {
  const { data: plans = [], isLoading: plansLoading } = useQuery({
    queryKey: ["subscription-plans"],
    queryFn: () => PharmacyService.getPlans(),
  });

  const [step, setStep] = useState(0);
  const [businessType, setBusinessType] = useState<BusinessType>("pharmacy");
  const [planSlug, setPlanSlug] = useState(initialPlan || "starter");
  const [pickPlan, setPickPlan] = useState(!initialPlan);
  const [billing, setBilling] = useState<BillingChoice>("trial");
  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState(defaultName || "");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("Dar es Salaam");
  const [address, setAddress] = useState("");
  const [regNumber, setRegNumber] = useState("");
  const [tin, setTin] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [payMethod, setPayMethod] = useState<string>("mpesa");
  const [payRef, setPayRef] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [logoError, setLogoError] = useState('');
  const [logoBusy, setLogoBusy] = useState(false);
  const [receipt, setReceipt] = useState<File | null>(null);

  const plan = useMemo(() => plans.find((p) => p.slug === planSlug) || plans[0], [plans, planSlug]);
  const billingChoice = resolveBillingChoice(plan?.slug || planSlug, billing);
  const amount = plan ? yearlyPrice(plan) : 0;
  const customPriced = plan ? isCustomPriced(plan) : false;

  const next = (e?: FormEvent) => {
    e?.preventDefault();
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!plan) return;
    const registration: RegistrationInput = {
      business_type: businessType,
      plan_slug: plan.slug,
      billing_choice: billingChoice === 'trial' ? 'trial' : 'annual',
      business_name: businessName.trim(),
      owner_name: ownerName.trim(),
      phone: phone.trim(),
      city: city.trim(),
      address: address.trim(),
      registration_number: regNumber.trim(),
      tax_number: tin.trim(),
      ...(billingChoice === "annual" && payRef.trim()
        ? { payment_method: payMethod, payment_reference: payRef.trim() }
        : {}),
    };
    await onSubmit({ registration, account: { fullName: ownerName.trim(), email, password }, receipt, logo });
  };

  return (
    <div className="space-y-5">
      {/* Progress */}
      <ol className="flex items-center gap-2 text-[11px] font-bold">
        {STEPS.map((label, i) => (
          <li key={label} className="flex items-center gap-2 flex-1 min-w-0">
            <span
              className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center ${
                i < step ? "bg-emerald-500 text-white" : i === step ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400"
              }`}
            >
              {i < step ? <Check className="w-3.5 h-3.5" /> : i + 1}
            </span>
            <span className={`truncate hidden sm:inline ${i === step ? "text-slate-900" : "text-slate-400"}`}>{label}</span>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <form onSubmit={next} className="space-y-4">
          <p className="text-sm text-slate-600">What kind of business are you registering?</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(
              [
                { value: "pharmacy", title: "Pharmacy Owner", desc: "Run your pharmacy, branches, staff, stock and sales.", Icon: Building2 },
                { value: "supplier", title: "Wholesale Supplier", desc: "Sell medicines to pharmacies and manage their orders.", Icon: Truck },
              ] as const
            ).map(({ value, title, desc, Icon }) => (
              <button
                type="button"
                key={value}
                onClick={() => setBusinessType(value)}
                className={`text-left p-4 rounded-2xl border-2 transition-all ${
                  businessType === value ? "border-blue-600 bg-blue-50/60 shadow-sm" : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center mb-2">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="font-extrabold text-sm text-slate-900">{title}</div>
                <div className="text-xs text-slate-500 mt-0.5">{desc}</div>
              </button>
            ))}
          </div>
          <p className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
            Pharmacists, cashiers and other staff don&apos;t register here — the pharmacy owner invites them to their team.
          </p>
          <button type="submit" className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm flex items-center justify-center gap-2">
            Continue <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      )}

      {step === 1 && (
        <form onSubmit={next} className="space-y-4">
          <p className="text-sm text-slate-600">Choose your plan. Every plan begins with a free {TRIAL_DAYS}-day trial, then is paid yearly.</p>
          {plansLoading ? (
            <div className="text-xs text-slate-500 p-6 text-center">Loading plans…</div>
          ) : !pickPlan && plan ? (
            <div className="p-4 rounded-2xl border-2 border-blue-600 bg-blue-50/60 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-blue-600 uppercase flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Selected plan</div>
                <div className="font-extrabold text-slate-900">{plan.name}</div>
                <div className="text-xs text-slate-500">
                  {isCustomPriced(plan) ? "Custom pricing" : `TZS ${formatNumber(plan.price_tzs_monthly)}/month · TZS ${formatNumber(amount)}/year`}
                </div>
              </div>
              <button type="button" onClick={() => setPickPlan(true)} className="text-xs font-bold text-blue-600 hover:underline shrink-0">Change plan</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {plans.map((p) => {
                const selected = p.slug === plan?.slug;
                const yearly = yearlyPrice(p);
                const saving = undiscountedYearlyPrice(p) - yearly;
                return (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => setPlanSlug(p.slug)}
                    className={`text-left p-4 rounded-2xl border-2 transition-all relative ${
                      selected ? "border-blue-600 bg-blue-50/60 shadow-sm" : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    {offersTrial(p.slug) && (
                      <span className="absolute top-3 right-3 bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {TRIAL_DAYS}-day free trial
                      </span>
                    )}
                    <div className="font-extrabold text-sm text-slate-900">{p.name}</div>
                    {isCustomPriced(p) ? (
                      <div className="text-lg font-black text-slate-900 mt-1">Custom pricing</div>
                    ) : (
                      <>
                        <div className="text-lg font-black text-slate-900 mt-1">
                          TZS {formatNumber(yearly)} <span className="text-xs font-semibold text-slate-500">/ year</span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          TZS {formatNumber(p.price_tzs_monthly)}/month
                          {saving > 0 && <span className="text-emerald-600 font-semibold"> · save TZS {formatNumber(saving)}</span>}
                        </div>
                      </>
                    )}
                    <ul className="mt-2 space-y-1">
                      {p.features.slice(0, 3).map((f) => (
                        <li key={f} className="text-[11px] text-slate-600 flex gap-1.5">
                          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> {f}
                        </li>
                      ))}
                    </ul>
                  </button>
                );
              })}
            </div>
          )}

          {plan && offersTrial(plan.slug) && (
            <div className="space-y-2">
              <div className={labelClass}>How do you want to start?</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label className={`p-3 rounded-xl border-2 cursor-pointer text-xs ${billing === "trial" ? "border-blue-600 bg-blue-50/60" : "border-slate-200"}`}>
                  <input type="radio" name="billing" className="sr-only" checked={billing === "trial"} onChange={() => setBilling("trial")} />
                  <div className="font-bold text-slate-900">Start {TRIAL_DAYS}-day free trial</div>
                  <div className="text-slate-500 mt-0.5">No payment now. After the trial, pay yearly to keep your account.</div>
                </label>
                <label className={`p-3 rounded-xl border-2 cursor-pointer text-xs ${billing === "annual" ? "border-blue-600 bg-blue-50/60" : "border-slate-200"}`}>
                  <input type="radio" name="billing" className="sr-only" checked={billing === "annual"} onChange={() => setBilling("annual")} />
                  <div className="font-bold text-slate-900">Pay yearly now</div>
                  <div className="text-slate-500 mt-0.5">TZS {formatNumber(amount)} for 12 months.</div>
                </label>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button type="button" onClick={back} className="px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm flex items-center gap-1">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <button type="submit" disabled={!plan} className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold text-sm flex items-center justify-center gap-2">
              Continue <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={next} className="space-y-3">
          <div>
            <label className={labelClass} htmlFor="bizName">{businessType === "supplier" ? "Company name" : "Pharmacy name"} *</label>
            <input id="bizName" required className={inputClass} value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder={businessType === "supplier" ? "e.g. Kilimanjaro Pharma Wholesale" : "e.g. Afya Bora Pharmacy"} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass} htmlFor="ownerName">Your full name *</label>
              <input id="ownerName" required className={inputClass} value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
            </div>
            <div>
              <label className={labelClass} htmlFor="phone">Phone *</label>
              <input id="phone" required type="tel" className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+255 7xx xxx xxx" />
            </div>
            <div>
              <label className={labelClass} htmlFor="city">City / Region *</label>
              <input id="city" required className={inputClass} value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div>
              <label className={labelClass} htmlFor="address">Street address</label>
              <input id="address" className={inputClass} value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <div>
              <label className={labelClass} htmlFor="reg">{businessType === "supplier" ? "Business licence no." : "Pharmacy Council licence no."}</label>
              <input id="reg" className={inputClass} value={regNumber} onChange={(e) => setRegNumber(e.target.value)} />
            </div>
            <div>
              <label className={labelClass} htmlFor="tin">TIN</label>
              <input id="tin" className={inputClass} value={tin} onChange={(e) => setTin(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <label className={labelClass}>Business logo (optional)</label>
            {logo && <img src={logo} alt="Business logo preview" className="h-20 w-40 object-contain" />}
            <Button variant="outline" asChild disabled={logoBusy}><label><Upload className="w-4 h-4" />{logoBusy ? 'Preparing…' : logo ? 'Change logo' : 'Upload logo'}
              <input aria-label="Registration business logo" type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={logoBusy} onChange={async e => {
                const file = e.target.files?.[0]; e.target.value = ''; if (!file) return; setLogoBusy(true); setLogoError('');
                try { setLogo(await fileToDataUrl(await optimizeLogo(file))); } catch (error) { setLogoError(error instanceof Error ? error.message : 'Could not read the logo.'); } finally { setLogoBusy(false); }
              }} />
            </label></Button>
            <p className="text-xs text-muted-foreground">PNG, JPEG or WebP · Maximum 2 MB</p>
            {logoError && <p role="alert" className="text-sm text-destructive">{logoError}</p>}
          </div>
          {mode === "signup" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
              <div>
                <label className={labelClass} htmlFor="email">Email address *</label>
                <input id="email" type="email" required className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@pharmacy.com" />
              </div>
              <div>
                <label className={labelClass} htmlFor="password">Password *</label>
                <input id="password" type="password" required minLength={6} className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={back} className="px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm flex items-center gap-1">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <button type="submit" className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm flex items-center justify-center gap-2">
              Continue <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      )}

      {step === 3 && plan && (
        <form onSubmit={submit} className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs space-y-1.5">
            <Row label="Business" value={`${businessName} (${businessType === "supplier" ? "Wholesale supplier" : "Pharmacy"})`} />
            <Row label="Contact" value={`${ownerName} · ${phone}`} />
            <Row label="Location" value={[address, city].filter(Boolean).join(", ")} />
            <Row label="Plan" value={plan.name} />
            <Row
              label="Billing"
              value={
                billingChoice === "trial"
                  ? `Free ${TRIAL_DAYS}-day trial, then TZS ${formatNumber(amount)} / year`
                  : customPriced
                    ? "Custom yearly price — our team will contact you"
                    : `TZS ${formatNumber(amount)} / year`
              }
            />
          </div>

          {billingChoice === "annual" && !customPriced && (
            <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 space-y-3">
              <div className="font-bold text-sm text-slate-900">Yearly payment — TZS {formatNumber(amount)}</div>
              <p className="text-[11px] text-slate-600">
                Pay by mobile money or bank transfer, then enter the transaction reference
                {mode === "complete" ? " and/or attach the receipt" : ""}. An administrator checks it before approving your account.
                {mode === "signup" && " You can also add the reference and upload the receipt later from your account page."}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass} htmlFor="payMethod">Payment method</label>
                  <select id="payMethod" className={inputClass} value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass} htmlFor="payRef">Transaction reference</label>
                  <input id="payRef" className={inputClass} value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="e.g. QK72HD91LP" />
                </div>
              </div>
              {mode === "complete" && (
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer bg-white border border-dashed border-slate-300 rounded-xl px-3 py-3">
                  <Upload className="w-4 h-4 text-blue-600" />
                  <span className="truncate">{receipt ? receipt.name : "Attach receipt or screenshot (image or PDF)"}</span>
                  <input type="file" accept="image/*,application/pdf" className="sr-only" onChange={(e) => setReceipt(e.target.files?.[0] ?? null)} />
                </label>
              )}
            </div>
          )}

          <p className="text-[11px] text-slate-500 flex gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            Your registration goes to the Afyadawa team for approval. You&apos;ll see the status on your account page.
          </p>

          <div className="flex gap-2">
            <button type="button" onClick={back} className="px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm flex items-center gap-1">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <button type="submit" disabled={busy || logoBusy} className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold text-sm">
              {busy ? "Submitting…" : "Submit registration"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-slate-500 font-semibold">{label}</span>
      <span className="text-slate-900 font-bold text-right">{value || "—"}</span>
    </div>
  );
}
