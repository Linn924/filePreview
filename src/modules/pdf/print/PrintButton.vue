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
    if (printEntry === "all")
      files = (previewFiles?.value || []).filter((f) => f.ext === "pdf");
    else if (printEntry === "current") files = [props.file];
    await window.localPreview.openPrintPanel(files);
  } catch (e) {
    error.value = printError(e);
  }
}
</script>
<template>
  <span
    ><button class="pdf-print-button" @click="open">打印 PDF</button
    ><span v-if="error" role="alert">{{ error }}</span></span
  >
</template>
