import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { ScanLine, UploadCloud, AlertTriangle, PackagePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { scanInvoice } from '@/lib/invoice-scan.functions';
import { linesToBatchRows, linesToProductRows, type InvoiceResult } from '@/lib/invoice-scan';
import { prepareAiFile } from '@/lib/image-resize';
import { inputCls } from './ws-ui';

type Row = Record<string, string>;
const key = (name: string, strength: string) => `${name} ${strength}`.toLowerCase().replace(/\s+/g, ' ').trim();

/** Upload a product/stock list or supplier invoice → Covlo extracts reviewable product and stock rows. */
export function InvoiceScanPanel({ pharmacyId, existingProducts, branches, disabled, onProducts, onBatches }: {
  pharmacyId: string; existingProducts: Row[]; branches: { value: string; label: string }[]; disabled: boolean;
  onProducts: (rows: Row[], fileName: string) => void; onBatches: (rows: Row[], fileName: string) => void;
}) {
  const scan = useServerFn(scanInvoice);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<InvoiceResult | null>(null);
  const [fileName, setFileName] = useState('');
  const [branch, setBranch] = useState(branches[0]?.value ?? '');
  const read = async (f?: File) => {
    if (!f) return; setError(''); setResult(null); setBusy(true);
    try {
      const file = await prepareAiFile(f); setFileName(f.name);
      const r = await scan({ data: { pharmacyId, file } });
      if (r.error || !r.result) setError(r.error ?? 'Could not read this invoice.'); else if (!r.result.lines.length) setError('No product lines were found on this document.'); else setResult(r.result);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not read this invoice.'); } finally { setBusy(false); }
  };
  const known = new Map(existingProducts.map((p) => [key(p['name'] ?? '', p['strength'] ?? ''), p['sku'] ?? '']));
  const plan = () => {
    if (!result) return { products: [] as Row[], skuRows: [] as Row[], fresh: 0 };
    const newLines = result.lines.filter((l) => !known.has(key(l.name, l.strength ?? '')));
    const products = linesToProductRows(newLines, result.supplier_name, existingProducts.map((p) => p['sku'] ?? ''));
    let n = 0;
    const skuRows = result.lines.map((l) => { const sku = known.get(key(l.name, l.strength ?? '')); return { sku: sku ?? products[n++]?.['sku'] ?? '' }; });
    return { products, skuRows, fresh: newLines.length };
  };
  const p = plan();
  return <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4 space-y-3">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="font-bold text-slate-900 flex items-center gap-2"><ScanLine className="w-4 h-4 text-blue-600" />Scan a product or stock list</h3><p className="text-xs text-slate-600 max-w-xl">Upload a photo or PDF of a product list, stock sheet, delivery note or invoice. Covlo extracts quantities and any visible batch/expiry details. Review every row before saving; unreadable or missing stock data is never guessed.</p></div>
      <label className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold ${disabled || busy ? 'bg-slate-200 text-slate-500' : 'bg-blue-600 text-white cursor-pointer hover:bg-blue-700'}`}><UploadCloud className="w-4 h-4" />{busy ? 'Reading file…' : 'Upload photo or PDF'}<input type="file" aria-label="Upload product or stock list" accept="image/jpeg,image/png,image/webp,application/pdf" disabled={disabled || busy} className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; void read(f); }} /></label>
    </div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {result && <div className="space-y-3">
      <p className="text-sm text-slate-700"><b>{result.lines.length}</b> lines read{result.supplier_name ? <> from <b>{result.supplier_name}</b></> : null}{result.invoice_number ? <> · invoice {result.invoice_number}</> : null}{result.invoice_date ? <> · {result.invoice_date}</> : null}. {p.fresh} new product{p.fresh === 1 ? '' : 's'}, {result.lines.length - p.fresh} already in your catalogue.</p>
      {result.warnings.map((w, i) => <p key={i} className="text-xs text-amber-700 flex gap-1.5"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />{w}</p>)}
      {result.lines.some((l) => l.corrected) && <p className="text-xs text-slate-600">Spelling fixed: {result.lines.filter((l) => l.corrected).map((l) => `${l.corrected} → ${l.name}`).join('; ')}</p>}
      <div className="flex flex-wrap items-end gap-2">
        <Button variant="outline" disabled={!p.products.length || disabled} onClick={() => onProducts(p.products, fileName)}><PackagePlus />Step 1 · Review {p.products.length} new products</Button>
        <label className="text-xs">Receive stock into branch<select aria-label="Branch for invoice stock" className={inputCls} value={branch} onChange={(e) => setBranch(e.target.value)}>{branches.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}</select></label>
        <Button disabled={!branch || disabled} onClick={() => onBatches(linesToBatchRows(result.lines, p.skuRows, branch, new Date().toISOString().slice(0, 10)), fileName)}>Step 2 · Review stock & expiry</Button>
      </div>
      <p className="text-[11px] text-slate-500">Stock is added as new batches, not used to replace existing stock. Required batch or expiry details missing from the file must be completed in the preview. Import new products first; product images are required.</p>
    </div>}
  </div>;
}
