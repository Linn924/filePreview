<script setup lang="ts">
import type { PreviewProps } from "../types";
import { usePreview } from "./usePreview";
import PageNavigation from "../../components/PageNavigation.vue";
const props = defineProps<PreviewProps>();
const emit = defineEmits<{
  ready: [];
  error: [message: string];
  "update:zoom": [value: number];
}>();
const { scroll, pages, current, sync, jump, dimensions } = usePreview(
  props,
  emit,
);
</script>
<template>
  <section class="pdf-pane">
    <div ref="scroll" class="pdf-scroll" @scroll.passive="sync">
      <div
        v-for="(page, index) in pages"
        :key="index"
        class="pdf-page preview-content"
        :data-page="index"
        :style="dimensions(index)"
      >
        <canvas :aria-label="'PDF 第 ' + (index + 1) + ' 页'"></canvas>
      </div>
    </div>
    <PageNavigation
      :current="current"
      :total="pages.length"
      label="PDF"
      @jump="jump"
    />
  </section>
</template>
