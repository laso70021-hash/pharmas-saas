import { describe, expect, it } from 'vitest';
import { categorySuggestionInput,checkedCategorySuggestion } from '@/lib/import-suggestions';
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
