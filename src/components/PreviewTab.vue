<script setup lang="ts">
import { ref, shallowRef, nextTick, watch, computed, onMounted, onBeforeUnmount } from "vue";
import { getPreviewModule } from "../modules";
import FitControl from "./FitControl.vue";
import type { FitMode } from "../composables/fit";
import type { PreviewModule } from "../modules/types";
import ZoomControl from "./ZoomControl.vue";
import { fileSize, type PreviewFile } from "../types";
const props = defineProps<{
  file: PreviewFile;
  initialZoom: number;
  immersive?: boolean;
  /** Whether this tab is the active tab (for memory cache). */
  active?: boolean;
}>();
/**
 * Cache loaded bytes for EVERY open tab so batch switch-back is instant
 * (invoice multi-view habit). Idle only drops mounted DOM, not bytes.
 * Evict only when total cache exceeds CACHE_BUDGET_BYTES (LRU).
 */
const contentCache = new Map<string, PreviewFile>();
const CACHE_BUDGET_BYTES = 512 * 1024 * 1024;
let cacheBytes = 0;
function cachePut(id: string, file: PreviewFile) {
  const prev = contentCache.get(id);
  if (prev) cacheBytes -= prev.bytes?.byteLength || 0;
  contentCache.delete(id);
  contentCache.set(id, file);
  cacheBytes += file.bytes?.byteLength || 0;
  while (cacheBytes > CACHE_BUDGET_BYTES && contentCache.size > 1) {
    const oldest = contentCache.keys().next().value as string | undefined;
    if (!oldest || oldest === id) break;
    const gone = contentCache.get(oldest);
    cacheBytes -= gone?.bytes?.byteLength || 0;
    contentCache.delete(oldest);
  }
}
function cacheDrop(id: string) {
  const gone = contentCache.get(id);
  cacheBytes -= gone?.bytes?.byteLength || 0;
  contentCache.delete(id);
}
const content=shallowRef<PreviewFile>();
let disposed=false;
let idleTimer: ReturnType<typeof setTimeout> | undefined;
/** Stagger loadPreview across tabs so multi-open does not spike CPU. */
let loadQ: Promise<unknown> = Promise.resolve();
function enqueueLoad(fn: () => Promise<unknown>) {
  loadQ = loadQ.then(fn).catch(() => undefined);
  return loadQ;
}

async function ensureLoaded() {
  if (content.value?.bytes?.byteLength || content.value?.error) return content.value;
  const hit = contentCache.get(props.file.id);
  if (hit) {
    hit.view = props.file.view;
    content.value = hit;
    ready.value = true;
    return hit;
  }
  if (props.file.error) {
    content.value = props.file;
    ready.value = true;
    return content.value;
  }
  ready.value = false;
  const loaded = await window.localPreview.loadPreview(props.file);
  if (disposed) return;
  loaded.view = props.file.view;
  cachePut(props.file.id, loaded);
  content.value = loaded;
  if (loaded.error) {
    error.value = loaded.error;
    ready.value = true;
  }
  return loaded;
}

function saveViewState() {
  props.file.view ??= { zoom: zoom.value, scroll: [] };
  props.file.view.zoom = zoom.value;
  props.file.view.fit = fitMode.value;
  props.file.view.scroll = scrollers().map((el) => ({
    top: el.scrollTop,
    left: el.scrollLeft,
  }));
}

function scheduleUnload() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (props.active || disposed) return;
    // Drop mounted module/PDF.js state only; bytes stay in contentCache.
    content.value = undefined;
  }, 15000);
}

onMounted(() => {
  void enqueueLoad(async () => {
    await ensureLoaded();
    if (!props.active) scheduleUnload();
  });
});
watch(
  () => props.active,
  (on) => {
    if (on) {
      clearTimeout(idleTimer);
      void enqueueLoad(() => ensureLoaded());
    } else {
      saveViewState();
      scheduleUnload();
    }
  },
);
onBeforeUnmount(()=>{
 disposed=true;
 clearTimeout(idleTimer);
 saveViewState();
 content.value=undefined;
 cacheDrop(props.file.id);
});
const module = computed(
  () => getPreviewModule(props.file.ext) as PreviewModule | undefined,
);
props.file.view ??= { zoom: props.initialZoom, scroll: [] };
const fitMode = ref<FitMode>(props.file.view.fit ?? "original");
watch(fitMode, value => { props.file.view!.fit = value; }, { flush: 'sync' });
let saved:
  | { zoom: number; fit: FitMode; scroll: Array<{ top: number; left: number }> }
  | undefined;
