import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase-client";
import type { UserProfile, UserRole } from "@/lib/pharmacy-types";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  isSuperAdmin: boolean;
  isLoading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  isSuperAdmin: false,
  isLoading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  // Which user the loaded profile/roles belong to; until it matches, roles are still loading.
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const isLoading = initialLoading || (user !== null && profileUserId !== user.id);

  const loadProfile = useCallback(async (currentUser: User | null) => {
    if (!currentUser) {
      setProfile(null);
      setIsSuperAdmin(false);
      setProfileUserId(null);
      return;
    }
    const [{ data: row }, { data: roleRows }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", currentUser.id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", currentUser.id),
    ]);
    const roles = (roleRows ?? []).map((r) => r.role as UserRole);
    const admin = roles.includes("super_admin");
    setIsSuperAdmin(admin);
    setProfile({
      id: currentUser.id,
      email: row?.email || currentUser.email || "",
      full_name: row?.full_name || (currentUser.user_metadata?.["full_name"] as string | undefined) || "User",
      ...(row?.phone ? { phone: row.phone } : {}),
      ...(row?.avatar_url ? { avatar_url: row.avatar_url } : {}),
      system_role: admin ? "super_admin" : roles[0] || "pharmacy_owner",
      is_super_admin: admin,
      created_at: row?.created_at || currentUser.created_at,
    });
    setProfileUserId(currentUser.id);
  }, []);

  useEffect(() => {
    let active = true;
    const { data: sub } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        // Defer Supabase calls out of the auth callback.
        setTimeout(() => {
          void loadProfile(nextSession?.user ?? null);
          void router.invalidate();
          if (event !== "SIGNED_OUT") void queryClient.invalidateQueries();
        }, 0);
      }
    });

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      await loadProfile(data.session?.user ?? null);
      if (active) setInitialLoading(false);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile, queryClient, router]);

  const signOut = useCallback(async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setIsSuperAdmin(false);
    setProfileUserId(null);
    navigate({ to: "/auth", replace: true });
  }, [navigate, queryClient]);

  const refreshProfile = useCallback(async () => {
    await loadProfile(user);
  }, [loadProfile, user]);

  return (
    <AuthContext.Provider value={{ user, session, profile, isSuperAdmin, isLoading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
