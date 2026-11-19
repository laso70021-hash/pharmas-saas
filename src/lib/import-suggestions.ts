import { z } from 'zod';
import { ENTRY_MODELS } from './entry-model';

export const categorySuggestionInput=z.object({
 pharmacyId:z.string().uuid(),
 unmatchedCategory:z.string().trim().min(1).max(200),
 details:z.string().trim().min(1).max(4000),
});
export const categorySuggestionOutput=z.object({categoryId:z.string().nullable(),reason:z.string().min(1).max(500)});
export function checkedCategorySuggestion(value:unknown,categories:{id:string;name:string}[]) {
 const parsed=categorySuggestionOutput.parse(value);
 if(parsed.categoryId===null)return {category:null,reason:parsed.reason};
 const category=categories.find(c=>c.id===parsed.categoryId);
 if(!category)throw new Error('The suggested category is not available in this workspace.');
 return {category,reason:parsed.reason};
}
export const referenceResolveInput=z.object({
 pharmacyId:z.string().uuid(),
 items:z.array(z.object({column:z.enum(['category_name','supplier_name']),value:z.string().trim().min(1).max(200),details:z.string().max(1500)})).min(1).max(40),
});
export const referenceResolveOutput=z.object({results:z.array(z.object({column:z.enum(['category_name','supplier_name']),value:z.string(),name:z.string().trim().min(1).max(120),isNew:z.boolean(),reason:z.string().max(300)}))});
/** Keep only answers for asked items; force isNew=false when the name already exists (case-insensitive). */
export function checkedReferenceResolution(value:unknown,asked:{column:string;value:string}[],existing:Record<string,string[]>){
 const parsed=referenceResolveOutput.parse(value);
 return parsed.results.filter(r=>asked.some(a=>a.column===r.column&&a.value.toLowerCase()===r.value.toLowerCase())).map(r=>{
  const match=(existing[r.column]??[]).find(n=>n.toLowerCase()===r.name.trim().toLowerCase());
  return match?{...r,name:match,isNew:false}:{...r,name:r.name.trim(),isNew:true};
 });
}
export const importMappingInput=z.object({
 pharmacyId:z.string().uuid(),
 module:z.enum(['products','batches']),
 headers:z.array(z.string().trim().min(1).max(200)).min(1).max(80),
 sampleRows:z.array(z.array(z.string().max(160)).max(80)).max(3),
});
export const importReviewInput=z.object({
 pharmacyId:z.string().uuid(),
 module:z.enum(['products','batches']),
 rows:z.array(z.object({
  row:z.number().int().min(2),
  values:z.array(z.object({field:z.string().max(80),value:z.string().max(160)})).max(40),
 })).min(1).max(80),
});
const importReviewOutput=z.object({findings:z.array(z.object({
 row:z.number().int().min(2),
 field:z.string().max(80),
 severity:z.enum(['review','warning']),
 reason:z.string().trim().min(1).max(300),
})).max(40)});
export function checkedImportReview(value:unknown,module:'products'|'batches',askedRows:{row:number}[]){
 const parsed=importReviewOutput.parse(value);
 const allowed=new Set([...ENTRY_MODELS[module].fields.filter(f=>f.importable!==false).map(f=>f.key),'source_id','source_expiry_date','source_received_date']);
 const rows=new Set(askedRows.map(item=>item.row));
 return parsed.findings.filter(item=>rows.has(item.row)&&allowed.has(item.field)).map(item=>({...item,reason:item.reason.trim()}));
}
const importMappingOutput=z.object({mappings:z.array(z.object({
 field:z.string().max(80),header:z.string().nullable(),reason:z.string().max(240),
})).max(40)});
export function checkedImportMapping(value:unknown,module:'products'|'batches',headers:string[]){
 const parsed=importMappingOutput.parse(value);
 const allowed=new Set(ENTRY_MODELS[module].fields.filter(f=>f.importable!==false).map(f=>f.key));
 const available=new Set(headers);
 const seen=new Set<string>();
 const mapping:Record<string,string>={};
 const reasons:{field:string;header:string;reason:string}[]=[];
 for(const item of parsed.mappings){
  if(!allowed.has(item.field)||seen.has(item.field))throw new Error('Covlo returned an invalid field mapping.');
  seen.add(item.field);
  if(item.header===null)continue;
  if(!available.has(item.header))throw new Error('Covlo returned a column that is not in this file.');
  mapping[item.field]=item.header;
  reasons.push({field:item.field,header:item.header,reason:item.reason});
 }
 return {mapping,reasons};
}
