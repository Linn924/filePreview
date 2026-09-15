<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed, watch } from "vue";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { PreviewFile } from "../../../../shared/contracts";
import {
  paperSize,
  selectedPages,
  applyPageOrder,
  type PdfPrintOptions,
} from "../../../../shared/printing";

const props = defineProps<{ file: PreviewFile; options: PdfPrintOptions }>();
const paper = computed(() => paperSize(props.options));
const pages = ref<
  Array<{ n: number; w: number; h: number; landscape: boolean }>
>([]);
const error = ref("");
const showAll = ref(false);
const MAX_SCAN = 40;
let disposed = false;
let loading: ReturnType<typeof getDocument> | undefined;

const activePages = computed(() => {
  try {
    const ranged = selectedPages(props.options.range || "", pages.value.length || 1);
    return applyPageOrder(ranged, props.options.pageOrder || "forward");
  } catch {
    return [];
  }
});
const summary = computed(() => {
  if (!pages.value.length)
    return [] as Array<{ n: number; w: number; h: number; landscape: boolean }>;
  return showAll.value ? pages.value : pages.value.slice(0, 8);
});
const moreCount = computed(() => Math.max(0, pages.value.length - 8));

async function load() {
  error.value = "";
  pages.value = [];
  try {
    GlobalWorkerOptions.workerSrc = workerUrl;
    void loading?.destroy();
    loading = getDocument({ data: props.file.bytes.slice() });
    const pdf = await loading.promise;
    if (disposed) return;
    const n = Math.min(pdf.numPages, MAX_SCAN);
    for (let i = 1; i <= n; i++) {
      if (disposed) return;
      const page = await pdf.getPage(i);
      const v = page.getViewport({ scale: 1 });
      pages.value.push({
        n: i,
        w: (v.width * 25.4) / 72,
        h: (v.height * 25.4) / 72,
        landscape: v.width > v.height,
      });
    }
  } catch {
    if (!disposed) error.value = "无法读取页面尺寸";
  }
}

onMounted(() => void load());
watch(
  () => [props.options.range, props.options.pageOrder],
  () => {
    /* recompute active list only */
  },
);
onBeforeUnmount(() => {
  disposed = true;
  void loading?.destroy();
});
</script>
<template>
  <div class="page-dims">
    <p class="paper-dimensions">
      <template v-if="pages.length">
        共 {{ pages.length }}<template v-if="pages.length >= 40">+</template>
        页 · 目标纸张 {{ options.paper }}：{{ paper.width }} ×
        {{ paper.height }} mm
      </template>
      <template v-else>{{ error || "读取页面尺寸…" }}</template>
      <small>混合尺寸按各页原尺寸等比打印；屏幕缩放≠纸张大小。</small>
    </p>
    <div v-if="summary.length" class="page-size-list">
      <div
        v-for="p in summary"
        :key="p.n"
        class="page-size-row"
        :class="{ active: activePages.includes(p.n) }"
      >
        <span class="page-n">p.{{ p.n }}</span>
        <span
          >{{ p.w.toFixed(0) }}×{{ p.h.toFixed(0) }} mm
          {{ p.landscape ? "横" : "纵" }}</span
        >
        <span class="page-fit-hint">{{
          p.landscape === options.landscape ? "方向一致" : "方向不同，将等比适配"
        }}</span>
      </div>
      <button
        v-if="moreCount > 0 && !showAll"
        type="button"
        class="page-size-more"
        @click="showAll = true"
      >
        还有 {{ moreCount }} 页…
      </button>
    </div>
  </div>
</template>
