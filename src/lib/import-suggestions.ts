import { z } from 'zod';

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
