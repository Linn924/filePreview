import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import { pdfWork } from "./workQueue";
type TextContent = Awaited<ReturnType<PDFPageProxy['getTextContent']>>;
const documents = new WeakMap<PDFDocumentProxy, Map<number, Promise<TextContent>>>();
/** Share extraction between search and text layers, bounded per document. */
export function pageTextContent(doc: PDFDocumentProxy, page: number, priority = 1) {
  let cache = documents.get(doc);
  if (!cache) { cache = new Map(); documents.set(doc, cache); }
  let result = cache.get(page);
  if (result) { cache.delete(page); cache.set(page, result); return result; }
  result = pdfWork(priority, async () => (await doc.getPage(page)).getTextContent());
  cache.set(page, result);
  if (cache.size > 32) cache.delete(cache.keys().next().value!);
  const held = result;
  void result.catch(() => { if (cache!.get(page) === held) cache!.delete(page); });
  return result;
}
