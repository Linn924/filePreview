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
  <span
    ><button class="file-print-button" @click="open">打印</button
    ><span v-if="error" role="alert">{{ error }}</span></span
  >
</template>
