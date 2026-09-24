import { ref, shallowRef, type Ref } from "vue";
import type { PDFDocumentProxy } from "pdfjs-dist";

export interface SearchHit {
  /** 1-based page */
  page: number;
  /** char offset in page text */
  charOffset: number;
  length: number;
  /** snippet around hit */
  text: string;
}

export function usePdfSearch(pdf: Ref<PDFDocumentProxy | undefined>) {
  const query = ref("");
  const searching = ref(false);
  const hits = shallowRef<SearchHit[]>([]);
  const active = ref(-1);
  const error = ref("");
  const cache = new Map<number, string>();
  const MAX_CACHED_PAGES = 32;
  let searchRevision = 0;

  async function pageText(n: number) {
    let text = cache.get(n);
    if (text !== undefined) {
      cache.delete(n);
      cache.set(n,text);
      return text;
    }
    const doc = pdf.value;
    if (!doc) return "";
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    const parts = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .filter(Boolean);
    text = parts.join(" ").replace(/\s+/g, " ").trim();
    cache.set(n, text);
    if(cache.size>MAX_CACHED_PAGES)cache.delete(cache.keys().next().value!);
    return text;
  }

  async function run(value = query.value) {
    query.value = value;
    error.value = "";
    hits.value = [];
    active.value = -1;
    const rev = ++searchRevision;
    const q = value.trim();
    if (!q || !pdf.value) return;
    searching.value = true;
    try {
      const found: SearchHit[] = [];
      const needle = q.toLowerCase();
      for (let n = 1; n <= pdf.value.numPages; n++) {
        if (rev !== searchRevision) return;
        const text = await pageText(n);
        if (rev !== searchRevision) return;
        const hay = text.toLowerCase();
        let at = hay.indexOf(needle);
        while (at >= 0) {
          if (rev !== searchRevision) return;
          found.push({
            page: n,
            charOffset: at,
            length: needle.length,
            text: text.slice(Math.max(0, at - 12), at + needle.length + 18),
          });
          at = hay.indexOf(needle, at + Math.max(1, needle.length));
        }
        if(found.length!==hits.value.length){
          hits.value=[...found];
          if(active.value===-1)active.value=0;
        }
      }
    } catch (e) {
      if (rev === searchRevision)
        error.value = e instanceof Error ? e.message : String(e);
    } finally {
      if (rev === searchRevision) searching.value = false;
    }
  }

  function next() {
    if (!hits.value.length) return;
    active.value = (active.value + 1) % hits.value.length;
  }
  function prev() {
    if (!hits.value.length) return;
    active.value =
      (active.value - 1 + hits.value.length) % hits.value.length;
  }
  function clear() {
    query.value = "";
    hits.value = [];
    active.value = -1;
    error.value = "";
  }
  return {
    query,
    searching,
    hits,
    active,
    error,
    run,
    next,
    prev,
    clear,
    pageText,
    cacheSize:()=>cache.size,
  };
}
