import { onMounted, onBeforeUnmount, ref, watch, nextTick } from "vue";
import {
  getDocument,
  GlobalWorkerOptions,
  type PDFDocumentProxy,
  type RenderTask,
} from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { useContinuousPages } from "../../composables/useContinuousPages";
import type { PreviewProps, PreviewEmit } from "../types";
export function usePreview(props: PreviewProps, emit: PreviewEmit) {
  GlobalWorkerOptions.workerSrc = workerUrl;
  const scroll = ref<HTMLElement>();
  const layout = ref(0);
  const pages = ref<Array<{ width: number; height: number }>>([]);
  const elements = () =>
    Array.from(scroll.value?.querySelectorAll<HTMLElement>(".pdf-page") || []);
  const { current, sync, jump } = useContinuousPages(scroll, elements);
  let pdf: PDFDocumentProxy | undefined,
    observer: IntersectionObserver | undefined,
    resize: ResizeObserver | undefined;
  let disposed = false,
    revision = 0;
  let queue = Promise.resolve();
  const rendered = new Set<number>();
  const tasks = new Set<RenderTask>();
  const base = new URL("./pdf-assets/", location.href).href;
  const load = getDocument({
    data: props.file.bytes.slice(),
    cMapUrl: base + "cmaps/",
    cMapPacked: true,
    standardFontDataUrl: base + "standard_fonts/",
    wasmUrl: base + "wasm/",
    useSystemFonts: true,
  });
  const scale = (width: number) =>
    (Math.min(
      Math.max(200, (scroll.value?.clientWidth || 850) - 60) / width,
      1.5,
    ) *
      props.zoom) /
    100;
  function dimensions(index: number) {
    void layout.value;
    const p = pages.value[index],
      s = scale(p.width);
    return { width: p.width * s + "px", height: p.height * s + "px" };
  }
  function render(index: number) {
    const token = revision;
    queue = queue
      .then(async () => {
        if (disposed || token !== revision || rendered.has(index) || !pdf)
          return;
        const canvas = elements()[index]?.querySelector("canvas");
        if (!canvas) return;
        const page = await pdf.getPage(index + 1);
        if (disposed || token !== revision) return;
        const original = page.getViewport({ scale: 1 });
        const ratio = Math.min(devicePixelRatio, 2);
        const viewport = page.getViewport({
          scale: scale(original.width) * ratio,
        });
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const task = page.render({ canvas, viewport });
        tasks.add(task);
        try {
          await task.promise;
          if (token === revision) rendered.add(index);
        } finally {
          tasks.delete(task);
        }
      })
      .catch((e) => {
        if (!disposed && e?.name !== "RenderingCancelledException")
          emit("error", "PDF 页面无法显示：" + String(e));
      });
    return queue;
  }
  function observe() {
    observer?.disconnect();
    observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const i = Number((e.target as HTMLElement).dataset.page);
          if (e.isIntersecting) void render(i);
          else if (rendered.has(i)) {
            const c = e.target.querySelector("canvas")!;
            c.width = 0;
            c.height = 0;
            rendered.delete(i);
          }
        }
      },
      { root: scroll.value, rootMargin: "800px" },
    );
    elements().forEach((el) => observer!.observe(el));
  }
  async function refresh() {
    layout.value++;
    revision++;
    tasks.forEach((t) => t.cancel());
    await queue;
    if (disposed) return;
    rendered.clear();
    await nextTick();
    observe();
  }
  onMounted(async () => {
    try {
      pdf = await load.promise;
      if (disposed) return;
      const sizes = [];
      for (let n = 1; n <= pdf.numPages; n++) {
        const p = await pdf.getPage(n);
        if (disposed) return;
        const v = p.getViewport({ scale: 1 });
        sizes.push({ width: v.width, height: v.height });
      }
      pages.value = sizes;
      await nextTick();
      await render(0);
      observe();
      resize = new ResizeObserver(() => void refresh());
      resize.observe(scroll.value!);
      emit("ready");
    } catch (e) {
      if (!disposed)
        emit("error", "无法打开 PDF，文件可能损坏或已加密。" + String(e));
    }
  });
  watch(
    () => props.zoom,
    () => void refresh(),
  );
  onBeforeUnmount(() => {
    disposed = true;
    revision++;
    observer?.disconnect();
    resize?.disconnect();
    tasks.forEach((t) => t.cancel());
    void load.destroy();
  });
  return { scroll, pages, current, sync, jump, dimensions };
}
