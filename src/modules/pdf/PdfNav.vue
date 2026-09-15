<script setup lang="ts">
import { computed, nextTick, onMounted, onBeforeUnmount, ref, watch } from "vue";
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
const thumbs = ref<Array<{ page: number; width: number; height: number }>>([]);
const thumbHost = ref<HTMLElement>();
const THUMB_CSS_W = 112;
/** page number -> in-flight or finished render task (cancel before re-paint) */
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

async function loadThumbs() {
  thumbs.value = [];
  paintedPages.clear();
  if (!props.pdf) return;
  const max = Math.min(props.pdf.numPages, 200);
  const sizes: Array<{ page: number; width: number; height: number }> = [];
  for (let n = 1; n <= max; n++) {
    const page = await props.pdf.getPage(n);
    // Do NOT page.cleanup() — document is shared with the main preview.
    const v = page.getViewport({ scale: 1, rotation: page.rotate });
    const h = Math.round((v.height / (v.width || 1)) * THUMB_CSS_W) || 140;
    sizes.push({ page: n, width: THUMB_CSS_W, height: h });
  }
  thumbs.value = sizes;
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
    const pdfPage = await props.pdf.getPage(pageNumber);
    if (disposed || epoch !== paintEpoch || tab.value !== "thumbs") return;
    const base = pdfPage.getViewport({ scale: 1 });
    const cssW = THUMB_CSS_W;
    const cssH =
      Math.round((base.height / (base.width || 1)) * cssW) ||
      canvas.clientHeight ||
      140;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    // Same viewport rotation as main view so thumbnail matches the page.
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
    // Never cleanup() the shared page — it would detach main-view operator lists.
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
  const epoch = ++paintEpoch;
  const host = thumbHost.value;
  const hostRect = host.getBoundingClientRect();
  const nodes = Array.from(host.querySelectorAll<HTMLElement>(".thumb"));
  for (const node of nodes) {
    const page = Number(node.dataset.page);
    if (!page) continue;
    const canvas = node.querySelector("canvas");
    if (!canvas) continue;
    if (paintedPages.has(page) && !canvasLooksBlank(canvas)) {
      node.classList.add("thumb-painted");
      continue;
    }
    const rect = node.getBoundingClientRect();
    // When panel is display:none rects collapse — still repaint after re-show.
    const hidden = hostRect.width === 0 && hostRect.height === 0;
    if (!hidden) {
      if (rect.bottom < hostRect.top - 400 || rect.top > hostRect.bottom + 400)
        continue;
    }
    void paintOne(node, page, epoch);
  }
}

async function showThumbsAndPaint() {
  await nextTick();
  // Wait a frame so v-show layout is real before measuring.
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => resolve()),
  );
  if (tab.value !== "thumbs") return;
  // Force blank/partial canvases to repaint after 目录 ↔ 缩略图 switches.
  for (const t of thumbs.value) {
    const node = thumbHost.value?.querySelector<HTMLElement>(
      `.thumb[data-page="${t.page}"]`,
    );
    const canvas = node?.querySelector("canvas");
    if (canvas && canvasLooksBlank(canvas)) paintedPages.delete(t.page);
  }
  schedulePaint();
}

watch(tab, async (value) => {
  if (value !== "thumbs") {
    // Cancel in-flight thumb renders so they cannot fight a later paint.
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
  await showThumbsAndPaint();
});
watch(thumbs, async () => {
  if (tab.value !== "thumbs") return;
  await showThumbsAndPaint();
});
onMounted(async () => {
  await loadOutline();
  await loadThumbs();
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
      <div
        v-for="t in thumbs"
        :key="t.page"
        class="thumb"
        :data-page="t.page"
        :class="{ current: t.page === current }"
        role="button"
        tabindex="0"
        :aria-label="'第 ' + t.page + ' 页缩略图'"
        @click="emit('jump', t.page)"
        @keydown.enter="emit('jump', t.page)"
      >
        <canvas
          :style="{ width: t.width + 'px', height: t.height + 'px' }"
        ></canvas>
        <span>{{ t.page }}</span>
      </div>
    </div>
  </aside>
</template>
