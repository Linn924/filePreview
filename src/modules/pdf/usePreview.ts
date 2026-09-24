import { fitScale } from "../../composables/fit";
import { previewError } from "../../../shared/previewError";
import { createSafeResizeObserver } from "../../composables/safeResizeObserver";
import { previewPixelRatio } from "./bitmap";
import { openCachedPdf, releaseDoc } from "./docCache";
import {
  onMounted,
  onBeforeUnmount,
  ref,
  shallowRef,
  computed,
  watch,
  nextTick,
} from "vue";
import {
  getDocument,
  GlobalWorkerOptions,
  type PDFDocumentLoadingTask,
  type PDFDocumentProxy,
  type RenderTask,
} from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { PreviewProps, PreviewEmit } from "../types";

const OVERSCAN = 2;
/** Must match .pdf-page margin-bottom; virtual padding represents complete page slots. */
const PAGE_GAP = 24;
const SCROLL_PADDING = 26;

export function usePreview(props: PreviewProps, emit: PreviewEmit) {
  GlobalWorkerOptions.workerSrc = workerUrl;
  const scroll = ref<HTMLElement>();
  const layout = ref(0);
  const textGeometry = ref(0);
  const pages = ref<Array<{ width: number; height: number }>>([]);
  const current = ref(1);
  let pdf: PDFDocumentProxy | undefined,
    observer: IntersectionObserver | undefined,
    resize: ResizeObserver | undefined,
    load: PDFDocumentLoadingTask | undefined;
  const pdfRef = shallowRef<PDFDocumentProxy | undefined>();
  const needPassword = ref(false);
  const allowPrint = ref(true);
  const passwordError = ref("");
  const rotate = ref<0 | 90 | 180 | 270>(props.file.view?.rotate || 0);
  let disposed = false,
    revision = 0;
  let queue = Promise.resolve();
  const rendered = new Map<number, HTMLCanvasElement>();
  const tasks = new Map<number, {task:RenderTask;canvas:HTMLCanvasElement}>();
  const pending = new Set<number>();
  const failed = new Set<number>();
  const retries = new Map<number, number>();
  const base = new URL("./pdf-assets/", location.href).href;

  function displayWH(index: number) {
    const p = pages.value[index];
    if (!p) return { width: 1, height: 1 };
    const r = ((rotate.value % 360) + 360) % 360;
    if (r === 90 || r === 270) return { width: p.height, height: p.width };
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
  function pageCss(index: number) {
    void layout.value;
    const d = displayWH(index);
    const s = scale(d.width, d.height);
    return { width: d.width * s, height: d.height * s };
  }
  function dimensions(index: number) {
    const { width, height } = pageCss(index);
    return { width: width + "px", height: height + "px" };
  }

  /** Cumulative offsets for virtualization (prefix[0]=0). */
  const offsets = computed(() => {
    void layout.value;
    const list = [0];
    for (let i = 0; i < pages.value.length; i++)
      list.push(list[i] + pageCss(i).height + PAGE_GAP);
    return list;
  });
  function indexAtOffset(y: number) {
    const o = offsets.value;
    let lo = 0,
      hi = Math.max(0, pages.value.length - 1);
    if (!o.length) return 0;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (o[mid + 1] <= y) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }
  const virtualStart = ref(0);
  const virtualEnd = ref(1);
  const padTop = computed(() => offsets.value[virtualStart.value] || 0);
  const padBottom = computed(() => {
    const o = offsets.value;
    const total = o[o.length - 1] || 0;
    const end = o[virtualEnd.value] ?? total;
    return Math.max(0, total - end);
  });
  const visiblePages = computed(() => {
    const out: number[] = [];
    for (let i = virtualStart.value; i < virtualEnd.value; i++) out.push(i);
    return out;
  });
  function updateVirtualWindow() {
    const root = scroll.value;
    const n = pages.value.length;
    if (!root || !n) {
      virtualStart.value = 0;
      virtualEnd.value = Math.min(n, 1);
      return;
    }
    const y = Math.max(0, root.scrollTop - SCROLL_PADDING);
    const h = root.clientHeight || 700;
    virtualStart.value = Math.max(0, indexAtOffset(y) - OVERSCAN);
    virtualEnd.value = Math.min(n, indexAtOffset(y + h) + 1 + OVERSCAN);
    current.value = indexAtOffset(y + Math.min(100, h * 0.2)) + 1;
  }
  function sync() {
    updateVirtualWindow();
  }
  function jump(value: number) {
    const n = pages.value.length;
    const index = Math.max(0, Math.min(n, Math.floor(value) || 1) - 1);
    const root = scroll.value;
    if (!root || !n) return;
    root.scrollTop = Math.max(0, offsets.value[index] || 0);
    current.value = index + 1;
    updateVirtualWindow();
  }

  async function updateSizes(
    updates: Array<{ index: number; width: number; height: number }>,
  ) {
    if (disposed) return;
    updates = updates.filter(
      (p) =>
        pages.value[p.index]?.width !== p.width ||
        pages.value[p.index]?.height !== p.height,
    );
    if (!updates.length) return;
    const root = scroll.value;
    const beforeTop = root?.scrollTop;
    const anchorPage = current.value - 1;
    const anchorOffsetBefore = offsets.value[anchorPage] || 0;
    for (const p of updates)
      pages.value[p.index] = { width: p.width, height: p.height };
    layout.value++;
    if (updates.some(p=>p.index>=virtualStart.value&&p.index<virtualEnd.value))
      textGeometry.value++;
    await nextTick();
    if (!disposed && root && beforeTop !== undefined) {
      const anchorOffsetAfter = offsets.value[anchorPage] || 0;
      root.scrollTop = beforeTop + (anchorOffsetAfter - anchorOffsetBefore);
    }
    updateVirtualWindow();
  }

  function pageEl(index: number) {
    return scroll.value?.querySelector<HTMLElement>(
      `.pdf-page[data-page="${index}"]`,
    );
  }

  function inRenderRange(index: number) {
    const root = scroll.value;
    const node = pageEl(index);
    if (!root || !node) return false;
    const boundary = root.getBoundingClientRect();
    const page = node.getBoundingClientRect();
    return page.bottom >= boundary.top - 600 && page.top <= boundary.bottom + 600;
  }

  function releaseCanvas(canvas: HTMLCanvasElement) {
    canvas.width = 0;
    canvas.height = 0;
  }

  function render(index: number) {
    if (pending.has(index) || failed.has(index)) return queue;
    pending.add(index);
    const token = revision;
    queue = queue
      .then(async () => {
        if (disposed || token !== revision || !pdf || !inRenderRange(index))
          return;
        const canvas = pageEl(index)?.querySelector("canvas");
        if (!canvas) return;
        if (rendered.get(index) === canvas && canvas.width > 0) return;
        const page = await pdf.getPage(index + 1);
        if (disposed || token !== revision || !inRenderRange(index)) return;
        const original = page.getViewport({ scale: 1 });
        await updateSizes([
          { index, width: original.width, height: original.height },
        ]);
        if (disposed || token !== revision || !inRenderRange(index)) return;
        const d = displayWH(index);
        const cssScale = scale(d.width, d.height);
        const ratio = previewPixelRatio(
          d.width * cssScale,
          d.height * cssScale,
          devicePixelRatio,
        );
        const viewport = page.getViewport({
          scale: cssScale * ratio,
          rotation: (page.rotate + rotate.value) % 360,
        });
        canvas.width = Math.max(1, Math.floor(viewport.width));
        canvas.height = Math.max(1, Math.floor(viewport.height));
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) return;
        context.fillStyle = "#fff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        const task = page.render({ canvas, canvasContext: context, viewport });
        tasks.set(index, {task,canvas});
        try {
          await task.promise;
          if (token === revision && inRenderRange(index)) {
            rendered.set(index, canvas);
            retries.delete(index);
          }
        } finally {
          if (rendered.get(index) !== canvas &&
              (disposed || token !== revision || !inRenderRange(index)))
            releaseCanvas(canvas);
          if (tasks.get(index)?.task === task) tasks.delete(index);
        }
      })
      .catch((e) => {
        if (!disposed && e?.name !== "RenderingCancelledException") {
          failed.add(index);
          emit("error", "PDF 页面无法显示：" + String(e));
        }
      })
      .finally(() => {
        pending.delete(index);
        if (disposed || token !== revision || failed.has(index) || !inRenderRange(index)) return;
        const canvas=pageEl(index)?.querySelector('canvas');
        if (canvas && (rendered.get(index)!==canvas || canvas.width===0)) {
          const attempts=(retries.get(index)||0)+1;
          retries.set(index,attempts);
          if(attempts<=8)requestAnimationFrame(()=>{if(!disposed)void render(index);});
        }
      });
    return queue;
  }

  function observe() {
    observer?.disconnect();
    for (const [index, canvas] of rendered) {
      if (pageEl(index)?.querySelector("canvas") !== canvas) {
        releaseCanvas(canvas);
        rendered.delete(index);
      }
    }
    observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const i = Number((e.target as HTMLElement).dataset.page);
          if (e.isIntersecting) void render(i);
          else {
            const canvas = e.target.querySelector("canvas")!;
            const running=tasks.get(i);
            if(running?.canvas===canvas)running.task.cancel();
            if (rendered.get(i) === canvas) {
              releaseCanvas(canvas);
              rendered.delete(i);
            }
          }
        }
      },
      { root: scroll.value, rootMargin: "600px" },
    );
    for (let i = virtualStart.value; i < virtualEnd.value; i++) {
      const el = pageEl(i);
      if (el) observer.observe(el);
    }
  }

  async function refresh() {
    layout.value++;
    textGeometry.value++;
    revision++;
    failed.clear();
    retries.clear();
    tasks.forEach(({task}) => task.cancel());
    await queue;
    if (disposed) return;
    for (const canvas of rendered.values()) releaseCanvas(canvas);
    rendered.clear();
    await nextTick();
    updateVirtualWindow();
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
      const doc = await openCachedPdf(props.file.id, props.file.bytes.slice(), {
        cMapUrl: base + "cmaps/",
        cMapPacked: true,
        standardFontDataUrl: base + "standard_fonts/",
        wasmUrl: base + "wasm/",
      });
      pdf = doc;
      load = undefined;
      pdfRef.value = doc;
      try {
        const perms = (await doc.getPermissions()) as number | null;
        // null/undefined = unlimited; otherwise bit flags (PDF.js PermissionFlag)
        if (perms == null) allowPrint.value = true;
        else allowPrint.value = ((Number(perms) & 4) === 4); // PRINT = 0x04
      } catch {
        allowPrint.value = true;
      }
      if (disposed) return;
      const first = await doc.getPage(1);
      if (disposed) return;
      const initial = first.getViewport({ scale: 1 });
      pages.value = Array.from({ length: doc.numPages }, () => ({
        width: initial.width,
        height: initial.height,
      }));
      virtualStart.value = 0;
      virtualEnd.value = Math.min(doc.numPages, 3);
      await nextTick();
      updateVirtualWindow();
      await render(virtualStart.value);
      if (disposed) return;
      observe();
      if (!resize && scroll.value) {
        resize = createSafeResizeObserver(() => void refresh());
        resize.observe(scroll.value);
      }
      emit("ready");
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      let sizes: Array<{ index: number; width: number; height: number }> = [];
      for (let n = 2; n <= doc.numPages; n++) {
        if (disposed) return;
        const p = await doc.getPage(n);
        if (disposed) return;
        const v = p.getViewport({ scale: 1 });
        sizes.push({ index: n - 1, width: v.width, height: v.height });
        if (sizes.length === 16 || n === pdf.numPages) {
          await updateSizes(sizes);
          sizes = [];
          await new Promise<void>((resolve) => setTimeout(resolve, 0));
        }
      }
      updateVirtualWindow();
      observe();
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

  // Re-observe when virtual window slides.
  watch([virtualStart, virtualEnd], async () => {
    await nextTick();
    if (!disposed && pdf) observe();
  });

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
    tasks.forEach(({task}) => task.cancel());
    for (const canvas of rendered.values()) releaseCanvas(canvas);
    rendered.clear();
    load?.destroy?.();
  });
  return {
    scroll,
    pages,
    current,
    sync,
    jump,
    dimensions,
    visiblePages,
    padTop,
    padBottom,
    pdf: pdfRef,
    needPassword,
    passwordError,
    unlock,
    rotate,
    layout,
    textGeometry,
    setRotate,
    allowPrint,
  };
}
