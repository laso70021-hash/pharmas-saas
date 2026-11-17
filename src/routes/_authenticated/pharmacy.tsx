import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { WorkspaceService } from "@/lib/pharmacy-service";
import { PharmacyWorkspace } from "@/components/workspace/PharmacyWorkspace";
import { AdminBusinessForm } from '@/components/workspace/AdminBusinessForm';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

export const Route = createFileRoute("/_authenticated/pharmacy")({
  head: () => ({
    meta: [
      { title: "Pharmacy Dashboard | Swahivo" },
      { name: "description", content: "Run your pharmacy: branches, staff roles, stock with photos, expenses and profit." },
      { property: "og:title", content: "Pharmacy Dashboard | Swahivo" },
      { property: "og:description", content: "Branches, staff, inventory and profit for your pharmacy." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): { id?: string } => (typeof s["id"] === "string" ? { id: s["id"] } : {}),
  component: PharmacyPage,
});

function PharmacyPage() {
  const [registering,setRegistering]=useState(false);
  const { user, isSuperAdmin, isLoading, signOut } = useAuth();
  const { id } = Route.useSearch();
  const navigate = useNavigate();
  const userId = user?.id ?? "";
  const { data: list, isLoading: wsLoading } = useQuery({
    queryKey: ["workspaces", userId, isSuperAdmin],
    queryFn: () => WorkspaceService.listWorkspaces(userId, isSuperAdmin),
    enabled: Boolean(userId) && !isLoading,
  });
  const pharmacies = list ?? [];
  const ws = pharmacies.find((w) => w.id === id) ?? pharmacies.find((w) => w.role !== "admin") ?? pharmacies[0];

  if (isLoading || wsLoading) return <div className="min-h-screen flex items-center justify-center text-sm font-semibold text-slate-500">Loading pharmacy…</div>;
  if (!ws)
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-sm text-slate-600 p-6 text-center">
        <p>You don&apos;t belong to a pharmacy yet. Register one, or accept a staff invitation from your account page.</p>
        <Link to="/account" className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold">Go to My Account</Link>
      </div>
    );
  const adminView = ws.role === "admin";
  return (
    <div className="relative">
      {adminView && (
        <div className="sticky top-0 z-30 bg-[#0F172A] text-white px-4 py-2 flex items-center justify-between gap-3 text-xs font-bold">
          <span className="truncate">Viewing {ws.name} as platform administrator</span>
          <Link to="/admin" className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 whitespace-nowrap">Return to admin dashboard</Link>
        </div>)}
      {isSuperAdmin&&!adminView&&<div className="absolute bottom-16 left-3 z-20"><Button size="sm" onClick={()=>setRegistering(true)}>Register pharmacy</Button></div>}
      {registering&&<AdminBusinessForm onClose={()=>setRegistering(false)} onCreated={()=>{setRegistering(false);void navigate({to:'/admin'});}}/>}
      <PharmacyWorkspace key={ws.id} ws={ws} all={adminView ? [ws] : pharmacies.filter((w) => w.role !== "admin")} userId={userId} onSwitch={(nid) => navigate({ to: "/pharmacy", search: { id: nid } })} onSignOut={() => void signOut()} />
    </div>
  );
}
