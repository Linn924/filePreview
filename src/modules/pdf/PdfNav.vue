<script setup lang="ts">
import {
  computed,
  nextTick,
  onMounted,
  onBeforeUnmount,
  ref,
  watch,
} from "vue";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";

const props = defineProps<{
  pdf: PDFDocumentProxy | undefined;
  current: number;
}>();
const emit = defineEmits<{ jump: [page: number] }>();
const tab = ref<"outline" | "thumbs">("outline");
interface OutlineItem {
  title: string;
  page: number;
  depth: number;
}
const outline = ref<OutlineItem[]>([]);
const thumbHost = ref<HTMLElement>();
const THUMB_CSS_W = 112;
const THUMB_GAP = 10; // matches .thumb margin-bottom
const EST_H = 148;
const pageCount = ref(0);
/** page index 0-based → css height (filled lazily) */
const heights = ref<number[]>([]);
const scrollTop = ref(0);
const clientH = ref(400);
const tasks = new Map<number, RenderTask>();
const paintedPages = new Set<number>();
let paintEpoch = 0;
let disposed = false;

async function loadOutline() {
  outline.value = [];
  if (!props.pdf) return;
  try {
    const items = await props.pdf.getOutline();
    if (!items?.length) return;
    const dests = (await props.pdf.getDestinations()) as
      | Map<string, unknown>
      | Record<string, unknown>;
    const destOf = (name: string) =>
      dests instanceof Map
        ? dests.get(name)
        : (dests as Record<string, unknown>)[name];
    const walk = async (list: typeof items, depth: number): Promise<void> => {
      for (const item of list) {
        let page = 0;
        try {
          const dest =
            typeof item.dest === "string" ? destOf(item.dest) : item.dest;
          if (Array.isArray(dest) && dest[0] != null) {
            const refObj = dest[0];
            page =
              typeof refObj === "number"
                ? refObj + 1
                : (await props.pdf!.getPageIndex(refObj as never)) + 1;
          }
        } catch {
          page = 0;
        }
        outline.value.push({ title: item.title || "未命名", page, depth });
        if (item.items?.length) await walk(item.items, depth + 1);
      }
    };
    await walk(items, 0);
  } catch {
    outline.value = [];
  }
}

function initThumbsMeta() {
  paintedPages.clear();
  if (!props.pdf) {
    pageCount.value = 0;
    heights.value = [];
    return;
  }
  pageCount.value = props.pdf.numPages;
  heights.value = Array.from({ length: props.pdf.numPages }, () => EST_H);
}

async function ensureSize(index: number) {
  if (!props.pdf) return;
  if (heights.value[index] !== EST_H) return;
  try {
    const page = await props.pdf.getPage(index + 1);
    const v = page.getViewport({ scale: 1 });
    const h = Math.round((v.height / (v.width || 1)) * THUMB_CSS_W) || EST_H;
    heights.value[index] = h;
  } catch {
    /* keep estimate */
  }
}

const offsets = computed(() => {
  const out = [0];
  for (let i = 0; i < heights.value.length; i++)
    out.push(out[i] + heights.value[i] + THUMB_GAP);
  return out;
});
function indexAt(y: number) {
  const o = offsets.value;
  let lo = 0,
    hi = Math.max(0, pageCount.value - 1);
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (o[mid + 1] <= y) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
const OVERSCAN = 3;
const virtualStart = ref(0);
const virtualEnd = ref(1);
const padTop = computed(() => offsets.value[virtualStart.value] || 0);
const padBottom = computed(() => {
  const o = offsets.value;
  const total = o[o.length - 1] || 0;
  return Math.max(0, total - (o[virtualEnd.value] ?? total));
});
const visibleThumbs = computed(() => {
  const list: number[] = [];
  for (let i = virtualStart.value; i < virtualEnd.value; i++) list.push(i);
  return list;
});

function updateVirtual() {
  const host = thumbHost.value;
  const n = pageCount.value;
  if (!host || !n) {
    virtualStart.value = 0;
    virtualEnd.value = Math.min(n, 1);
    return;
  }
  scrollTop.value = host.scrollTop;
  clientH.value = host.clientHeight || 400;
  virtualStart.value = Math.max(0, indexAt(scrollTop.value) - OVERSCAN);
  virtualEnd.value = Math.min(
    n,
    indexAt(scrollTop.value + clientH.value) + 1 + OVERSCAN,
  );
}

function canvasLooksBlank(canvas: HTMLCanvasElement) {
  return !canvas.width || !canvas.height;
}

async function paintOne(node: HTMLElement, pageNumber: number, epoch: number) {
  if (disposed || epoch !== paintEpoch || tab.value !== "thumbs" || !props.pdf)
    return;
  const canvas = node.querySelector("canvas");
  if (!canvas) return;
  if (paintedPages.has(pageNumber) && !canvasLooksBlank(canvas)) {
    node.classList.add("thumb-painted");
    return;
  }
  const prev = tasks.get(pageNumber);
  if (prev) {
    try {
      prev.cancel();
    } catch {
      /* ignore */
    }
    tasks.delete(pageNumber);
  }
  try {
    const pdfPage = await props.pdf.getPage(pageNumber + 1);
    if (disposed || epoch !== paintEpoch || tab.value !== "thumbs") return;
    const base = pdfPage.getViewport({ scale: 1 });
    const cssW = THUMB_CSS_W;
    const cssH =
      Math.round((base.height / (base.width || 1)) * cssW) ||
      canvas.clientHeight ||
      EST_H;
    heights.value[pageNumber] = cssH;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const viewport = pdfPage.getViewport({
      scale: (cssW / (base.width || 1)) * dpr,
    });
    canvas.width = Math.max(1, Math.round(viewport.width));
    canvas.height = Math.max(1, Math.round(viewport.height));
    canvas.style.width = cssW + "px";
    canvas.style.height = cssH + "px";
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const task = pdfPage.render({ canvasContext: ctx, viewport, canvas });
    tasks.set(pageNumber, task);
    await task.promise;
    if (disposed || epoch !== paintEpoch) return;
    paintedPages.add(pageNumber);
    node.classList.add("thumb-painted");
  } catch (e) {
    if ((e as { name?: string })?.name === "RenderingCancelledException")
      return;
    node.classList.remove("thumb-painted");
    paintedPages.delete(pageNumber);
  } finally {
    tasks.delete(pageNumber);
  }
}

function schedulePaint() {
  if (tab.value !== "thumbs" || !props.pdf || !thumbHost.value) return;
  updateVirtual();
  const epoch = ++paintEpoch;
  const host = thumbHost.value;
  const hostRect = host.getBoundingClientRect();
  const nodes = Array.from(host.querySelectorAll<HTMLElement>(".thumb"));
  for (const node of nodes) {
    const page = Number(node.dataset.page) - 1;
    if (!Number.isFinite(page) || page < 0) continue;
    const canvas = node.querySelector("canvas");
    if (!canvas) continue;
    if (paintedPages.has(page) && !canvasLooksBlank(canvas)) {
      node.classList.add("thumb-painted");
      continue;
    }
    const rect = node.getBoundingClientRect();
    const hidden = hostRect.width === 0 && hostRect.height === 0;
    if (!hidden) {
      if (rect.bottom < hostRect.top - 400 || rect.top > hostRect.bottom + 400)
        continue;
    }
    void paintOne(node, page, epoch);
  }
  // Resolve placeholder heights near the window so scroll length stays stable.
  for (let i = virtualStart.value; i < virtualEnd.value; i++)
    void ensureSize(i);
}

async function showThumbsAndPaint() {
  await nextTick();
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => resolve()),
  );
  if (tab.value !== "thumbs") return;
  for (const i of visibleThumbs.value) {
    const node = thumbHost.value?.querySelector<HTMLElement>(
      `.thumb[data-page="${i + 1}"]`,
    );
    const canvas = node?.querySelector("canvas");
    if (canvas && canvasLooksBlank(canvas)) paintedPages.delete(i);
  }
  schedulePaint();
}

