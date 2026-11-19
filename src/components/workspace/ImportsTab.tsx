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
import { reviewImportRows, suggestImportMapping } from '@/lib/import-suggestions.functions';
import { PlanFeatureGate } from './PlanFeatureGate';
import { InvoiceScanPanel } from './InvoiceScanPanel';

function download(name:string,text:string){const url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);}
type ImportFinding={row:number;field:string;severity:'review'|'warning';reason:string};
export function ImportsTab({ws}:{ws:Workspace}) {
 const [module,setModule]=useState<EntryModule>('products'); const [headers,setHeaders]=useState<string[]>([]); const [source,setSource]=useState<string[][]>([]);const [sourceRowNumbers,setSourceRowNumbers]=useState<number[]>([]);const [mapping,setMapping]=useState<Record<string,string>>({});const [rows,setRows]=useState<EntryRow[]>([]);const [photos,setPhotos]=useState<File[]>([]);const [stockBranch,setStockBranch]=useState('');const [reviewPage,setReviewPage]=useState(1);
 const [file,setFile]=useState<File|null>(null);const [sheets,setSheets]=useState<string[]>([]);const [sheet,setSheet]=useState('');   const [busy,setBusy]=useState(false);const [mappingBusy,setMappingBusy]=useState(false);const [aiReviewBusy,setAiReviewBusy]=useState(false);const [aiReviewError,setAiReviewError]=useState(false);const [aiReviewMessage,setAiReviewMessage]=useState('');const [aiFindings,setAiFindings]=useState<ImportFinding[]>([]);const [notice,setNotice]=useState('');const [mappingReport,setMappingReport]=useState<{field:string;header:string;reason:string}[]>([]);const [allowZeroStockImport,setAllowZeroStockImport]=useState(false);const [confirm,setConfirm]=useState(false);
 const qc=useQueryClient();const model=ENTRY_MODELS[module];
 const mapColumns=useServerFn(suggestImportMapping);
 const reviewRows=useServerFn(reviewImportRows);
 const clearAiReview=()=>{setAiFindings([]);setAiReviewMessage('');setAiReviewError(false);};
 const refsQuery=useQuery({queryKey:['entry-refs',ws.id],queryFn:()=>EntryService.references(ws.id)});
 const existingQuery=useQuery({queryKey:['entry',ws.id,module],queryFn:()=>EntryService.list(ws.id,module)});
 const refs=refsQuery.data??{};
 const existing=existingQuery.data??[];
 const reviewPageSize=50;
 const reviewPageCount=Math.max(1,Math.ceil(rows.length/reviewPageSize));
 const reviewStart=(Math.min(reviewPage,reviewPageCount)-1)*reviewPageSize;
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
   const sampleIndices=[...new Set([0,Math.floor((source.length-1)/2),source.length-1])].filter(index=>index>=0);
   const result=await mapColumns({data:{pharmacyId:ws.id,module,headers,sampleRows:sampleIndices.map(index=>source[index]!.map(value=>value.slice(0,160)))}});
   if(result.error)throw new Error(result.error);
   const matched=Object.keys(result.mapping).length;
   if(!matched){setNotice('Covlo could not confidently match any columns. Your rows are unchanged; map them manually.');return;}
   setMapping(current=>({...current,...result.mapping}));setMappingReport(result.reasons);setRows([]);clearAiReview();setAllowZeroStockImport(false);
   setNotice(`Covlo suggested ${matched} column mappings. Review them and preview the rows before importing.`);
  }catch(error){setNotice(error instanceof Error?error.message:'Covlo could not map the columns.');}
  finally{setMappingBusy(false);}
 };
  const reviewWholeSheet=async()=>{
   if(module!=='products'&&module!=='batches')return;
   setAiReviewBusy(true);setAiReviewError(false);setAiReviewMessage('');setAiFindings([]);
   const findings:ImportFinding[]=[];
   try{
    for(let start=0;start<rowsToImport.length;start+=80){
     const chunk=rowsToImport.slice(start,start+80);
     setAiReviewMessage(`Covlo is reviewing rows ${start+1}–${start+chunk.length} of ${rowsToImport.length}…`);
     const result=await reviewRows({data:{pharmacyId:ws.id,module,rows:chunk.map((row,index)=>({
      row:Number(row['source_row'])||start+index+2,
      values:Object.entries(row).filter(([field])=>field!=='source_row').map(([field,value])=>({field,value:(value??'').slice(0,160)})),
     }))}});
     if(result.error)throw new Error(result.error);
     findings.push(...result.findings);
    }
    setAiFindings(findings);
    setAiReviewMessage(findings.length?`Covlo reviewed all ${rowsToImport.length} rows and flagged ${findings.length} item(s) for staff review. No values were changed.`:`Covlo reviewed all ${rowsToImport.length} rows and found no additional issues. Platform validation still applies.`);
   }catch(error){setAiReviewError(true);setAiReviewMessage(error instanceof Error?error.message:'Covlo could not review the sheet. Your rows were not changed.');}
   finally{setAiReviewBusy(false);}
  };
 const useAsStockOnly=()=>{
  const stockRows=existingStockRows.map(row=>({
   product_sku:row['sku']??'',branch_code:row['branch_code']??'',batch_number:row['batch_number']??'',
   expiry_date:row['expiry_date']??'',received_date:row['received_date']??'',quantity:row['quantity']??'',
   cost_per_unit:row['cost_per_unit']||row['cost_price']||'',source_row:row['source_row']??'',
   source_expiry_date:row['source_expiry_date']??'',source_received_date:row['source_received_date']??'',
  }));
  setModule('batches');setHeaders([]);setSource([]);setSourceRowNumbers([]);setRows(stockRows);setReviewPage(1);clearAiReview();setStockBranch('');setMappingReport([]);setAllowZeroStockImport(false);
  setNotice(`Covlo kept ${stockRows.length} rows whose SKUs already exist. Review quantities, choose a branch, and complete any missing batch or expiry details.`);
 };
 const load=async(f:File,worksheet?:string)=>{setBusy(true);setNotice('');setMappingReport([]);setRows([]);setReviewPage(1);clearAiReview();setPhotos([]);setAllowZeroStockImport(false);try{let data:string[][];
  if(f.size>10*1024*1024)throw new Error('Upload a file smaller than 10 MB');
  if(f.name.toLowerCase().endsWith('.csv')){const parsed=Papa.parse<string[]>(await f.text());if(parsed.errors.length)throw new Error(parsed.errors[0]?.message??'Invalid CSV');data=parsed.data;setSheets([]);}
  else if(f.name.toLowerCase().endsWith('.xlsx')){const {default:read,readSheet}=await import('read-excel-file/browser');const names=(await read(f)).map(s=>s.sheet);setSheets(names);const selected=worksheet??names[0];setSheet(selected??'');const values=await readSheet(f,selected);data=values.map(r=>r.map(v=>v instanceof Date?v.toISOString().slice(0,10):String(v??'')));}
  else throw new Error('Choose a CSV or .xlsx file');
  const h=(data[0]??[]).map(x=>x.trim());if(!h.length||new Set(h).size!==h.length)throw new Error('Column headers must be present and unique');
  const sourceRows=data.slice(1).map((values,index)=>({values,row:index+2})).filter(item=>item.values.some(value=>value.trim()));if(sourceRows.length>5000)throw new Error('Import no more than 5000 rows at a time');setHeaders(h);setSource(sourceRows.map(item=>item.values));setSourceRowNumbers(sourceRows.map(item=>item.row));setMapping(defaultImportMapping(module,h));
 }catch(e){setNotice(e instanceof Error?e.message:'Upload failed');setHeaders([]);}finally{setBusy(false);}};
 const preview=()=>{
  const fields=model.fields.filter(f=>f.importable!==false);
  const next=source.map((values,index)=>{
   const row=Object.fromEntries(fields.map(f=>[f.key,normalizeImportValue(f,mapping[f.key]?values[headers.indexOf(mapping[f.key]??'')]??'':f.default??'')]));
   row['source_row']=String(sourceRowNumbers[index]??index+2);
   row['source_expiry_date']=mapping['expiry_date']?values[headers.indexOf(mapping['expiry_date'])]??'':'';
   row['source_received_date']=mapping['received_date']?values[headers.indexOf(mapping['received_date'])]??'':'';
   if(module==='products'){
    const sourceId=mapping['source_id']?values[headers.indexOf(mapping['source_id'])]??'':'';
    row['source_id']=sourceId.trim();
    if(!row['sku']&&row['source_id'])row['sku']=`PH-${row['source_id']}`;
   }
   return row;
  });
  setRows(module==='products'?fillBarcodes(next):next);setReviewPage(1);clearAiReview();setAllowZeroStockImport(false);
  const monthOnly=source.reduce((count,values)=>count+['expiry_date','received_date'].filter(key=>{
   const header=mapping[key];const raw=header?values[headers.indexOf(header)]??'':'';
   return /^(?:\d{4}\s*[-/]\s*[A-Za-z]+|[A-Za-z]+\s+\d{4})$/.test(raw.trim());
  }).length,0);
  setNotice(monthOnly?`${monthOnly} month-only date value(s) need an exact day before stock can be posted; no day was inferred.`:'');
 };
 const template=async(excel:boolean)=>{const fields=module==='products'?model.fields.slice(0,17):model.fields.filter(f=>f.importable!==false);const keys=fields.map(f=>f.key);if(!excel){download(`${module}-template.csv`,Papa.unparse([keys,keys.map(k=>blankEntry(module)[k]??'')]));return;}const {default:write}=await import('write-excel-file/browser');await write([keys.map(value=>({value,type:String})),keys.map(k=>({value:blankEntry(module)[k]??'',type:String}))]).toFile(`${module}-template.xlsx`);};
 return <div className="space-y-5"><SectionHeader title="Bulk imports"/>
  <div className="flex flex-wrap items-end gap-3"><label className="text-sm">Module<select aria-label="Import module" className={inputCls} value={module} disabled={busy||mappingBusy||aiReviewBusy} onChange={e=>{setModule(e.target.value as EntryModule);setRows([]);setReviewPage(1);clearAiReview();setHeaders([]);setSource([]);setSourceRowNumbers([]);setPhotos([]);setStockBranch('');setFile(null);setNotice('');setMappingReport([]);setAllowZeroStockImport(false);}}>{Object.entries(ENTRY_MODELS).filter(([key])=>key!=='settings').map(([key,m])=><option key={key} value={key}>{m.label}</option>)}</select></label><Button variant="outline" onClick={()=>void template(false)}><Download/>CSV template</Button><Button variant="outline" onClick={()=>void template(true)}><FileSpreadsheet/>Excel template</Button></div>
  {editable&&<div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950">
   <b>Need to restore stock for products showing 0?</b> Upload the product/stock list with real quantities. Covlo can read a photo or PDF below, or map columns in a CSV/Excel file. Choose <b>Batches / Opening stock</b> for products already in your catalogue. Covlo never guesses missing quantities, dates, or batch numbers. Month-only dates need an exact day before stock can be posted. Stock imports add batches, do not replace stock, and do not reactivate inactive products.
  </div>}
  {editable&&(module==='products'||module==='batches')&&<PlanFeatureGate ws={ws} feature="import_ai"><InvoiceScanPanel pharmacyId={ws.id} existingProducts={productsQuery.data??[]} branches={refs['branch_code']??[]} disabled={busy} onProducts={(r,name)=>{setModule('products');setHeaders([]);setFile(new File([],name));setRows(fillBarcodes(r));setReviewPage(1);setPhotos([]);setAllowZeroStockImport(false);setNotice('Covlo extracted new product rows. Review every row; missing photos use a neutral placeholder.');}} onBatches={(r,name)=>{setModule('batches');setHeaders([]);setFile(new File([],name));setRows(r);setReviewPage(1);setPhotos([]);setAllowZeroStockImport(false);setNotice('Covlo extracted stock batches. Review quantities, exact dates, branch and batch before importing.');}}/></PlanFeatureGate>}
  {editable&&<label className="flex items-center gap-3 border border-dashed border-border rounded-lg p-4 text-sm"><Upload/><input aria-label="Upload import file" type="file" accept=".csv,.xlsx" disabled={busy||mappingBusy||aiReviewBusy} onChange={e=>{const f=e.target.files?.[0];if(f){setFile(f);void load(f);}}}/></label>}
  {editable&&module==='products'&&<label className="flex items-center gap-3 border border-dashed border-border rounded-lg p-4 text-sm"><Upload/>Product photos (optional; match filenames to source ID or SKU)<input aria-label="Upload product photos" type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={busy||aiReviewBusy} onChange={e=>setPhotos(Array.from(e.target.files??[]))}/></label>}
  {sheets.length>1&&<label>Worksheet<select aria-label="Worksheet" className={inputCls} value={sheet} disabled={busy||mappingBusy} onChange={e=>{setSheet(e.target.value);if(file)void load(file,e.target.value);}}>{sheets.map(s=><option key={s}>{s}</option>)}</select></label>}
  {headers.length>0&&<><h3 className="font-bold">Column mapping · {source.length} rows</h3><div className="grid sm:grid-cols-3 gap-3">{model.fields.filter(f=>f.importable!==false).map(f=><label className="text-xs" key={f.key}>{f.label}{f.required?' *':''}<select aria-label={`Map ${f.key}`} className={inputCls} value={mapping[f.key]??''} disabled={busy||mappingBusy||aiReviewBusy} onChange={e=>{setMapping(m=>({...m,[f.key]:e.target.value}));setRows([]);setMappingReport([]);setAiFindings([]);setAiReviewMessage('');}}><option value="">Default / empty</option>{headers.map(h=><option key={h}>{h}</option>)}</select></label>)}{module==='products'&&<label className="text-xs">Source ID (used for SKU/photo matching)<select aria-label="Map source_id" className={inputCls} value={mapping['source_id']??''} disabled={busy||mappingBusy||aiReviewBusy} onChange={e=>{setMapping(m=>({...m,source_id:e.target.value}));setRows([]);setAiFindings([]);setAiReviewMessage('');}}><option value="">None</option>{headers.map(h=><option key={h}>{h}</option>)}</select></label>}</div>
   {(module==='products'||module==='batches')&&<PlanFeatureGate ws={ws} feature="import_ai"><Button variant="outline" disabled={!editable||busy||mappingBusy||aiReviewBusy||!source.length} onClick={()=>void mapWithCovlo()}>{mappingBusy?'Covlo is mapping…':'Ask Covlo to map these columns'}</Button><span className="ml-2 text-xs text-muted-foreground">Covlo samples the beginning, middle and end of the sheet; the validator checks every row. Review all suggestions before importing.</span></PlanFeatureGate>}
   {mappingReport.length>0&&<ul className="text-xs text-muted-foreground" role="status">{mappingReport.map(item=><li key={`${item.field}:${item.header}`}><b>{model.fields.find(field=>field.key===item.field)?.label??item.field}</b> ← {item.header}: {item.reason}</li>)}</ul>}
   <Button disabled={busy||mappingBusy||!source.length} onClick={preview}>Preview and validate</Button></>}
  {needsBranchChoice&&<label className="block text-sm">Opening stock branch<select aria-label="Opening stock branch" className={inputCls} value={branchCode} onChange={e=>setStockBranch(e.target.value)}><option value="">Select a branch</option>{branchOptions.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select></label>}
  {rows.length>0&&module==='products'&&<div className="text-sm"><p role="status">{rows.length-missingPhotos.length} of {rows.length} products matched to an image by source ID/SKU. {missingPhotos.length>0?`${missingPhotos.length} will use a neutral placeholder and can be updated later.`:'All rows have a matching image.'}</p>{photoErrors.map((error,i)=><p role="status" className="text-amber-700" key={i}>{error}; affected products will use a placeholder.</p>)}{photoMatch?.unmatched.map((name,i)=><p role="status" className="text-amber-700" key={`${name}:${i}`}>Image {name} did not match a product ID/SKU and will not be attached.</p>)}</div>}
  {zeroStockProductImport&&<div role="alert" className="space-y-2 text-sm text-amber-700"><p>No positive opening quantity was found. Importing these products will leave them at zero stock. If these SKUs already exist, use the stock-only option below instead of re-importing the products.</p><label className="flex items-start gap-2"><input type="checkbox" checked={allowZeroStockImport} onChange={event=>setAllowZeroStockImport(event.currentTarget.checked)}/><span>I understand these products will be imported with zero stock.</span></label></div>}
  {rows.length>0&&<><div className="flex flex-wrap justify-between gap-2"><h3 className="font-bold">Preview · {rows.length} records · {errors.length} errors</h3>{errors.length>0&&<Button variant="outline" onClick={()=>download(`${module}-errors.csv`,Papa.unparse(errors.map(e=>({...rowsToImport.find(row=>Number(row['source_row'])===e.row)??rowsToImport[e.row-2]??{},row:e.row,column:e.column,reason:e.reason}))))}><Download/>Error report</Button>}</div>
   {(module==='products'||module==='batches')&&<PlanFeatureGate ws={ws} feature="import_ai"><div className="flex flex-wrap items-center gap-3"><Button variant="outline" disabled={!editable||busy||aiReviewBusy} onClick={()=>void reviewWholeSheet()}>{aiReviewBusy?'Covlo is reviewing…':`Ask Covlo to review all ${rows.length} rows`}</Button><span className="text-xs text-muted-foreground">Covlo checks the full sheet in small batches. It flags suspicious data but never changes quantities, prices, dates or identifiers.</span></div></PlanFeatureGate>}
   {aiReviewMessage&&<p role={aiReviewError?'alert':'status'} className={`text-sm ${aiReviewError?'text-destructive':'text-muted-foreground'}`}>{aiReviewMessage}</p>}
   {aiFindings.length>0&&<div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2"><h4 className="font-bold text-sm">Covlo review findings · {aiFindings.length}</h4><ul className="max-h-48 overflow-auto space-y-1 text-sm">{aiFindings.map((finding,index)=>{const rowIndex=rowsToImport.findIndex((row,i)=>(Number(row['source_row'])||i+2)===finding.row);return <li key={`${finding.row}:${finding.field}:${index}`}><button type="button" className="text-left underline underline-offset-2" onClick={()=>{if(rowIndex>=0)setReviewPage(Math.floor(rowIndex/reviewPageSize)+1);}}>Row {finding.row}, {finding.field} ({finding.severity})</button>: {finding.reason}</li>;})}</ul></div>}
   {checking&&<p role="status" className="text-sm text-muted-foreground">Checking existing records…</p>}
   {lookupError&&<div role="alert" className="text-sm text-destructive">Could not check existing records: {lookupError.message}<Button variant="outline" onClick={()=>{void refsQuery.refetch();void existingQuery.refetch();}}>Retry</Button></div>}
   {!checking&&errors.length>0&&<ul role="alert" className="text-sm text-destructive max-h-40 overflow-auto">{errors.map((e,i)=><li key={i}>Row {e.row}, {e.column}: {e.reason}</li>)}</ul>}
   {!checking&&existingStockRows.length>0&&<div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm"><p>{existingStockRows.length} row(s) have positive quantities and SKUs already in your catalogue. To add stock without duplicating products, use stock-only mode. This adds batches; it does not replace existing stock.</p><Button variant="outline" className="mt-2" onClick={useAsStockOnly}>Use this file to add stock to existing products</Button></div>}
   {!checking&&unresolved.length>0&&<div className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold">Resolve unmatched categories and suppliers</h3><PlanFeatureGate ws={ws} feature="import_ai"><ImportAutoResolve pharmacyId={ws.id} unresolved={unresolved} rows={rows} disabled={!editable||busy||!!lookupError} onApply={async results=>{await qc.invalidateQueries({queryKey:['entry-refs',ws.id]});await refsQuery.refetch();setRows(all=>results.reduce((acc,r)=>replaceEntryReference(acc,r.column,r.value,r.name),all));}}/></PlanFeatureGate></div><div className="grid gap-3 sm:grid-cols-2">{unresolved.map(({column,value})=><div key={`${column}:${value}`} className="space-y-2"><label className="text-sm">{column==='category_name'?'Category':'Supplier'}: {value}<select aria-label={`Resolve ${column} ${value}`} className={inputCls} value="" onChange={e=>{if(e.target.value)setRows(all=>replaceEntryReference(all,column,value,e.target.value==='__none__'?'':e.target.value));}}><option value="">Choose a replacement for all matching rows</option><option value="__none__">{column==='category_name'?'No category':'No supplier'}</option>{(refs[column]??[]).map((option,i)=><option key={`${option.value}:${i}`} value={option.value}>{option.label}</option>)}</select></label>{column==='category_name'&&<PlanFeatureGate ws={ws} feature="import_ai"><ImportCategorySuggestion key={`${ws.id}:${value}`} pharmacyId={ws.id} value={value} rows={rows.filter(row=>(row['category_name']??'').trim().toLowerCase()===value.trim().toLowerCase())} disabled={!editable||busy||!!lookupError} onApply={category=>setRows(all=>replaceEntryReference(all,'category_name',value,category))}/></PlanFeatureGate>}</div>)}</div></div>}
   <div className="overflow-auto max-h-96 border border-border rounded-lg"><table className="text-xs text-left"><thead><tr><th className="p-2">Row</th>{module==='products'&&<th className="p-2">source_id</th>}{(module==='products'||module==='batches')&&<><th className="p-2">source_expiry_date</th><th className="p-2">source_received_date</th></>}{model.fields.map(f=><th className="p-2" key={f.key}>{f.key}</th>)}</tr></thead><tbody>{rowsToImport.slice(reviewStart,reviewStart+reviewPageSize).map((r,offset)=>{const i=reviewStart+offset;const rowNumber=Number(r['source_row'])||i+2;return <tr key={i}><td className="p-2">{rowNumber}</td>{module==='products'&&<td className="p-1"><input aria-label={`Row ${rowNumber} source_id`} className="border border-input rounded p-1 w-32 bg-background text-foreground" value={r['source_id']??''} onChange={e=>{setRows(all=>all.map((x,n)=>n===i?{...x,source_id:e.target.value,sku:x['sku']?.startsWith('PH-')?`PH-${e.target.value}`:x['sku']??''}:x));clearAiReview();}}/></td>}{(module==='products'||module==='batches')&&<><td className="p-2">{r['source_expiry_date']??''}</td><td className="p-2">{r['source_received_date']??''}</td></>}{model.fields.map(f=><td className="p-1" key={f.key}><input aria-label={`Row ${rowNumber} ${f.key}`} className="border border-input rounded p-1 w-32 bg-background text-foreground" value={r[f.key]??''} onChange={e=>{setRows(all=>all.map((x,n)=>n===i?{...x,[f.key]:e.target.value}:x));setAllowZeroStockImport(false);clearAiReview();}}/></td>)}</tr>})}</tbody></table></div>
   {rows.length>reviewPageSize&&<div className="flex items-center justify-between text-sm"><span>Reviewing rows {reviewStart+1}–{Math.min(reviewStart+reviewPageSize,rows.length)} of {rows.length}. All rows are validated.</span><div className="flex gap-2"><Button variant="outline" disabled={reviewPage<=1} onClick={()=>setReviewPage(page=>page-1)}>Previous</Button><span className="self-center">Page {reviewPage} of {reviewPageCount}</span><Button variant="outline" disabled={reviewPage>=reviewPageCount} onClick={()=>setReviewPage(page=>page+1)}>Next</Button></div></div>}
   {!checking&&errors.length>0&&<p className="text-sm text-destructive">Import is blocked by {errors.length} validation errors.</p>}
   {!editable&&<p className="text-sm text-muted-foreground">Your account does not currently have permission to import these records.</p>}
   <Button disabled={!editable||busy||aiReviewBusy||checking||!!lookupError||errors.length>0||zeroStockProductImport&&!allowZeroStockImport} onClick={()=>setConfirm(true)}><Check/>Import {rows.length} records</Button>
  </>}
  {notice&&<p role="status" className="text-sm font-semibold">{notice}</p>}
  {confirm&&<Modal title="Confirm import" onClose={()=>!busy&&!aiReviewBusy&&setConfirm(false)}><p className="text-sm">Save {rows.length} {model.label.toLowerCase()} to {ws.name}? All records will be saved together, or none.</p><Button disabled={!editable||busy||aiReviewBusy||checking||!!lookupError||errors.length>0||zeroStockProductImport&&!allowZeroStockImport} onClick={async()=>{setBusy(true);try{const result=await EntryService.import(ws.id,module,rowsToImport,file?.name??'spreadsheet',module==='products'?photos:[]);setNotice(result.status==='completed'?`${result.successful_count} records imported. No failed records.`:`No records saved. ${result.error}`);if(result.status==='completed'){setRows([]);setHeaders([]);setPhotos([]);setAllowZeroStockImport(false);}await qc.invalidateQueries({queryKey:['import-history',ws.id]});await qc.invalidateQueries({queryKey:['entry',ws.id]});await qc.invalidateQueries({queryKey:['entry-refs',ws.id]});await qc.invalidateQueries({queryKey:['ws',ws.id]});}catch(e){setNotice(e instanceof Error?e.message:'Import failed');}finally{setBusy(false);setConfirm(false);}}}>{busy?'Importing…':'Confirm import'}</Button></Modal>}
  <h3 className="font-bold">Import history</h3><div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead><tr className="border-b border-border"><th className="p-2">Date</th><th>File</th><th>Module</th><th>Saved</th><th>Failed</th><th>Result</th></tr></thead><tbody>{history.map(h=><tr key={h.id} className="border-b border-border"><td className="p-2">{new Date(h.created_at).toLocaleDateString()}</td><td>{h.file_name}</td><td>{h.module}</td><td>{h.successful_count}</td><td>{h.failed_count}</td><td>{h.status}{h.error_message&&` · ${h.error_message}`}</td></tr>)}</tbody></table></div>
 </div>;
}