const scrollers = () =>
  Array.from(
    document
      .querySelector(`[data-file-id="${props.file.id}"]`)
      ?.querySelectorAll<HTMLElement>(
        ".pdf-scroll,.slide-scroll,.document-scroll,.table-wrap,.text-scroll,.image",
      ) || [],
  );
watch(
  () => props.immersive,
  async (value) => {
    if (value) {
      saved = {
        zoom: zoom.value,
        fit: fitMode.value,
        scroll: scrollers().map((el) => ({
          top: el.scrollTop,
          left: el.scrollLeft,
        })),
      };
      if (module.value?.pageFit) {
        fitMode.value = "page";
        zoom.value = 100;
      }
    } else if (saved) {
      zoom.value = saved.zoom;
      fitMode.value = saved.fit;
      await nextTick();
      setTimeout(
        () =>
          scrollers().forEach((el, i) => {
            el.scrollTop = saved?.scroll[i]?.top || 0;
            el.scrollLeft = saved?.scroll[i]?.left || 0;
          }),
        150,
      );
    }
  },
);
const zoom = ref(props.file.view?.zoom ?? props.initialZoom);
const error = ref(props.file.error);
const ready = ref(false);
function toggleFullscreen() {
  (document.activeElement as HTMLElement)?.blur();
  void window.localPreview.setFullscreen(!props.immersive);
}
async function loaded() {
  ready.value = true;
  await nextTick();
  const root = document.querySelector(`[data-file-id="${props.file.id}"]`);
  root
    ?.querySelectorAll<HTMLElement>(
      ".pdf-scroll,.slide-scroll,.document-scroll,.table-wrap,.text-scroll,.image",
    )
    .forEach((el, i) => {
      const saved = props.file.view?.scroll[i];
      if (saved) {
        el.scrollTop = saved.top;
        el.scrollLeft = saved.left;
      }
    });
}
</script>
<template>
  <section class="preview-tab" :data-file-id="file.id">
    <!-- Plan B: identity strip (type · name · size) -->
    <div class="filebar idbar">
      <span class="badge">{{ file.ext.toUpperCase() }}</span>
      <div class="filename">
        <strong :title="file.name">{{ file.name }}</strong>
      </div>
      <small class="filesize">{{ fileSize(file.size) }}</small>
    </div>
    <!-- Plan B: action strip -->
    <div class="filebar actbar" role="toolbar" aria-label="文件预览工具">
      <FitControl
        v-if="!error && module?.pageFit"
        v-model="fitMode"
        @update:model-value="zoom = 100"
      />
      <span v-if="!error && module?.pageFit" class="sep" aria-hidden="true"></span>
      <ZoomControl v-if="!error" v-model="zoom" />
      <span class="module-tools" :data-tools-for="file.id"></span>
      <component
        v-if="module?.toolbar && !error"
        :is="module.toolbar"
        :file="file"
      />
      <span class="flex-sp"></span>
      <button
        class="immersive-toggle icon-only-btn"
        type="button"
        :title="immersive ? '退出全屏（Esc）' : '沉浸阅读（F11）'"
        :aria-label="immersive ? '退出全屏' : '沉浸阅读'"
        @click="toggleFullscreen"
      >
        <svg class="btn-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" />
        </svg>
        <span class="sr-only">{{ immersive ? "退出全屏" : "沉浸" }}</span>
      </button>
    </div>
    <div class="search-tools"></div>
    <div v-if="error" class="error" role="alert">
      <strong>暂时无法预览</strong>
      <p>{{ error }}</p>
    </div>
    <template v-else
      ><div v-if="!ready" class="loading" role="status">正在解析文件…</div>
      <component
        v-if="content && !content.error"
        :is="getPreviewModule(file.ext)?.component"
        :file="content"
        :zoom="zoom"
        :fit-mode="fitMode"
        @update:zoom="zoom = $event"
        @ready="loaded"
        @error="
          error = $event;
          ready = true;
        "
    /></template>
  </section>
</template>
