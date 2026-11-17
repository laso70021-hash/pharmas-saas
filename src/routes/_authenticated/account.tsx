import { saveBusinessLogo } from '@/lib/branding.functions';
import { BusinessLogoSettings } from '@/components/workspace/BusinessLogoSettings';
import { BRAND } from "@/lib/brand";
import { NotificationBell } from '@/components/common/NotificationBell';
import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Clock, CheckCircle2, AlertTriangle, XCircle, LogOut, ShieldCheck, Building2, Truck, FileText } from "lucide-react";
import { RegistrationWizard } from "@/components/registration/RegistrationWizard";
import { PaymentProofForm } from "@/components/registration/PaymentProofForm";
import { PharmacyService, WorkspaceService } from "@/lib/pharmacy-service";
import { roleLabel } from "@/lib/workspace";
import { useAuth } from "@/hooks/useAuth";
import { formatNumber, formatDateDeterministic } from "@/lib/utils";
import { STATUS_LABELS, TRIAL_DAYS, daysLeft, paymentMethodLabel, type AccountStatus } from "@/lib/billing";
import type { BusinessRegistration } from "@/lib/pharmacy-types";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({
    meta: [
      { title: "My Account | Swahivo" },
      { name: "description", content: "Your Swahivo registration, plan, approval status and yearly payments." },
      { property: "og:title", content: "My Account | Swahivo" },
      { property: "og:description", content: "Your Swahivo registration, plan, approval status and yearly payments." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AccountPage,
});

const statusStyle: Record<AccountStatus, { box: string; Icon: typeof Clock }> = {
  pending: { box: "bg-amber-50 border-amber-200 text-amber-900", Icon: Clock },
  trial: { box: "bg-blue-50 border-blue-200 text-blue-900", Icon: Clock },
  active: { box: "bg-emerald-50 border-emerald-200 text-emerald-900", Icon: CheckCircle2 },
  expired: { box: "bg-rose-50 border-rose-200 text-rose-900", Icon: AlertTriangle },
  suspended: { box: "bg-rose-50 border-rose-200 text-rose-900", Icon: XCircle },
  rejected: { box: "bg-rose-50 border-rose-200 text-rose-900", Icon: XCircle },
};

function AccountPage() {
  const { user, profile, isSuperAdmin, signOut } = useAuth();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [resubmit, setResubmit] = useState(false);

  const userId = user?.id ?? "";
  const { data: business, isLoading } = useQuery({
    queryKey: ["my-business", userId],
    queryFn: () => PharmacyService.getMyBusiness(userId),
    enabled: Boolean(userId),
  });
  const { data: plans = [] } = useQuery({
    queryKey: ["subscription-plans"],
    queryFn: () => PharmacyService.getPlans(),
  });

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["my-business", userId] });
  const { data: invitations = [], refetch: refetchInvites } = useQuery({
    queryKey: ["my-invitations", userId],
    queryFn: () => WorkspaceService.myInvitations(),
    enabled: Boolean(userId),
  });
  const { data: workspaces = [] } = useQuery({
    queryKey: ["workspaces", userId, false],
    queryFn: () => WorkspaceService.listWorkspaces(userId, false),
    enabled: Boolean(userId),
  });
  const staffOf = workspaces.filter((w) => w.role !== "owner" && w.business_type === "pharmacy");
  const isStaff = staffOf.length > 0 || invitations.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50/60 via-white to-slate-50 font-sans">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center">
            <img src={BRAND.logoUrl} alt="Afyadawa" className="h-10 w-auto" />
          </Link>
          <div className="flex items-center gap-3 text-xs">
            <NotificationBell />
            <span className="hidden sm:inline text-slate-500 font-medium">{profile?.email || user?.email}</span>
            <button onClick={() => void signOut()} className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center gap-1.5">
              <LogOut className="w-3.5 h-3.5" /> Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {isSuperAdmin && (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-bold text-blue-900">
              <ShieldCheck className="w-5 h-5" /> You&apos;re a platform administrator.
            </div>
            <Link to="/admin" className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold">
              Open Admin Dashboard
            </Link>
          </div>
        )}

        {invitations.map((inv) => (
          <div key={inv.id} className="rounded-2xl border border-blue-200 bg-white p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-sm">
              <div className="font-black text-slate-900">You&apos;re invited to {inv.pharmacy_name}</div>
              <div className="text-xs text-slate-500">As {roleLabel(inv.role)}{inv.branch_name ? ` · ${inv.branch_name}` : ""}</div>
            </div>
            <button
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
              onClick={async () => {
                try {
                  await WorkspaceService.acceptInvitation(inv.id);
                  toast.success(`Welcome to ${inv.pharmacy_name}`);
                  await refetchInvites();
                  void queryClient.invalidateQueries({ queryKey: ["workspaces"] });
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Could not accept");
                }
              }}
            >
              Accept invitation
            </button>
          </div>
        ))}

        {(staffOf.length > 0 || (business && business.business_type === "pharmacy" && business.effective_status !== "rejected")) && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 flex items-center justify-between gap-3">
            <div className="text-sm font-bold text-emerald-900">
              {staffOf.length > 0 && !business ? `You work at ${staffOf.map((w) => w.name).join(", ")}.` : "Manage branches, staff, stock and profit."}
            </div>
            <Link to="/pharmacy" className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold whitespace-nowrap">
              Open Pharmacy Dashboard
            </Link>
          </div>
        )}

        {business && <BusinessLogoSettings pharmacyId={business.id} name={business.name} />}
        {isLoading ? (
          <div className="text-sm text-slate-500 text-center py-16">Loading your account…</div>
        ) : !business && isStaff && !resubmit ? null : !business || resubmit ? (
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4 max-w-2xl mx-auto">
            <div>
              <h1 className="text-xl font-black text-slate-900">{resubmit ? "Update and resubmit your registration" : "Register your business"}</h1>
              <p className="text-xs text-slate-500 mt-1">
                Choose a plan and send your details. An administrator approves new accounts before they can be used.
              </p>
            </div>
            <RegistrationWizard
              mode="complete"
              defaultName={profile?.full_name}
              busy={busy}
              onSubmit={async ({ registration, receipt, logo }) => {
                setBusy(true);
                try {
                  const { payment_method: payMethod, payment_reference: reference = "", ...rest } = registration;
                  const pharmacyId = await PharmacyService.submitRegistration(rest);
                  if (logo) await saveBusinessLogo({ data: { pharmacyId, data: logo } });
                  if (rest.billing_choice === "annual" && (reference || receipt)) {
                    await PharmacyService.submitPayment({
                      userId,
                      pharmacyId,
                      planSlug: rest.plan_slug,
                      method: payMethod || "mpesa",
                      reference,
                      file: receipt,
                    });
                  }
                  toast.success("Registration submitted for approval.");
                  setResubmit(false);
                  refresh();
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Registration failed");
                } finally {
                  setBusy(false);
                }
              }}
            />
          </section>
        ) : (
          <BusinessStatus business={business} userId={userId} plans={plans} onChanged={refresh} onResubmit={() => setResubmit(true)} />
        )}
      </main>
    </div>
  );
}

