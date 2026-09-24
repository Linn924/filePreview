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

interface OutlineNode {
  title: string;
  page: number;
  depth: number;
  key: string;
  parentKey: string | null;
  hasChildren: boolean;
}
const outline = ref<OutlineNode[]>([]);
const collapsed = ref(new Set<string>());
const outlineHost=ref<HTMLElement>();
const thumbHost = ref<HTMLElement>();
const navWidth=ref(168);
const thumbCssW=computed(()=>navWidth.value-56);
const THUMB_GAP = 10;
const estimateHeight=computed(()=>Math.round(thumbCssW.value*1.32));
const pageCount = ref(0);
const heights = ref<number[]>([]);
const scrollTop = ref(0);
const clientH = ref(400);
const tasks = new Map<number, RenderTask>();
/** Single-flight: one paint job per page index; results always persist. */
const paintJobs = new Map<number, Promise<void>>();
const paintedPages = new Map<number, HTMLCanvasElement>();
let disposed = false;
let thumbGeneration=0;

async function loadOutline() {
  outline.value = [];
  collapsed.value = new Set();
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
    const walk = async (
      list: typeof items,
      depth: number,
      parentKey: string | null,
      path: string,
    ): Promise<void> => {
      for (let i = 0; i < list.length; i++) {
        const item = list[i];
        const key = `${path}.${i}`;
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
        const hasChildren = !!(item.items && item.items.length);
        outline.value.push({
          title: item.title || "未命名",
          page,
          depth,
          key,
          parentKey,
          hasChildren,
        });
        if (hasChildren && depth >= 2) collapsed.value.add(key);
        if (item.items?.length) await walk(item.items, depth + 1, key, key);
      }
    };
    await walk(items, 0, null, "r");
  } catch {
    outline.value = [];
  }
}

function toggleOutline(key: string) {
  const next = new Set(collapsed.value);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  collapsed.value = next;
}

function outlineHidden(item: OutlineNode) {
  let p = item.parentKey;
  while (p) {
    if (collapsed.value.has(p)) return true;
    p = outline.value.find((n) => n.key === p)?.parentKey ?? null;
  }
  return false;
}

const visibleOutline = computed(() =>
  outline.value.filter((item) => !outlineHidden(item)),
);

const currentOutlineKey = computed(() => {
  let hit: string | null = null;
  for (const item of outline.value) {
    if (item.page && item.page <= props.current) hit = item.key;
  }
  return hit;
});
watch(currentOutlineKey,async key=>{
 if(!key)return;
 const byKey=new Map(outline.value.map(item=>[item.key,item]));
 const next=new Set(collapsed.value);
 let parent=byKey.get(key)?.parentKey;
 while(parent){next.delete(parent);parent=byKey.get(parent)?.parentKey??null;}
 if(next.size!==collapsed.value.size)collapsed.value=next;
 await nextTick();
 const item=Array.from(outlineHost.value?.querySelectorAll<HTMLElement>('.outline-row')||[])
  .find(row=>row.dataset.outlineKey===key);
 if(item&&outlineHost.value){
  const view=outlineHost.value.getBoundingClientRect(),rect=item.getBoundingClientRect();
  if(rect.top<view.top||rect.bottom>view.bottom)item.scrollIntoView({block:'nearest'});
 }
});

