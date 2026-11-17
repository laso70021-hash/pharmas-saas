import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { Sparkles, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { resolveImportReferences } from '@/lib/import-suggestions.functions';
import { EntryService } from '@/lib/pharmacy-service';
import type { EntryRow } from '@/lib/entry-model';
import { Modal } from './ws-ui';

type Result={column:'category_name'|'supplier_name';value:string;name:string;isNew:boolean;reason:string};
const slug=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60)||'category';

export function ImportAutoResolve({pharmacyId,unresolved,rows,disabled,onApply}:{pharmacyId:string;unresolved:{column:string;value:string}[];rows:EntryRow[];disabled:boolean;onApply:(r:Result[])=>Promise<void>}){
 const [open,setOpen]=useState(false);const [busy,setBusy]=useState(false);const [results,setResults]=useState<Result[]>([]);const [error,setError]=useState('');
 const resolve=useServerFn(resolveImportReferences);
 const run=async()=>{setOpen(true);setBusy(true);setError('');setResults([]);try{
  const items=unresolved.slice(0,40).map(u=>({column:u.column as Result['column'],value:u.value,details:rows.filter(r=>(r[u.column]??'').trim().toLowerCase()===u.value.trim().toLowerCase()).slice(0,5).map(r=>[r['name'],r['generic_name'],r['brand_name'],r['dosage_form'],r['strength']].filter(Boolean).join(' / ')).join('; ').slice(0,1500)}));
  const res=await resolve({data:{pharmacyId,items}});setResults(res.results);if(res.error)setError(res.error);
 }catch{setError('AI could not resolve these names. Your rows have not changed.');}finally{setBusy(false);}};
 return <><Button disabled={disabled||!unresolved.length} onClick={()=>void run()}><Sparkles/>Auto-resolve with Covlo AI</Button>
 {open&&<Modal title="Covlo AI suggestions" onClose={()=>{if(!busy)setOpen(false);}}>
  {busy&&<p role="status" className="text-sm">Reading medicine details…</p>}
  {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
  {results.length>0&&<><ul className="space-y-2 text-sm max-h-80 overflow-auto">{results.map(r=><li key={r.column+r.value} className="border border-border rounded p-2"><b>{r.value}</b> → {r.name} <span className="text-xs text-muted-foreground">({r.column==='category_name'?'category':'supplier'}{r.isNew?', will be created':''})</span><p className="text-xs text-muted-foreground">{r.reason}</p></li>)}</ul>
  <Button disabled={busy} onClick={async()=>{setBusy(true);try{
   const made=new Set<string>();
   for(const r of results.filter(x=>x.isNew)){const key=r.column+r.name.toLowerCase();if(made.has(key))continue;made.add(key);
    await EntryService.save(pharmacyId,r.column==='category_name'?'categories':'suppliers',r.column==='category_name'?{name:r.name,slug:slug(r.name),description:'',is_active:'true'}:{name:r.name,is_active:'true'});}
   await onApply(results);setOpen(false);
  }catch(e){setError(e instanceof Error?e.message:'Could not apply suggestions');}finally{setBusy(false);}}}><Check/>Apply all ({results.length})</Button></>}
 </Modal>}</>;
}
