export type EntryModule = 'products' | 'batches' | 'suppliers' | 'categories' | 'branches' | 'staff' | 'settings';
export type EntryRow = Record<string, string>;
export interface EntryField { key: string; label: string; type?: 'number' | 'integer' | 'date' | 'email' | 'boolean'; required?: boolean; reference?: string; options?: string[]; default?: string; importOnly?: boolean; importable?: boolean }
const text = (key: string, label: string, required = false): EntryField => ({ key, label, required });
const numeric = (key: string, label: string, integer = false, required = false): EntryField => ({ key, label, type: integer ? 'integer' : 'number', required });
const importText = (key: string, label: string, importable = true): EntryField => ({ ...text(key, label), importOnly: true, importable });
const importNumeric = (key: string, label: string, integer = false): EntryField => ({ ...numeric(key, label, integer), importOnly: true });
const importDate = (key: string, label: string): EntryField => ({ key, label, type: 'date', importOnly: true });
const active: EntryField = { key: 'is_active', label: 'Active', type: 'boolean', default: 'true' };
export const ENTRY_MODELS: Record<EntryModule, { label: string; fields: EntryField[]; unique: string[] }> = {
 products: { label: 'Products', unique: ['sku'], fields: [text('name','Product name',true),text('generic_name','Generic name'),text('brand_name','Brand'),text('category_name','Category'),text('description','Description'),text('sku','SKU',true),text('barcode','Barcode'),text('dosage_form','Dosage form'),text('strength','Strength'),text('unit_of_measurement','Unit of measurement',true),text('packaging','Packaging'),numeric('cost_price','Purchase price (TZS)'),numeric('selling_price','Selling price (TZS)',false,true),numeric('min_stock_level','Reorder level',true),text('supplier_name','Supplier'),{key:'is_prescription_required',label:'Prescription required',type:'boolean',default:'false'},active,importNumeric('quantity','Opening stock quantity',true),importText('branch_code','Opening stock branch',false),importText('batch_number','Batch number'),importDate('expiry_date','Expiry date'),importDate('received_date','Received date'),importNumeric('cost_per_unit','Batch purchase cost')] },
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
const IMPORT_HEADER_ALIASES: Record<string, string[]> = {
 name: ['product name', 'brand name'],
 sku: ['product sku', 'item code', 'item code (sku)', 'stock code'],
 product_sku: ['sku', 'product id', 'id', 'product code', 'drug code', 'medicine code', 'item code', 'code'],
 brand_name: ['brand name'],
 unit_of_measurement: ['selling unit', 'unit'],
 cost_price: ['buying price', 'buying price (tzs)', 'purchase price', 'purchase price (tzs)'],
 selling_price: ['selling price (tzs)', 'retail price'],
 min_stock_level: ['reorder level', 'minimum stock'],
 quantity: ['stock quantity', 'opening stock', 'opening stock quantity', 'stock qty', 'qty', 'on hand', 'on hand quantity', 'stock on hand', 'available units', 'current stock', 'current balance', 'quantity in stock', 'balance', 'closing balance'],
 branch_code: ['branch', 'branch name', 'location', 'outlet', 'store code'],
 batch_number: ['batch no', 'batch number', 'lot number', 'lot no', 'lot', 'lot ref'],
 expiry_date: ['expiry month', 'expiry', 'expiration date', 'best before', 'use by'],
 received_date: ['purchase month', 'purchase date', 'date received'],
 cost_per_unit: ['buying price', 'buying price (tzs)', 'buy price', 'purchase price', 'purchase price (tzs)', 'purchase cost', 'unit cost'],
};
const normalizeHeader = (value: string) => value.replace(/^\uFEFF/, '').toLowerCase().replace(/[^a-z0-9]/g, '');
export function defaultImportMapping(module: EntryModule, headers: string[]): Record<string, string> {
 const normalized = headers.map(normalizeHeader);
 const mapping = Object.fromEntries(ENTRY_MODELS[module].fields.filter(f=>f.importable!==false).map(field=>{
  const candidates=[field.key,field.label,...(IMPORT_HEADER_ALIASES[field.key]??[])].map(normalizeHeader);
  const index=candidates.map(candidate=>normalized.indexOf(candidate)).find(i=>i>=0)??-1;
  return [field.key,headers[index]??''];
 }));
 if(module==='products'){
  const index=normalized.findIndex(header=>['id','sourceid','externalid','productid'].includes(header));
  if(index>=0)mapping['source_id']=headers[index]??'';
 }
 return mapping;
}
const dateValue=(year:number,month:number,day:number,original:string):string=>{
 const date=new Date(Date.UTC(year,month-1,day));
 return date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&date.getUTCDate()===day
  ?`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`
  :original;
};
const isValidIsoDate=(value:string):boolean=>{
 const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
 if(!match)return false;
 const year=Number(match[1]);const month=Number(match[2]);const day=Number(match[3]);const date=new Date(Date.UTC(year,month-1,day));
 return date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&date.getUTCDate()===day;
};
const MONTHS=['january','february','march','april','may','june','july','august','september','october','november','december'];
export function normalizeImportValue(field: EntryField, input: string): string {
 const value=input.trim();
 if(!value)return '';
 if(field.type==='number'||field.type==='integer')return value.replace(/^TZS\s*/i,'').replace(/,/g,'').trim();
 if(field.type==='boolean'){
  if(['true','yes','y','1','active'].includes(value.toLowerCase()))return 'true';
  if(['false','no','n','0','inactive'].includes(value.toLowerCase()))return 'false';
 }
 if(field.type==='date'){
  const iso=value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);
  if(iso)return dateValue(Number(iso[1]),Number(iso[2]),Number(iso[3]),value);
  const yearMonthDay=value.match(/^(\d{4})[-/\s]+([A-Za-z]+)[-/\s]+(\d{1,2})(?:[,\s].*)?$/);
  if(yearMonthDay){const month=MONTHS.indexOf((yearMonthDay[2]??'').toLowerCase())+1;if(month)return dateValue(Number(yearMonthDay[1]),month,Number(yearMonthDay[3]),value);}
  const dayMonthYear=value.match(/^(\d{1,2})[-/\s]+([A-Za-z]+)[,/\s-]+(\d{4})(?:[,\s].*)?$/);
  if(dayMonthYear){const month=MONTHS.indexOf((dayMonthYear[2]??'').toLowerCase())+1;if(month)return dateValue(Number(dayMonthYear[3]),month,Number(dayMonthYear[1]),value);}
  const monthDayYear=value.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})(?:[,\s].*)?$/);
  if(monthDayYear){const month=MONTHS.indexOf((monthDayYear[1]??'').toLowerCase())+1;if(month)return dateValue(Number(monthDayYear[3]),month,Number(monthDayYear[2]),value);}
  if(/^(?:\d{4}\s*[-/]\s*[A-Za-z]+|[A-Za-z]+\s+\d{4})$/.test(value))return '';
 }
 return value;
}
export function matchProductPhotos(rows: EntryRow[], files: File[]) {
 const bySku=new Map<string,File>();const byRow=new Map<number,File>();const errors:string[]=[];const unmatched:string[]=[];
 const identifiers=new Map<string,number[]>();
 rows.forEach((row,index)=>{
  const sku=(row['sku']??'').trim().toLowerCase();
  const sourceId=(row['source_id']??'').trim().toLowerCase();
  const keys=new Set([sku,sourceId].filter(Boolean));
  if(sourceId)keys.add(`ph-${sourceId}`);
  if(sku.startsWith('ph-'))keys.add(sku.slice(3));
  for(const key of keys)identifiers.set(key,[...(identifiers.get(key)??[]),index]);
 });
 for(const file of files){
  const match=/^(.+)\.(jpe?g|png|webp)$/i.exec(file.name);
  if(!match||!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024){errors.push(`${file.name}: choose a JPG, PNG or WebP under 5 MB`);continue;}
  const key=(match[1]??'').trim().toLowerCase();const candidates=identifiers.get(key)??[];
  if(!candidates.length){unmatched.push(file.name);continue;}
  if(candidates.length!==1){errors.push(`${file.name}: identifier ${match[1]} matches more than one product`);continue;}
  const index=candidates[0]!;
  if(byRow.has(index)){errors.push(`${file.name}: more than one image matches ${rows[index]?.['sku']||rows[index]?.['source_id']||'this product'}`);continue;}
  byRow.set(index,file);
  if(rows[index]?.['sku'])bySku.set(rows[index]!['sku']!.trim().toLowerCase(),file);
 }
 const missing=rows.flatMap((row,index)=>byRow.has(index)?[]:[row['sku']?.trim()||row['source_id']?.trim()||`row ${index+2}`]);
 return {bySku,byRow,errors,missing,unmatched};
}
export function replaceEntryReference(rows: EntryRow[], column: string, source: string, replacement: string): EntryRow[] {
 return rows.map(row => (row[column] ?? '').trim().toLowerCase() === source.trim().toLowerCase() ? {...row, [column]: replacement} : row);
}
export function validateEntries(module: EntryModule, rows: EntryRow[], existing: EntryRow[] = [], references: EntryReferences = {}): EntryError[] {
 const errors: EntryError[]=[]; const model=ENTRY_MODELS[module]; const seen=new Set<string>();
 const identity=(r:EntryRow)=>model.unique.map(k=>(r[k]??'').trim().toLowerCase()).join('|');
 const old=new Set(existing.map(identity));
 rows.forEach((r,index)=>{
  const add=(column:string,reason:string)=>errors.push({row:Number(r['source_row'])||index+2,column,reason});
  for(const f of model.fields){
   const value=(r[f.key]??'').trim();
   if(!value){if(f.required)add(f.key,'Required value is missing');continue;}
   if((f.type==='number'||f.type==='integer')&&(!Number.isFinite(Number(value))||Number(value)<0||(f.type==='integer'&&!Number.isInteger(Number(value)))))add(f.key,'Enter a non-negative '+(f.type==='integer'?'whole number':'number'));
   if(f.type==='date'&&value&&!isValidIsoDate(value))add(f.key,'Use a valid date in YYYY-MM-DD format');
   if(f.type==='email'&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))add(f.key,'Enter a valid email address');
   if(f.type==='boolean'&&!['true','false'].includes(value.toLowerCase()))add(f.key,'Use true or false');
   if(f.options&&!f.options.includes(value))add(f.key,'Choose one of: '+f.options.join(', '));
   if(references[f.key]){
    const values=f.key==='branch_codes'?value.split(';').map(v=>v.trim()):[value];
    for(const v of values){const matches=(references[f.key] ?? []).filter(o=>o.value.toLowerCase()===v.toLowerCase());if(matches.length!==1)add(f.key,`Unknown or ambiguous reference: ${v}`);}
   }
  }
  if(module==='products'&&Number(r['quantity'])>0){
   for(const key of ['branch_code','batch_number','expiry_date','received_date'])if(!(r[key]??'').trim())add(key,key==='received_date'?'Enter an exact received date; month-only values are not converted to a day':'Required when opening stock quantity is greater than zero');
  }
  if(module==='batches'&&Number(r['quantity'])>0&&!(r['received_date']??'').trim())add('received_date','Enter an exact received date; month-only values are not converted to a day');
  if(module==='batches'&&r['manufacturing_date']&&r['expiry_date']&&r['manufacturing_date']>r['expiry_date'])add('manufacturing_date','Manufacturing date must not be after expiry date');
  if(module==='batches'&&Number(r['quantity'])===0)add('quantity','Opening stock quantity must be greater than zero');
  if(model.unique.length&&model.unique.every(k=>r[k]?.trim())){const key=identity(r);if(seen.has(key)||old.has(key))add(model.unique.join(', '),'Duplicate record');seen.add(key);}
 });
 if(rows.length>5000)errors.push({row:0,column:'file',reason:'Import no more than 5000 rows at a time'});
 return errors;
}
/** Afyadawa system barcode: EAN-13 with prefix 2 (in-store range) + valid check digit. */
export function afyadawaBarcode(random: () => number = Math.random): string {
 const body='29'+Array.from({length:10},()=>Math.floor(random()*10)).join('');
 const sum=body.split('').reduce((a,d,i)=>a+Number(d)*(i%2?3:1),0);
 return body+((10-(sum%10))%10);
}
export function fillBarcodes(rows: EntryRow[], random?: () => number): EntryRow[] {
 const used=new Set(rows.map(r=>(r['barcode']??'').trim()).filter(Boolean));
 return rows.map(r=>{if((r['barcode']??'').trim())return r;let code=afyadawaBarcode(random);while(used.has(code))code=afyadawaBarcode(random);used.add(code);return {...r,barcode:code};});
}
