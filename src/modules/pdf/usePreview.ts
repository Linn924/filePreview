import { fitScale } from "../../composables/fit";
import { previewError } from '../../../shared/previewError';
import { onMounted, onBeforeUnmount, ref, shallowRef, watch, nextTick } from "vue";
import {
  getDocument,
  GlobalWorkerOptions,
  type PDFDocumentLoadingTask,
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
    resize: ResizeObserver | undefined,
    load: PDFDocumentLoadingTask | undefined;
  const pdfRef = shallowRef<PDFDocumentProxy | undefined>();
  const needPassword = ref(false);
  const passwordError = ref("");
  const rotate = ref<0 | 90 | 180 | 270>(props.file.view?.rotate || 0);
  let disposed = false,
    revision = 0;
  let queue = Promise.resolve();
  const rendered = new Set<number>();
  const tasks = new Set<RenderTask>();
  async function updateSizes(updates: Array<{ index: number; width: number; height: number }>) {
    if (disposed) return;
    updates = updates.filter(p => pages.value[p.index]?.width !== p.width || pages.value[p.index]?.height !== p.height);
    if (!updates.length) return;
    const root = scroll.value;
    sync();
    const anchor = elements()[current.value - 1];
    const top = anchor?.getBoundingClientRect().top;
    const beforeScroll = root?.scrollTop;
    for (const p of updates) pages.value[p.index] = { width: p.width, height: p.height };
    await nextTick();
    if (!disposed && root && anchor && top !== undefined && root.scrollTop === beforeScroll)
      root.scrollTop += anchor.getBoundingClientRect().top - top;
  }
  const base = new URL("./pdf-assets/", location.href).href;
  function displayWH(index: number) {
    const p = pages.value[index];
    if (!p) return { width: 1, height: 1 };
    const r = ((rotate.value % 360) + 360) % 360;
    if (r === 90 || r === 270)
      return { width: p.height, height: p.width };
    return p;
  }
  const scale = (width: number, height: number) =>
    (fitScale(
      width,
      height,
      (scroll.value?.clientWidth || 850) - 60,
      (scroll.value?.clientHeight || 700) - 48,
      props.fitMode || "original",
      Math.min(
        Math.max(200, (scroll.value?.clientWidth || 850) - 60) / width,
        1.5,
      ),
    ) *
      props.zoom) /
    100;
  function dimensions(index: number) {
    void layout.value;
    const d = displayWH(index);
    const s = scale(d.width, d.height);
    return { width: d.width * s + "px", height: d.height * s + "px" };
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
        await updateSizes([{ index, width: original.width, height: original.height }]);
        if (disposed || token !== revision) return;
        const d = displayWH(index);
        const ratio = Math.min(devicePixelRatio, 2);
        const viewport = page.getViewport({
          scale: scale(d.width, d.height) * ratio,
          rotation: (page.rotate + rotate.value) % 360,
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
  function setRotate(value: 0 | 90 | 180 | 270) {
    rotate.value = value;
    props.file.view ??= { zoom: props.zoom, scroll: [] };
    props.file.view.rotate = value;
    void refresh();
  }
  async function bootstrap(password?: string) {
    needPassword.value = false;
    passwordError.value = "";
    try {
      void load?.destroy();
      load = getDocument({
        data: props.file.bytes.slice(),
        password,
        cMapUrl: base + "cmaps/",
        cMapPacked: true,
        standardFontDataUrl: base + "standard_fonts/",
        wasmUrl: base + "wasm/",
        useSystemFonts: true,
      });
      pdf = await load.promise;
      pdfRef.value = pdf;
      if (disposed) return;
      const first = await pdf.getPage(1);
      if (disposed) return;
      const initial = first.getViewport({ scale: 1 });
      pages.value = Array.from({ length: pdf.numPages }, () => ({
        width: initial.width,
        height: initial.height,
      }));
      await nextTick();
      await render(0);
      if (disposed) return;
      observe();
      if (!resize) {
        resize = new ResizeObserver(() => void refresh());
        resize.observe(scroll.value!);
      }
      emit("ready");
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      let sizes: Array<{ index: number; width: number; height: number }> = [];
      for (let n = 2; n <= pdf.numPages; n++) {
        if (disposed) return;
        const p = await pdf.getPage(n);
        if (disposed) return;
        const v = p.getViewport({ scale: 1 });
        sizes.push({ index: n - 1, width: v.width, height: v.height });
        if (sizes.length === 16 || n === pdf.numPages) {
          await updateSizes(sizes);
          sizes = [];
          await new Promise<void>((resolve) => setTimeout(resolve, 0));
        }
      }
    } catch (e) {
      if (disposed) return;
      const name = (e as { name?: string })?.name || "";
      if (name === "PasswordException" || /password/i.test(String(e))) {
        needPassword.value = true;
        passwordError.value = password
          ? "密码不正确，请重试。"
          : "此 PDF 受密码保护，请输入密码后继续。";
        return;
      }
      emit("error", previewError(e, "PDF 文件"));
    }
  }
  async function unlock(password: string) {
    await bootstrap(password);
  }
  onMounted(() => void bootstrap());
  watch(
    () => props.zoom,
    () => void refresh(),
  );
  watch(
    () => props.fitMode,
    async () => {
      const page = current.value;
      await refresh();
      await nextTick();
      jump(page);
    },
  );
  onBeforeUnmount(() => {
    disposed = true;
    revision++;
    observer?.disconnect();
    resize?.disconnect();
    tasks.forEach((t) => t.cancel());
    void load?.destroy();
  });
  return {
    scroll,
    pages,
    current,
    sync,
    jump,
    dimensions,
    pdf: pdfRef,
    needPassword,
    passwordError,
    unlock,
    rotate,
    setRotate,
  };
}
