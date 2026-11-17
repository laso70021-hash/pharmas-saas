import { useState } from 'react';
import { toast } from 'sonner';
import { Download } from 'lucide-react';
import type { Workspace } from '@/lib/pharmacy-types';
import { WorkspaceService } from '@/lib/pharmacy-service';
import { filterByRange, type DateRange } from '@/lib/date-range';
import { profitSummary } from '@/lib/workspace';
import { ghostBtn, errorText } from './ws-ui';

const csv = (rows: (string | number)[][]) => rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');

export function ReportButton({ ws, range }: { ws: Workspace; range: DateRange | null }) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const [sales, expenses] = await Promise.all([WorkspaceService.getSales(ws.id), WorkspaceService.getExpenses(ws.id)]);
      const s = filterByRange(sales, (x) => x.created_at, range);
      const e = filterByRange(expenses, (x) => x.expense_date || x.created_at, range);
      const p = profitSummary(s, e.map((x) => x.amount));
      const body = csv([
        [`${ws.name} report`, range ? `${range.from} to ${range.to}` : 'All time'], [],
        ['Revenue', p.revenue], ['Cost of goods', p.costOfGoods], ['Gross profit', p.grossProfit], ['Expenses', p.expenses], ['Net profit', p.netProfit], ['Margin %', p.marginPct], [],
        ['SALES'], ['Date', 'Invoice', 'Payment', 'Total'], ...s.map((x) => [x.created_at.slice(0, 10), x.invoice_number, x.payment_method, x.total]), [],
        ['EXPENSES'], ['Date', 'Category', 'Description', 'Amount'], ...e.map((x) => [x.expense_date || x.created_at.slice(0, 10), x.category, x.description, x.amount]),
      ]);
      const url = URL.createObjectURL(new Blob([body], { type: 'text/csv' }));
      const a = document.createElement('a'); a.href = url; a.download = `${ws.name.replace(/\W+/g, '-')}-report.csv`; a.click();
      URL.revokeObjectURL(url);
    } catch (err) { toast.error(errorText(err)); } finally { setBusy(false); }
  };
  return <button className={ghostBtn} disabled={busy} onClick={run}><Download className="w-3.5 h-3.5" /> {busy ? 'Preparing…' : 'Download report'}</button>;
}
