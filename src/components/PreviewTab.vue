<script setup lang="ts">
import { ref, nextTick, watch, computed } from "vue";
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
}>();
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
    <div class="filebar actbar">
      <FitControl
        v-if="!error && module?.pageFit"
        v-model="fitMode"
        @update:model-value="zoom = 100"
      />
      <span class="sep" aria-hidden="true"></span>
      <ZoomControl v-if="!error" v-model="zoom" />
      <span class="sep" aria-hidden="true"></span>
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
        <svg v-if="immersive" class="btn-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
          <path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" />
        </svg>
        <svg v-else class="btn-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
          <path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" />
        </svg>
        <span class="sr-only">{{ immersive ? "退出全屏" : "沉浸" }}</span>
      </button>
    </div>
    <div v-if="error" class="error" role="alert">
      <strong>暂时无法预览</strong>
      <p>{{ error }}</p>
    </div>
    <template v-else
      ><div v-if="!ready" class="loading" role="status">正在解析文件…</div>
      <component
        :is="getPreviewModule(file.ext)?.component"
        :file="file"
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