function resetThumbs(){
 thumbGeneration++;
 for(const task of tasks.values())task.cancel();
 paintedPages.clear();
 heights.value=Array.from({length:pageCount.value},()=>estimateHeight.value);
 thumbHost.value?.querySelectorAll<HTMLElement>('.thumb').forEach(node=>{
  node.classList.remove('thumb-painted');
  const canvas=node.querySelector('canvas');if(canvas){canvas.width=0;canvas.height=0;}
 });
 const active=[...paintJobs.values()];
 void Promise.allSettled(active).then(()=>nextTick()).then(()=>{if(!disposed){updateVirtual();schedulePaint();}});
}
function setNavWidth(value:number){
 const next=Math.max(168,Math.min(320,Math.round(value)));
 if(next===navWidth.value)return;
 navWidth.value=next;
 resetThumbs();
}
function beginResize(event:PointerEvent){
 if(event.button!==0)return;
 event.preventDefault();
 const handle=event.currentTarget as HTMLElement;
 const startX=event.clientX,startWidth=navWidth.value;
 handle.setPointerCapture(event.pointerId);
 const move=(e:PointerEvent)=>{navWidth.value=Math.max(168,Math.min(320,startWidth+e.clientX-startX));};
 const end=()=>{handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',end);handle.removeEventListener('pointercancel',end);resetThumbs();};
 handle.addEventListener('pointermove',move);
 handle.addEventListener('pointerup',end);
 handle.addEventListener('pointercancel',end);
}

function initThumbsMeta() {
  paintedPages.clear();
  if (!props.pdf) {
    pageCount.value = 0;
    heights.value = [];
    return;
  }
  pageCount.value = props.pdf.numPages;
  heights.value = Array.from({ length: props.pdf.numPages }, () => estimateHeight.value);
}

async function ensureSize(index: number) {
  if (!props.pdf) return;
  if (heights.value[index] !== estimateHeight.value) return;
  try {
    const page = await props.pdf.getPage(index + 1);
    const v = page.getViewport({ scale: 1 });
    const h = Math.round((v.height / (v.width || 1)) * thumbCssW.value) || estimateHeight.value;
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

async function paintOne(node: HTMLElement, pageNumber: number) {
  if (disposed || !props.pdf) return;
  const canvas = node.querySelector("canvas");
  if (!canvas) return;
  if (paintedPages.get(pageNumber) === canvas && !canvasLooksBlank(canvas)) {
    node.classList.add("thumb-painted");
    return;
  }
  const running = paintJobs.get(pageNumber);
  if (running) return running;
  const generation=thumbGeneration;
  let task:RenderTask|undefined;
  const job = (async () => {
    try {
      const pdfPage = await props.pdf!.getPage(pageNumber + 1);
      if (disposed || generation!==thumbGeneration) return;
      const base = pdfPage.getViewport({ scale: 1 });
      const cssW = thumbCssW.value;
      const cssH =
        Math.round((base.height / (base.width || 1)) * cssW) ||
        canvas.clientHeight ||
        estimateHeight.value;
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
      task = pdfPage.render({ canvasContext: ctx, viewport, canvas });
      tasks.set(pageNumber, task);
      await task.promise;
      if(disposed || generation!==thumbGeneration)return;
      // Keep pixels even if user switched to 目录 mid-render.
      if(!node.isConnected)return;
      paintedPages.set(pageNumber,canvas);
      node.classList.add("thumb-painted");
    } catch (e) {
      if ((e as { name?: string })?.name === "RenderingCancelledException")
        return;
      node.classList.remove("thumb-painted");
      paintedPages.delete(pageNumber);
    } finally {
      if(task && tasks.get(pageNumber)===task)tasks.delete(pageNumber);
      paintJobs.delete(pageNumber);
      if(!disposed && tab.value==='thumbs'){
        const current=thumbHost.value?.querySelector<HTMLElement>(`.thumb[data-page="${pageNumber+1}"]`);
        if(current && current!==node && current.querySelector('canvas')!==paintedPages.get(pageNumber))
          requestAnimationFrame(()=>{if(!disposed) schedulePaint();});
      }
    }
  })();
  paintJobs.set(pageNumber, job);
  return job;
}

function schedulePaint() {
  if (tab.value !== "thumbs" || !props.pdf || !thumbHost.value) return;
  updateVirtual();
  const host = thumbHost.value;
  const hostRect = host.getBoundingClientRect();
  const nodes = Array.from(host.querySelectorAll<HTMLElement>(".thumb"));
  for (const node of nodes) {
    const page = Number(node.dataset.page) - 1;
    if (!Number.isFinite(page) || page < 0) continue;
    const canvas = node.querySelector("canvas");
    if (!canvas) continue;
    if (paintedPages.get(page) === canvas && !canvasLooksBlank(canvas)) {
      node.classList.add("thumb-painted");
      continue;
    }
    const rect = node.getBoundingClientRect();
    const hidden = hostRect.width === 0 && hostRect.height === 0;
    if (!hidden) {
      if (rect.bottom < hostRect.top - 400 || rect.top > hostRect.bottom + 400)
        continue;
    }
    void paintOne(node, page);
  }
  for (let i = virtualStart.value; i < virtualEnd.value; i++)
    void ensureSize(i);
}

watch(
  () => props.current,
  () => {
    if (tab.value !== "thumbs" || !thumbHost.value) return;
    const idx = props.current - 1;
    if (idx < 0) return;
    const top = offsets.value[idx] || 0;
    const h = heights.value[idx] || estimateHeight.value;
    const host = thumbHost.value;
    const viewTop = host.scrollTop;
    const viewBottom = viewTop + host.clientHeight;
    if (top < viewTop + 8 || top + h > viewBottom - 8) {
      host.scrollTop = Math.max(0, top - host.clientHeight / 3);
      schedulePaint();
    }
  },
);

async function showThumbsAndPaint() {
  await nextTick();
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => resolve()),
  );
  if (tab.value !== "thumbs") return;
  schedulePaint();
  if (thumbHost.value) {
    const top = offsets.value[props.current - 1] || 0;
    thumbHost.value.scrollTop = Math.max(
      0,
      top - thumbHost.value.clientHeight / 3,
    );
    schedulePaint();
  }
}

watch(tab, async (value) => {
  // Do not cancel in-flight paints when switching to 目录.
  if (value !== "thumbs") return;
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
  for (const [, task] of tasks) {
    try {
      task.cancel();
    } catch {
      /* ignore */
    }
  }
  tasks.clear();
  paintJobs.clear();
});
const hasOutline = computed(() => outline.value.length > 0);
</script>
<template>
  <aside class="pdf-nav" aria-label="PDF 导航" :style="{width:navWidth+'px'}">
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
      ref="outlineHost"
      class="pdf-outline"
      role="tabpanel"
      aria-label="目录"
    >
      <p v-if="!hasOutline" class="pdf-nav-empty">本文档没有目录/书签</p>
      <template v-else>
        <div
          v-for="item in visibleOutline"
          :key="item.key"
          class="outline-row"
          :data-outline-key="item.key"
          :style="{ paddingLeft: 6 + item.depth * 12 + 'px' }"
        >
          <button
            v-if="item.hasChildren"
            type="button"
            class="outline-toggle icon-only-btn"
            :title="collapsed.has(item.key) ? '展开' : '折叠'"
            :aria-label="collapsed.has(item.key) ? '展开' : '折叠'"
            @click="toggleOutline(item.key)"
          >
            <svg class="btn-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
              <path
                :d="
                  collapsed.has(item.key) ? 'M5 3l5 5-5 5' : 'M3 5l5 5 5-5'
                "
              />
            </svg>
          </button>
          <span v-else class="outline-toggle-spacer" aria-hidden="true"></span>
          <button
            type="button"
            class="outline-item"
            :disabled="!item.page"
            :class="{ current: item.key === currentOutlineKey }"
            @click="item.page && emit('jump', item.page)"
          >
            {{ item.title }}
            <small v-if="item.page">p.{{ item.page }}</small>
          </button>
        </div>
      </template>
    </div>
    <div
      v-show="tab === 'thumbs'"
      class="thumb-pane"
    >
      <label class="thumb-size-control">缩略图尺寸
        <select class="thumb-size-select" :value="navWidth" aria-label="缩略图尺寸" @change="setNavWidth(Number(($event.target as HTMLSelectElement).value))">
          <option :value="168">小</option><option :value="216">中</option><option :value="272">大</option>
        </select>
      </label>
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
      <div
        v-if="padTop > 0"
        class="thumb-pad"
        :style="{ height: padTop + 'px' }"
      ></div>
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
          :style="{ width: thumbCssW + 'px', height: heights[i] + 'px' }"
        ></canvas>
        <span>{{ i + 1 }}</span>
      </div>
      <div
        v-if="padBottom > 0"
        class="thumb-pad"
        :style="{ height: padBottom + 'px' }"
      ></div>
    </div>
    <span class="pdf-nav-resizer" role="separator" tabindex="0" aria-label="拖动调整导航栏宽度" aria-orientation="vertical" @pointerdown="beginResize" @keydown.left.prevent="setNavWidth(navWidth-16)" @keydown.right.prevent="setNavWidth(navWidth+16)"></span>
  </aside>
</template>
