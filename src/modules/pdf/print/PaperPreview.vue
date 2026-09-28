<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch, toRaw } from "vue";
import { acquireCachedPdf } from "../docCache";
import type { RenderTask } from "pdfjs-dist";
import { pdfWork } from "../workQueue";
import type { PreviewFile } from "../../../../shared/contracts";
import {
  paperSize,
  selectedPages,
  applyPageOrder,
  printScaleFactor,
  type PdfPrintOptions,
} from "../../../../shared/printing";

const props = defineProps<{ file: PreviewFile; options: PdfPrintOptions }>();
/** Coalesce obsolete draws per row; shared queue limits expanded rows. */
let drawChain: Promise<void> = Promise.resolve();
const canvas = ref<HTMLCanvasElement>();
const error = ref("");
let disposed = false;
let releaseLease: (() => void) | undefined;
let task: RenderTask | undefined;
let revision = 0;
let leasePromise: ReturnType<typeof acquireCachedPdf> | undefined;

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
  const token = ++revision;
  task?.cancel();
  drawChain = drawChain.then(() => token === revision && !disposed ? drawNow(token) : undefined).catch(() => {});
  return drawChain;
}
async function drawNow(token: number) {
  if (!canvas.value) return;
  error.value = "";
  try {
    if (!leasePromise) leasePromise = (async () => {
      const source = await window.localPreview.loadPreview(toRaw(props.file));
      if (source.error) throw Error(source.error);
      return acquireCachedPdf(props.file.id, source.bytes);
    })().then(lease => {
      if (disposed) lease.release();
      else releaseLease = lease.release;
      return lease;
    }).catch(error => { leasePromise = undefined; throw error; });
    const { doc: pdf } = await leasePromise;
    if (disposed || token !== revision) return;
    const ranged = selectedPages(props.options.range || "", pdf.numPages);
    const pages = applyPageOrder(ranged, props.options.pageOrder || "forward");
    const pageNum = pages[0] || 1;
    const page = await pdf.getPage(pageNum);
    if (disposed || token !== revision) return;
    const original = page.getViewport({ scale: 1 });
    const fit = printScaleFactor(original, paper.value, props.options.scale || "fit");
    const displayScale = 0.35;
    const viewport = page.getViewport({
      scale: fit * displayScale * devicePixelRatio,
    });
    await pdfWork(4, async () => {
      if (disposed || token !== revision || !canvas.value) return;
      const c = canvas.value;
      c.width = Math.ceil(viewport.width);
      c.height = Math.ceil(viewport.height);
      task = page.render({ canvas: c, viewport });
      await task.promise;
    });
  } catch (e) {
    if (!disposed && token === revision && (e as {name?:string})?.name !== 'RenderingCancelledException')
      error.value = e instanceof Error ? e.message : String(e);
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
  revision++;
  task?.cancel();
  releaseLease?.();
  if (canvas.value) { canvas.value.width = 0; canvas.value.height = 0; }
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
