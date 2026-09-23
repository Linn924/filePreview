<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, provide, ref, watch } from "vue";
import type { PreviewProps } from "../types";
import { usePreview } from "./usePreview";
import { usePdfSearch, type SearchHit } from "./useSearch";
import PageNavigation from "../../components/PageNavigation.vue";
import PdfSearch from "./PdfSearch.vue";
import PdfNav from "./PdfNav.vue";
const props = defineProps<PreviewProps>();
const emit = defineEmits<{
  ready: [];
  error: [message: string];
  "update:zoom": [value: number];
}>();
const {
  scroll,
  pages,
  current,
  sync,
  jump,
  dimensions,
  visiblePages,
  padTop,
  padBottom,
  pdf,
  needPassword,
  passwordError,
  unlock,
  rotate,
  layout,
  setRotate,
  allowPrint,
} = usePreview(props, emit);
const search = usePdfSearch(pdf);
provide("pdfAllowPrint", allowPrint);
const searchOpen = ref(false);
const navOpen = ref(false);
const passwordInput = ref("");
let textGeometryRevision = 0;
function cycleRotate() {
  const next = (((rotate.value + 90) % 360) as 0 | 90 | 180 | 270);
  setRotate(next);
}
async function submitPassword() {
  await unlock(passwordInput.value);
  passwordInput.value = "";
}
const highlightPages = computed(() => {
  const set = new Set<number>();
  for (const h of search.hits.value) set.add(h.page - 1);
  return set;
});
const activeHit = computed(() => search.hits.value[search.active.value]);
watch(
  () => search.active.value,
  () => {
    const hit = activeHit.value;
    if (hit) {
      jump(hit.page);
      highlightActiveHit();
    }
  },
);
async function runSearch() {
  await search.run();
}

function markHitsInLayer(layer: HTMLElement, hit: SearchHit | undefined) {
  if (!hit) return;
  const spans = Array.from(layer.querySelectorAll<HTMLElement>("span"));
  // Map page-text char offsets approximately onto sequential spans.
  let cursor = 0;
  let activeSet = false;
  for (const span of spans) {
    const text = span.textContent || "";
    const start = cursor;
    const end = cursor + text.length;
    cursor = end + 1; // pageText joins with single spaces
    const s = hit.charOffset;
    const e = hit.charOffset + hit.length;
    if (e <= start || s >= end) continue;
    const localStart = Math.max(0, s - start);
    const localEnd = Math.min(text.length, e - start);
    if (localEnd <= localStart) continue;
    const before = text.slice(0, localStart);
    const mid = text.slice(localStart, localEnd);
    const after = text.slice(localEnd);
    span.replaceChildren();
    if (before) span.append(document.createTextNode(before));
    const mark = document.createElement("mark");
    mark.className = "pdf-hit";
    if (!activeSet) {
      mark.classList.add("is-active");
      activeSet = true;
    }
    mark.textContent = mid;
    span.append(mark);
    if (after) span.append(document.createTextNode(after));
  }
}

function highlightActiveHit() {
  const hit = activeHit.value;
  if (!hit) return;
  void nextTick().then(() => {
    scroll.value
      ?.querySelectorAll(".pdf-page.is-active-hit")
      .forEach((el) => el.classList.remove("is-active-hit"));
    scroll.value
      ?.querySelectorAll(".pdf-hit.is-active")
      .forEach((el) => el.classList.remove("is-active"));
    const pageEl = scroll.value?.querySelector<HTMLElement>(
      `.pdf-page[data-page="${hit.page - 1}"]`,
    );
    if (!pageEl) return;
    pageEl.classList.add("is-active-hit");
    const layer = pageEl.querySelector<HTMLElement>(".pdf-text-layer");
    if (layer?.dataset.built === "1") {
      markHitsInLayer(layer, hit);
      const mark =
        layer.querySelector<HTMLElement>(".pdf-hit.is-active") ||
        layer.querySelector<HTMLElement>(".pdf-hit");
      if (mark) {
        mark.scrollIntoView({ block: "center", behavior: "smooth" });
        return;
      }
    }
    pageEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
  });
}

function resolveDestPage(dest: unknown): number | null {
  const doc = pdf.value;
  if (!doc) return null;
  try {
    const refObj = Array.isArray(dest) ? dest[0] : dest;
    if (typeof refObj === "number") return refObj + 1;
    if (refObj != null) {
      // sync path via getPageIndex is async; handled by caller
    }
  } catch {
    /* ignore */
  }
  return null;
}

