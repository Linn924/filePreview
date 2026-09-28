import { getDocument, GlobalWorkerOptions, type PDFDocumentLoadingTask, type PDFDocumentProxy } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
type Entry = {
  task: PDFDocumentLoadingTask;
  promise: Promise<PDFDocumentProxy>;
  doc?: PDFDocumentProxy;
  bytes: number;
  users: number;
  retired: boolean;
  /** Loading params included a password (or the doc is already open). */
  withPassword: boolean;
};
const cache = new Map<string, Entry>();
const BUDGET_BYTES = 384 * 1024 * 1024;
const MAX_DOCUMENTS = 8;
let cacheBytes = 0;
function charge(bytes: number) {
  cacheBytes += bytes;
}
function discharge(bytes: number) {
  cacheBytes = Math.max(0, cacheBytes - bytes);
}
function destroy(entry: Entry) { void entry.task.destroy().catch(() => {}); }
function evict() {
  for (const [id, entry] of cache) {
    if (cacheBytes <= BUDGET_BYTES && cache.size <= MAX_DOCUMENTS) break;
    if (entry.users) continue;
    cache.delete(id);
    discharge(entry.bytes);
    destroy(entry);
  }
}
/** Detach from the cache map; active readers keep their lease until release. */
function retire(id: string, entry: Entry) {
  if (cache.get(id) !== entry) return;
  cache.delete(id);
  discharge(entry.bytes);
  entry.retired = true;
  if (!entry.users) destroy(entry);
}
/** Retire on file close; active readers keep their lease until unmount. */
export function releaseDoc(id: string) {
  const entry = cache.get(id);
  if (!entry) return;
  retire(id, entry);
}
export async function acquireCachedPdf(
  id: string,
  bytes: Uint8Array,
  extra: { cMapUrl?: string; cMapPacked?: boolean; standardFontDataUrl?: string; wasmUrl?: string; password?: string } = {},
) {
  GlobalWorkerOptions.workerSrc = workerUrl;
  const password = extra.password;
  let entry = cache.get(id);
  // Unlock must not reuse a load that never received the password.
  if (entry && password && !entry.withPassword && !entry.doc) {
    retire(id, entry);
    entry = undefined;
  }
  if (entry) {
    // Hit: only refresh LRU order. Do not re-charge source bytes.
    cache.delete(id);
    cache.set(id, entry);
  } else {
    const task = getDocument({ data: bytes.slice(), ...extra, useSystemFonts: true });
    entry = {
      task,
      promise: task.promise,
      bytes: bytes.byteLength,
      users: 0,
      retired: false,
      withPassword: Boolean(password),
    };
    cache.set(id, entry);
    charge(entry.bytes);
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
    retire(id, held);
    release();
    throw error;
  }
}
export function cachedPdf(id: string) { return cache.get(id)?.doc; }
/** Test/budget helper: source-byte accounting for idle entries. */
export function docCacheStats() {
  return { count: cache.size, bytes: cacheBytes };
}
