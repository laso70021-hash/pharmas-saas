import { describe, expect, it } from 'vitest';
import { blankEntry,defaultImportMapping,matchProductPhotos,normalizeImportValue,replaceEntryReference,validateEntries,ENTRY_MODELS } from '@/lib/entry-model';
const product={...blankEntry('products'),name:'Paracetamol',sku:'PCM500',unit_of_measurement:'tablet',selling_price:'100'};
describe('real-world entry validation',()=>{
 it('resolves all matching category errors without changing other categories',()=>{
  const rows=[{...product,category_name:'Pain Relief'},{...product,sku:'PCM501',category_name:' pain relief '},{...product,sku:'PCM502',category_name:'Antibiotics'}];
  const refs={category_name:[{value:'Analgesics',label:'Analgesics'},{value:'Antibiotics',label:'Antibiotics'}]};
  expect(validateEntries('products',rows,[],refs)).toHaveLength(2);
  const resolved=replaceEntryReference(rows,'category_name','Pain Relief','Analgesics');
  expect(resolved.map(row=>row['category_name'])).toEqual(['Analgesics','Analgesics','Antibiotics']);
  expect(validateEntries('products',resolved,[],refs)).toEqual([]);
 });
 it('allows explicitly removing an optional missing category while preserving product data',()=>{
  const rows=[{...product,category_name:'Pain Relief'}];
  const resolved=replaceEntryReference(rows,'category_name','Pain Relief','');
  expect(resolved).toEqual([{...product,category_name:''}]);
  expect(validateEntries('products',resolved,[],{category_name:[]})).toEqual([]);
 });
 it('requires a product name and SKU',()=>{expect(validateEntries('products',[{...product,name:'',sku:''}]).map(e=>e.column)).toEqual(['name','sku']);});
 it('rejects negative prices',()=>{expect(validateEntries('products',[{...product,selling_price:'-1'}])).toEqual(expect.arrayContaining([expect.objectContaining({column:'selling_price'})]));});
 it('rejects fractional opening quantities',()=>{expect(validateEntries('batches',[{product_sku:'PCM500',branch_code:'MAIN',batch_number:'B1',quantity:'1.5',cost_per_unit:'50',expiry_date:'2028-01-01'}])).toEqual(expect.arrayContaining([expect.objectContaining({column:'quantity'})]));});
 it('rejects impossible calendar dates',()=>{expect(validateEntries('batches',[{product_sku:'PCM500',branch_code:'MAIN',batch_number:'B1',quantity:'2',cost_per_unit:'50',expiry_date:'2027-02-30'}])).toEqual(expect.arrayContaining([expect.objectContaining({column:'expiry_date'})]));});
 it('requires manufacturing before expiry',()=>{expect(validateEntries('batches',[{product_sku:'PCM500',branch_code:'MAIN',batch_number:'B1',quantity:'2',cost_per_unit:'50',expiry_date:'2027-01-01',manufacturing_date:'2028-01-01'}])).toEqual(expect.arrayContaining([expect.objectContaining({column:'manufacturing_date'})]));});
 it('detects case-insensitive duplicate product codes',()=>{expect(validateEntries('products',[product,{...product,sku:'pcm500'}])).toEqual(expect.arrayContaining([expect.objectContaining({row:3,reason:'Duplicate record'})]));});
 it('rejects supplier references outside the selected business',()=>{expect(validateEntries('products',[{...product,supplier_name:'Other business'}],[],{supplier_name:[{value:'Our supplier',label:'Our supplier'}]}).length).toBe(1);});
 it('checks every staff branch reference',()=>{expect(validateEntries('staff',[{...blankEntry('staff'),full_name:'Demo staff',email:'staff@example.invalid',branch_codes:'MAIN;OTHER'}],[],{branch_codes:[{value:'MAIN',label:'Main'}]})).toEqual(expect.arrayContaining([expect.objectContaining({column:'branch_codes',reason:'Unknown or ambiguous reference: OTHER'})]));});
 it('does not permit imported platform admins',()=>{expect(validateEntries('staff',[{...blankEntry('staff'),full_name:'Demo',email:'demo@example.invalid',role:'super_admin'}])).toEqual(expect.arrayContaining([expect.objectContaining({column:'role'})]));});
 it('requires positive opening stock',()=>{expect(validateEntries('batches',[{product_sku:'PCM500',branch_code:'MAIN',batch_number:'B1',quantity:'0',cost_per_unit:'50',expiry_date:'2028-01-01'}])).toEqual(expect.arrayContaining([expect.objectContaining({column:'quantity',reason:'Opening stock quantity must be greater than zero'})]));});
 it('detects duplicate product batches in the same branch',()=>{const batch={product_sku:'PCM500',branch_code:'MAIN',batch_number:'B1',quantity:'2',cost_per_unit:'50',expiry_date:'2028-01-01'};expect(validateEntries('batches',[batch,{...batch}])).toEqual(expect.arrayContaining([expect.objectContaining({row:3,reason:'Duplicate record'})]));});
 it('maps legacy pharmacy product headers and normalizes prices and month dates',()=>{
  const headers=['ID','Brand Name','Generic Name','Quantity','Selling Unit','Buying Price (TZS)','Selling Price (TZS)','Batch No','Expiry Month','Purchase Month'];
  const mapping=defaultImportMapping('products',headers);
  expect(mapping).toMatchObject({sku:'ID',name:'Brand Name',generic_name:'Generic Name',quantity:'Quantity',unit_of_measurement:'Selling Unit',cost_price:'Buying Price (TZS)',selling_price:'Selling Price (TZS)',batch_number:'Batch No',expiry_date:'Expiry Month',received_date:'Purchase Month'});
  const price=ENTRY_MODELS.products.fields.find(field=>field.key==='cost_price')!;
  const expiry=ENTRY_MODELS.products.fields.find(field=>field.key==='expiry_date')!;
  const purchase=ENTRY_MODELS.products.fields.find(field=>field.key==='received_date')!;
  expect(normalizeImportValue(price,'TZS 1,500')).toBe('1500');
  expect(normalizeImportValue(expiry,'2029 - November')).toBe('2029-11-30');
  expect(normalizeImportValue(purchase,'2026 - November')).toBe('2026-11-01');
 });
 it('maps common stock-list headers to existing-product batch fields',()=>{
  expect(defaultImportMapping('batches',['Drug Code','Current Balance','Outlet','Lot Ref','Use By','Buy Price'])).toMatchObject({
   product_sku:'Drug Code',quantity:'Current Balance',branch_code:'Outlet',batch_number:'Lot Ref',expiry_date:'Use By',cost_per_unit:'Buy Price',
  });
 });
 it('requires batch details and a valid branch for imported opening stock',()=>{
  const refs={branch_code:[{value:'MAIN',label:'Main'}]};
  expect(validateEntries('products',[{...product,quantity:'4',batch_number:'B1',expiry_date:'2028-01-01',branch_code:'OTHER'}],[],refs)).toEqual(expect.arrayContaining([expect.objectContaining({column:'branch_code',reason:'Unknown or ambiguous reference: OTHER'})]));
  expect(validateEntries('products',[{...product,quantity:'4'}],[],refs)).toEqual(expect.arrayContaining([expect.objectContaining({column:'batch_number',reason:'Required when opening stock quantity is greater than zero'}),expect.objectContaining({column:'expiry_date',reason:'Required when opening stock quantity is greater than zero'})]));
 });
 it('matches uploaded photos to product SKU case-insensitively and reports missing images',()=>{
  const photo=new File(['photo'],'pcm500.JPG',{type:'image/jpeg'});
  const result=matchProductPhotos([{...product,sku:'PCM500'},{...product,sku:'PCM501'}],[photo]);
  expect(result.bySku.get('pcm500')).toBe(photo);
  expect(result.missing).toEqual(['PCM501']);
  expect(result.errors).toEqual([]);
 });
});
import { afyadawaBarcode, fillBarcodes } from '@/lib/entry-model';
describe('Afyadawa barcodes', () => {
 it('generates a valid 13-digit EAN starting with 29', () => {
  const code = afyadawaBarcode(() => 0);
  expect(code).toBe('2900000000001');
 });
 it('fills only empty barcodes', () => {
  const rows = fillBarcodes([{ barcode: '123' }, { barcode: '' }]);
  expect(rows[0]!['barcode']).toBe('123');
  expect(rows[1]!['barcode']).toMatch(/^29\d{11}$/);
 });
});
