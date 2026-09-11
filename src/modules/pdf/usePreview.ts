import { useWheelPreview } from "../../composables/useWheelPreview";
import { onMounted, onBeforeUnmount, ref, watch } from "vue";
import {
  getDocument,
  GlobalWorkerOptions,
  type PDFDocumentProxy,
  type RenderTask,
} from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { PreviewFile } from "../../types";
import type { PreviewProps, PreviewEmit } from "../types";
export function usePreview(props: PreviewProps, emit: PreviewEmit) {
  GlobalWorkerOptions.workerSrc = workerUrl;
  const pane = ref<HTMLElement>();
  useWheelPreview(pane, {
    zoom: () => props.zoom,
    enabled: () => props.wheelZoom !== false,
    update: (value) => emit("update:zoom", value),
    page: (direction) => {
      current.value = Math.max(
        1,
        Math.min(pages.value, current.value + direction),
      );
    },
  });
  const canvas = ref<HTMLCanvasElement>();
  const scroll = ref<HTMLElement>();
  const current = ref(1);
  const pages = ref(0);
  const rendering = ref(false);
  let pdf: PDFDocumentProxy | undefined;
  let task: RenderTask | undefined;
  let revision = 0;
  let disposed = false;
  let observer: ResizeObserver | undefined;
  let timer: ReturnType<typeof setTimeout>;
  const base = new URL("./pdf-assets/", location.href).href;
  const load = getDocument({
    data: props.file.bytes.slice(),
    cMapUrl: base + "cmaps/",
    cMapPacked: true,
    standardFontDataUrl: base + "standard_fonts/",
    wasmUrl: base + "wasm/",
    useSystemFonts: true,
  });
  async function render() {
    if (!pdf || !canvas.value || disposed) return;
    const token = ++revision;
    const previous = task;
    previous?.cancel();
    try {
      await previous?.promise;
    } catch {}
    if (token !== revision || disposed) return;
    rendering.value = true;
    try {
      const page = await pdf.getPage(current.value);
      if (token !== revision || disposed) return;
      const original = page.getViewport({ scale: 1 });
      const available = Math.max(200, (scroll.value?.clientWidth || 850) - 60);
      const scale =
        (Math.min(available / original.width, 1.5) * props.zoom) / 100;
      const ratio = Math.min(devicePixelRatio, 2);
      const viewport = page.getViewport({ scale: scale * ratio });
      canvas.value.width = Math.ceil(viewport.width);
      canvas.value.height = Math.ceil(viewport.height);
      canvas.value.style.width = viewport.width / ratio + "px";
      canvas.value.style.height = viewport.height / ratio + "px";
      task = page.render({ canvas: canvas.value, viewport });
      await task.promise;
      if (token === revision && !disposed) {
        emit("ready");
        rendering.value = false;
      }
    } catch (e) {
      if (
        token === revision &&
        !disposed &&
        !(e instanceof Error && e.name === "RenderingCancelledException")
      )
        emit("error", "PDF 页面无法显示。" + String(e));
    }
  }
  onMounted(async () => {
    try {
      pdf = await load.promise;
      pages.value = pdf.numPages;
      await render();
      observer = new ResizeObserver(() => {
        clearTimeout(timer);
        timer = setTimeout(() => void render(), 120);
      });
      observer.observe(scroll.value!);
    } catch (e) {
      if (!disposed)
        emit(
          "error",
          e instanceof Error && e.name === "PasswordException"
            ? "此 PDF 已加密，当前版本不支持加密文件。"
            : "无法打开 PDF，文件可能损坏。",
        );
    }
  });
  watch([current, () => props.zoom], () => {
    if (scroll.value) scroll.value.scrollTop = 0;
    void render();
  });
  onBeforeUnmount(() => {
    disposed = true;
    revision++;
    clearTimeout(timer);
    observer?.disconnect();
    task?.cancel();
    void load.destroy();
  });

  return { pane, scroll, canvas, current, pages, rendering };
}