async function buildTextLayer(pageEl: HTMLElement, index: number) {
  const doc = pdf.value;
  if (!doc) return;
  const layer = pageEl.querySelector(".pdf-text-layer") as HTMLElement | null;
  if (!layer) return;
  const revision = String(textGeometryRevision);
  if (layer.dataset.geometry === revision &&
      (layer.dataset.built === "1" || layer.dataset.loading === revision)) return;
  layer.dataset.loading = revision;
  let annotHost = pageEl.querySelector<HTMLElement>(".pdf-annot-layer");
  if (!annotHost) {
    annotHost = document.createElement("div");
    annotHost.className = "pdf-annot-layer";
    annotHost.setAttribute("aria-hidden", "false");
    pageEl.append(annotHost);
  }
  annotHost.replaceChildren();
  try {
    const page = await doc.getPage(index + 1);
    if (!layer.isConnected || layer.dataset.loading !== revision) return;
    const content = await page.getTextContent();
    if (!layer.isConnected || layer.dataset.loading !== revision) return;
    const cssW = pageEl.clientWidth || parseFloat(pageEl.style.width) || 1;
    const rotation = (page.rotate + rotate.value) % 360;
    const base = page.getViewport({ scale: 1, rotation });
    const viewport = page.getViewport({ scale: cssW / (base.width || 1), rotation });
    layer.replaceChildren();
    const items = content.items as Array<{
      str?: string;
      transform: number[];
      width?: number;
      height?: number;
    }>;
    for (const item of items) {
      if (!item.str) continue;
      const tx = item.transform;
      const [x, y] = viewport.convertToViewportPoint(tx[4], tx[5]);
      const fontH = Math.hypot(tx[2], tx[3]) * viewport.scale || 12;
      const span = document.createElement("span");
      span.textContent = item.str;
      const style = span.style;
      style.left = x + "px";
      style.top = y - fontH + "px";
      style.fontSize = fontH + "px";
      if (item.width) style.width = item.width * viewport.scale + "px";
      layer.append(span);
    }
    layer.dataset.built = "1";
    layer.dataset.geometry = revision;
    delete layer.dataset.loading;

    // Item 2: link annotations (GoTo / URI)
    try {
      const annotations = await page.getAnnotations();
      if (!layer.isConnected || layer.dataset.geometry !== revision) return;
      for (const ann of annotations) {
        if (!ann || !ann.rect) continue;
        const kind = (ann as { subtype?: string }).subtype || "";
        const url = (ann as { url?: string }).url;
        const dest = (ann as { dest?: unknown }).dest;
        const isLink =
          kind === "Link" || ann.subtype === undefined || url || dest;
        if (!isLink && !url && dest == null) continue;
        const rect = ann.rect as number[];
        const [x1, y1] = viewport.convertToViewportPoint(rect[0], rect[1]);
        const [x2, y2] = viewport.convertToViewportPoint(rect[2], rect[3]);
        const left = Math.min(x1, x2);
        const top = Math.min(y1, y2);
        const width = Math.abs(x2 - x1);
        const height = Math.abs(y2 - y1);
        if (width < 2 || height < 2) continue;
        const a = document.createElement("a");
        a.style.left = left + "px";
        a.style.top = top + "px";
        a.style.width = width + "px";
        a.style.height = height + "px";
        if (url && /^https?:\/\//i.test(url)) {
          a.href = url;
          a.title = url;
          a.addEventListener("click", (e) => {
            e.preventDefault();
            void window.localPreview.openExternal(url).catch(() => {});
          });
        } else if (dest != null) {
          a.href = "#";
          a.title = "跳到文档内目标";
          a.addEventListener("click", (e) => {
            e.preventDefault();
            void (async () => {
              let target: number | null = resolveDestPage(dest);
              if (target == null) {
                const refObj = Array.isArray(dest) ? dest[0] : dest;
                if (refObj != null && typeof refObj !== "number") {
                  target =
                    (await doc.getPageIndex(refObj as never)) + 1;
                }
              }
              if (target) jump(target);
            })();
          });
        } else {
          continue;
        }
        annotHost!.append(a);
      }
    } catch {
      /* annotations optional */
    }
  } catch {
    if(layer.dataset.loading === revision) {
      layer.dataset.built = "";
      delete layer.dataset.loading;
    }
  }
}

