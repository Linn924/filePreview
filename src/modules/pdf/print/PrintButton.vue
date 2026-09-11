<script setup lang="ts">
import { ref } from "vue";
import type { PreviewFile } from "../../../../shared/contracts";
import { printError } from "./errorMessage";
const props = defineProps<{ file: PreviewFile }>();
const error = ref("");
async function open() {
  try {
    await window.localPreview.openPrintPanel(props.file);
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
