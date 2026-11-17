import { useQuery } from '@tanstack/react-query';
import { WorkspaceService } from '@/lib/pharmacy-service';
import type { Workspace } from '@/lib/pharmacy-types';
import type { DateRange } from '@/lib/date-range';
import { can } from '@/lib/workspace';
import { DateRangeFilter } from '@/components/dashboard/DateRangeFilter';
import { OverviewAnalytics } from './OverviewAnalytics';

export function SalesReportsTab({ ws, range, onRangeChange, isMounted, actions }: {
  ws: Workspace; range: DateRange | null; onRangeChange: (r: DateRange | null) => void; isMounted: boolean; actions?: React.ReactNode;
}) {
  const pid = ws.id;
  const showFinance = can(ws.role, 'viewFinance', ws.status);
  const canSeeStaff = can(ws.role, 'manageBranches', 'active');
  const { data: allSales = [] } = useQuery({ queryKey: ['ws', pid, 'sales'], queryFn: () => WorkspaceService.getSales(pid), refetchInterval: 60000 });
  const { data: allExpenses = [] } = useQuery({ queryKey: ['ws', pid, 'expenses'], queryFn: () => WorkspaceService.getExpenses(pid) });
  const { data: products = [] } = useQuery({ queryKey: ['ws', pid, 'products'], queryFn: () => WorkspaceService.getProducts(pid) });
  const { data: batches = [] } = useQuery({ queryKey: ['ws', pid, 'batches'], queryFn: () => WorkspaceService.getBatches(pid) });
  const { data: branches = [] } = useQuery({ queryKey: ['ws', pid, 'branches'], queryFn: () => WorkspaceService.getBranches(pid) });
  const { data: staff = [] } = useQuery({ queryKey: ['ws', pid, 'staff'], queryFn: () => WorkspaceService.getStaff(pid), enabled: canSeeStaff });
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">Sales Reports</h1>
          <p className="text-sm text-slate-500">Detailed sales, branch, payment, product and inventory reports with CSV export.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DateRangeFilter value={range} onChange={onRangeChange} />
          {actions}
        </div>
      </div>
      <OverviewAnalytics ws={ws} range={range} isMounted={isMounted} allSales={allSales} allExpenses={allExpenses} products={products} batches={batches} branches={branches} staff={staff} showFinance={showFinance} canSeeStaff={canSeeStaff} />
    </div>
  );
}
