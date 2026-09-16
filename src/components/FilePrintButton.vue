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
    ><button
      class="file-print-button icon-only-btn"
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
