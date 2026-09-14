<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { PreviewFile } from "../../../../shared/contracts";
import { paperSize, selectedPages, type PdfPrintOptions } from "../../../../shared/printing";

const props = defineProps<{ file: PreviewFile; options: PdfPrintOptions }>();
const canvas = ref<HTMLCanvasElement>();
const error = ref("");
let disposed = false;
let loading: ReturnType<typeof getDocument> | undefined;

const paper = computed(() => paperSize(props.options));
const label = computed(
  () =>
    `排版示意：原页适配到 ${props.options.paper}${props.options.landscape ? " 横向" : " 纵向"}，约 10mm 边距`,
);

async function draw() {
  if (!canvas.value) return;
  error.value = "";
  try {
    GlobalWorkerOptions.workerSrc = workerUrl;
    void loading?.destroy();
    loading = getDocument({ data: props.file.bytes.slice() });
    const pdf = await loading.promise;
    if (disposed) return;
    const pages = selectedPages(props.options.range || "", pdf.numPages);
    const pageNum = pages[0] || 1;
    const page = await pdf.getPage(pageNum);
    if (disposed) return;
    const original = page.getViewport({ scale: 1 });
    const paperPtW = (paper.value.width * 72) / 25.4;
    const paperPtH = (paper.value.height * 72) / 25.4;
    const fit = Math.min(
      (paperPtW - (20 * 72) / 25.4) / original.width,
      (paperPtH - (20 * 72) / 25.4) / original.height,
    );
    const displayScale = 0.35;
    const viewport = page.getViewport({
      scale: fit * displayScale * devicePixelRatio,
    });
    const c = canvas.value;
    c.width = Math.ceil(viewport.width);
    c.height = Math.ceil(viewport.height);
    await page.render({ canvas: c, viewport }).promise;
  } catch (e) {
    if (!disposed) error.value = e instanceof Error ? e.message : String(e);
  }
}

watch(
  () => [props.options.paper, props.options.landscape, props.options.range],
  () => void draw(),
);
onMounted(() => void draw());
onBeforeUnmount(() => {
  disposed = true;
  void loading?.destroy();
});
</script>
<template>
  <div class="paper-layout-preview" :title="label">
    <div
      class="paper-sheet"
      :style="{
        width: paper.width * 0.55 + 'px',
        height: paper.height * 0.55 + 'px',
      }"
    >
      <canvas ref="canvas"></canvas>
    </div>
    <small v-if="error" class="paper-layout-error">{{ error }}</small>
    <small v-else>{{ label }} · 实际出纸以打印驱动为准</small>
  </div>
</template>
