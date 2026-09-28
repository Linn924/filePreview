import type { PDFDocumentProxy } from 'pdfjs-dist';
import { pdfWork } from './workQueue';
export type PageSize={width:number;height:number};
const sizes=new WeakMap<PDFDocumentProxy,Map<number,PageSize>>();
const pending=new WeakMap<PDFDocumentProxy,Map<number,Promise<PageSize>>>();
export function cachedPageSize(doc:PDFDocumentProxy,page:number) { return sizes.get(doc)?.get(page); }
export function rememberPageSize(doc:PDFDocumentProxy,page:number,size:PageSize) {
  let cache=sizes.get(doc);if(!cache){cache=new Map();sizes.set(doc,cache);}cache.set(page,size);
}
export function pageSize(doc:PDFDocumentProxy,page:number,priority=3,signal?:AbortSignal) {
  const cached=cachedPageSize(doc,page);if(cached)return Promise.resolve(cached);
  let jobs=pending.get(doc);if(!jobs){jobs=new Map();pending.set(doc,jobs);}
  const old=jobs.get(page);if(old)return old;
  const job=pdfWork(priority,async()=>{const p=await doc.getPage(page);const v=p.getViewport({scale:1});const result={width:v.width,height:v.height};rememberPageSize(doc,page,result);return result;},signal);
  jobs.set(page,job);
  void job.finally(()=>{if(jobs!.get(page)===job)jobs!.delete(page);}).catch(()=>{});
  return job;
}
