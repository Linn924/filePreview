<script setup lang="ts">
import type { PreviewProps } from "../types";
import { usePreview } from "./usePreview";
const props = defineProps<PreviewProps>();
const emit = defineEmits<{
  ready: [];
  error: [message: string];
  "update:zoom": [value: number];
}>();
const { pane, url, style, dimensions, loaded } = usePreview(props, emit);
</script>
<template>
  <section ref="pane" class="image-pane">
    <div class="image">
      <img
        class="preview-content"
        :src="url"
        :alt="file.name"
        :style="style"
        @load="loaded"
        @error="emit('error', '无法解码图片，文件可能损坏或格式不受支持。')"
      />
    </div>
    <div class="pane-footer">{{ dimensions }} <span>100% 时适配窗口</span></div>
  </section>
</template>
