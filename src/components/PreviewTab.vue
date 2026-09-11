<script setup lang="ts">
import { ref, nextTick } from "vue";
import { getPreviewModule } from "../modules";
import ZoomControl from "./ZoomControl.vue";
import { fileSize, type PreviewFile } from "../types";
const props = defineProps<{
  file: PreviewFile;
  initialZoom: number;
}>();
const zoom = ref(props.file.view?.zoom ?? props.initialZoom);
const error = ref(props.file.error);
const ready = ref(false);
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
    <div class="filebar">
      <span class="badge">{{ file.ext.toUpperCase() }}</span>
      <div class="filename">
        <strong :title="file.name">{{ file.name }}</strong
        ><small>{{ fileSize(file.size) }}</small>
      </div>
      <ZoomControl v-if="!error" v-model="zoom" />
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
        @update:zoom="zoom = $event"
        @ready="loaded"
        @error="
          error = $event;
          ready = true;
        "
    /></template>
  </section>
</template>
