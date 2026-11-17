import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { Sparkles, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { suggestImportCategory } from '@/lib/import-suggestions.functions';
import type { EntryRow } from '@/lib/entry-model';
import { Modal, inputCls } from './ws-ui';

export function ImportCategorySuggestion({pharmacyId,value,rows,disabled,onApply}:{pharmacyId:string;value:string;rows:EntryRow[];disabled:boolean;onApply:(category:string)=>void}){
 const [open,setOpen]=useState(false);
 const [details,setDetails]=useState(()=>rows.slice(0,10).map(row=>['name','generic_name','brand_name','description','dosage_form','strength'].map(key=>row[key]?`${key}: ${row[key]}`:'').filter(Boolean).join('; ')).join('\n').slice(0,4000));
 const [busy,setBusy]=useState(false);
 const [result,setResult]=useState<{category:{id:string;name:string}|null;reason:string;error:string|null}|null>(null);
 const suggest=useServerFn(suggestImportCategory);
 return <><Button variant="outline" disabled={disabled} onClick={()=>setOpen(true)}><Sparkles/>Suggest category</Button>
 {open&&<Modal title={`Category suggestion: ${value}`} onClose={()=>{if(!busy)setOpen(false);}}>
  <label className="block text-sm">Unmatched row details<textarea aria-label="Unmatched row details" className={`${inputCls} mt-2 min-h-36`} maxLength={4000} value={details} disabled={busy} onChange={e=>{setDetails(e.target.value);setResult(null);}}/></label>
  <Button disabled={busy||disabled||!details.trim()} onClick={async()=>{setBusy(true);setResult(null);try{setResult(await suggest({data:{pharmacyId,unmatchedCategory:value,details}}));}catch{setResult({category:null,reason:'',error:'Could not request a suggestion. Your rows have not changed.'});}finally{setBusy(false);}}}><Sparkles/>{busy?'Finding a match…':'Find matching category'}</Button>
  {result?.error&&<p role="alert" className="text-sm text-destructive">{result.error}</p>}
  {result&&!result.error&&<div role="status" className="space-y-2"><h4 className="font-bold">{result.category?.name??'No suitable match'}</h4><p className="text-sm text-muted-foreground">{result.reason}</p>{result.category&&<Button disabled={disabled} onClick={()=>{if(result.category){onApply(result.category.name);setOpen(false);}}}><Check/>Apply to {rows.length} matching rows</Button>}</div>}
 </Modal>}</>;
}