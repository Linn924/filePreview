import { ref, shallowRef, type Ref } from "vue";
import type { PDFDocumentProxy } from "pdfjs-dist";

export interface SearchHit {
  page: number;
  text: string;
}

export function usePdfSearch(pdf: Ref<PDFDocumentProxy | undefined>) {
  const query = ref("");
  const searching = ref(false);
  const hits = shallowRef<SearchHit[]>([]);
  const active = ref(-1);
  const error = ref("");
  const cache = new Map<number, string>();

  async function pageText(n: number) {
    let text = cache.get(n);
    if (text !== undefined) return text;
    const doc = pdf.value;
    if (!doc) return "";
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    const parts = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .filter(Boolean);
    // Keep both spaced and compact forms so CJK and Latin invoices match.
    text = [parts.join(" "), parts.join("")]
    .map((s) => s.replace(/\s+/g, " ").trim())
    .join("\n");
    cache.set(n, text);
    return text;
  }

  async function run(value = query.value) {
    query.value = value;
    error.value = "";
    hits.value = [];
    active.value = -1;
    const q = value.trim();
    if (!q || !pdf.value) return;
    searching.value = true;
    try {
      const found: SearchHit[] = [];
      const needle = q.toLowerCase();
      for (let n = 1; n <= pdf.value.numPages; n++) {
        const text = await pageText(n);
        if (text.toLowerCase().includes(needle)) found.push({ page: n, text });
      }
      hits.value = found;
      active.value = found.length ? 0 : -1;
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      searching.value = false;
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
  return { query, searching, hits, active, error, run, next, prev, clear, pageText };
}
