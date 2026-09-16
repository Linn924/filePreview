<script setup lang="ts">
import { ref } from "vue";
import type { PreviewFile } from "../../shared/contracts";
import { printError } from "../modules/pdf/print/errorMessage";
const props = defineProps<{ file: PreviewFile }>();
const error = ref("");
async function open() {
  try {
    if (props.file.ext === "doc") {
      error.value = "旧版 .doc 请先另存为 .docx 再打印。";
      return;
    }
    const { printEntry } = await window.localPreview.getSettings();
    const files = printEntry === "none" ? [] : [props.file];
    await window.localPreview.openPrintPanel(files);
  } catch (e) {
    error.value = printError(e);
  }
}
</script>
<template>
  <span class="print-btn-wrap"
    ><button class="file-print-button icon-text-btn" type="button" title="打印" @click="open">
      <svg class="btn-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true">
        <path d="M4 6V2h8v4M4 12H3a1 1 0 0 1-1-1V7h12v4a1 1 0 0 1-1 1h-1M4 10h8v4H4z" />
      </svg>
      <span>打印</span></button
    ><span v-if="error" role="alert">{{ error }}</span></span
  >
</template>