function BusinessStatus({
  business,
  userId,
  plans,
  onChanged,
  onResubmit,
}: {
  business: BusinessRegistration;
  userId: string;
  plans: import("@/lib/pharmacy-types").SubscriptionPlan[];
  onChanged: () => void;
  onResubmit: () => void;
}) {
  const status = business.effective_status;
  const { box, Icon } = statusStyle[status];
  const pendingPayment = business.payments.find((p) => p.status === "pending");
  const TypeIcon = business.business_type === "supplier" ? Truck : Building2;

  let message: string;
  switch (status) {
    case "pending":
      message =
        business.billing_choice === "trial"
          ? `Your registration is with our team. Once approved, your ${TRIAL_DAYS}-day free trial starts.`
          : pendingPayment
            ? "Your registration and payment are being checked. You'll be activated once the payment is confirmed."
            : "Your registration is with our team. Send your yearly payment below so we can approve it.";
      break;
    case "trial":
      message = `Free trial: ${daysLeft(business.trial_ends_at)} day(s) left (ends ${formatDateDeterministic(business.trial_ends_at || "")}). Pay monthly or yearly before it ends to keep your account.`;
      break;
    case "active":
      message = `Paid ${business.billing_choice === "monthly" ? "monthly" : "yearly"}${business.subscription_starts_at ? ` from ${formatDateDeterministic(business.subscription_starts_at)}` : ""} until ${formatDateDeterministic(business.subscription_ends_at || "")} (${daysLeft(business.subscription_ends_at)} days left).${daysLeft(business.subscription_ends_at) <= 7 ? " Your service ends soon — send a renewal payment below to extend it." : ""}`;
      break;
    case "expired":
      message = "Your account has expired. Renew monthly or yearly below to continue using Swahivo.";
      break;
    case "suspended":
      message = "Your account is suspended. Please contact Swahivo support.";
      break;
    case "rejected":
      message = business.review_note ? `Your registration was not approved: ${business.review_note}` : "Your registration was not approved.";
      break;
  }

  const canPay = (status === "pending" && business.billing_choice === "annual") || status === "trial" || status === "expired" || status === "active";

  return (
    <div className="space-y-6">
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center">
              <TypeIcon className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900">{business.name}</h1>
              <p className="text-xs text-slate-500">
                {business.business_type === "supplier" ? "Wholesale supplier" : "Pharmacy"} · {business.city} · {business.plan_name} plan
              </p>
            </div>
          </div>
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 whitespace-nowrap">{STATUS_LABELS[status]}</span>
        </div>

        <div className={`rounded-xl border p-4 flex gap-3 text-sm ${box}`}>
          <Icon className="w-5 h-5 shrink-0 mt-0.5" />
          <p className="font-medium">{message}</p>
        </div>

        {status === "rejected" && (
          <button onClick={onResubmit} className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold">
            Update and resubmit
          </button>
        )}

        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <Info label="Plan" value={business.plan_name} />
          <Info label="Yearly fee" value={business.yearly_price ? `TZS ${formatNumber(business.yearly_price)}` : "Custom"} />
          <Info label="Billing" value={business.billing_choice === "trial" ? `${TRIAL_DAYS}-day trial` : business.billing_choice === "monthly" ? "Monthly" : "Yearly"} />
          <Info label="Registered" value={formatDateDeterministic(business.created_at)} />
        </dl>
      </section>

      {canPay && (
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-3">
          <div>
            <h2 className="font-black text-slate-900">{status === "active" ? "Renew for another year" : "Pay yearly"}</h2>
            <p className="text-xs text-slate-500">
              Pay by mobile money or bank transfer, then send the reference and/or receipt here. An administrator confirms it.
            </p>
          </div>
          {pendingPayment && (
            <div className="text-xs bg-amber-50 border border-amber-200 text-amber-900 rounded-xl px-3 py-2 font-semibold">
              A payment of TZS {formatNumber(pendingPayment.amount_tzs)} is waiting for verification.
            </div>
          )}
          <PaymentProofForm userId={userId} pharmacyId={business.id} plans={plans} currentPlanSlug={business.plan_slug} onSubmitted={onChanged} />
        </section>
      )}

      {business.payments.length > 0 && (
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h2 className="font-black text-slate-900 mb-3">Payment history</h2>
          <div className="divide-y divide-slate-100 text-xs">
            {business.payments.map((p) => (
              <div key={p.id} className="py-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-400" />
                  <div>
                    <div className="font-bold text-slate-900">TZS {formatNumber(p.amount_tzs)} · {paymentMethodLabel(p.method)}</div>
                    <div className="text-slate-500">
                      {p.reference || "Receipt attached"} · {formatDateDeterministic(p.created_at)}
                      {p.review_note ? ` · ${p.review_note}` : ""}
                    </div>
                  </div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-md font-bold text-[10px] capitalize ${
                    p.status === "confirmed" ? "bg-emerald-100 text-emerald-800" : p.status === "rejected" ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {p.status === "pending" ? "Checking" : p.status}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80">
      <dt className="text-[10px] uppercase font-bold text-slate-400">{label}</dt>
      <dd className="font-bold text-slate-900 mt-0.5">{value}</dd>
    </div>
  );
}
