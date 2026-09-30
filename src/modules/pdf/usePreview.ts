import { fitScale } from "../../composables/fit";
import { previewError } from "../../../shared/previewError";
import { createSafeResizeObserver } from "../../composables/safeResizeObserver";
import { previewPixelRatio } from "./bitmap";
import { acquireCachedPdf } from "./docCache";
import { pdfWork } from "./workQueue";
import { PageIndex } from './pageIndex';
import { cachedPageSize, rememberPageSize, pageSize } from './metadata';
import { pdfResources } from './resources';
import { allocatePdfCanvas, availablePdfPixels, releasePdfCanvas, prunePdfCanvases } from './canvasPool';
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
  GlobalWorkerOptions,
  type PDFDocumentProxy,
  type RenderTask,
} from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { PreviewProps, PreviewEmit } from "../types";

const OVERSCAN = 2;
/** Must match .pdf-page margin-bottom; virtual padding represents complete page slots. */
const PAGE_GAP = 24;
const SCROLL_PADDING = 26;

export function usePreview(props: PreviewProps, emit: PreviewEmit, publishPermission?:(allowed:boolean,password?:string)=>void,presentation=ref(false)) {
  GlobalWorkerOptions.workerSrc = workerUrl;
  const scroll = ref<HTMLElement>();
  const layout = ref(0);
  const textGeometry = ref(0);
  const pages = ref<Array<{ width: number; height: number }>>([]);
  const current = ref(1);
  let pdf: PDFDocumentProxy | undefined,
    observer: IntersectionObserver | undefined,
    resize: ResizeObserver | undefined;
  const pdfRef = shallowRef<PDFDocumentProxy | undefined>();
  const needPassword = ref(false);
  const allowPrint = ref(true);
  const passwordError = ref("");
  const rotate = ref<0 | 90 | 180 | 270>(props.file.view?.rotate || 0);
  let disposed = false,
    revision = 0;
  let queue = Promise.resolve();
  let releaseLease: (() => void) | undefined;
  let refreshTimer: ReturnType<typeof setTimeout> | undefined;
  let refreshing = false;
  let refreshAgain = false;
  let scanningSizes = false;
  let bootstrapRevision=0;
  let scrollFrame = 0;
  let visibility:MutationObserver|undefined;
  let idleWarmup=0;
  let warmupController=new AbortController();
  const lifetime = new AbortController();
  let generation = new AbortController();
  let positions = new PageIndex([]);
  let lastGeometry='';
  const geometryKey=()=>[presentation.value,props.zoom,props.fitMode,rotate.value,scroll.value?.clientWidth,props.fitMode==='page'?scroll.value?.clientHeight:0].join(':');
  const ownedCanvases = new Set<HTMLCanvasElement>();
  const rendered = new Map<number, HTMLCanvasElement>();
  const tasks = new Map<number, {task:RenderTask;canvas:HTMLCanvasElement}>();
  let sizeQueue=Promise.resolve();
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
      presentation.value?"page":props.fitMode || "original",
      Math.min(
        Math.max(200, (scroll.value?.clientWidth || 850) - 60) / width,
        1.5,
      ),
    ) *
      (presentation.value?100:props.zoom)) /
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

  function offsetAt(index:number) { void layout.value;return positions.prefix(index); }
  function rebuildPositions() {
    positions = new PageIndex(pages.value.map((_,i)=>pageCss(i).height+PAGE_GAP));
    layout.value++;
  }
  function indexAtOffset(y: number) {
    return positions.indexAt(y);
  }
  const virtualStart = ref(0);
  const virtualEnd = ref(1);
  const padTop = computed(() => presentation.value?0:offsetAt(virtualStart.value));
  const padBottom = computed(() => {
    if(presentation.value)return 0;
    return Math.max(0, offsetAt(pages.value.length) - offsetAt(virtualEnd.value));
  });
  const visiblePages = computed(() => {
    if(presentation.value)return pages.value.length?[current.value-1]:[];
    const out: number[] = [];
    for (let i = virtualStart.value; i < virtualEnd.value; i++) out.push(i);
    return out;
  });
  function updateVirtualWindow() {
    if(presentation.value)return;
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
    if (scrollFrame) return;
    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = 0;
      if (!disposed) {updateVirtualWindow();scheduleWarmup();}
    });
  }
  function scheduleWarmup() {
    if(disposed||!pdf||pdf.numPages<100)return;
    cancelIdleCallback(idleWarmup);warmupController.abort();warmupController=new AbortController();
    const signal=warmupController.signal,doc=pdf,center=current.value;
    idleWarmup=requestIdleCallback(()=>{
      void (async()=>{
        for(let distance=1;distance<=10;distance++)for(const n of [center+distance,center-distance]){
          if(disposed||signal.aborted||pdf!==doc)return;
          if(n<1||n>doc.numPages||cachedPageSize(doc,n))continue;
          try {const size=await pageSize(doc,n,5,signal);if(!disposed&&!signal.aborted)await updateSizes([{index:n-1,...size}]);}
          catch(error){if((error as Error).name==='AbortError')return;}
        }
      })();
    },{timeout:500});
  }
  function jump(value: number) {
    const n = pages.value.length;
    const index = Math.max(0, Math.min(n, Math.floor(value) || 1) - 1);
    const root = scroll.value;
    if (!root || !n) return;
    if(presentation.value){current.value=index+1;root.scrollTop=0;scheduleWarmup();return;}
    root.scrollTop = Math.max(0, offsetAt(index));
    current.value = index + 1;
    updateVirtualWindow();scheduleWarmup();
  }

  function updateSizes(updates:Array<{index:number;width:number;height:number}>) {
    sizeQueue=sizeQueue.then(()=>applySizes(updates));return sizeQueue;
  }
  async function applySizes(
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
    const anchorOffsetBefore = offsetAt(anchorPage);
    for (const p of updates)
      pages.value[p.index] = { width: p.width, height: p.height };
    for(const p of updates)positions.set(p.index,pageCss(p.index).height+PAGE_GAP);
    layout.value++;
    if (updates.some(p=>p.index>=virtualStart.value&&p.index<virtualEnd.value))
      textGeometry.value++;
    await nextTick();
    if (!disposed && root && beforeTop !== undefined) {
      const anchorOffsetAfter = offsetAt(anchorPage);
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
    ownedCanvases.delete(canvas);
    releasePdfCanvas(canvas);
  }

  function render(index: number) {
    if (pending.has(index) || failed.has(index)) return queue;
    pending.add(index);
    const token = revision;
    const signal = generation.signal;
    // Submit all visible pages together; serialize per-canvas ownership via pending.
    const job = pdfWork(Math.min(0.9,Math.abs(index+1-current.value)*0.1), async () => {
        if(scroll.value)scroll.value.dataset.pdfStage='render-work';
        if (disposed || token !== revision || !pdf || !inRenderRange(index))
          return;
        const canvas = pageEl(index)?.querySelector("canvas");
        if (!canvas) return;
        if (rendered.get(index) === canvas && canvas.width > 0) return;
        const page = await pdf.getPage(index + 1);
        if(scroll.value)scroll.value.dataset.pdfStage='render-page';
        if (disposed || token !== revision || !inRenderRange(index)) return;
        const original = page.getViewport({ scale: 1 });
        rememberPageSize(pdf,index+1,{width:original.width,height:original.height});
        await updateSizes([
          { index, width: original.width, height: original.height },
        ]);
        if(scroll.value)scroll.value.dataset.pdfStage='render-sized';
        if (disposed || token !== revision || !inRenderRange(index)) return;
        const d = displayWH(index);
        const cssScale = scale(d.width, d.height);
        const off = document.createElement("canvas");
        const allowance=Math.min(availablePdfPixels(),pdfResources.value.pixels / (2 * Math.max(2,visiblePages.value.length)));
        if(allowance<4)return;
        const ratio = previewPixelRatio(
          d.width * cssScale,
          d.height * cssScale,
          devicePixelRatio,
          allowance,
        );
        const viewport = page.getViewport({
          scale: cssScale * ratio,
          rotation: (page.rotate + rotate.value) % 360,
        });
        // Render offscreen, then blit: continuous zoom/resize keeps old pixels
        // until the new bitmap is ready (avoids a long white flash).
        if(!allocatePdfCanvas(off,Math.max(1,Math.floor(viewport.width)),Math.max(1,Math.floor(viewport.height)),true))return;
        const context = off.getContext("2d", { alpha: false });
        if (!context) { releasePdfCanvas(off);return; }
        context.fillStyle = "#fff";
        context.fillRect(0, 0, off.width, off.height);
        let task:RenderTask|undefined;
        try {
          task = page.render({ canvas: off, canvasContext: context, viewport });
          tasks.set(index, {task,canvas});
          if(scroll.value)scroll.value.dataset.pdfStage='render-task';
          await task.promise;
          if(scroll.value)scroll.value.dataset.pdfStage='render-pixels';
          if (disposed || token !== revision || !inRenderRange(index) || pageEl(index)?.querySelector('canvas')!==canvas) return;
          if(!allocatePdfCanvas(canvas,off.width,off.height))return;
          ownedCanvases.add(canvas);
          const target = canvas.getContext("2d", { alpha: false });
          if (!target) return;
          target.drawImage(off, 0, 0);
          rendered.set(index, canvas);
          retries.delete(index);
        } finally {
          releasePdfCanvas(off);
          // Keep the live bitmap when a newer refresh supersedes this task.
          if (disposed) releaseCanvas(canvas);
          if (tasks.get(index)?.task === task) tasks.delete(index);
        }
      },signal)
      .catch((e) => {
        if (!disposed && token===revision && e?.name !== "RenderingCancelledException" && e?.name!=='AbortError') {
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
    queue=Promise.allSettled([queue,job]).then(()=>{});
    return job;
  }

  function observe() {
    prunePdfCanvases();
    observer?.disconnect();
    for(const canvas of ownedCanvases) {
      if(!canvas.isConnected || !scroll.value?.contains(canvas))releaseCanvas(canvas);
    }
    for (const [index, canvas] of rendered) {
      if (pageEl(index)?.querySelector("canvas") !== canvas) {
        releaseCanvas(canvas);
        rendered.delete(index);
      }
    }
    observer = new IntersectionObserver(
      (entries) => {
        entries.sort((a,b)=>Math.abs(Number((a.target as HTMLElement).dataset.page)+1-current.value)-Math.abs(Number((b.target as HTMLElement).dataset.page)+1-current.value));
        for (const e of entries) {
          const i = Number((e.target as HTMLElement).dataset.page);
          if (e.isIntersecting) void render(i);
          else {
            const canvas = e.target.querySelector("canvas")!;
            const running=tasks.get(i);
            if(running?.canvas===canvas)running.task.cancel();
            if (ownedCanvases.has(canvas)) {
              releaseCanvas(canvas);
              rendered.delete(i);
            }
          }
        }
      },
      { root: scroll.value, rootMargin: "600px" },
    );
    for (const i of visiblePages.value) {
      const el = pageEl(i);
      if (el) observer.observe(el);
    }
  }

  async function refresh() {
    if (disposed) return;
    if (refreshing) { refreshAgain = true; return; }
    refreshing = true;
    try {
      generation.abort();generation=new AbortController();
      const geometry=geometryKey();
      if(geometry!==lastGeometry){lastGeometry=geometry;rebuildPositions();textGeometry.value++;}
      revision++;
      failed.clear();
      retries.clear();
      tasks.forEach(({task}) => task.cancel());
      await queue;
      if (disposed) return;
      // Keep current bitmaps on screen; render() replaces each page when ready.
      rendered.clear();
      await nextTick();
      updateVirtualWindow();
      observe();
    } finally {
      refreshing = false;
      if (refreshAgain) { refreshAgain = false; scheduleRefresh(); }
    }
  }

  function scheduleRefresh() {
    if (disposed) return;
    clearTimeout(refreshTimer);
    // Keep existing pixels during continuous resize/zoom, redraw after settling.
    refreshTimer = setTimeout(() => { refreshTimer = undefined; void refresh(); }, 100);
  }

  function setRotate(value: 0 | 90 | 180 | 270) {
    rotate.value = value;
    props.file.view ??= { zoom: props.zoom, scroll: [] };
    props.file.view.rotate = value;
    void refresh();
  }

  async function bootstrap(password=props.file.view?.pdfPassword) {
    const attempt=++bootstrapRevision;
    needPassword.value = false;
    passwordError.value = "";
    try {
      const lease = await acquireCachedPdf(props.file.id, props.file.bytes, {
        cMapUrl: base + "cmaps/",
        cMapPacked: true,
        standardFontDataUrl: base + "standard_fonts/",
        wasmUrl: base + "wasm/",
        password,
      });
      if(scroll.value)scroll.value.dataset.pdfStage='document';
      if (disposed||attempt!==bootstrapRevision) { lease.release(); return; }
      releaseLease?.();
      releaseLease = lease.release;
      const doc = lease.doc;
      pdf = doc;
      pdfRef.value = doc;
      try {
        const perms = await doc.getPermissions();
        if (perms == null) allowPrint.value = true;
        else allowPrint.value = perms.has(4);
      } catch {
        allowPrint.value = true;
      }
      props.file.view ??= {zoom:props.zoom,scroll:[]};
      props.file.view.pdfPrintAllowed=allowPrint.value;
      if(password)props.file.view.pdfPassword=password;
      if(password)await window.localPreview.setPdfPassword(props.file.id,password);
      publishPermission?.(allowPrint.value,password);
      if (disposed) return;
      const first = await doc.getPage(1);
      if (disposed) return;
      const initial = first.getViewport({ scale: 1 });
      rememberPageSize(doc,1,{width:initial.width,height:initial.height});
      pages.value = Array.from({ length: doc.numPages }, (_,index) => cachedPageSize(doc,index+1) || ({
        width: initial.width,
        height: initial.height,
      }));
      rebuildPositions();
      lastGeometry=geometryKey();
      virtualStart.value = 0;
      virtualEnd.value = Math.min(doc.numPages, 3);
      await nextTick();
      updateVirtualWindow();
      await render(virtualStart.value);
      if(scroll.value)scroll.value.dataset.pdfStage='bootstrap-ready';
      if (disposed) return;
      observe();
      if (!resize && scroll.value) {
        resize = createSafeResizeObserver(scheduleRefresh);
        resize.observe(scroll.value);
      }
      const tab=scroll.value?.closest('.preview-tab');
      if(tab&&!visibility){visibility=new MutationObserver(()=>{prunePdfCanvases();if(getComputedStyle(tab).display!=='none'){scheduleRefresh();scheduleWarmup();}});visibility.observe(tab,{attributes:true,attributeFilter:['style','class']});}
      scheduleWarmup();
      emit("ready");
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      if (scanningSizes) return;
      scanningSizes = true;
      let sizes: Array<{ index: number; width: number; height: number }> = [];
      const remaining = new Set(Array.from({length: Math.max(0, doc.numPages - 1)}, (_, i) => i + 2).filter(n=>!cachedPageSize(doc,n)));
      let scanCursor = 2;
      while (remaining.size) {
        if (disposed) return;
        // Resolve sizes nearest the reading position first, yield to foreground work.
        const near = current.value;
        while (scanCursor <= doc.numPages && !remaining.has(scanCursor)) scanCursor++;
        const n = [near, near + 1, near - 1, near + 2].find(page => remaining.has(page)) ?? scanCursor;
        remaining.delete(n);
        const v = await pageSize(doc,n,3,lifetime.signal);
        if (disposed) return;
        sizes.push({ index: n - 1, width: v.width, height: v.height });
        if (sizes.length === 64 || !remaining.size || (n >= current.value && n <= current.value + 2)) {
          await updateSizes(sizes);
          sizes = [];
          await new Promise<void>((resolve) => setTimeout(resolve, 8));
        }
      }
      updateVirtualWindow();
      observe();
    } catch (e) {
      if (disposed||attempt!==bootstrapRevision) return;
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

  watch(current,async()=>{if(presentation.value){await nextTick();observe();}});
  watch(presentation,async()=>{await refresh();await nextTick();jump(current.value);});
  onMounted(() => void bootstrap());
  watch(
    () => props.zoom,
    scheduleRefresh,
  );
  watch(pdfResources,scheduleRefresh);
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
    lifetime.abort();generation.abort();warmupController.abort();cancelIdleCallback(idleWarmup);visibility?.disconnect();
    clearTimeout(refreshTimer);
    cancelAnimationFrame(scrollFrame);
    revision++;
    observer?.disconnect();
    resize?.disconnect();
    tasks.forEach(({task}) => task.cancel());
    for (const canvas of ownedCanvases) releaseCanvas(canvas);
    rendered.clear();
    releaseLease?.();
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
