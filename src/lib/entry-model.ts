export type EntryModule = 'products' | 'batches' | 'suppliers' | 'categories' | 'branches' | 'staff' | 'settings';
export type EntryRow = Record<string, string>;
export interface EntryField { key: string; label: string; type?: 'number' | 'integer' | 'date' | 'email' | 'boolean'; required?: boolean; reference?: string; options?: string[]; default?: string }
const text = (key: string, label: string, required = false): EntryField => ({ key, label, required });
const numeric = (key: string, label: string, integer = false, required = false): EntryField => ({ key, label, type: integer ? 'integer' : 'number', required });
const active: EntryField = { key: 'is_active', label: 'Active', type: 'boolean', default: 'true' };
export const ENTRY_MODELS: Record<EntryModule, { label: string; fields: EntryField[]; unique: string[] }> = {
 products: { label: 'Products', unique: ['sku'], fields: [text('name','Product name',true),text('generic_name','Generic name'),text('brand_name','Brand'),text('category_name','Category'),text('description','Description'),text('sku','SKU',true),text('barcode','Barcode'),text('dosage_form','Dosage form'),text('strength','Strength'),text('unit_of_measurement','Unit of measurement',true),text('packaging','Packaging'),numeric('cost_price','Purchase price (TZS)'),numeric('selling_price','Selling price (TZS)',false,true),numeric('min_stock_level','Reorder level',true),text('supplier_name','Supplier'),{key:'is_prescription_required',label:'Prescription required',type:'boolean',default:'false'},active] },
 batches: { label: 'Batches / Opening stock', unique: ['product_sku','branch_code','batch_number'], fields: [text('product_sku','Product SKU',true),text('branch_code','Branch code',true),text('batch_number','Batch number',true),{key:'manufacturing_date',label:'Manufacturing date',type:'date'},{key:'expiry_date',label:'Expiry date',type:'date',required:true},{key:'received_date',label:'Received date',type:'date'},numeric('quantity','Stock quantity',true,true),numeric('cost_per_unit','Purchase cost per unit (TZS)',false,true)] },
 suppliers: { label: 'Suppliers', unique: ['name'], fields:[text('name','Company name',true),text('contact_name','Contact person'),text('phone','Phone'),{key:'email',label:'Email',type:'email'},text('address','Address'),text('tax_id','Tax ID'),active] },
 categories: { label: 'Categories', unique: ['slug'], fields:[text('name','Category name',true),text('slug','Category code',true),text('description','Description'),active] },
 branches: { label: 'Branches', unique: ['code'], fields:[text('name','Branch name',true),text('code','Branch code',true),text('address','Address'),text('phone','Phone'),{key:'is_main',label:'Main branch',type:'boolean',default:'false'},text('manager_id','Branch manager'),active] },
 staff: { label: 'Staff invitations', unique: ['email'], fields:[text('full_name','Full name',true),{key:'email',label:'Email',type:'email',required:true},text('phone','Phone'),text('staff_id','Staff ID'),text('job_title','Job title'),{key:'role',label:'Role',required:true,options:['manager','pharmacist','cashier','accountant','inventory_manager','delivery_rider'],default:'cashier'},text('branch_codes','Assigned branch codes (separate with ;)'),{key:'employment_status',label:'Employment status',options:['active','on_leave','inactive'],default:'active'}] },
 settings: { label: 'Business settings',unique:[],fields:[text('name','Business name',true),text('registration_number','Registration number'),text('tax_number','Tax number'),text('owner_name','Owner name',true),{key:'email',label:'Contact email',type:'email'},text('phone','Phone'),text('address','Address'),text('city','City'),text('country','Country')] },
};
export interface EntryReferences { [field: string]: { value: string; label: string }[] }
export interface EntryError { row: number; column: string; reason: string }
export function blankEntry(module: EntryModule): EntryRow { return Object.fromEntries(ENTRY_MODELS[module].fields.map(f=>[f.key,f.default ?? ''])); }
export function replaceEntryReference(rows: EntryRow[], column: string, source: string, replacement: string): EntryRow[] {
 return rows.map(row => (row[column] ?? '').trim().toLowerCase() === source.trim().toLowerCase() ? {...row, [column]: replacement} : row);
}
export function validateEntries(module: EntryModule, rows: EntryRow[], existing: EntryRow[] = [], references: EntryReferences = {}): EntryError[] {
 const errors: EntryError[]=[]; const model=ENTRY_MODELS[module]; const seen=new Set<string>();
 const identity=(r:EntryRow)=>model.unique.map(k=>(r[k]??'').trim().toLowerCase()).join('|');
 const old=new Set(existing.map(identity));
 rows.forEach((r,index)=>{
  const add=(column:string,reason:string)=>errors.push({row:index+2,column,reason});
  for(const f of model.fields){
   const value=(r[f.key]??'').trim();
   if(!value){if(f.required)add(f.key,'Required value is missing');continue;}
   if((f.type==='number'||f.type==='integer')&&(!Number.isFinite(Number(value))||Number(value)<0||(f.type==='integer'&&!Number.isInteger(Number(value)))))add(f.key,'Enter a non-negative '+(f.type==='integer'?'whole number':'number'));
   if(f.type==='date'&&(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value))add(f.key,'Use a valid date in YYYY-MM-DD format');
   if(f.type==='email'&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))add(f.key,'Enter a valid email address');
   if(f.type==='boolean'&&!['true','false'].includes(value.toLowerCase()))add(f.key,'Use true or false');
   if(f.options&&!f.options.includes(value))add(f.key,'Choose one of: '+f.options.join(', '));
   if(references[f.key]){
    const values=f.key==='branch_codes'?value.split(';').map(v=>v.trim()):[value];
    for(const v of values){const matches=(references[f.key] ?? []).filter(o=>o.value.toLowerCase()===v.toLowerCase());if(matches.length!==1)add(f.key,`Unknown or ambiguous reference: ${v}`);}
   }
  }
  if(module==='batches'&&r['manufacturing_date']&&r['expiry_date']&&r['manufacturing_date']>r['expiry_date'])add('manufacturing_date','Manufacturing date must not be after expiry date');
  if(module==='batches'&&Number(r['quantity'])===0)add('quantity','Opening stock quantity must be greater than zero');
  if(model.unique.length&&model.unique.every(k=>r[k]?.trim())){const key=identity(r);if(seen.has(key)||old.has(key))add(model.unique.join(', '),'Duplicate record');seen.add(key);}
 });
 if(rows.length>5000)errors.push({row:0,column:'file',reason:'Import no more than 5000 rows at a time'});
 return errors;
}
/** Swahivo system barcode: EAN-13 with Swahivo prefix 2 (in-store range) + valid check digit. */
export function swahivoBarcode(random: () => number = Math.random): string {
 const body='29'+Array.from({length:10},()=>Math.floor(random()*10)).join('');
 const sum=body.split('').reduce((a,d,i)=>a+Number(d)*(i%2?3:1),0);
 return body+((10-(sum%10))%10);
}
export function fillBarcodes(rows: EntryRow[], random?: () => number): EntryRow[] {
 const used=new Set(rows.map(r=>(r['barcode']??'').trim()).filter(Boolean));
 return rows.map(r=>{if((r['barcode']??'').trim())return r;let code=swahivoBarcode(random);while(used.has(code))code=swahivoBarcode(random);used.add(code);return {...r,barcode:code};});
}
