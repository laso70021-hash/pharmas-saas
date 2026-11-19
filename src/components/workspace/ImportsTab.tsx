import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import Papa from 'papaparse';
import { Download, FileSpreadsheet, Upload, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EntryService } from '@/lib/pharmacy-service';
import { ENTRY_MODELS, blankEntry, defaultImportMapping, fillBarcodes, matchProductPhotos, normalizeImportValue, replaceEntryReference, validateEntries, type EntryModule, type EntryRow } from '@/lib/entry-model';
import type { Workspace } from '@/lib/pharmacy-types';
import { can } from '@/lib/workspace';
import { Modal, SectionHeader, inputCls } from './ws-ui';
import { ImportCategorySuggestion } from './ImportCategorySuggestion';
import { ImportAutoResolve } from './ImportAutoResolve';
import { suggestImportMapping } from '@/lib/import-suggestions.functions';
import { PlanFeatureGate } from './PlanFeatureGate';
import { InvoiceScanPanel } from './InvoiceScanPanel';

function download(name:string,text:string){const url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);}
export function ImportsTab({ws}:{ws:Workspace}) {
 const [module,setModule]=useState<EntryModule>('products'); const [headers,setHeaders]=useState<string[]>([]); const [source,setSource]=useState<string[][]>([]);const [mapping,setMapping]=useState<Record<string,string>>({});const [rows,setRows]=useState<EntryRow[]>([]);const [photos,setPhotos]=useState<File[]>([]);const [stockBranch,setStockBranch]=useState('');
 const [file,setFile]=useState<File|null>(null);const [sheets,setSheets]=useState<string[]>([]);const [sheet,setSheet]=useState(''); const [busy,setBusy]=useState(false);const [mappingBusy,setMappingBusy]=useState(false);const [notice,setNotice]=useState('');const [mappingReport,setMappingReport]=useState<{field:string;header:string;reason:string}[]>([]);const [allowZeroStockImport,setAllowZeroStockImport]=useState(false);const [confirm,setConfirm]=useState(false);
 const qc=useQueryClient();const model=ENTRY_MODELS[module];
 const mapColumns=useServerFn(suggestImportMapping);
 const refsQuery=useQuery({queryKey:['entry-refs',ws.id],queryFn:()=>EntryService.references(ws.id)});
 const existingQuery=useQuery({queryKey:['entry',ws.id,module],queryFn:()=>EntryService.list(ws.id,module)});
 const refs=refsQuery.data??{};
 const existing=existingQuery.data??[];
 const productsQuery=useQuery({queryKey:['entry',ws.id,'products'],queryFn:()=>EntryService.list(ws.id,'products'),enabled:module==='products'||module==='batches'});
 const {data:history=[]}=useQuery({queryKey:['import-history',ws.id],queryFn:()=>EntryService.history(ws.id)});
 const branchOptions=refs['branch_code']??[];
 const branchCode=stockBranch||(branchOptions.length===1?branchOptions[0]?.value??'':'');
 const rowsToImport:EntryRow[]=module==='products'
  ?rows.map(row=>({...row,branch_code:Number(row['quantity'])>0?branchCode:'',cost_per_unit:row['cost_per_unit']||row['cost_price']||''}))
  :module==='batches'?rows.map(row=>({...row,branch_code:row['branch_code']||branchCode})):rows;
 const errors=validateEntries(module,rowsToImport,existing,refs);
 const existingProductSkus=module==='products'?new Set(existing.map(row=>(row['sku']??'').trim().toLowerCase())):new Set<string>();
 const existingStockRows=module==='products'?rowsToImport.filter(row=>existingProductSkus.has((row['sku']??'').trim().toLowerCase())&&Number(row['quantity'])>0):[];
 const photoMatch=module==='products'?matchProductPhotos(rows,photos):null;
 const photoErrors=photoMatch?.errors??[];
 const missingPhotos=photoMatch?.missing??[];
 const productImagesReady=module!=='products'||(!photoErrors.length&&!missingPhotos.length);
 const hasOpeningStock=(module==='products'||module==='batches')&&rows.some(row=>Number(row['quantity'])>0);
 const needsBranchChoice=module==='products'&&hasOpeningStock||module==='batches'&&hasOpeningStock&&rows.some(row=>!row['branch_code']);
 const zeroStockProductImport=module==='products'&&rows.length>0&&!rows.some(row=>Number(row['quantity'])>0);
 const checking=refsQuery.isPending||existingQuery.isPending;
 const lookupError=refsQuery.error??existingQuery.error;
 const unresolved=Array.from(new Map(errors.filter(e=>e.reason.startsWith('Unknown or ambiguous reference:')&&['category_name','supplier_name'].includes(e.column)).map(e=>{const value=rows[e.row-2]?.[e.column]??'';return [`${e.column}:${value.trim().toLowerCase()}`,{column:e.column,value}];})).values());
 const editable=can(ws.role,module==='staff'?'manageStaff':module==='branches'?'manageBranches':'manageStock',ws.status);
 const mapWithCovlo=async()=>{
  if(module!=='products'&&module!=='batches')return;
  setMappingBusy(true);setNotice('');
  try{
   const result=await mapColumns({data:{pharmacyId:ws.id,module,headers,sampleRows:source.slice(0,3).map(row=>row.map(value=>value.slice(0,160)))}});
   if(result.error)throw new Error(result.error);
   const matched=Object.keys(result.mapping).length;
   if(!matched){setNotice('Covlo could not confidently match any columns. Your rows are unchanged; map them manually.');return;}
   setMapping(current=>({...current,...result.mapping}));setMappingReport(result.reasons);setRows([]);setAllowZeroStockImport(false);
   setNotice(`Covlo suggested ${matched} column mappings. Review them and preview the rows before importing.`);
  }catch(error){setNotice(error instanceof Error?error.message:'Covlo could not map the columns.');}
  finally{setMappingBusy(false);}
 };
 const useAsStockOnly=()=>{
  const stockRows=existingStockRows.map(row=>({
   product_sku:row['sku']??'',branch_code:row['branch_code']??'',batch_number:row['batch_number']??'',
   expiry_date:row['expiry_date']??'',received_date:row['received_date']??'',quantity:row['quantity']??'',
   cost_per_unit:row['cost_per_unit']||row['cost_price']||'',
  }));
  setModule('batches');setHeaders([]);setSource([]);setRows(stockRows);setStockBranch('');setMappingReport([]);setAllowZeroStockImport(false);
  setNotice(`Covlo kept ${stockRows.length} rows whose SKUs already exist. Review quantities, choose a branch, and complete any missing batch or expiry details.`);
 };
 const load=async(f:File,worksheet?:string)=>{setBusy(true);setNotice('');setMappingReport([]);setRows([]);setPhotos([]);setAllowZeroStockImport(false);try{let data:string[][];
  if(f.size>10*1024*1024)throw new Error('Upload a file smaller than 10 MB');
  if(f.name.toLowerCase().endsWith('.csv')){const parsed=Papa.parse<string[]>(await f.text(),{skipEmptyLines:'greedy'});if(parsed.errors.length)throw new Error(parsed.errors[0]?.message??'Invalid CSV');data=parsed.data;setSheets([]);}
  else if(f.name.toLowerCase().endsWith('.xlsx')){const {default:read,readSheet}=await import('read-excel-file/browser');const names=(await read(f)).map(s=>s.sheet);setSheets(names);const selected=worksheet??names[0];setSheet(selected??'');const values=await readSheet(f,selected);data=values.map(r=>r.map(v=>v instanceof Date?v.toISOString().slice(0,10):String(v??'')));}
  else throw new Error('Choose a CSV or .xlsx file');
  const h=(data[0]??[]).map(x=>x.trim());if(!h.length||new Set(h).size!==h.length)throw new Error('Column headers must be present and unique');
  if(data.length>5001)throw new Error('Import no more than 5000 rows at a time');setHeaders(h);setSource(data.slice(1).filter(r=>r.some(v=>v.trim())));setMapping(defaultImportMapping(module,h));
 }catch(e){setNotice(e instanceof Error?e.message:'Upload failed');setHeaders([]);}finally{setBusy(false);}};
 const preview=()=>{const fields=model.fields.filter(f=>f.importable!==false);const next=source.map(values=>Object.fromEntries(fields.map(f=>[f.key,normalizeImportValue(f,mapping[f.key]?values[headers.indexOf(mapping[f.key]??'')]??'':f.default??'')])));setRows(module==='products'?fillBarcodes(next):next);setAllowZeroStockImport(false);};
 const template=async(excel:boolean)=>{const fields=model.fields.filter(f=>f.importable!==false);const keys=fields.map(f=>f.key);if(!excel){download(`${module}-template.csv`,Papa.unparse([keys,keys.map(k=>blankEntry(module)[k]??'')]));return;}const {default:write}=await import('write-excel-file/browser');await write([keys.map(value=>({value,type:String})),keys.map(k=>({value:blankEntry(module)[k]??'',type:String}))]).toFile(`${module}-template.xlsx`);};
 return <div className="space-y-5"><SectionHeader title="Bulk imports"/>
  <div className="flex flex-wrap items-end gap-3"><label className="text-sm">Module<select aria-label="Import module" className={inputCls} value={module} disabled={busy||mappingBusy} onChange={e=>{setModule(e.target.value as EntryModule);setRows([]);setHeaders([]);setPhotos([]);setStockBranch('');setFile(null);setNotice('');setMappingReport([]);setAllowZeroStockImport(false);}}>{Object.entries(ENTRY_MODELS).filter(([key])=>key!=='settings').map(([key,m])=><option key={key} value={key}>{m.label}</option>)}</select></label><Button variant="outline" onClick={()=>void template(false)}><Download/>CSV template</Button><Button variant="outline" onClick={()=>void template(true)}><FileSpreadsheet/>Excel template</Button></div>
  {editable&&<div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950">
   <b>Need to restore stock for products showing 0?</b> Upload the product/stock list with real quantities. Covlo can read a photo or PDF below, or map columns in a CSV/Excel file. Choose <b>Batches / Opening stock</b> for products already in your catalogue. Covlo never guesses missing quantities, batch numbers or expiry dates; review the rows before saving. Stock imports add batches, do not replace stock, and do not reactivate inactive products.
  </div>}
  {editable&&(module==='products'||module==='batches')&&<PlanFeatureGate ws={ws} feature="import_ai"><InvoiceScanPanel pharmacyId={ws.id} existingProducts={productsQuery.data??[]} branches={refs['branch_code']??[]} disabled={busy} onProducts={(r,name)=>{setModule('products');setHeaders([]);setFile(new File([],name));setRows(fillBarcodes(r));setPhotos([]);setAllowZeroStockImport(false);setNotice('Covlo extracted new product rows. Check the values and attach images before importing.');}} onBatches={(r,name)=>{setModule('batches');setHeaders([]);setFile(new File([],name));setRows(r);setPhotos([]);setAllowZeroStockImport(false);setNotice('Covlo extracted stock batches. Check quantities, branch, batch and expiry before importing.');}}/></PlanFeatureGate>}
  {editable&&<label className="flex items-center gap-3 border border-dashed border-border rounded-lg p-4 text-sm"><Upload/><input aria-label="Upload import file" type="file" accept=".csv,.xlsx" disabled={busy||mappingBusy} onChange={e=>{const f=e.target.files?.[0];if(f){setFile(f);void load(f);}}}/></label>}
  {editable&&module==='products'&&<label className="flex items-center gap-3 border border-dashed border-border rounded-lg p-4 text-sm"><Upload/>Product photos (required, filenames must match ID/SKU)<input aria-label="Upload product photos" type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e=>setPhotos(Array.from(e.target.files??[]))}/></label>}
  {sheets.length>1&&<label>Worksheet<select aria-label="Worksheet" className={inputCls} value={sheet} disabled={busy||mappingBusy} onChange={e=>{setSheet(e.target.value);if(file)void load(file,e.target.value);}}>{sheets.map(s=><option key={s}>{s}</option>)}</select></label>}
  {headers.length>0&&<><h3 className="font-bold">Column mapping · {source.length} rows</h3><div className="grid sm:grid-cols-3 gap-3">{model.fields.filter(f=>f.importable!==false).map(f=><label className="text-xs" key={f.key}>{f.label}{f.required?' *':''}<select aria-label={`Map ${f.key}`} className={inputCls} value={mapping[f.key]??''} disabled={busy||mappingBusy} onChange={e=>{setMapping(m=>({...m,[f.key]:e.target.value}));setRows([]);setMappingReport([]);}}><option value="">Default / empty</option>{headers.map(h=><option key={h}>{h}</option>)}</select></label>)}</div>
   {(module==='products'||module==='batches')&&<PlanFeatureGate ws={ws} feature="import_ai"><Button variant="outline" disabled={!editable||busy||mappingBusy||!source.length} onClick={()=>void mapWithCovlo()}>{mappingBusy?'Covlo is mapping…':'Ask Covlo to map these columns'}</Button><span className="ml-2 text-xs text-muted-foreground">Covlo checks the headers and first 3 rows. Review every suggestion before importing.</span></PlanFeatureGate>}
   {mappingReport.length>0&&<ul className="text-xs text-muted-foreground" role="status">{mappingReport.map(item=><li key={`${item.field}:${item.header}`}><b>{model.fields.find(field=>field.key===item.field)?.label??item.field}</b> ← {item.header}: {item.reason}</li>)}</ul>}
   <Button disabled={busy||mappingBusy||!source.length} onClick={preview}>Preview and validate</Button></>}
  {needsBranchChoice&&<label className="block text-sm">Opening stock branch<select aria-label="Opening stock branch" className={inputCls} value={branchCode} onChange={e=>setStockBranch(e.target.value)}><option value="">Select a branch</option>{branchOptions.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select></label>}
  {rows.length>0&&module==='products'&&<div className="text-sm"><p role="status">{rows.length-missingPhotos.length} of {rows.length} products matched to an image by ID/SKU.</p>{photoErrors.map((error,i)=><p role="alert" className="text-destructive" key={i}>{error}</p>)}{missingPhotos.length>0&&<p role="alert" className="text-destructive">Missing images for: {missingPhotos.slice(0,20).join(', ')}{missingPhotos.length>20?'…':''}</p>}</div>}
  {zeroStockProductImport&&<div role="alert" className="space-y-2 text-sm text-amber-700"><p>No positive opening quantity was found. Importing these products will leave them at zero stock. If these SKUs already exist, use the stock-only option below instead of re-importing the products.</p><label className="flex items-start gap-2"><input type="checkbox" checked={allowZeroStockImport} onChange={event=>setAllowZeroStockImport(event.currentTarget.checked)}/><span>I understand these products will be imported with zero stock.</span></label></div>}
  {rows.length>0&&<><div className="flex flex-wrap justify-between gap-2"><h3 className="font-bold">Preview · {rows.length} records · {errors.length} errors</h3>{errors.length>0&&<Button variant="outline" onClick={()=>download(`${module}-errors.csv`,Papa.unparse(errors.map(e=>({...rowsToImport[e.row-2],row:e.row,column:e.column,reason:e.reason}))))}><Download/>Error report</Button>}</div>
   {checking&&<p role="status" className="text-sm text-muted-foreground">Checking existing records…</p>}
   {lookupError&&<div role="alert" className="text-sm text-destructive">Could not check existing records: {lookupError.message}<Button variant="outline" onClick={()=>{void refsQuery.refetch();void existingQuery.refetch();}}>Retry</Button></div>}
   {!checking&&errors.length>0&&<ul role="alert" className="text-sm text-destructive max-h-40 overflow-auto">{errors.map((e,i)=><li key={i}>Row {e.row}, {e.column}: {e.reason}</li>)}</ul>}
   {!checking&&existingStockRows.length>0&&<div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm"><p>{existingStockRows.length} row(s) have positive quantities and SKUs already in your catalogue. To add stock without duplicating products, use stock-only mode. This adds batches; it does not replace existing stock.</p><Button variant="outline" className="mt-2" onClick={useAsStockOnly}>Use this file to add stock to existing products</Button></div>}
   {!checking&&unresolved.length>0&&<div className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold">Resolve unmatched categories and suppliers</h3><PlanFeatureGate ws={ws} feature="import_ai"><ImportAutoResolve pharmacyId={ws.id} unresolved={unresolved} rows={rows} disabled={!editable||busy||!!lookupError} onApply={async results=>{await qc.invalidateQueries({queryKey:['entry-refs',ws.id]});await refsQuery.refetch();setRows(all=>results.reduce((acc,r)=>replaceEntryReference(acc,r.column,r.value,r.name),all));}}/></PlanFeatureGate></div><div className="grid gap-3 sm:grid-cols-2">{unresolved.map(({column,value})=><div key={`${column}:${value}`} className="space-y-2"><label className="text-sm">{column==='category_name'?'Category':'Supplier'}: {value}<select aria-label={`Resolve ${column} ${value}`} className={inputCls} value="" onChange={e=>{if(e.target.value)setRows(all=>replaceEntryReference(all,column,value,e.target.value==='__none__'?'':e.target.value));}}><option value="">Choose a replacement for all matching rows</option><option value="__none__">{column==='category_name'?'No category':'No supplier'}</option>{(refs[column]??[]).map((option,i)=><option key={`${option.value}:${i}`} value={option.value}>{option.label}</option>)}</select></label>{column==='category_name'&&<PlanFeatureGate ws={ws} feature="import_ai"><ImportCategorySuggestion key={`${ws.id}:${value}`} pharmacyId={ws.id} value={value} rows={rows.filter(row=>(row['category_name']??'').trim().toLowerCase()===value.trim().toLowerCase())} disabled={!editable||busy||!!lookupError} onApply={category=>setRows(all=>replaceEntryReference(all,'category_name',value,category))}/></PlanFeatureGate>}</div>)}</div></div>}
   <div className="overflow-auto max-h-96 border border-border rounded-lg"><table className="text-xs text-left"><thead><tr><th className="p-2">Row</th>{model.fields.map(f=><th className="p-2" key={f.key}>{f.key}</th>)}</tr></thead><tbody>{rowsToImport.slice(0,100).map((r,i)=><tr key={i}><td className="p-2">{i+2}</td>{model.fields.map(f=><td className="p-1" key={f.key}><input aria-label={`Row ${i+2} ${f.key}`} className="border border-input rounded p-1 w-32 bg-background text-foreground" value={r[f.key]??''} onChange={e=>{setRows(all=>all.map((x,n)=>n===i?{...x,[f.key]:e.target.value}:x));setAllowZeroStockImport(false);}}/></td>)}</tr>)}</tbody></table></div>{rows.length>100&&<p className="text-sm text-muted-foreground">First 100 rows shown; all {rows.length} rows validated. Correct later rows in your file and upload again.</p>}
   {!checking&&errors.length>0&&<p className="text-sm text-destructive">Import is blocked by {errors.length} validation errors.</p>}
   {!editable&&<p className="text-sm text-muted-foreground">Your account does not currently have permission to import these records.</p>}
   <Button disabled={!editable||busy||checking||!!lookupError||errors.length>0||!productImagesReady||zeroStockProductImport&&!allowZeroStockImport} onClick={()=>setConfirm(true)}><Check/>Import {rows.length} records</Button>
  </>}
  {notice&&<p role="status" className="text-sm font-semibold">{notice}</p>}
  {confirm&&<Modal title="Confirm import" onClose={()=>!busy&&setConfirm(false)}><p className="text-sm">Save {rows.length} {model.label.toLowerCase()} to {ws.name}? All records will be saved together, or none.</p><Button disabled={!editable||busy||checking||!!lookupError||errors.length>0||!productImagesReady||zeroStockProductImport&&!allowZeroStockImport} onClick={async()=>{setBusy(true);try{const result=await EntryService.import(ws.id,module,rowsToImport,file?.name??'spreadsheet',module==='products'?photos:[]);setNotice(result.status==='completed'?`${result.successful_count} records imported. No failed records.`:`No records saved. ${result.error}`);if(result.status==='completed'){setRows([]);setHeaders([]);setPhotos([]);setAllowZeroStockImport(false);}await qc.invalidateQueries({queryKey:['import-history',ws.id]});await qc.invalidateQueries({queryKey:['entry',ws.id]});await qc.invalidateQueries({queryKey:['entry-refs',ws.id]});await qc.invalidateQueries({queryKey:['ws',ws.id]});}catch(e){setNotice(e instanceof Error?e.message:'Import failed');}finally{setBusy(false);setConfirm(false);}}}>{busy?'Importing…':'Confirm import'}</Button></Modal>}
  <h3 className="font-bold">Import history</h3><div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead><tr className="border-b border-border"><th className="p-2">Date</th><th>File</th><th>Module</th><th>Saved</th><th>Failed</th><th>Result</th></tr></thead><tbody>{history.map(h=><tr key={h.id} className="border-b border-border"><td className="p-2">{new Date(h.created_at).toLocaleDateString()}</td><td>{h.file_name}</td><td>{h.module}</td><td>{h.successful_count}</td><td>{h.failed_count}</td><td>{h.status}{h.error_message&&` · ${h.error_message}`}</td></tr>)}</tbody></table></div>
 </div>;
}