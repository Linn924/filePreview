<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch, toRaw } from "vue";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { PreviewFile } from "../../../../shared/contracts";
import {
  paperSize,
  selectedPages,
  applyPageOrder,
  printScaleFactor,
  type PdfPrintOptions,
} from "../../../../shared/printing";

const props = defineProps<{ file: PreviewFile; options: PdfPrintOptions }>();
const canvas = ref<HTMLCanvasElement>();
const error = ref("");
let disposed = false;
let loading: ReturnType<typeof getDocument> | undefined;

const paper = computed(() => paperSize(props.options));
const scaleLabel = computed(
  () =>
    ({
      fit: "适合纸张",
      actual: "实际大小 100%",
      shrink: "仅缩小",
    })[props.options.scale || "fit"],
);
const label = computed(
  () =>
    `${props.options.paper}${props.options.landscape ? " 横" : " 纵"} · ${scaleLabel.value}`,
);

async function draw() {
  if (!canvas.value) return;
  error.value = "";
  try {
    GlobalWorkerOptions.workerSrc = workerUrl;
    void loading?.destroy();
    const source=await window.localPreview.loadPreview(toRaw(props.file));
    if(disposed||source.error)return;
    loading = getDocument({ data: source.bytes.slice() });
    const pdf = await loading.promise;
    if (disposed) return;
    const ranged = selectedPages(props.options.range || "", pdf.numPages);
    const pages = applyPageOrder(ranged, props.options.pageOrder || "forward");
    const pageNum = pages[0] || 1;
    const page = await pdf.getPage(pageNum);
    if (disposed) return;
    const original = page.getViewport({ scale: 1 });
    const fit = printScaleFactor(original, paper.value, props.options.scale || "fit");
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
  () => [
    props.options.paper,
    props.options.landscape,
    props.options.range,
    props.options.scale,
    props.options.pageOrder,
  ],
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
    <small v-else class="paper-caption">{{ label }}</small>
  </div>
</template>
