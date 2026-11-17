import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase-client";
import { useAuth } from "@/hooks/useAuth";
import { RegistrationWizard, type AccountFields } from "@/components/registration/RegistrationWizard";
import type { RegistrationInput } from "@/lib/pharmacy-types";
import { BRAND } from "@/lib/brand";
import { PharmacyService, WorkspaceService } from "@/lib/pharmacy-service";
import { saveBusinessLogo } from '@/lib/branding.functions';
import { landingWorkspace } from "@/lib/workspace";

const PENDING_LOGO_KEY = 'afyadawa-registration-logo';
const LEGACY_PENDING_LOGO_KEY = 'swahivo-registration-logo';

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign In | Afyadawa" },
      { name: "description", content: "Sign in or create your Afyadawa account." },
      { property: "og:title", content: "Sign In | Afyadawa" },
      { property: "og:description", content: "Sign in or create your Afyadawa account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): AuthSearch => ({
    ...(search["mode"] === "signup" ? { mode: "signup" as const } : {}),
    ...(typeof search["plan"] === "string" ? { plan: search["plan"] } : {}),
    ...(typeof search["invite"] === "string" ? { invite: search["invite"] } : {}),
  }),
  component: AuthPage,
});

interface AuthSearch {
  mode?: "signup";
  plan?: string;
  invite?: string;
}

type Mode = "signin" | "signup" | "forgot" | "staff";

const inputClass =
  "w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm";
const labelClass = "block text-xs font-bold text-slate-700 uppercase mb-1";

function GoogleLogo() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z" />
    </svg>
  );
}

