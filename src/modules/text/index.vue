<script setup lang="ts">
import { computed, ref, watch, nextTick, onMounted, onBeforeUnmount } from "vue";
import type { PreviewProps } from "../types";
import { usePreview } from "./usePreview";
import { createSafeResizeObserver } from "../../composables/safeResizeObserver";
import textModule from "./index";
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
const searchInput = ref<HTMLInputElement>();
watch(showSearch, async value => { if (value) { await nextTick(); searchInput.value?.focus(); } });
const lines = computed(() => (pretty.value || "").split("\n"));

/** 超过此行数才启用虚拟滚动，小文件直接全量渲染 */
const VIRTUAL_THRESHOLD = 3000;
/** 视口外额外保留的行数（上下各一份） */
const OVERSCAN = 5;

const useVirtual = computed(() => lines.value.length > VIRTUAL_THRESHOLD);

// ------- 虚拟滚动状态 -------
const textScroll = ref<HTMLElement>();
const vStart = ref(0);
const vEnd = ref(VIRTUAL_THRESHOLD); // 初始先渲染前 N 行
const padTop = ref(0);
const padBottom = ref(0);

/** 读取实际行高：优先取 DOM 真实值，fallback 到 zoom 比例估算 */
function lineHeight(): number {
  const el = textScroll.value?.querySelector<HTMLElement>(".text-line");
  if (el && el.offsetHeight > 0) return el.offsetHeight;
  return (14 * props.zoom) / 100 * 1.65;
}

function updateVirtual() {
  if (!useVirtual.value) return;
  const root = textScroll.value;
  if (!root) return;
  const lh = lineHeight();
  const total = lines.value.length;
  const viewH = root.clientHeight || 600;
  const scrollY = root.scrollTop;

  const firstVisible = Math.floor(scrollY / lh);
  const lastVisible = Math.ceil((scrollY + viewH) / lh);

  const start = Math.max(0, firstVisible - OVERSCAN);
  const end = Math.min(total, lastVisible + OVERSCAN);

  vStart.value = start;
  vEnd.value = end;
  padTop.value = start * lh;
  padBottom.value = Math.max(0, (total - end) * lh);
}

// 当切换虚拟/非虚拟或 lines 变化时重置
watch(useVirtual, async (on) => {
  if (!on) {
    vStart.value = 0;
    vEnd.value = 0;
    padTop.value = 0;
    padBottom.value = 0;
  } else {
    await nextTick();
    updateVirtual();
  }
});

watch(lines, async () => {
  if (!useVirtual.value) return;
  // 编码切换后重置到顶部
  if (textScroll.value) textScroll.value.scrollTop = 0;
  vStart.value = 0;
  await nextTick();
  updateVirtual();
});

// zoom 变化时重算（行高改变）
watch(() => props.zoom, async () => {
  if (!useVirtual.value) return;
  await nextTick();
  updateVirtual();
});

let resizeObs: ResizeObserver | undefined;
onMounted(() => {
  if (useVirtual.value) updateVirtual();
  resizeObs = createSafeResizeObserver(() => updateVirtual());
  if (textScroll.value) resizeObs.observe(textScroll.value);
});
onBeforeUnmount(() => {
  resizeObs?.disconnect();
});

/** 当前视口内实际渲染的行（小文件为全部，大文件为虚拟窗口） */
const virtualLines = computed(() => {
  if (!useVirtual.value) return lines.value;
  return lines.value.slice(vStart.value, vEnd.value);
});

