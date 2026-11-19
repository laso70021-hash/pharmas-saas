import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { ENTRY_MODELS, blankEntry, afyadawaBarcode, validateEntries, type EntryModule, type EntryRow, type EntryReferences } from '@/lib/entry-model';
import { Field, Modal, inputCls } from './ws-ui';

export function EntryForm({ module, initial, references, existing = [], extraFields, imageSrc, onClose, onSave }: { module: EntryModule; initial?: EntryRow | undefined; references: EntryReferences; existing?: EntryRow[]; extraFields?: ReactNode; imageSrc?: string | null; onClose: () => void; onSave: (row: EntryRow, photo?: File) => Promise<void> }) {
 const [row,setRow]=useState<EntryRow>(()=>{const r={...blankEntry(module),...initial};if(module==='products'&&!r['barcode'])r['barcode']=afyadawaBarcode();return r;});
 const [photo,setPhoto]=useState<File|null>(null);
 const [busy,setBusy]=useState(false); const [error,setError]=useState('');
 const set=(key:string,value:string)=>setRow(r=>({...r,[key]:value}));
 return <Modal title={`${initial?.['id'] ? 'Edit' : 'Add'} ${ENTRY_MODELS[module].label}`} onClose={onClose} wide>
  <form className="grid grid-cols-1 sm:grid-cols-2 gap-3" onSubmit={async e=>{e.preventDefault();const errors=validateEntries(module,[row],existing.filter(r=>r['id']!==initial?.['id']),references);if(errors.length){setError(errors.map(x=>`${x.column}: ${x.reason}`).join('; '));return;}setBusy(true);try{await onSave(row,photo??undefined);onClose();}catch(e){setError(e instanceof Error?e.message:'Save failed');}finally{setBusy(false);}}}>
   {ENTRY_MODELS[module].fields.filter(f=>!f.importOnly).map(f=><Field key={f.key} label={f.label}>
    {f.type==='boolean' ? <input type="checkbox" checked={row[f.key]==='true'} onChange={e=>set(f.key,String(e.target.checked))}/> : f.key==='branch_codes' ? <div className="flex flex-col gap-2 text-sm">{(references['branch_codes']??[]).map(o=><label key={o.value} className="flex gap-2"><input type="checkbox" checked={(row['branch_codes']??'').split(';').includes(o.value)} onChange={e=>{const values=(row['branch_codes']??'').split(';').filter(Boolean);set(f.key,(e.target.checked?[...values,o.value]:values.filter(v=>v!==o.value)).join(';'));}}/>{o.label}</label>)}</div> : f.options || references[f.key] ? <select className={inputCls} required={f.required} value={row[f.key]??''} onChange={e=>set(f.key,e.target.value)}><option value="">—</option>{(f.options?.map(v=>({value:v,label:v.replace(/_/g,' ')}))??references[f.key]??[]).map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select> : <input className={inputCls} required={f.required} type={f.type==='integer'?'number':f.type==='number'?'number':f.type==='date'?'date':f.type==='email'?'email':'text'} min={f.type==='number'||f.type==='integer'?0:undefined} step={f.type==='number'?'any':f.type==='integer'?1:undefined} value={row[f.key]??''} onChange={e=>set(f.key,e.target.value)}/>
    }
   </Field>)}
   {module==='products'&&<Field label={initial?.['id']?'Change product image (optional)':'Product image *'} hint="JPG, PNG or WebP, up to 5 MB.">
    {imageSrc&&!photo&&<img src={imageSrc} alt="Current product" className="mb-2 h-20 w-20 rounded-lg object-cover"/>}
    <input className={inputCls} type="file" accept="image/jpeg,image/png,image/webp" required={!initial?.['id']} onChange={e=>setPhoto(e.target.files?.[0]??null)}/>
   </Field>}
   {extraFields}
   {error&&<p role="alert" className="sm:col-span-2 text-sm text-destructive">{error}</p>}
   <Button className="sm:col-span-2" disabled={busy} type="submit">{busy?'Saving…':'Save'}</Button>
  </form>
 </Modal>;
}