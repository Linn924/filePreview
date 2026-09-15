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
  printScaleFactor,
} from "../../../../shared/printing";
const host = ref<HTMLElement>();
let disposed = false;
let task: RenderTask | undefined;
let loading: ReturnType<typeof getDocument> | undefined;

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
  if (!disposed) await window.localPreview.printReady();
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
  if (!disposed) await window.localPreview.printReady();
}

async function printPdf(job: Awaited<ReturnType<typeof window.localPreview.consumePrint>>) {
  GlobalWorkerOptions.workerSrc = workerUrl;
  const base = new URL("./pdf-assets/", location.href).href;
  loading = getDocument({
    data: job.file.bytes.slice(),
    cMapUrl: base + "cmaps/",
    cMapPacked: true,
    standardFontDataUrl: base + "standard_fonts/",
    wasmUrl: base + "wasm/",
    useSystemFonts: true,
  });
  const pdf = await loading.promise;
  const ranged = selectedPages(job.options.range, pdf.numPages);
  const selected = applyPageOrder(ranged, job.options.pageOrder || "forward");
  if (!selected.length) throw Error("按当前页码范围与页序没有可打印的页。");
  const paper = paperSize(job.options);
  const style = document.createElement("style");
  style.textContent = sheetStyle(paper) + `.print-sheet canvas{max-width:100%;max-height:100%;object-fit:contain}`;
  host.value!.append(style);
  let pixels = 0;
  for (const index of selected) {
    if (disposed) return;
    const page = await pdf.getPage(index);
    const original = page.getViewport({ scale: 1 });
    const fit = printScaleFactor(original, paper, job.options.scale || "fit");
    const viewport = page.getViewport({ scale: (fit * 150) / 72 });
    pixels += Math.ceil(viewport.width) * Math.ceil(viewport.height);
    if (pixels > 60000000)
      throw Error("本次打印页数较多，请填写页码范围分批打印。");
    const section = document.createElement("section");
    section.className = "print-sheet";
    section.dataset.sourcePage = String(index);
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    canvas.style.width = (original.width * fit * 25.4) / 72 + "mm";
    canvas.style.height = (original.height * fit * 25.4) / 72 + "mm";
    section.append(canvas);
    host.value!.append(section);
    task = page.render({ canvas, viewport });
    await task.promise;
    page.cleanup();
  }
  await document.fonts.ready;
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
  if (!disposed) await window.localPreview.printReady();
}

onMounted(async () => {
  try {
    const job = await window.localPreview.consumePrint();
    if (job.file.ext === "pdf") await printPdf(job);
    else if (job.file.ext === "docx") await printWord(job);
    else await printImage(job);
  } catch (e) {
    if (!disposed)
      await window.localPreview.printReady(
        e instanceof Error ? e.message : String(e),
      );
  }
});
onBeforeUnmount(() => {
  disposed = true;
  task?.cancel();
  void loading?.destroy();
  host.value?.replaceChildren();
});
</script>
<template><div ref="host" class="pdf-print-document"></div></template>
