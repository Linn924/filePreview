import { getDocument, GlobalWorkerOptions, type PDFDocumentLoadingTask, type PDFDocumentProxy } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
type Entry = {
  task: PDFDocumentLoadingTask;
  promise: Promise<PDFDocumentProxy>;
  doc?: PDFDocumentProxy;
  bytes: number;
  users: number;
  retired: boolean;
};
const cache = new Map<string, Entry>();
const BUDGET_BYTES = 384 * 1024 * 1024;
const MAX_DOCUMENTS = 8;
let cacheBytes = 0;
function destroy(entry: Entry) { void entry.task.destroy().catch(() => {}); }
function evict() {
  for (const [id, entry] of cache) {
    if (cacheBytes <= BUDGET_BYTES && cache.size <= MAX_DOCUMENTS) break;
    if (entry.users) continue;
    cache.delete(id);
    cacheBytes -= entry.bytes;
    destroy(entry);
  }
}
/** Retire on file close; active readers keep their lease until unmount. */
export function releaseDoc(id: string) {
  const entry = cache.get(id);
  if (!entry) return;
  cache.delete(id);
  cacheBytes -= entry.bytes;
  entry.retired = true;
  if (!entry.users) destroy(entry);
}
export async function acquireCachedPdf(
  id: string,
  bytes: Uint8Array,
  extra: { cMapUrl?: string; cMapPacked?: boolean; standardFontDataUrl?: string; wasmUrl?: string; password?: string } = {},
) {
  GlobalWorkerOptions.workerSrc = workerUrl;
  let entry = cache.get(id);
  if (entry) {
    cache.delete(id);
    cache.set(id, entry);
  } else {
    const task = getDocument({ data: bytes.slice(), ...extra, useSystemFonts: true });
    entry = { task, promise: task.promise, bytes: bytes.byteLength, users: 0, retired: false };
    cache.set(id, entry);
    cacheBytes += entry.bytes;
  }
  const held = entry;
  held.users++;
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    held.users--;
    if (held.retired && !held.users) destroy(held);
    evict();
  };
  try {
    const doc = await held.promise;
    held.doc = doc;
    evict();
    return { doc, release };
  } catch (error) {
    if (cache.get(id) === held) releaseDoc(id);
    release();
    throw error;
  }
}
export function cachedPdf(id: string) { return cache.get(id)?.doc; }
