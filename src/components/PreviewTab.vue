<script setup lang="ts">
import { ref } from "vue";
import { getPreviewModule } from "../modules";
import ZoomControl from "./ZoomControl.vue";
import { fileSize, type PreviewFile } from "../types";
const props = defineProps<{
  file: PreviewFile;
  initialZoom: number;
  wheelZoom: boolean;
}>();
const zoom = ref(props.initialZoom);
const error = ref(props.file.error);
const ready = ref(false);
</script>
<template>
  <section class="preview-tab">
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
        :wheel-zoom="wheelZoom"
        @update:zoom="zoom = $event"
        @ready="ready = true"
        @error="
          error = $event;
          ready = true;
        "
    /></template>
  </section>
</template>
