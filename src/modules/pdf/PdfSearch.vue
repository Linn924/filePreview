<script setup lang="ts">
import type { SearchHit } from "./useSearch";

defineProps<{
  query: string;
  hits: SearchHit[];
  active: number;
  searching: boolean;
  error: string;
  open: boolean;
}>();
const emit = defineEmits<{
  "update:query": [string];
  search: [];
  next: [];
  prev: [];
  clear: [];
  "update:open": [boolean];
}>();
function submit(event: Event) {
  event.preventDefault();
  emit("search");
}
</script>
<template>
  <div class="pdf-search" :class="{ open }">
    <button
      type="button"
      class="pdf-search-toggle icon-only-btn"
      :aria-expanded="open"
      :title="open ? '关闭搜索' : '搜索'"
      aria-label="搜索"
      @click="emit('update:open', !open)"
    >
      <svg v-if="!open" class="btn-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
        <circle cx="7" cy="7" r="4.5" />
        <path d="M10.5 10.5L14 14" />
      </svg>
      <svg v-else class="btn-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
        <path d="M4 4l8 8M12 4l-8 8" />
      </svg>
      <span class="sr-only">{{ open ? "关闭搜索" : "搜索" }}</span>
    </button>
    <form v-if="open" class="pdf-search-bar" role="search" @submit="submit">
      <input
        class="pdf-search-input"
        :value="query"
        placeholder="在文档中搜索文字"
        aria-label="搜索 PDF"
        @input="emit('update:query', ($event.target as HTMLInputElement).value)"
        @keydown.enter.prevent="emit('search')"
      />
      <button type="submit" class="pdf-search-go" :disabled="searching">
        查找
      </button>
      <span class="pdf-search-count" aria-live="polite">
        <template v-if="searching">搜索中…</template>
        <template v-else-if="query.trim()">
          {{ hits.length ? active + 1 + " / " + hits.length : "无结果" }}
        </template>
      </span>
      <button
        type="button"
        :disabled="searching || !hits.length"
        @click="emit('prev')"
      >
        上一处</button
      ><button
        type="button"
        :disabled="searching || !hits.length"
        @click="emit('next')"
      >
        下一处</button
      ><button type="button" @click="emit('clear')">清除</button>
      <span v-if="error" class="pdf-search-error" role="alert">{{ error }}</span>
    </form>
  </div>
</template>
