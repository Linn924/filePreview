import {
  getDocument,
  GlobalWorkerOptions,
  type PDFDocumentLoadingTask,
  type PDFDocumentProxy,
} from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

/**
 * Reuse PDFDocumentProxy across tab remounts and print paper sketches.
 * Avoids re-parsing the same invoice PDF on every switch (batch preview).
 */
type Entry = {
  doc: PDFDocumentProxy;
  task: PDFDocumentLoadingTask;
  bytes: number;
};
const cache = new Map<string, Entry>();
const BUDGET_BYTES = 384 * 1024 * 1024;
let cacheBytes = 0;

function touch(id: string, entry: Entry) {
  cache.delete(id);
  cache.set(id, entry);
  cacheBytes += entry.bytes;
  while (cacheBytes > BUDGET_BYTES && cache.size > 1) {
    const oldest = cache.keys().next().value as string | undefined;
    if (!oldest || oldest === id) break;
    releaseDoc(oldest);
  }
}

export function releaseDoc(id: string) {
  const entry = cache.get(id);
  if (!entry) return;
  cacheBytes -= entry.bytes;
  cache.delete(id);
  void entry.task.destroy().catch(() => {});
}

export async function openCachedPdf(
  id: string,
  bytes: Uint8Array,
  extra: {
    cMapUrl?: string;
    cMapPacked?: boolean;
    standardFontDataUrl?: string;
    wasmUrl?: string;
  } = {},
): Promise<PDFDocumentProxy> {
  GlobalWorkerOptions.workerSrc = workerUrl;
  const hit = cache.get(id);
  if (hit) {
    touch(id, hit);
    return hit.doc;
  }
  const task = getDocument({
    data: bytes.slice(),
    cMapUrl: extra.cMapUrl,
    cMapPacked: extra.cMapPacked,
    standardFontDataUrl: extra.standardFontDataUrl,
    wasmUrl: extra.wasmUrl,
    useSystemFonts: true,
  } as never);
  const doc = await task.promise;
  const entry: Entry = {
    doc,
    task,
    bytes: bytes.byteLength,
  };
  touch(id, entry);
  return doc;
}

export function cachedPdf(id: string) {
  return cache.get(id)?.doc;
}
