<script setup lang="ts">
import type { PreviewProps } from "../types";
import { usePreview } from "./usePreview";
const props = defineProps<PreviewProps>();
const emit = defineEmits<{
  ready: [];
  error: [message: string];
  "update:zoom": [value: number];
}>();
const { pane, scroll, canvas, current, pages, rendering } = usePreview(
  props,
  emit,
);
</script>
<template>
  <section ref="pane" class="pdf-pane">
    <div ref="scroll" class="pdf-scroll">
      <canvas
        class="preview-content"
        ref="canvas"
        aria-label="PDF 页面"
      ></canvas>
    </div>
    <footer class="page-nav">
      <span>{{ rendering ? "正在绘制…" : "PDF 预览" }}</span>
      <div>
        <button :disabled="current <= 1" @click="current--">上一页</button
        ><label
          ><input
            v-model.number.lazy="current"
            type="number"
            min="1"
            :max="pages"
            aria-label="页码"
            @change="
              current = Math.max(1, Math.min(pages, Math.floor(current) || 1))
            "
          />
          / {{ pages }}</label
        ><button :disabled="current >= pages" @click="current++">下一页</button>
      </div>
    </footer>
  </section>
</template>
