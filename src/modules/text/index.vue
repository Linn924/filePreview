<script setup lang="ts">
import { computed, ref } from "vue";
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
const query = ref("");
const showLines = ref(true);
const showSearch = ref(false);
const lines = computed(() => (pretty.value || "").split("\n"));
const hitCount = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return 0;
  return lines.value.reduce(
    (n, line) => n + (line.toLowerCase().includes(q) ? 1 : 0),
    0,
  );
});
const isCode = computed(() =>
  ["json", "xml", "log", "txt", "text", "md"].includes(props.file.ext),
);
function highlightLine(line: string) {
  if (!isCode.value) return line;
  if (props.file.ext === "json") {
    return line
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/("(?:\\.|[^"\\])*")(\s*:)?/g, (_m, str, colon) =>
        colon
          ? `<span class="tok-key">${str}</span>${colon}`
          : `<span class="tok-str">${str}</span>`,
      )
      .replace(/\b(true|false|null)\b/g, '<span class="tok-kw">$1</span>')
      .replace(/\b(-?\d+(?:\.\d+)?)\b/g, '<span class="tok-num">$1</span>');
  }
  if (props.file.ext === "xml")
    return line
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/(&lt;\/?)([\w:.-]+)/g, '$1<span class="tok-key">$2</span>')
      .replace(/("(?:[^"]*)")/g, '<span class="tok-str">$1</span>');
  return line.replace(/&/g, "&amp;").replace(/</g, "&lt;");
}
function markSearch(line: string) {
  const q = query.value.trim();
  if (!q) return highlightLine(line);
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return highlightLine(line).replace(
    new RegExp(escaped, "gi"),
    (m) => `<mark class="text-hit">${m}</mark>`,
  );
}
const showHtml = computed(
  () => props.file.ext === "md" && !showSearch.value,
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
      ><span>{{ raw.length.toLocaleString() }} 字符</span
      ><label
        ><input v-model="showLines" type="checkbox" /> 行号</label
      ><button type="button" class="text-search-toggle" @click="showSearch = !showSearch">
        {{ showSearch ? "关闭搜索" : "搜索" }}
      </button>
      <input
        v-if="showSearch"
        v-model="query"
        class="text-search-input"
        aria-label="搜索文本"
        placeholder="在文本中搜索"
      />
      <span v-if="showSearch && query.trim()" class="text-search-count">
        {{ hitCount }} 行命中
      </span>
    </div>
    <div v-if="invalidJson" class="notice">
      JSON 格式不完整，按原始文本显示。
    </div>
    <div class="text-scroll">
      <article
        v-if="showHtml"
        class="markdown preview-content"
        :style="{ fontSize: (15 * zoom) / 100 + 'px' }"
        @click.prevent
        v-html="html"
      ></article>
      <div
        v-else
        class="text-code preview-content"
        :class="{ 'with-lines': showLines }"
        :style="{ fontSize: (14 * zoom) / 100 + 'px' }"
      >
        <div
          v-for="(line, i) in lines"
          :key="i"
          class="text-line"
          :data-line="i + 1"
        >
          <span v-if="showLines" class="line-no" aria-hidden="true">{{
            i + 1
          }}</span>
          <code class="line-body" v-html="markSearch(line) || '&nbsp;'"></code>
        </div>
      </div>
    </div>
  </section>
</template>