export function AuthPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const { user, isLoading, isSuperAdmin } = useAuth();
  const [mode, setMode] = useState<Mode>(search.invite ? "staff" : search.mode === "signup" ? "signup" : "signin");
  const [email, setEmail] = useState(search.invite ?? "");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Once signed in (and roles are loaded), send admins to the admin dashboard and everyone else to their account.
  useEffect(() => {
    if (!isLoading && user) {
      void supabase.from('account_onboarding').select('password_required').eq('user_id',user.id).maybeSingle().then(async ({data,error})=>{
        if(error){toast.error('Could not check account setup. Please try again.');return;}
        const pendingLogo = sessionStorage.getItem(PENDING_LOGO_KEY) ?? sessionStorage.getItem(LEGACY_PENDING_LOGO_KEY);
        if (pendingLogo) {
          try {
            const pending = JSON.parse(pendingLogo) as { email: string; data: string };
            if (pending.email.toLowerCase() === user.email?.toLowerCase()) {
              const business = await PharmacyService.getMyBusiness(user.id);
              if (business) { await saveBusinessLogo({ data: { pharmacyId: business.id, data: pending.data } }); sessionStorage.removeItem(PENDING_LOGO_KEY); sessionStorage.removeItem(LEGACY_PENDING_LOGO_KEY); }
            }
          } catch { toast.error('Your logo could not be saved. Upload it from business settings.'); }
        }
        if(data?.password_required){void navigate({to:'/set-password',replace:true});return;}
        if(isSuperAdmin){void navigate({to:'/admin',replace:true});return;}
        void WorkspaceService.listWorkspaces(user.id,false).then((list)=>{
          const ws=landingWorkspace(list);
          void (ws?navigate({to:'/pharmacy',search:{id:ws.id},replace:true}):navigate({to:'/account',replace:true}));
        }).catch(()=>void navigate({to:'/account',replace:true}));
      });
    }
  }, [isLoading, user, isSuperAdmin, navigate]);

  const handleRegister = async ({ registration, account, logo }: { registration: RegistrationInput; account: AccountFields; logo: string | null }) => {
    setBusy(true);
    setNotice(null);
    try {
      if (logo) sessionStorage.setItem(PENDING_LOGO_KEY, JSON.stringify({ email: account.email, data: logo }));
      else { sessionStorage.removeItem(PENDING_LOGO_KEY); sessionStorage.removeItem(LEGACY_PENDING_LOGO_KEY); }
      const { data, error } = await supabase.auth.signUp({
        email: account.email,
        password: account.password,
        options: {
          emailRedirectTo: window.location.origin + "/auth",
          data: { full_name: account.fullName, registration },
        },
      });
      if (error) throw error;
      if (!data.session) {
        setEmail(account.email);
        setNotice("Registration received! Check your email to confirm your address, then sign in to follow your approval.");
        setMode("signin");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      if (mode === "staff") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/auth", data: { full_name: fullName } },
        });
        if (error) throw error;
        if (!data.session) {
          setNotice("Account created! Confirm your email, then sign in to accept your invitation.");
          setMode("signin");
        }
      } else if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setNotice("If that email has an account, a reset link is on its way.");
        setMode("signin");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const handleOAuth = async (provider: "google") => {
    const result = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin + "/auth" },
    });
    if (result.error) {
      toast.error(result.error.message || "Sign-in failed");
      return;
    }
  };

  const heading = mode === "signin" ? "Sign In to Afyadawa" : mode === "signup" ? "Register your business" : mode === "staff" ? "Join your pharmacy team" : "Reset your password";

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50/60 via-white to-slate-50 flex items-center justify-center p-4 font-sans">
      <div className={`bg-white rounded-2xl w-full p-6 shadow-2xl border border-slate-100 space-y-5 ${mode === "signup" ? "max-w-2xl" : "max-w-md"}`}>
        <Link to="/" className="flex items-center">
          <img src={BRAND.logoUrl} alt="Afyadawa" className="h-11 w-auto" />
        </Link>

        <h1 className="font-bold text-slate-900 text-lg pt-1">{heading}</h1>

        {notice && (
          <div className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
            {notice}
          </div>
        )}

        {mode === "signup" && (
          <RegistrationWizard mode="signup" initialPlan={search.plan} busy={busy} onSubmit={handleRegister} />
        )}

        {mode === "signin" && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => void handleOAuth("google")}
              className="w-full h-11 rounded-xl border border-[#747775] bg-white text-[#1F1F1F] text-sm font-medium flex items-center justify-center gap-[10px] px-3 hover:bg-slate-50 transition-colors"
            >
              <GoogleLogo />
              Continue with Google
            </button>
            <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-400 uppercase pt-1">
              <span className="h-px flex-1 bg-slate-200" /> or <span className="h-px flex-1 bg-slate-200" />
            </div>
          </div>
        )}

        {mode !== "signup" && (
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "staff" && (
            <div>
              <label className={labelClass} htmlFor="fullName">Full name</label>
              <input id="fullName" required className={inputClass} value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
          )}
          <div>
            <label className={labelClass} htmlFor="email">Email Address</label>
            <input id="email" type="email" required className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@pharmacy.com" />
          </div>
          {mode !== "forgot" && (
            <div>
              <label className={labelClass} htmlFor="password">Password</label>
              <input id="password" type="password" required minLength={6} className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          )}
          {mode === "signin" && (
            <div className="text-xs text-right">
              <button type="button" onClick={() => setMode("forgot")} className="text-blue-600 hover:underline font-semibold">
                Forgot password?
              </button>
            </div>
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold text-sm shadow-md transition-all"
          >
            {busy ? "Please wait…" : mode === "signin" ? "Sign In" : mode === "staff" ? "Create staff account" : "Send reset link"}
          </button>
        </form>
        )}

        <div className="text-center text-xs text-slate-500">
          {mode === "signin" ? (
            <>
              New to Afyadawa?{" "}
              <button onClick={() => setMode("signup")} className="text-blue-600 font-semibold hover:underline">Register your pharmacy or supplier business</button>
            </>
          ) : mode === "signup" || mode === "staff" ? (
            <>
              Already registered?{" "}
              <button onClick={() => setMode("signin")} className="text-blue-600 font-semibold hover:underline">Sign in</button>
            </>
          ) : (
            <button onClick={() => setMode("signin")} className="text-blue-600 font-semibold hover:underline">Back to sign in</button>
          )}
        </div>
      </div>
    </div>
  );
}