// Always build text layers when visible pages change or PDF loads (item 1)
async function syncVisibleText(revision: number) {
  await nextTick();
  if (revision !== textGeometryRevision) return;
  await Promise.all(Array.from(scroll.value?.querySelectorAll<HTMLElement>(".pdf-page") || [])
    .map(el => buildTextLayer(el, Number(el.dataset.page))));
  if (revision === textGeometryRevision) highlightActiveHit();
}
watch([visiblePages, pdf], () => void syncVisibleText(textGeometryRevision));
watch([() => props.zoom, () => props.fitMode, rotate, layout], () => {
  const revision = ++textGeometryRevision;
  void syncVisibleText(revision);
});
// Keyboard: PageDown / PageUp to jump pages (item 9 — keep)
function onKeydown(event: KeyboardEvent) {
  if (event.key === "PageDown") {
    event.preventDefault();
    jump(current.value + 1);
  } else if (event.key === "PageUp") {
    event.preventDefault();
    jump(current.value - 1);
  }
}
function handleOpenSearch(e: Event) {
  if ((e as CustomEvent<string>).detail !== props.file.id) return;
  searchOpen.value = true;
}
onMounted(() => {
  window.addEventListener("pdf:open-search", handleOpenSearch);
});
onBeforeUnmount(() => {
  window.removeEventListener("pdf:open-search", handleOpenSearch);
});
</script>
<template>
  <section class="pdf-pane">
    <Teleport
      :to="`[data-file-id='${props.file.id}'] .module-tools`"
      defer
    >
      <span class="pdf-inline-tools" data-pdf-toolbar>
        <PdfSearch
          :target="`[data-file-id='${props.file.id}'] .search-tools`"
          v-model:open="searchOpen"
          :query="search.query.value"
          :hits="search.hits.value"
          :active="search.active.value"
          :searching="search.searching.value"
          :error="search.error.value"
          @update:query="(v) => (search.query.value = v)"
          @search="runSearch"
          @next="search.next()"
          @prev="search.prev()"
          @clear="search.clear()"
        />
        <button
          type="button"
          class="pdf-nav-toggle icon-only-btn"
          :aria-pressed="navOpen"
          :title="navOpen ? '隐藏导航' : '目录 / 缩略图'"
          aria-label="目录 / 缩略图"
          @click="navOpen = !navOpen"
        >
          <svg class="btn-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" aria-hidden="true">
            <rect x="2.5" y="3.5" width="4.5" height="9" rx="1" />
            <path d="M9 4.5h5M9 8h5M9 11.5h5" />
          </svg>
          <span class="sr-only">{{ navOpen ? "隐藏导航" : "目录 / 缩略图" }}</span>
        </button>
        <button
          type="button"
          class="pdf-rotate icon-only-btn"
          :title="'临时旋转（当前 ' + rotate + '°）'"
          aria-label="旋转预览"
          @click="cycleRotate"
        >
          <svg class="btn-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M13.2 8A5.2 5.2 0 1 1 11.4 4.2" />
            <path d="M13.2 2.6v3h-3" />
          </svg>
          <span class="sr-only">旋转 {{ rotate }}°</span>
        </button>
      </span>
    </Teleport>
    <form
      v-if="needPassword"
      class="pdf-password"
      @submit.prevent="submitPassword"
    >
      <strong>PDF 受密码保护</strong>
      <p v-if="passwordError" role="alert">{{ passwordError }}</p>
      <input
        v-model="passwordInput"
        type="password"
        aria-label="PDF 密码"
        placeholder="输入打开密码"
        autocomplete="off"
      />
      <button type="submit">解锁预览</button>
      <small>密码仅用于本次内存解密，不会写入设置或磁盘。</small>
    </form>
    <div v-else class="pdf-body">
      <PdfNav
        v-if="navOpen && pdf"
        :pdf="pdf"
        :current="current"
        @jump="jump"
      />
      <div
        ref="scroll"
        class="pdf-scroll"
        tabindex="0"
        @scroll.passive="sync"
        @keydown="onKeydown"
      >
        <div v-if="padTop > 0" class="pdf-virtual-pad" :style="{ height: padTop + 'px' }" aria-hidden="true"></div>
        <div
          v-for="index in visiblePages"
          :key="index"
          class="pdf-page preview-content"
          :class="{
            'has-hit': highlightPages.has(index),
            'is-active-hit': activeHit?.page === index + 1,
          }"
          :data-page="index"
          :style="dimensions(index)"
        >
          <canvas :aria-label="'PDF 第 ' + (index + 1) + ' 页'"></canvas>
          <div class="pdf-text-layer"></div>
        </div>
        <div v-if="padBottom > 0" class="pdf-virtual-pad" :style="{ height: padBottom + 'px' }" aria-hidden="true"></div>
      </div>
    </div>
    <PageNavigation
      :current="current"
      :total="pages.length"
      label="PDF"
      @jump="jump"
    />
    <p v-if="!allowPrint" class="pdf-perm-note" role="status">
      此文档不允许打印
    </p>
  </section>
</template>
