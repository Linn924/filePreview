<script setup lang="ts">
import type { PreviewProps } from "../types";
import { usePreview } from "./usePreview";
const props = defineProps<PreviewProps>();
const emit = defineEmits<{
  ready: [];
  error: [message: string];
  "update:zoom": [value: number];
}>();
const {
  pane,
  url,
  style,
  dimensions,
  loaded,
  rotate,
  cycleRotate,
  originalPixels,
  toggleOriginal,
  fitLabel,
} = usePreview(props, emit);
</script>
<template>
  <section ref="pane" class="image-pane">
    <div class="image-toolbar">
      <button type="button" class="image-rotate" @click="cycleRotate">
        旋转 {{ rotate }}°
      </button>
      <button
        type="button"
        class="image-original"
        :aria-pressed="originalPixels"
        @click="toggleOriginal"
      >
        {{ originalPixels ? "适配窗口" : "原始像素" }}
      </button>
      <span class="image-fit-label">{{ fitLabel }}</span>
    </div>
    <div class="image">
      <img
        class="preview-content"
        :src="url"
        :alt="file.name"
        :style="[style, { transform: `rotate(${rotate}deg)` }]"
        @load="loaded"
        @error="emit('error', '无法解码图片，文件可能损坏或格式不受支持。')"
      />
    </div>
    <div class="pane-footer">
      {{ dimensions }}
      <span>{{ originalPixels ? "100% 原始像素" : "适配窗口" }}</span>
    </div>
  </section>
</template>
