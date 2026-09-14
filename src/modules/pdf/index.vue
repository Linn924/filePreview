<script setup lang="ts">
import { computed, ref, watch } from "vue";
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
const { scroll, pages, current, sync, jump, dimensions, pdf } = usePreview(
  props,
  emit,
);
const search = usePdfSearch(pdf);
const searchOpen = ref(false);
const navOpen = ref(false);
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
    if (hit) jump(hit.page);
  },
);
async function runSearch() {
  await search.run();
  if (!search.hits.value.length) return;
  search.active.value = 0;
  jump(search.hits.value[0].page);
}
function buildTextLayer(pageEl: HTMLElement, index: number) {
  const doc = pdf.value;
  if (!doc) return;
  const layer = pageEl.querySelector(".pdf-text-layer") as HTMLElement | null;
  if (!layer || layer.dataset.built === "1") return;
  void (async () => {
    const page = await doc.getPage(index + 1);
    const viewport = page.getViewport({
      scale:
        (parseFloat(pageEl.style.width) || pageEl.clientWidth) /
        page.getViewport({ scale: 1 }).width,
    });
    const content = await page.getTextContent();
    layer.replaceChildren();
    for (const item of content.items) {
      if (!("str" in item) || !item.str) continue;
      const span = document.createElement("span");
      span.textContent = item.str;
      const tx = item.transform;
      const style = span.style;
      style.left = tx[4] + "px";
      style.top = tx[5] - (item.height || 12) + "px";
      style.fontSize = (item.height || Math.hypot(tx[1], tx[3]) || 12) + "px";
      style.height = (item.height || 12) + "px";
      layer.append(span);
    }
    layer.dataset.built = "1";
    void viewport;
  })();
}
watch(
  [scroll, pages, () => props.zoom, searchOpen],
  async () => {
    if (!searchOpen.value) return;
    const { nextTick } = await import("vue");
    await nextTick();
    for (const el of scroll.value?.querySelectorAll<HTMLElement>(".pdf-page") ||
      []) {
      const i = Number(el.dataset.page);
      if (Number.isFinite(i)) buildTextLayer(el, i);
    }
  },
  { deep: false },
);
</script>
<template>
  <section class="pdf-pane">
    <div class="pdf-toolbar-row">
      <PdfSearch
        v-model:open="searchOpen"
        v-model:query="search.query.value"
        :hits="search.hits.value"
        :active="search.active.value"
        :searching="search.searching.value"
        :error="search.error.value"
        @search="runSearch"
        @next="search.next()"
        @prev="search.prev()"
        @clear="search.clear()"
      />
      <button
        class="pdf-nav-toggle"
        :aria-pressed="navOpen"
        @click="navOpen = !navOpen"
      >
        {{ navOpen ? "隐藏导航" : "目录 / 缩略图" }}
      </button>
    </div>
    <div class="pdf-body">
      <PdfNav
        v-if="navOpen && pdf"
        :pdf="pdf"
        :current="current"
        @jump="jump"
      />
      <div ref="scroll" class="pdf-scroll" @scroll.passive="sync">
        <div
          v-for="(page, index) in pages"
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
