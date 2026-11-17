import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { EntryService, PharmacyService } from '@/lib/pharmacy-service';
import { Modal, Field, inputCls } from './ws-ui';
export function AdminBusinessForm({onClose,onCreated}:{onClose:()=>void;onCreated:(id:string)=>void}){
 const {data:plans=[]}=useQuery({queryKey:['subscription-plans'],queryFn:()=>PharmacyService.getPlans()});
 const [row,setRow]=useState<Record<string,string>>({});const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 return <Modal title="Register business" onClose={onClose} wide><form className="grid sm:grid-cols-2 gap-3" onSubmit={async e=>{e.preventDefault();setBusy(true);try{const id=await EntryService.registerBusiness(row);onCreated(id);}catch(e){setError(e instanceof Error?e.message:'Registration failed');}finally{setBusy(false);}}}>
 {['business_name','owner_name','email','phone','city','address','registration_number','tax_number'].map(key=><Field key={key} label={key.replace(/_/g,' ')}><input className={inputCls} required={key==='business_name'||key==='owner_name'} type={key==='email'?'email':'text'} value={row[key]??''} onChange={e=>setRow(r=>({...r,[key]:e.target.value}))}/></Field>)}
 <Field label="Business type"><select required className={inputCls} value={row['business_type']??'pharmacy'} onChange={e=>setRow(r=>({...r,business_type:e.target.value}))}><option value="pharmacy">Pharmacy</option><option value="supplier">Supplier (wholesale)</option></select></Field>
 <Field label="Plan"><select required className={inputCls} value={row['plan_slug']??''} onChange={e=>setRow(r=>({...r,plan_slug:e.target.value}))}><option value="">Choose plan</option>{plans.map(p=><option key={p.id} value={p.slug}>{p.name}</option>)}</select></Field>
 {error&&<p role="alert" className="text-destructive">{error}</p>}<Button type="submit" disabled={busy}>{busy?'Submitting…':'Submit registration'}</Button></form></Modal>;
}