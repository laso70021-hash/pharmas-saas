import { z } from 'zod';

export const recordKind = z.enum(['customers','suppliers','profiles','pharmacies']);
export type RecordKind = z.infer<typeof recordKind>;
export const recordFields: Record<RecordKind, string[]> = {
 customers:['full_name','email','phone','address','allergies','chronic_conditions'],
 suppliers:['name','contact_name','email','phone','address','tax_id'],
 profiles:['full_name','phone'],
 pharmacies:['name','owner_name','email','phone','address','city','registration_number','tax_number'],
};
export const recordInput=z.object({kind:recordKind,id:z.string().uuid(),action:z.enum(['edit','delete','deactivate']),values:z.record(z.string().max(5000)).default({})});
export function safeRecordValues(kind:RecordKind, values:Record<string,string>) {
 const clean=Object.fromEntries(recordFields[kind].filter(k=>k in values).map(k=>[k,values[k]?.trim()||null]));
 if('email' in clean&&clean['email'])z.string().email().max(200).parse(clean['email']);
 const name=kind==='profiles'||kind==='customers'?'full_name':'name';
 if(name in clean)z.string().min(1).max(120).parse(clean[name]);
 return clean;
}
export function guardAdminDeletion(currentId:string,targetId:string,isAdmin:boolean,adminCount:number){
 if(currentId===targetId)throw new Error('You cannot delete your own account.');
 if(isAdmin&&adminCount<=1)throw new Error('The last platform administrator cannot be deleted.');
}
export const reportPreferenceInput=z.object({pharmacyId:z.string().uuid(),frequency:z.enum(['daily','weekly','monthly']),recipient_ids:z.array(z.string().uuid()).max(50),topics:z.array(z.enum(['sales','expenses','stock','orders'])).min(1).max(4),language:z.enum(['English','Swahili']),delivery_hour:z.number().int().min(0).max(23),enabled:z.boolean()});
export function reportPeriod(frequency:'daily'|'weekly'|'monthly',now=new Date()){
 const local=new Date(now.getTime()+3*3600000);const end=new Date(Date.UTC(local.getUTCFullYear(),local.getUTCMonth(),local.getUTCDate()));
 if(frequency==='weekly')end.setUTCDate(end.getUTCDate()-((end.getUTCDay()+6)%7));
 if(frequency==='monthly')end.setUTCDate(1);
 const start=new Date(end);
 if(frequency==='monthly')start.setUTCMonth(start.getUTCMonth()-1);else start.setUTCDate(start.getUTCDate()-(frequency==='weekly'?7:1));
 return {key:`${frequency}:${start.toISOString().slice(0,10)}`,start:new Date(start.getTime()-3*3600000).toISOString(),end:new Date(end.getTime()-3*3600000).toISOString()};
}