<script setup lang="ts">
import { inject, ref, type ShallowRef } from "vue";
import type { PreviewFile } from "../../../../shared/contracts";
import { printError } from "./errorMessage";
const props = defineProps<{ file: PreviewFile }>();
const error = ref("");
const previewFiles = inject<ShallowRef<PreviewFile[]>>("previewFiles");
async function open() {
  try {
    const { printEntry } = await window.localPreview.getSettings();
    let files: PreviewFile[] = [];
    if (printEntry === "all") {
      const printable = new Set([
        "pdf",
        "png",
        "jpg",
        "jpeg",
        "webp",
        "gif",
        "bmp",
        "svg",
        "docx",
      ]);
      files = (previewFiles?.value || []).filter((f) => printable.has(f.ext));
    } else if (printEntry === "current") files = [props.file];
    await window.localPreview.openPrintPanel(files);
  } catch (e) {
    error.value = printError(e);
  }
}
</script>
<template>
  <span class="print-btn-wrap"
    ><button
      class="pdf-print-button icon-only-btn"
      type="button"
      title="打印"
      aria-label="打印"
      @click="open"
    >
      <svg class="btn-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true">
        <path d="M4 6.2V2.5h8v3.7M4 11.5V8h8v3.5M4 11.5h8V14H4z" />
        <path d="M5.2 11.5v-2h5.6v2" />
      </svg></button
    ><span v-if="error" role="alert">{{ error }}</span></span
  >
</template>
