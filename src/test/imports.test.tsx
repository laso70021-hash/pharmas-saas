import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ImportsTab } from '@/components/workspace/ImportsTab';
import type { Workspace } from '@/lib/pharmacy-types';
const suggest=vi.hoisted(()=>vi.fn(async()=>({category:{id:'category-1',name:'Analgesics'},reason:'Matches pain relief products.',error:null})));
vi.mock('@tanstack/react-start',()=>({useServerFn:(fn:unknown)=>fn}));
vi.mock('@/lib/import-suggestions.functions',()=>({suggestImportCategory:suggest,resolveImportReferences:vi.fn()}));
vi.mock('@/lib/invoice-scan.functions',()=>({scanInvoice:vi.fn()}));

const service=vi.hoisted(()=>({
 references:vi.fn(async()=>({category_name:[{value:'Analgesics',label:'Analgesics'}],supplier_name:[]})),
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
  expect(screen.getByRole('button',{name:'Import 1 records'})).toBeEnabled();
  expect(service.import).not.toHaveBeenCalled();
 });
 it('unblocks validation and submits all corrected rows through the import service',async()=>{
  const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
  render(<QueryClientProvider client={client}><ImportsTab ws={ws}/></QueryClientProvider>);
  const file=new File([''], 'products.csv',{type:'text/csv'});
  Object.defineProperty(file,'text',{value:async()=> 'name,sku,unit_of_measurement,selling_price,category_name\nParacetamol,PCM500,tablet,100,Pain Relief\nIbuprofen,IBU200,tablet,200,Pain Relief'});
  fireEvent.change(screen.getByLabelText('Upload import file'),{target:{files:[file]}});
  fireEvent.click(await screen.findByRole('button',{name:'Preview and validate'}));
  await waitFor(()=>expect(screen.getByRole('button',{name:'Import 2 records'})).toBeDisabled());
  fireEvent.change(await screen.findByLabelText('Resolve category_name Pain Relief'),{target:{value:'Analgesics'}});
  await waitFor(()=>expect(screen.getByRole('button',{name:'Import 2 records'})).toBeEnabled());
  fireEvent.click(screen.getByRole('button',{name:'Import 2 records'}));
  fireEvent.click(screen.getByRole('button',{name:'Confirm import'}));
  await screen.findByText('2 records imported. No failed records.');
  expect(service.import).toHaveBeenCalledWith('test-pharmacy','products',[
   expect.objectContaining({sku:'PCM500',category_name:'Analgesics'}),
   expect.objectContaining({sku:'IBU200',category_name:'Analgesics'}),
  ],'products.csv');
 });
});