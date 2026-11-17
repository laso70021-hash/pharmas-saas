import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, PackagePlus, Pill, Search, Box, Upload } from 'lucide-react';
import { EntryForm } from './EntryForm';
import { ProductsCanvas } from './ProductsCanvas';
import { EntryService, WorkspaceService } from '@/lib/pharmacy-service';
import type { Workspace, WsProduct } from '@/lib/pharmacy-types';
import { can, stockState, EXPIRY_WARNING_DAYS } from '@/lib/workspace';
import { formatNumber, formatDateDeterministic } from '@/lib/utils';
import { cardCls, Empty, Field, Modal, errorText, ghostBtn, inputCls, primaryBtn } from './ws-ui';

export function InventoryTab({ ws, userId, onImport }: { ws: Workspace; userId: string; onImport?: (() => void) | undefined }) {
  const pid = ws.id;
  const qc = useQueryClient();
  const editable = can(ws.role, 'manageStock', ws.status);
  const { data: products = [], isLoading } = useQuery({ queryKey: ['ws', pid, 'products'], queryFn: () => WorkspaceService.getProducts(pid) });
  const { data: batches = [] } = useQuery({ queryKey: ['ws', pid, 'batches'], queryFn: () => WorkspaceService.getBatches(pid) });
  const { data: branches = [] } = useQuery({ queryKey: ['ws', pid, 'branches'], queryFn: () => WorkspaceService.getBranches(pid) });
  const { data: entryProducts = [] } = useQuery({ queryKey: ['entry', pid, 'products'], queryFn: () => EntryService.list(pid, 'products') });
  const { data: refs = {} } = useQuery({ queryKey: ['entry-refs', pid], queryFn: () => EntryService.references(pid) });
  const [view, setView] = useState<'table' | 'grid' | 'batches'>('grid');
  const [q, setQ] = useState('');
  const [branch, setBranch] = useState('');
  const [editing, setEditing] = useState<Partial<WsProduct> | null>(null);
  const [receiving, setReceiving] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['ws', pid, 'products'] });
    void qc.invalidateQueries({ queryKey: ['ws', pid, 'batches'] });
  };
  const run = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true);
    try { await fn(); toast.success(ok); refresh(); } catch (err) { toast.error(errorText(err)); } finally { setBusy(false); }
  };
  const qty = (p: WsProduct) => (branch ? p.stock_by_branch[branch] || 0 : p.stock);
  const shown = products.filter((p) => `${p.name} ${p.generic_name} ${p.sku}`.toLowerCase().includes(q.toLowerCase()));
  const branchName = (id: string | null) => branches.find((b) => b.id === id)?.name ?? '—';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 text-white flex items-center justify-center shadow-sm"><Box className="w-7 h-7" /></div>
          <div><h2 className="text-2xl font-black text-slate-900 tracking-tight">{view === 'table' ? 'Pharmacy Products' : 'Inventory'}</h2>
            <p className="text-sm text-slate-500">{view === 'table' ? 'Manage your pharmacy catalogue and inventory across branches' : `${products.length} products · stock per branch`}</p></div>
        </div>
        {editable && <div className="flex flex-wrap gap-2">
          <button className="h-11 px-4 rounded-xl border border-blue-600 text-blue-700 bg-white font-bold text-sm inline-flex items-center gap-2 disabled:opacity-50" disabled={!products.length || !branches.length} onClick={() => setReceiving('')}><PackagePlus className="w-4 h-4" /> Receive Stock</button>
          {onImport && <button className="h-11 px-4 rounded-xl border border-blue-600 text-blue-700 bg-white font-bold text-sm inline-flex items-center gap-2" onClick={onImport}><Upload className="w-4 h-4" /> Bulk Import</button>}
          <button className="h-11 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm inline-flex items-center gap-2" onClick={() => setEditing({})}><Plus className="w-4 h-4" /> Add Product</button>
        </div>}
      </div>
      {editable && branches.length === 0 && <div className="text-xs bg-amber-50 border border-amber-200 text-amber-900 rounded-xl px-4 py-2.5 font-semibold">Add a branch first so you can receive stock into it.</div>}
      <div className="flex gap-6 border-b border-slate-200 text-sm font-semibold">
        {(['grid', 'table', 'batches'] as const).map((v) => <button key={v} onClick={() => setView(v)} className={`pb-2.5 -mb-px border-b-2 ${view === v ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-600 hover:text-slate-900'}`}>{v === 'grid' ? 'Inventory' : v === 'table' ? 'Pharmacy Products' : 'Batches'}</button>)}
      </div>
      {view !== 'table' && <div className="flex flex-wrap gap-2 items-center">
        <div className="relative"><Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" /><input className={`${inputCls.replace('w-full ', '')} pl-8 w-56`} placeholder="Search products" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select className={`${inputCls.replace('w-full ', '')} w-44`} value={branch} onChange={(e) => setBranch(e.target.value)} aria-label="Branch">
          <option value="">All branches</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>}

      {isLoading ? <Empty>Loading…</Empty> : view === 'table' ? (
        <ProductsCanvas products={products} batches={batches} branches={branches} editable={editable} onEdit={(p) => setEditing(p)} onStock={(p) => setReceiving(p.id)} />
      ) : view === 'grid' ? (
        shown.length === 0 ? <Empty>No products yet.</Empty> : (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
            {shown.map((p) => {
              const st = stockState(qty(p), p.min_stock_level);
              return (
                <div key={p.id} className={`${cardCls} overflow-hidden flex flex-col ${p.is_active ? '' : 'opacity-50'}`}>
                  <div className="aspect-square bg-slate-50 flex items-center justify-center">
                    {p.image_src ? <img src={p.image_src} alt={p.name} className="w-full h-full object-cover" loading="lazy" /> : <Pill className="w-10 h-10 text-slate-300" />}
                  </div>
                  <div className="p-3 space-y-1.5 flex-1 flex flex-col">
                    <div className="font-black text-slate-900 text-sm leading-tight">{p.name}</div>
                    <div className="text-[11px] text-slate-400">{[p.strength, p.dosage_form].filter(Boolean).join(' ') || p.generic_name}</div>
                    <div className="text-sm font-black text-blue-600">TZS {formatNumber(p.selling_price)}</div>
                    <span className={`self-start text-[10px] font-bold px-2 py-0.5 rounded-md ${st === 'out' ? 'bg-rose-100 text-rose-700' : st === 'low' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'}`}>
                      {st === 'out' ? 'Out of stock' : `${qty(p)} in stock`}
                    </span>
                    {editable && <div className="flex flex-wrap gap-1.5 pt-1 mt-auto">
                      <button className={ghostBtn} onClick={() => setEditing(p)}>Edit</button>
                      <button className={ghostBtn} disabled={!branches.length} onClick={() => setReceiving(p.id)}>+ Stock</button>
                      <label className={ghostBtn}>Photo<input aria-label={`Photo for ${p.name}`} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e=>{const file=e.target.files?.[0];if(file)void run(()=>EntryService.photo(pid,p.id,file),'Photo saved');}}/></label>
                    </div>}
                  </div>
                </div>);
            })}
          </div>)
      ) : (
        <div className={`${cardCls} p-5 overflow-x-auto`}>
          {batches.length === 0 ? <Empty>No stock received yet.</Empty> : (
            <table className="w-full text-left text-xs min-w-[640px]">
              <thead><tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px] font-bold"><th className="py-2">Product</th><th>Batch</th><th>Branch</th><th>Qty</th><th>Cost/unit</th><th>Expiry</th>{editable && <th />}</tr></thead>
              <tbody className="divide-y divide-slate-100">
                {batches.filter((b) => !branch || b.branch_id === branch).map((b) => (
                  <tr key={b.id}>
                    <td className="py-2.5 font-bold text-slate-900">{b.product_name}</td><td>{b.batch_number}</td><td>{branchName(b.branch_id)}</td>
                    <td className="font-bold">{b.quantity}</td><td>TZS {formatNumber(b.cost_per_unit)}</td>
                    <td className={b.days_to_expiry <= EXPIRY_WARNING_DAYS ? 'text-orange-600 font-bold' : ''}>{formatDateDeterministic(b.expiry_date)}</td>
                    {editable && <td className="text-right"><button className={ghostBtn} disabled={busy} onClick={() => {
                      const v = prompt(`New counted quantity for ${b.product_name} (${b.batch_number})`, String(b.quantity));
                      if (v === null || isNaN(Number(v)) || Number(v) < 0) return;
                      void run(() => WorkspaceService.adjustBatch(pid, userId, b, Number(v), 'Stock count'), 'Stock adjusted');
                    }}>Adjust</button></td>}
                  </tr>))}
              </tbody>
            </table>)}
        </div>
      )}

      {editing && <EntryForm module="products" initial={editing.id ? entryProducts.find(p=>p.id===editing.id) : undefined} existing={entryProducts} references={refs} onClose={()=>setEditing(null)} onSave={async row=>{await EntryService.save(pid,'products',row,editing.id);refresh();void qc.invalidateQueries({queryKey:['entry',pid]});}} />}
      {receiving !== null && <EntryForm module="batches" references={refs} onClose={()=>setReceiving(null)} onSave={async row=>{await EntryService.save(pid,'batches',row);refresh();}} />}

    </div>
  );
}
