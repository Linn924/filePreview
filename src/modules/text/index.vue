<script setup lang="ts">
import type { PreviewProps } from "../types";
import { usePreview } from "./usePreview";
const props = defineProps<PreviewProps>();
const emit = defineEmits<{
  ready: [];
  error: [message: string];
  "update:zoom": [value: number];
}>();
const { pane, encoding, raw, pretty, invalidJson, html } = usePreview(
  props,
  emit,
);
</script>
<template>
  <section ref="pane" class="text">
    <div class="text-tools">
      <label
        >文本编码
        <select v-model="encoding">
          <option value="utf-8">UTF-8</option>
          <option value="gb18030">GB18030 / GBK</option>
          <option value="utf-16le">UTF-16 LE</option>
          <option value="utf-16be">UTF-16 BE</option>
        </select></label
      ><span>{{ raw.length.toLocaleString() }} 字符</span>
    </div>
    <div v-if="invalidJson" class="notice">
      JSON 格式不完整，按原始文本显示。
    </div>
    <div class="text-scroll">
      <article
        v-if="file.ext === 'md'"
        class="markdown preview-content"
        :style="{ fontSize: (15 * zoom) / 100 + 'px' }"
        @click.prevent
        v-html="html"
      ></article>
      <pre
        class="preview-content"
        v-else
        :style="{ fontSize: (14 * zoom) / 100 + 'px' }"
        >{{ pretty || "（空文件）" }}</pre
      >
    </div>
  </section>
</template>
