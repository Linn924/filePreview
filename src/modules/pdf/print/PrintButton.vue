<script setup lang="ts">
import { ref } from "vue";
import type { PreviewFile } from "../../../../shared/contracts";
import PrintPanel from "./PrintPanel.vue";
const props = defineProps<{ file: PreviewFile }>();
const open = ref(false);
const root = ref<HTMLElement>();
</script>
<template>
  <span ref="root"
    ><button class="pdf-print-button" @click="open = true">打印 PDF</button
    ><PrintPanel v-if="open" :file="props.file" @close="open = false"
  /></span>
</template>
