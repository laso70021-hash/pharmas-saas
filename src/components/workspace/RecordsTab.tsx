import { BusinessLogoSettings } from './BusinessLogoSettings';
import { useState } from 'react';
import { RecordActions } from '@/components/common/RecordActions';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { EntryService } from '@/lib/pharmacy-service';
import { ENTRY_MODELS, type EntryModule, type EntryRow } from '@/lib/entry-model';
import type { Workspace } from '@/lib/pharmacy-types';
import { can } from '@/lib/workspace';
import { EntryForm } from './EntryForm';
import { Empty, SectionHeader } from './ws-ui';

export function RecordsTab({ws,module}:{ws:Workspace;module:EntryModule}) {
 const qc=useQueryClient(); const [editing,setEditing]=useState<EntryRow|null>(null);
 const {data:rows=[],isLoading}=useQuery({queryKey:['entry',ws.id,module],queryFn:()=>EntryService.list(ws.id,module)});
 const {data:refs={}}=useQuery({queryKey:['entry-refs',ws.id],queryFn:()=>EntryService.references(ws.id)});
 const editable=can(ws.role,module==='settings'?'manageStaff':module==='branches'?'manageBranches':'manageStock',ws.status);
 return <div className="space-y-5"><SectionHeader title={ENTRY_MODELS[module].label} action={editable&&<Button size="sm" onClick={()=>setEditing(module==='settings'?rows[0]??{}:{})}>{module==='settings'?<Pencil/>:<Plus/>}{module==='settings'?'Edit settings':'Add record'}</Button>}/>
  {module === 'settings' && (ws.role === 'owner' || ws.role === 'admin') && <BusinessLogoSettings pharmacyId={ws.id} name={ws.name} />}
  {isLoading?<Empty>Loading…</Empty>:!rows.length?<Empty>No records yet.</Empty>:<div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead><tr className="border-b border-border">{ENTRY_MODELS[module].fields.slice(0,6).map(f=><th className="py-3 px-2" key={f.key}>{f.label}</th>)}<th>Actions</th></tr></thead><tbody>{rows.map(r=><tr key={r['id']} className="border-b border-border">{ENTRY_MODELS[module].fields.slice(0,6).map(f=><td key={f.key} className="p-2">{r[f.key]||'—'}</td>)}<td>{editable&&(module==='suppliers'?<RecordActions kind="suppliers" record={r} onChanged={()=>{void qc.invalidateQueries({queryKey:['entry',ws.id]});void qc.invalidateQueries({queryKey:['entry-refs',ws.id]});}}/>:<Button variant="ghost" size="icon" aria-label={`Edit ${r['name']??r['id']}`} onClick={()=>setEditing(r)}><Pencil/></Button>)}</td></tr>)}</tbody></table></div>}
  {editing&&<EntryForm module={module} initial={editing} references={refs} existing={rows} onClose={()=>setEditing(null)} onSave={async r=>{await EntryService.save(ws.id,module,r,editing['id']);toast.success('Saved');void qc.invalidateQueries({queryKey:['entry',ws.id]});void qc.invalidateQueries({queryKey:['entry-refs',ws.id]});void qc.invalidateQueries({queryKey:['ws',ws.id]});}}/>}
 </div>;
}