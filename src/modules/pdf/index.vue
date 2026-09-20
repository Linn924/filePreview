<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import type { PreviewProps } from "../types";
import { usePreview } from "./usePreview";
import { usePdfSearch } from "./useSearch";
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
  setRotate,
} = usePreview(props, emit);
const search = usePdfSearch(pdf);
const searchOpen = ref(false);
const navOpen = ref(false);
const passwordInput = ref("");
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
  if (!search.hits.value.length) return;
  search.active.value = 0;
  jump(search.hits.value[0].page);
  highlightActiveHit();
}
function highlightActiveHit() {
  const hit = activeHit.value;
  if (!hit) return;
  void nextTick().then(() => {
    // 先清除上一个活跃高亮
    scroll.value
      ?.querySelectorAll(".pdf-page.is-active-hit")
      .forEach((el) => el.classList.remove("is-active-hit"));
    const pageEl = scroll.value?.querySelector<HTMLElement>(
      `.pdf-page[data-page="${hit.page - 1}"]`,
    );
    if (!pageEl) return;
    pageEl.classList.add("is-active-hit");

    // 尝试在文本层中找到命中 span 并精确定位
    const layer = pageEl.querySelector<HTMLElement>(".pdf-text-layer");
    if (layer?.dataset.built === "1") {
      const needle = search.query.value.trim().toLowerCase();
      const spans = Array.from(layer.querySelectorAll<HTMLElement>("span"));
      const hitSpan = spans.find((s) =>
        s.textContent?.toLowerCase().includes(needle),
      );
      if (hitSpan) {
        hitSpan.scrollIntoView({ block: "center", behavior: "smooth" });
        return;
      }
    }
    // fallback：滚动到页面顶部
    pageEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
  });
}
function buildTextLayer(pageEl: HTMLElement, index: number) {
  const doc = pdf.value;
  if (!doc) return;
  const layer = pageEl.querySelector(".pdf-text-layer") as HTMLElement | null;
  if (!layer || layer.dataset.built === "1") return;
  void (async () => {
    try {
      const page = await doc.getPage(index + 1);
      const content = await page.getTextContent();
      const cssW = pageEl.clientWidth || parseFloat(pageEl.style.width) || 1;
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: cssW / (base.width || 1) });
      layer.replaceChildren();
      const items = content.items as Array<{
        str?: string;
        transform: number[];
        width?: number;
        height?: number;
      }>;
      for (const item of items) {
        if (!item.str) continue;
        // Map PDF text matrix into the page viewport (css pixels).
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
    } catch {
      layer.dataset.built = "";
    }
  })();
}
watch(searchOpen, async (open) => {
  if (!open) return;
  await nextTick();
  for (const el of scroll.value?.querySelectorAll<HTMLElement>(".pdf-page") ||
    []) {
    const i = Number(el.dataset.page);
    if (Number.isFinite(i)) buildTextLayer(el, i);
  }
});
watch([visiblePages, searchOpen], async () => {
  if (!searchOpen.value) return;
  await nextTick();
  for (const el of scroll.value?.querySelectorAll<HTMLElement>(".pdf-page") ||
    []) {
    const i = Number(el.dataset.page);
    if (Number.isFinite(i)) buildTextLayer(el, i);
  }
});
watch(
  () => props.zoom,
  () => {
    if (!searchOpen.value) return;
    for (const el of scroll.value?.querySelectorAll<HTMLElement>(".pdf-page") ||
      []) {
      const layer = el.querySelector(".pdf-text-layer") as HTMLElement | null;
      if (layer) layer.dataset.built = "";
    }
    void nextTick().then(() => {
      for (const el of scroll.value?.querySelectorAll<HTMLElement>(
        ".pdf-page",
      ) || []) {
        const i = Number(el.dataset.page);
        if (Number.isFinite(i)) buildTextLayer(el, i);
      }
    });
  },
);
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
      <div ref="scroll" class="pdf-scroll" @scroll.passive="sync">
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
          <div
            class="pdf-text-layer"
            :class="{ enabled: searchOpen }"
            aria-hidden="true"
          ></div>
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
  </section>
</template>
