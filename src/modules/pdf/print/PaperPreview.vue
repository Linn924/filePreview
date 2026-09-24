<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch, toRaw } from "vue";
import { openCachedPdf } from "../docCache";
import type { PreviewFile } from "../../../../shared/contracts";
import {
  paperSize,
  selectedPages,
  applyPageOrder,
  printScaleFactor,
  type PdfPrintOptions,
} from "../../../../shared/printing";

const props = defineProps<{ file: PreviewFile; options: PdfPrintOptions }>();
/** Serialize paper sketch draws so expanding many rows stays responsive. */
let drawChain: Promise<void> = Promise.resolve();
const canvas = ref<HTMLCanvasElement>();
const error = ref("");
let disposed = false;
let loading: { destroy?: () => Promise<void> } | undefined;

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

function draw() {
  drawChain = drawChain.then(() => drawNow()).catch(() => {});
  return drawChain;
}
async function drawNow() {
  if (!canvas.value) return;
  error.value = "";
  try {
    const source = await window.localPreview.loadPreview(toRaw(props.file));
    if (disposed || source.error) return;
    const pdf = await openCachedPdf(props.file.id + ":print", source.bytes.slice());
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
