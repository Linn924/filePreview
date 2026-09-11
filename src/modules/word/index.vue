<script setup lang="ts">
import type { PreviewProps } from "../types";
import { usePreview } from "./usePreview";
const props = defineProps<PreviewProps>();
const emit = defineEmits<{
  ready: [];
  error: [message: string];
  "update:zoom": [value: number];
}>();
const { pane, host, warning, page, pageCount, goPage } = usePreview(
  props,
  emit,
);
</script>
<template>
  <section ref="pane" class="document-pane">
    <div v-if="warning" class="notice">{{ warning }}</div>
    <div class="document-scroll">
      <div ref="host" class="word-host" :style="{ zoom: zoom / 100 }"></div>
    </div>
    <footer class="page-nav">
      <span>文档</span>
      <div>
        <button :disabled="page <= 1" @click="goPage(-1)">上一页</button
        ><span class="page-indicator">{{ page }} / {{ pageCount }}</span
        ><button :disabled="page >= pageCount" @click="goPage(1)">
          下一页
        </button>
      </div>
    </footer>
  </section>
</template>