const hitCount = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return 0;
  // 始终基于全量 lines 统计，不受虚拟化影响
  return lines.value.reduce(
    (n, line) => n + (line.toLowerCase().includes(q) ? 1 : 0),
    0,
  );
});
const isCode = computed(() => textModule.extensions.includes(props.file.ext));
function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
}
function highlightLine(line: string) {
  if (!isCode.value) return esc(line);
  const ext = props.file.ext;
  if (ext === "json") {
    return esc(line)
      .replace(/(\"(?:\\.|[^\"\\])*\")(\s*:)?/g, (_m, str, colon) =>
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
      .replace(/(\"(?:[^\"]*)\")/g, '<span class="tok-str">$1</span>');
  if (ext === "js" || ext === "ts")
    return esc(line)
      .replace(/(\/\/.*$)/g, '<span class="tok-cmt">$1</span>')
      .replace(
        /\b(const|let|var|function|return|if|else|for|while|class|import|export|from|async|await|type|interface|new|try|catch|typeof)\b/g,
        '<span class="tok-kw">$1</span>',
      )
      .replace(/(\"(?:\\.|[^\"\\])*\"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)/g, '<span class="tok-str">$1</span>')
      .replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="tok-num">$1</span>');
  if (ext === "css")
    return esc(line)
      .replace(/(\/\*[\s\S]*?\*\/|\/\/.*$)/g, '<span class="tok-cmt">$1</span>')
      .replace(/([.#][\w-]+)/g, '<span class="tok-key">$1</span>')
      .replace(/(#[0-9a-fA-F]{3,8})\b/g, '<span class="tok-num">$1</span>')
      .replace(/(:\s*[\w-]+)/g, '<span class="tok-str">$1</span>');
  if (ext === "toml")
    return esc(line)
      .replace(/(^\s*#.*$)/g, '<span class="tok-cmt">$1</span>')
      .replace(/^(\s*\[\[?[^\]]+\]?\])/, '<span class="tok-key">$1</span>')
      .replace(/^(\s*[\w.-]+)(\s*=)/, '$1<span class="tok-kw">$2</span>')
      .replace(/("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/g, '<span class="tok-str">$1</span>')
      .replace(/(:\s*|\s*=\s*)(true|false)\b/gi, '$1<span class="tok-kw">$2</span>')
      .replace(/\b(-?\d+(?:\.\d+)?)\b/g, '<span class="tok-num">$1</span>');
  if (ext === "ini")
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
      </span>
    </Teleport>
    <Teleport :to="`[data-file-id='${props.file.id}'] .search-tools`" defer>
      <div v-if="showSearch" class="text-search-bar" role="search" @keydown.esc.prevent="showSearch=false">
        <span class="search-caption">查找</span>
        <input
          ref="searchInput"
          v-model="query"
          class="text-search-input"
          aria-label="搜索文本"
          placeholder="搜索"
        />
        <span v-if="query.trim()" class="text-search-count" aria-live="polite">
          {{ hitCount }} 行
        </span>
        <button type="button" class="search-close" aria-label="关闭文本搜索" title="关闭搜索（Esc）" @click="showSearch=false">关闭</button>
      </div>
    </Teleport>
    <div v-if="invalidJson" class="notice">
      JSON 格式不完整，按原始文本显示。
    </div>
    <div
      ref="textScroll"
      class="text-scroll"
      @scroll.passive="updateVirtual"
    >
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
        <!-- 虚拟滚动上方占位 -->
        <div
          v-if="useVirtual && padTop > 0"
          class="text-virtual-pad"
          :style="{ height: padTop + 'px' }"
          aria-hidden="true"
        ></div>
        <div
          v-for="(line, i) in virtualLines"
          :key="vStart + i"
          class="text-line"
          :data-line="vStart + i + 1"
        >
          <span v-if="showLines" class="line-no" aria-hidden="true">{{
            vStart + i + 1
          }}</span>
          <code class="line-body" v-html="markSearch(line) || '&nbsp;'"></code>
        </div>
        <!-- 虚拟滚动下方占位 -->
        <div
          v-if="useVirtual && padBottom > 0"
          class="text-virtual-pad"
          :style="{ height: padBottom + 'px' }"
          aria-hidden="true"
        ></div>
      </div>
    </div>
  </section>
</template>
