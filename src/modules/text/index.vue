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
  [
    "json",
    "xml",
    "log",
    "txt",
    "text",
    "md",
    "js",
    "ts",
    "css",
    "ini",
    "yaml",
    "yml",
    "toml",
  ].includes(props.file.ext),
);
function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
}
function highlightLine(line: string) {
  if (!isCode.value) return esc(line);
  const ext = props.file.ext;
  if (ext === "json") {
    return esc(line)
      .replace(/("(?:\\.|[^"\\])*")(\s*:)?/g, (_m, str, colon) =>
        colon
          ? `<span class="tok-key">${str}</span>${colon}`
          : `<span class="tok-str">${str}</span>`,
      )
      .replace(/\b(true|false|null)\b/g, '<span class="tok-kw">$1</span>')
      .replace(/\b(-?\d+(?:\.\d+)?)\b/g, '<span class="tok-num">$1</span>');
  }
  if (ext === "xml")
    return esc(line)
      .replace(/(&lt;\/?)([\w:.-]+)/g, '$1<span class="tok-key">$2</span>')
      .replace(/("(?:[^"]*)")/g, '<span class="tok-str">$1</span>');
  if (ext === "js" || ext === "ts")
    return esc(line)
      .replace(/(\/\/.*$)/g, '<span class="tok-cmt">$1</span>')
      .replace(
        /\b(const|let|var|function|return|if|else|for|while|class|import|export|from|async|await|type|interface|new|try|catch|typeof)\b/g,
        '<span class="tok-kw">$1</span>',
      )
      .replace(/("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)/g, '<span class="tok-str">$1</span>')
      .replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="tok-num">$1</span>');
  if (ext === "css")
    return esc(line)
      .replace(/(\/\*[\s\S]*?\*\/|\/\/.*$)/g, '<span class="tok-cmt">$1</span>')
      .replace(/([.#][\w-]+)/g, '<span class="tok-key">$1</span>')
      .replace(/(#[0-9a-fA-F]{3,8})\b/g, '<span class="tok-num">$1</span>')
      .replace(/(:\s*[\w-]+)/g, '<span class="tok-str">$1</span>');
  if (ext === "ini" || ext === "toml")
    return esc(line)
      .replace(/(^\s*[#;].*$)/g, '<span class="tok-cmt">$1</span>')
      .replace(/^(\s*\[[^\]]+\])/, '<span class="tok-key">$1</span>')
      .replace(/^(\s*[\w.-]+)(\s*=)/, '$1<span class="tok-kw">$2</span>');
  if (ext === "yaml" || ext === "yml")
    return esc(line)
      .replace(/(^\s*#.*$)/g, '<span class="tok-cmt">$1</span>')
      .replace(/^(\s*-?\s*)([\w.-]+)(:)/, '$1<span class="tok-key">$2</span>$3')
      .replace(/(:\s*)(true|false|null)\b/gi, '$1<span class="tok-kw">$2</span>');
  if (ext === "log")
    return esc(line).replace(
      /\b(ERROR|WARN|WARNING|INFO|DEBUG|TRACE)\b/g,
      '<span class="tok-kw">$1</span>',
    );
  return esc(line);
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
    <Teleport :to="`[data-file-id='${props.file.id}'] .module-tools`" defer>
      <span class="text-tools filebar-inline" data-text-tools>
        <label class="tool-field"
          >编码
          <select v-model="encoding" aria-label="文本编码">
            <option value="utf-8">UTF-8</option>
            <option value="gb18030">GBK</option>
            <option value="utf-16le">UTF-16 LE</option>
            <option value="utf-16be">UTF-16 BE</option>
          </select></label
        ><span class="tool-meta">{{ raw.length.toLocaleString() }} 字</span
        ><label class="tool-check"
          ><input v-model="showLines" type="checkbox" /> 行号</label
        ><button
          type="button"
          class="text-search-toggle icon-only-btn"
          :title="showSearch ? '关闭搜索' : '搜索'"
          aria-label="搜索文本"
          @click="showSearch = !showSearch"
        >
          <svg v-if="!showSearch" class="btn-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true">
            <circle cx="7.2" cy="7.2" r="4.3" />
            <path d="M10.6 10.6L13.5 13.5" />
          </svg>
          <svg v-else class="btn-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true">
            <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />
          </svg>
          <span class="sr-only">{{ showSearch ? "关闭搜索" : "搜索" }}</span>
        </button>
        <input
          v-if="showSearch"
          v-model="query"
          class="text-search-input"
          aria-label="搜索文本"
          placeholder="搜索"
        />
        <span v-if="showSearch && query.trim()" class="text-search-count">
          {{ hitCount }} 行
        </span>
      </span>
    </Teleport>
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