watch(tab, async (value) => {
  if (value !== "thumbs") {
    paintEpoch++;
    for (const [, task] of tasks) {
      try {
        task.cancel();
      } catch {
        /* ignore */
      }
    }
    tasks.clear();
    return;
  }
  updateVirtual();
  await showThumbsAndPaint();
});
watch(visibleThumbs, () => {
  if (tab.value !== "thumbs") return;
  void nextTick().then(() => schedulePaint());
});
onMounted(async () => {
  await loadOutline();
  initThumbsMeta();
});
onBeforeUnmount(() => {
  disposed = true;
  paintEpoch++;
  for (const [, task] of tasks) {
    try {
      task.cancel();
    } catch {
      /* ignore */
    }
  }
  tasks.clear();
});
const hasOutline = computed(() => outline.value.length > 0);
</script>
<template>
  <aside class="pdf-nav" aria-label="PDF 导航">
    <div class="pdf-nav-tabs" role="tablist">
      <button
        type="button"
        role="tab"
        class="pdf-nav-tab"
        :class="{ active: tab === 'outline' }"
        :aria-selected="tab === 'outline'"
        @click="tab = 'outline'"
      >
        目录</button
      ><button
        type="button"
        role="tab"
        class="pdf-nav-tab"
        :class="{ active: tab === 'thumbs' }"
        :aria-selected="tab === 'thumbs'"
        @click="tab = 'thumbs'"
      >
        缩略图
      </button>
    </div>
    <div
      v-show="tab === 'outline'"
      class="pdf-outline"
      role="tabpanel"
      aria-label="目录"
    >
      <p v-if="!hasOutline" class="pdf-nav-empty">本文档没有目录/书签</p>
      <button
        v-for="(item, i) in outline"
        :key="i"
        type="button"
        class="outline-item"
        :style="{ paddingLeft: 8 + item.depth * 12 + 'px' }"
        :disabled="!item.page"
        :class="{ current: item.page === current }"
        @click="item.page && emit('jump', item.page)"
      >
        {{ item.title }}
        <small v-if="item.page">p.{{ item.page }}</small>
      </button>
    </div>
    <div
      v-show="tab === 'thumbs'"
      ref="thumbHost"
      class="pdf-thumbs"
      role="tabpanel"
      aria-label="缩略图"
      @scroll.passive="schedulePaint()"
    >
      <p class="thumb-meta">共 {{ pageCount }} 页</p>
      <div v-if="padTop > 0" class="thumb-pad" :style="{ height: padTop + 'px' }"></div>
      <div
        v-for="i in visibleThumbs"
        :key="i"
        class="thumb"
        :data-page="i + 1"
        :class="{ current: i + 1 === current }"
        role="button"
        tabindex="0"
        :aria-label="'第 ' + (i + 1) + ' 页缩略图'"
        :style="{ height: heights[i] + 24 + 'px' }"
        @click="emit('jump', i + 1)"
        @keydown.enter="emit('jump', i + 1)"
      >
        <canvas
          :style="{ width: THUMB_CSS_W + 'px', height: heights[i] + 'px' }"
        ></canvas>
        <span>{{ i + 1 }}</span>
      </div>
      <div
        v-if="padBottom > 0"
        class="thumb-pad"
        :style="{ height: padBottom + 'px' }"
      ></div>
    </div>
  </aside>
</template>
