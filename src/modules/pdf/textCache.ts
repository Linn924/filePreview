import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import { pdfWork, abortablePdfTask } from "./workQueue";
type TextContent = Awaited<ReturnType<PDFPageProxy['getTextContent']>>;
type Entry={promise:Promise<TextContent>;users:number;done:boolean;weight:number;controller:AbortController};
const documents = new WeakMap<PDFDocumentProxy, Map<number, Entry>>();
function trim(cache:Map<number,Entry>) {
  let bytes=[...cache.values()].reduce((sum,e)=>sum+e.weight,0);
  for(const [page,entry] of cache) {
    if(cache.size<=32&&bytes<=4*1024*1024)break;
    if(entry.users)continue;
    cache.delete(page);bytes-=entry.weight;if(!entry.done)entry.controller.abort();
  }
}
/** Share extraction between search and text layers, bounded per document. */
export function pageTextContent(doc: PDFDocumentProxy, page: number, priority = 1, signal?:AbortSignal) {
  let cache = documents.get(doc);
  if (!cache) { cache = new Map(); documents.set(doc, cache); }
  let entry = cache.get(page);
  if (entry) { cache.delete(page); cache.set(page, entry); }
  else {
    const controller=new AbortController();
    const promise=pdfWork(priority, async () => (await doc.getPage(page)).getTextContent(),controller.signal);
    entry={promise,controller,users:0,done:false,weight:0};cache.set(page,entry);
    const held=entry;
    void promise.then(content=>{held.done=true;held.weight=content.items.reduce((sum,item)=>sum+128+('str' in item?item.str.length*2:0),0);trim(cache!);},()=>{if(cache!.get(page)===held)cache!.delete(page);});
  }
  const held=entry;held.users++;
  return abortablePdfTask(held.promise,signal).finally(()=>{
    held.users--;
    if(!held.users&&!held.done){held.controller.abort();if(cache!.get(page)===held)cache!.delete(page);}
    trim(cache!);
  });
}
export function canonicalPdfText(content:TextContent) { return content.items.filter((item):item is Extract<TextContent['items'][number],{str:string}>=>'str' in item&&!!item.str).map(item=>item.str).join(' '); }
