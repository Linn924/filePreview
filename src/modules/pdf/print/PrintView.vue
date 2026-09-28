<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from "vue";
import {
  getDocument,
  GlobalWorkerOptions,
  type RenderTask,
} from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import {
  paperSize,
  selectedPages,
  applyPageOrder,
} from "../../../../shared/printing";
import { pdfRasterPlan } from './rasterPlan';
const host = ref<HTMLElement>();
let disposed = false;
let task: RenderTask | undefined;
let loading: ReturnType<typeof getDocument> | undefined;
let jobToken: string | undefined;
const canvases = new Set<HTMLCanvasElement>();

function sheetStyle(paper: { width: number; height: number }) {
  return `@page{size:${paper.width}mm ${paper.height}mm;margin:0}html,body,#app{margin:0;padding:0;background:white;color:black;color-scheme:light}.print-sheet{box-sizing:border-box;width:${paper.width}mm;height:${paper.height}mm;padding:10mm;break-after:page;display:flex;align-items:center;justify-content:center;overflow:hidden}.print-sheet:last-child{break-after:auto}.print-sheet canvas,.print-sheet img,.print-sheet .word-host{max-width:100%;max-height:100%;object-fit:contain}`;
}

async function printImage(job: Awaited<ReturnType<typeof window.localPreview.consumePrint>>) {
  const paper = paperSize(job.options);
  const style = document.createElement("style");
  style.textContent = sheetStyle(paper);
  host.value!.append(style);
  const url = URL.createObjectURL(
    new Blob([job.file.bytes.slice().buffer], {
      type:
        {
          png: "image/png",
          jpg: "image/jpeg",
          jpeg: "image/jpeg",
          webp: "image/webp",
          gif: "image/gif",
          bmp: "image/bmp",
          svg: "image/svg+xml",
        }[job.file.ext] || "application/octet-stream",
    }),
  );
  const section = document.createElement("section");
  section.className = "print-sheet";
  const img = document.createElement("img");
  img.src = url;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(Error("无法解码图片用于打印。"));
  });
  if (disposed) return;
  section.append(img);
  host.value!.append(section);
  await document.fonts.ready;
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
  if (!disposed) await window.localPreview.printReady(undefined,jobToken);
}

async function printWord(job: Awaited<ReturnType<typeof window.localPreview.consumePrint>>) {
  const paper = paperSize(job.options);
  const style = document.createElement("style");
  style.textContent = sheetStyle(paper);
  host.value!.append(style);
  const section = document.createElement("section");
  section.className = "print-sheet word-host";
  section.style.alignItems = "flex-start";
  section.style.justifyContent = "flex-start";
  section.style.overflow = "visible";
  section.style.height = "auto";
  section.style.minHeight = paper.height + "mm";
  section.style.padding = "12mm";
  const body = document.createElement("div");
  section.append(body);
  host.value!.append(section);
  const { renderAsync } = await import("docx-preview");
  await renderAsync(job.file.bytes, body, body, {
    useBase64URL: true,
    renderAltChunks: false,
    breakPages: true,
    renderHeaders: true,
    renderFooters: true,
  });
  if (disposed) return;
  await document.fonts.ready;
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
  if (!disposed) await window.localPreview.printReady(undefined,jobToken);
}

async function printPdf(job: Awaited<ReturnType<typeof window.localPreview.consumePrint>>) {
  GlobalWorkerOptions.workerSrc = workerUrl;
  const base = new URL("./pdf-assets/", location.href).href;
  loading = getDocument({
    // This hidden renderer exclusively owns the consumed job; transfer it directly.
    data: job.file.bytes,
    password: job.file.view?.pdfPassword,
    cMapUrl: base + "cmaps/",
    cMapPacked: true,
    standardFontDataUrl: base + "standard_fonts/",
    wasmUrl: base + "wasm/",
    useSystemFonts: true,
  });
  const pdf = await loading.promise;
  const permissions=await pdf.getPermissions();
  if(permissions&&!permissions.has(4))throw Error('此 PDF 不允许打印。');
  const ranged = selectedPages(job.options.range, pdf.numPages);
  const selected = applyPageOrder(ranged, job.options.pageOrder || "forward");
  if (!selected.length) throw Error("按当前页码范围与页序没有可打印的页。");
  const paper = paperSize(job.options);
  const style = document.createElement("style");
  style.textContent = sheetStyle(paper) + `.print-sheet canvas{flex:none;max-width:none;max-height:none}`;
  host.value!.append(style);
  let pixels = 0;
  const plans: Array<{ index: number; raster:ReturnType<typeof pdfRasterPlan> }> = [];
  for (const index of selected) {
    if (disposed) return;
    const page = await pdf.getPage(index);
    const original = page.getViewport({ scale: 1 });
    const raster=pdfRasterPlan(original,paper,job.options.scale||'fit',150);
    pixels += raster.width*raster.height;
    if (pixels > 60000000)
      throw Error("本次打印页数较多，请填写页码范围分批打印。");
    plans.push({ index, raster });
  }
  // Validate the whole job's raster budget before allocating any print canvases.
  for (const plan of plans) {
    if (disposed) return;
    const page = await pdf.getPage(plan.index);
    const viewport = page.getViewport({ scale: plan.raster.scale });
    const section = document.createElement("section");
    section.className = "print-sheet";
    section.dataset.sourcePage = String(plan.index);
    const canvas = document.createElement("canvas");
    canvases.add(canvas);
    canvas.width = plan.raster.width;
    canvas.height = plan.raster.height;
    canvas.style.width = plan.raster.widthMm + 'mm';
    canvas.style.height = plan.raster.heightMm + 'mm';
    canvas.dataset.renderScale=String(plan.raster.scale);
    section.append(canvas);
    host.value!.append(section);
    task = page.render({ canvas, viewport, transform:plan.raster.transform, intent:'print' });
    await task.promise;
    page.cleanup();
  }
  await document.fonts.ready;
  // Native print flushes layout; hidden-window animation frames may be throttled.
  await new Promise<void>(resolve=>setTimeout(resolve,0));
  if (!disposed) await window.localPreview.printReady(undefined,jobToken);
}

onMounted(async () => {
  try {
    const job = await window.localPreview.consumePrint();
    jobToken=job.token;
    if(host.value)host.value.dataset.jobToken=jobToken;
    if (job.file.ext === "pdf") await printPdf(job);
    else if (job.file.ext === "docx") await printWord(job);
    else await printImage(job);
  } catch (e) {
    if (!disposed)
      await window.localPreview.printReady(
        e instanceof Error ? e.message : String(e),
        jobToken,
      );
  }
});
onBeforeUnmount(() => {
  disposed = true;
  task?.cancel();
  void loading?.destroy();
  for(const canvas of canvases){canvas.width=0;canvas.height=0;}canvases.clear();
  host.value?.replaceChildren();
});
</script>
<template><div ref="host" class="pdf-print-document"></div></template>
