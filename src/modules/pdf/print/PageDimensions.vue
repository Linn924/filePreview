<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from "vue";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { PreviewFile } from "../../../../shared/contracts";
import { paperSize, type PdfPrintOptions } from "../../../../shared/printing";
const props = defineProps<{ file: PreviewFile; options: PdfPrintOptions }>();
const message = ref("读取页面尺寸…");
const paper = computed(() => paperSize(props.options));
let loading: ReturnType<typeof getDocument> | undefined;
let disposed = false;
onMounted(async () => {
  try {
    GlobalWorkerOptions.workerSrc = workerUrl;
    loading = getDocument({ data: props.file.bytes.slice() });
    const pdf = await loading.promise;
    const page = await pdf.getPage(1);
    const size = page.getViewport({ scale: 1 });
    if (!disposed)
      message.value = `原页（第 1 页）：${((size.width * 25.4) / 72).toFixed(1)} × ${((size.height * 25.4) / 72).toFixed(1)} mm · ${pdf.numPages} 页`;
  } catch {
    if (!disposed) message.value = "无法读取原页尺寸";
  } finally {
    void loading?.destroy();
  }
});
onBeforeUnmount(() => {
  disposed = true;
  void loading?.destroy();
});
</script>
<template>
  <p class="paper-dimensions">
    {{ message }} → {{ options.paper }}：{{ paper.width }} ×
    {{ paper.height }} mm<small
      >屏幕缩放不代表实际纸张大小；混合尺寸文档以各页原尺寸等比打印。</small
    >
  </p>
</template>
