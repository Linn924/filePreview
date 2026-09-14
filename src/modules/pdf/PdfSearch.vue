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
</script>
<template>
  <div class="pdf-search" :class="{ open }">
    <button
      class="pdf-search-toggle"
      :aria-expanded="open"
      title="搜索 PDF 文字"
      @click="emit('update:open', !open)"
    >
      搜索
    </button>
    <div v-if="open" class="pdf-search-bar" role="search">
      <input
        class="pdf-search-input"
        :value="query"
        placeholder="在文档中搜索文字"
        aria-label="搜索 PDF"
        @input="emit('update:query', ($event.target as HTMLInputElement).value)"
        @keydown.enter="emit('search')"
      />
      <span class="pdf-search-count" aria-live="polite">
        <template v-if="searching">搜索中…</template>
        <template v-else-if="query.trim()">
          {{ hits.length ? active + 1 + " / " + hits.length : "无结果" }}
        </template>
      </span>
      <button :disabled="searching || !hits.length" @click="emit('prev')">
        上一处</button
      ><button :disabled="searching || !hits.length" @click="emit('next')">
        下一处</button
      ><button @click="emit('clear')">清除</button>
      <span v-if="error" class="pdf-search-error" role="alert">{{ error }}</span>
    </div>
  </div>
</template>
