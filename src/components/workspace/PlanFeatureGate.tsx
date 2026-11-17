import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { LockKeyhole } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WorkspaceService } from '@/lib/pharmacy-service';
import { canUsePlanFeature, PLAN_FEATURES, type PlanFeature } from '@/lib/plan-features';
import type { Workspace } from '@/lib/pharmacy-types';

export function PlanFeatureGate({ ws, feature, children }: { ws: Workspace; feature: PlanFeature; children: ReactNode }) {
  const { data, isPending, error } = useQuery({ queryKey: ['plan-access', ws.id], queryFn: () => WorkspaceService.getPlanFeatures(ws.id), staleTime: 0, refetchInterval: 30000 });
  if (isPending) return <p className="text-sm text-muted-foreground">Checking plan access…</p>;
  if (error) return <p role="alert" className="text-sm text-destructive">Could not verify your plan. Please retry.</p>;
  if (canUsePlanFeature(data?.plan, feature, data?.status ?? ws.status, ws.role === 'admin')) return <>{children}</>;
  return <section className="py-8 space-y-3 text-foreground">
    <h2 className="flex gap-2 items-center font-bold"><LockKeyhole className="size-5" />{PLAN_FEATURES[feature]}</h2>
    <p className="text-sm text-muted-foreground">Not available on your current plan or subscription. Your existing records are unchanged.</p>
    {ws.role === 'owner' ? <Button asChild><Link to="/account">Manage plan</Link></Button> : <p className="text-sm text-muted-foreground">Ask your business owner to upgrade or renew.</p>}
  </section>;
}