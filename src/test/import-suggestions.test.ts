import { describe, expect, it } from 'vitest';
import { categorySuggestionInput,checkedCategorySuggestion,checkedImportMapping,importMappingInput } from '@/lib/import-suggestions';
describe('AI import category boundaries',()=>{
 const categories=[{id:'local-category',name:'Analgesics'}];
 it('accepts only an existing workspace category',()=>{
  expect(checkedCategorySuggestion({categoryId:'local-category',reason:'Pain relief'},categories)).toEqual({category:categories[0],reason:'Pain relief'});
  expect(()=>checkedCategorySuggestion({categoryId:'other-tenant-category',reason:'Pain relief'},categories)).toThrow('not available');
 });
 it('preserves a no-match result without inventing a category',()=>{
  expect(checkedCategorySuggestion({categoryId:null,reason:'No suitable match'},categories)).toEqual({category:null,reason:'No suitable match'});
 });
 it('requires workspace ID and nonempty row details',()=>{
  expect(categorySuggestionInput.safeParse({pharmacyId:'',unmatchedCategory:'Pain Relief',details:'Paracetamol'}).success).toBe(false);
  expect(categorySuggestionInput.safeParse({pharmacyId:'25abb0d6-3fa5-48dd-85f0-4ebbaea48a27',unmatchedCategory:'Pain Relief',details:' '}).success).toBe(false);
 });
});
import { checkedReferenceResolution } from '@/lib/import-suggestions';
describe('AI reference resolution', () => {
 it('reuses existing names and drops unasked items', () => {
  const out = checkedReferenceResolution({ results: [
   { column: 'category_name', value: 'antibiotc', name: 'antibiotics', isNew: true, reason: 'x' },
   { column: 'supplier_name', value: 'other', name: 'Other', isNew: true, reason: 'x' },
  ] }, [{ column: 'category_name', value: 'Antibiotc' }], { category_name: ['Antibiotics'] });
  expect(out).toEqual([{ column: 'category_name', value: 'antibiotc', name: 'Antibiotics', isNew: false, reason: 'x' }]);
 });
});
describe('Covlo import column mapping',()=>{
 const pharmacyId='25abb0d6-3fa5-48dd-85f0-4ebbaea48a27';
 it('accepts only requested fields and exact file headers',()=>{
  const result=checkedImportMapping({mappings:[
   {field:'product_sku',header:'Drug Code',reason:'Product identifier'},
   {field:'quantity',header:'Current Balance',reason:'Current stock'},
   {field:'expiry_date',header:null,reason:'Not provided'},
  ]},'batches',['Drug Code','Current Balance','Use By']);
  expect(result.mapping).toEqual({product_sku:'Drug Code',quantity:'Current Balance'});
  expect(()=>checkedImportMapping({mappings:[{field:'not_a_field',header:'Drug Code',reason:'x'}]},'batches',['Drug Code'])).toThrow('invalid field mapping');
  expect(()=>checkedImportMapping({mappings:[{field:'quantity',header:'Invented',reason:'x'}]},'batches',['Drug Code'])).toThrow('not in this file');
 });
 it('bounds spreadsheet samples before they reach Covlo',()=>{
  const valid={pharmacyId,module:'batches',headers:['SKU'],sampleRows:[['P-1']]};
  expect(importMappingInput.safeParse(valid).success).toBe(true);
  expect(importMappingInput.safeParse({...valid,sampleRows:[['x'.repeat(161)]]}).success).toBe(false);
 });
});
