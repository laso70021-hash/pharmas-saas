import { useQuery } from '@tanstack/react-query';
import { TrendingUp } from 'lucide-react';
import { supabase } from '@/lib/supabase-client';
import { demandPlan, type DemandRow } from '@/lib/covlo';
import type { Workspace } from '@/lib/pharmacy-types';
import { cardCls, Empty, SectionHeader } from './ws-ui';

export function MarketDemandTab({ ws }: { ws: Workspace }) {
  const { data = [], isLoading, error } = useQuery({
    queryKey: ['demand', ws.id],
    queryFn: async () => { const { data, error } = await supabase.rpc('platform_demand_trends', { _supplier: ws.id }); if (error) throw error; return (data ?? []) as DemandRow[]; },
  });
  const rows = data.map((r) => ({ ...r, ...demandPlan(r) }));
  return (
    <div className="space-y-4">
      <SectionHeader title="Market Demand" subtitle="What pharmacies on Swahivo are selling, and Covlo's suggested next batch for you. Totals only; no pharmacy is named." />
      <div className={`${cardCls} overflow-x-auto`}>
        {isLoading ? <Empty>Loading demand…</Empty> : error ? <Empty>Could not load market demand.</Empty> : rows.length === 0 ? <Empty>Not enough sales on the platform yet. A medicine shows here once at least two pharmacies sell it.</Empty> : (
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-900 text-white text-left text-xs"><th className="p-2.5">Medicine</th><th className="p-2.5 text-right">Sold 30 days</th><th className="p-2.5 text-right">Trend</th><th className="p-2.5 text-right">Pharmacies</th><th className="p-2.5 text-right">Expected next month</th><th className="p-2.5 text-right">Your stock</th><th className="p-2.5 text-right">Suggested next batch</th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.product + r.strength} className="border-t border-slate-100">
                <td className="p-2.5 font-semibold">{r.product} <span className="text-slate-400 font-normal">{r.strength}</span>{r.trending && <span className="ml-2 inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700"><TrendingUp className="w-3 h-3" />Trending</span>}</td>
                <td className="p-2.5 text-right">{r.units_30d.toLocaleString()}</td>
                <td className={`p-2.5 text-right font-bold ${r.trend > 0 ? 'text-emerald-600' : r.trend < 0 ? 'text-red-600' : 'text-slate-500'}`}>{r.trend > 0 ? '+' : ''}{r.trend}%</td>
                <td className="p-2.5 text-right">{r.pharmacies}</td>
                <td className="p-2.5 text-right">{r.expected.toLocaleString()}</td>
                <td className="p-2.5 text-right">{r.your_stock.toLocaleString()}</td>
                <td className="p-2.5 text-right font-black text-blue-600">{r.nextBatch.toLocaleString()}</td>
              </tr>))}</tbody>
          </table>)}
      </div>
    </div>
  );
}
