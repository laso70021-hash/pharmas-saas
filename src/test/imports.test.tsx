import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ImportsTab } from '@/components/workspace/ImportsTab';
import type { Workspace } from '@/lib/pharmacy-types';
const suggest=vi.hoisted(()=>vi.fn(async()=>({category:{id:'category-1',name:'Analgesics'},reason:'Matches pain relief products.',error:null})));
const mapColumns=vi.hoisted(()=>vi.fn(async()=>({mapping:{} as Record<string,string>,reasons:[] as {field:string;header:string;reason:string}[],error:null as string|null})));
const review=vi.hoisted(()=>vi.fn(async()=>({findings:[] as {row:number;field:string;severity:'review'|'warning';reason:string}[],error:null as string|null})));
vi.mock('@tanstack/react-start',()=>({useServerFn:(fn:unknown)=>fn}));
vi.mock('@/lib/import-suggestions.functions',()=>({suggestImportCategory:suggest,suggestImportMapping:mapColumns,reviewImportRows:review,resolveImportReferences:vi.fn()}));
vi.mock('@/lib/invoice-scan.functions',()=>({scanInvoice:vi.fn()}));

const service=vi.hoisted(()=>({
 references:vi.fn(async()=>({category_name:[{value:'Analgesics',label:'Analgesics'}],supplier_name:[],branch_code:[{value:'MAIN',label:'Main (MAIN)'}]})),
 list:vi.fn(async()=>[]),history:vi.fn(async()=>[]),
 import:vi.fn(async()=>({status:'completed',successful_count:2,failed_count:0})),
}));
vi.mock('@/lib/pharmacy-service',()=>({EntryService:service,WorkspaceService:{getPlanFeatures:vi.fn(async()=>({plan:{has_bulk_import_ocr:true},status:'active'}))}}));
const ws:Workspace={id:'test-pharmacy',name:'Test pharmacy',business_type:'pharmacy',city:null,role:'admin',status:'active',plan_name:'Essential',plan_slug:'essential',limits:{max_branches:1,max_employees:3},trial_ends_at:null,subscription_ends_at:null};
afterEach(()=>{cleanup();vi.clearAllMocks();});
describe('import category resolution',()=>{
 it('only applies AI category matches after explicit approval',async()=>{
  const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
  render(<QueryClientProvider client={client}><ImportsTab ws={ws}/></QueryClientProvider>);
  const file=new File([''],'products.csv',{type:'text/csv'});
  Object.defineProperty(file,'text',{value:async()=> 'name,sku,unit_of_measurement,selling_price,category_name\nParacetamol,PCM500,tablet,100,Pain Relief'});
  fireEvent.change(screen.getByLabelText('Upload import file'),{target:{files:[file]}});
  fireEvent.change(screen.getByLabelText('Upload product photos'),{target:{files:[new File(['photo'],'PCM500.jpg',{type:'image/jpeg'})]}});
  fireEvent.click(await screen.findByRole('button',{name:'Preview and validate'}));
  fireEvent.click(await screen.findByRole('button',{name:'Suggest category'}));
  fireEvent.change(screen.getByLabelText('Unmatched row details'),{target:{value:'Paracetamol tablets for pain relief'}});
  fireEvent.click(screen.getByRole('button',{name:'Find matching category'}));
  await screen.findByText('Matches pain relief products.');
  expect(suggest).toHaveBeenCalledWith({data:{pharmacyId:ws.id,unmatchedCategory:'Pain Relief',details:'Paracetamol tablets for pain relief'}});
  expect(screen.getByLabelText('Row 2 category_name')).toHaveValue('Pain Relief');
  expect(screen.getByRole('button',{name:'Import 1 records'})).toBeDisabled();
  fireEvent.click(screen.getByRole('button',{name:'Apply to 1 matching rows'}));
  expect(screen.getByLabelText('Row 2 category_name')).toHaveValue('Analgesics');
  fireEvent.click(screen.getByLabelText('I understand these products will be imported with zero stock.'));
  expect(screen.getByRole('button',{name:'Import 1 records'})).toBeEnabled();
  expect(service.import).not.toHaveBeenCalled();
 });
 it('unblocks validation and submits all corrected rows through the import service',async()=>{
  const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
  render(<QueryClientProvider client={client}><ImportsTab ws={ws}/></QueryClientProvider>);
  const file=new File([''], 'products.csv',{type:'text/csv'});
  Object.defineProperty(file,'text',{value:async()=> 'name,sku,unit_of_measurement,selling_price,category_name\nParacetamol,PCM500,tablet,100,Pain Relief\nIbuprofen,IBU200,tablet,200,Pain Relief'});
  fireEvent.change(screen.getByLabelText('Upload import file'),{target:{files:[file]}});
  fireEvent.change(screen.getByLabelText('Upload product photos'),{target:{files:[new File(['photo'],'PCM500.jpg',{type:'image/jpeg'}),new File(['photo'],'IBU200.jpg',{type:'image/jpeg'})]}});
  fireEvent.click(await screen.findByRole('button',{name:'Preview and validate'}));
  await waitFor(()=>expect(screen.getByRole('button',{name:'Import 2 records'})).toBeDisabled());
  fireEvent.change(await screen.findByLabelText('Resolve category_name Pain Relief'),{target:{value:'Analgesics'}});
  expect(screen.getByRole('button',{name:'Import 2 records'})).toBeDisabled();
  fireEvent.click(screen.getByLabelText('I understand these products will be imported with zero stock.'));
  await waitFor(()=>expect(screen.getByRole('button',{name:'Import 2 records'})).toBeEnabled());
  fireEvent.click(screen.getByRole('button',{name:'Import 2 records'}));
  fireEvent.click(screen.getByRole('button',{name:'Confirm import'}));
  await screen.findByText('2 records imported. No failed records.');
  expect(service.import).toHaveBeenCalledWith('test-pharmacy','products',[
   expect.objectContaining({sku:'PCM500',category_name:'Analgesics'}),
   expect.objectContaining({sku:'IBU200',category_name:'Analgesics'}),
  ],'products.csv',expect.arrayContaining([expect.objectContaining({name:'PCM500.jpg'}),expect.objectContaining({name:'IBU200.jpg'})]));
 });
 it('maps legacy product exports and includes opening stock in the selected branch',async()=>{
  const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
  render(<QueryClientProvider client={client}><ImportsTab ws={ws}/></QueryClientProvider>);
  service.import.mockResolvedValueOnce({status:'completed',successful_count:1,failed_count:0});
  const file=new File([''],'legacy-products.csv',{type:'text/csv'});
  Object.defineProperty(file,'text',{value:async()=> 'ID,Brand Name,Generic Name,Dosage Form,Quantity,Selling Unit,Buying Price (TZS),Selling Price (TZS),Batch No,Expiry Month,Purchase Month\n428126,VIGOR DOCTOR,Medicine,Toothpaste,4,Pack,"TZS 1,500","TZS 3,000",V240,2029 - November,2026 - November'});
  fireEvent.change(screen.getByLabelText('Upload import file'),{target:{files:[file]}});
  fireEvent.change(screen.getByLabelText('Upload product photos'),{target:{files:[new File(['photo'],'428126.jpg',{type:'image/jpeg'})]}});
  fireEvent.click(await screen.findByRole('button',{name:'Preview and validate'}));
  expect(screen.getByLabelText('Opening stock branch')).toHaveValue('MAIN');
  expect(screen.getByLabelText('Row 2 sku')).toHaveValue('PH-428126');
  expect(screen.getByLabelText('Row 2 source_id')).toHaveValue('428126');
  expect(screen.getByLabelText('Row 2 quantity')).toHaveValue('4');
  expect(screen.getByText('2029 - November')).toBeInTheDocument();
  expect(screen.getByText('2026 - November')).toBeInTheDocument();
  expect(screen.getByLabelText('Row 2 expiry_date')).toHaveValue('');
  expect(screen.getByLabelText('Row 2 received_date')).toHaveValue('');
  fireEvent.change(screen.getByLabelText('Row 2 expiry_date'),{target:{value:'2029-11-30'}});
  fireEvent.change(screen.getByLabelText('Row 2 received_date'),{target:{value:'2026-11-18'}});
  fireEvent.click(await screen.findByRole('button',{name:'Import 1 records'}));
  fireEvent.click(screen.getByRole('button',{name:'Confirm import'}));
  await screen.findByText('1 records imported. No failed records.');
  expect(service.import).toHaveBeenCalledWith('test-pharmacy','products',[
   expect.objectContaining({sku:'PH-428126',source_id:'428126',source_row:'2',name:'VIGOR DOCTOR',quantity:'4',branch_code:'MAIN',batch_number:'V240',expiry_date:'2029-11-30',received_date:'2026-11-18',cost_price:'1500',cost_per_unit:'1500',selling_price:'3000'}),
  ],'legacy-products.csv',expect.arrayContaining([expect.objectContaining({name:'428126.jpg'})]));
 });
 it('allows products without photos and explains that a placeholder will be used',async()=>{
  const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
  render(<QueryClientProvider client={client}><ImportsTab ws={ws}/></QueryClientProvider>);
  service.import.mockResolvedValueOnce({status:'completed',successful_count:1,failed_count:0});
  const file=new File([''],'no-photos.csv',{type:'text/csv'});
  Object.defineProperty(file,'text',{value:async()=> 'name,sku,unit_of_measurement,selling_price\nParacetamol,PCM500,tablet,100'});
  fireEvent.change(screen.getByLabelText('Upload import file'),{target:{files:[file]}});
  fireEvent.click(await screen.findByRole('button',{name:'Preview and validate'}));
  expect(await screen.findByText(/1 will use a neutral placeholder and can be updated later/)).toBeInTheDocument();
  fireEvent.click(screen.getByLabelText('I understand these products will be imported with zero stock.'));
  fireEvent.click(screen.getByRole('button',{name:'Import 1 records'}));
  fireEvent.click(screen.getByRole('button',{name:'Confirm import'}));
  await screen.findByText('1 records imported. No failed records.');
  expect(service.import).toHaveBeenCalledWith('test-pharmacy','products',[
   expect.objectContaining({sku:'PCM500'}),
  ],'no-photos.csv',[]);
 });
 it('lets staff review every row while preserving source row numbers',async()=>{
  const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
  render(<QueryClientProvider client={client}><ImportsTab ws={ws}/></QueryClientProvider>);
  const products=Array.from({length:51},(_,index)=>`Product ${index+1},SKU${index+1},tablet,100`);
  const file=new File([''],'many-products.csv',{type:'text/csv'});
  Object.defineProperty(file,'text',{value:async()=> `name,sku,unit_of_measurement,selling_price\n${products[0]}\n\n${products.slice(1).join('\n')}`});
  fireEvent.change(screen.getByLabelText('Upload import file'),{target:{files:[file]}});
  fireEvent.click(await screen.findByRole('button',{name:'Preview and validate'}));
  expect(await screen.findByText('Reviewing rows 1–50 of 51. All rows are validated.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Next'}));
  expect(screen.getByLabelText('Row 53 sku')).toHaveValue('SKU51');
 });
 it('asks Covlo to review all rows and only reports findings without changing values',async()=>{
  review.mockResolvedValueOnce({findings:[{row:2,field:'dosage_form',severity:'review',reason:'The dosage form may not match the product name.'}],error:null});
  const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
  render(<QueryClientProvider client={client}><ImportsTab ws={ws}/></QueryClientProvider>);
  const file=new File([''],'review.csv',{type:'text/csv'});
  Object.defineProperty(file,'text',{value:async()=> 'name,sku,unit_of_measurement,selling_price,dosage_form\nSpeniv Susp 100ml,PH-428123,bottle,4000,NEEDLES\nOther Product,PH-428124,tablet,200,Tablet'});
  fireEvent.change(screen.getByLabelText('Upload import file'),{target:{files:[file]}});
  fireEvent.click(await screen.findByRole('button',{name:'Preview and validate'}));
  fireEvent.click(await screen.findByRole('button',{name:'Ask Covlo to review all 2 rows'}));
  await screen.findByText('Covlo reviewed all 2 rows and flagged 1 item(s) for staff review. No values were changed.');
  expect(review).toHaveBeenCalledWith({data:expect.objectContaining({pharmacyId:ws.id,module:'products',rows:expect.arrayContaining([
   expect.objectContaining({row:2,values:expect.arrayContaining([expect.objectContaining({field:'dosage_form',value:'NEEDLES'})])}),
   expect.objectContaining({row:3,values:expect.arrayContaining([expect.objectContaining({field:'dosage_form',value:'Tablet'})])}),
  ])})});
  expect(screen.getByLabelText('Row 2 dosage_form')).toHaveValue('NEEDLES');
 });
 it('uses Covlo mappings to turn an existing product file into a stock-only import',async()=>{
  service.list.mockResolvedValueOnce([{id:'existing-1',sku:'P-101',name:'Medicine',strength:'500mg'}] as never);
  mapColumns.mockResolvedValueOnce({mapping:{sku:'Drug Code',quantity:'Current Balance',batch_number:'Lot Ref',expiry_date:'Use By',received_date:'Date Received',cost_per_unit:'Buy Cost'},reasons:[{field:'quantity',header:'Current Balance',reason:'Current stock balance'}],error:null});
  const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
  render(<QueryClientProvider client={client}><ImportsTab ws={ws}/></QueryClientProvider>);
  const file=new File([''],'stock-list.csv',{type:'text/csv'});
  Object.defineProperty(file,'text',{value:async()=> 'Drug Code,Current Balance,Lot Ref,Use By,Buy Cost,Date Received\nP-101,15,B-12,2027-12-31,75,2026-11-18\nP-999,8,B-13,2028-12-31,60,2026-11-18'});
  fireEvent.change(screen.getByLabelText('Upload import file'),{target:{files:[file]}});
  fireEvent.click(await screen.findByRole('button',{name:'Ask Covlo to map these columns'}));
  await waitFor(()=>expect(screen.getByText('Covlo suggested 6 column mappings. Review them and preview the rows before importing.')).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button',{name:'Preview and validate'}));
  expect(await screen.findByText(/1 row\(s\) have positive quantities and SKUs already in your catalogue/)).toBeInTheDocument();
  fireEvent.click(await screen.findByRole('button',{name:'Use this file to add stock to existing products'}));
  expect(screen.getByLabelText('Import module')).toHaveValue('batches');
  expect(await screen.findByLabelText('Row 2 product_sku')).toHaveValue('P-101');
  expect(screen.getByLabelText('Row 2 quantity')).toHaveValue('15');
  expect(screen.getByLabelText('Row 2 branch_code')).toHaveValue('MAIN');
  expect(screen.getByLabelText('Row 2 batch_number')).toHaveValue('B-12');
  expect(screen.getByLabelText('Row 2 expiry_date')).toHaveValue('2027-12-31');
  await waitFor(()=>expect(screen.getByRole('button',{name:'Import 1 records'})).toBeEnabled());
 });
});