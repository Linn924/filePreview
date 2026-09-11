<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from "vue";
import type { PreviewFile } from "../../types";
import { useWheelPreview } from "../../composables/useWheelPreview";
import { openSlides, type SlidesRenderer } from "./renderer";
const props = defineProps<{
  file: PreviewFile;
  zoom: number;
  wheelZoom?: boolean;
}>();
const emit = defineEmits<{
  ready: [];
  error: [message: string];
  "update:zoom": [value: number];
}>();
const pane = ref<HTMLElement>(),
  viewport = ref<HTMLElement>(),
  host = ref<HTMLElement>();
const current = ref(0),
  count = ref(0),
  busy = ref(false);
let renderer: SlidesRenderer | undefined,
  stage: HTMLElement,
  observer: ResizeObserver | undefined;
let disposed = false,
  revision = 0;
let queue = Promise.resolve();
useWheelPreview(pane, {
  zoom: () => props.zoom,
  enabled: () => props.wheelZoom !== false,
  update: (value) => emit("update:zoom", value),
  page: (direction) => {
    if (!busy.value)
      current.value = Math.max(
        0,
        Math.min(count.value - 1, current.value + direction),
      );
  },
});
function fit() {
  if (
    !renderer ||
    !viewport.value ||
    !host.value ||
    !viewport.value.clientWidth
  )
    return;
  const ratio =
    (Math.min(
      (viewport.value.clientWidth - 48) / renderer.width,
      (viewport.value.clientHeight - 48) / renderer.height,
    ) *
      props.zoom) /
    100;
  const scale = Math.max(0.05, ratio);
  host.value.style.width = renderer.width * scale + "px";
  host.value.style.height = renderer.height * scale + "px";
  stage.style.width = renderer.width + "px";
  stage.style.height = renderer.height + "px";
  stage.style.transform = `scale(${scale})`;
  stage.style.transformOrigin = "top left";
}
function render() {
  const token = ++revision;
  busy.value = true;
  queue = queue
    .then(async () => {
      if (disposed || token !== revision || !renderer) return;
      await renderer.render(current.value);
      fit();
    })
    .catch((e) => {
      if (!disposed) emit("error", "幻灯片无法显示：" + String(e));
    })
    .finally(() => {
      if (token === revision) busy.value = false;
    });
}
onMounted(async () => {
  try {
    const shadow = host.value!.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent =
      ":host{display:block;background:white}*{box-sizing:border-box}::-webkit-scrollbar{display:none}a{pointer-events:none}";
    shadow.append(style);
    stage = document.createElement("div");
    stage.className = "slide-stage";
    shadow.append(stage);
    renderer = await openSlides(props.file.bytes, props.file.ext, stage);
    if (disposed) {
      renderer.dispose();
      return;
    }
    count.value = renderer.count;
    if (!count.value) throw new Error("没有可显示的幻灯片。");
    await renderer.render(0);
    fit();
    observer = new ResizeObserver(fit);
    observer.observe(viewport.value!);
    emit("ready");
  } catch (e) {
    if (!disposed)
      emit(
        "error",
        "无法解析演示文稿，文件可能损坏、加密或不兼容。" + String(e),
      );
  }
});
watch(current, render);
watch(() => props.zoom, fit);
onBeforeUnmount(() => {
  disposed = true;
  observer?.disconnect();
  renderer?.dispose();
});
</script>
<template>
  <section ref="pane" class="presentation-pane">
    <div ref="viewport" class="slide-scroll">
      <div ref="host" class="slide-host preview-content"></div>
    </div>
    <footer class="page-nav">
      <span>幻灯片</span>
      <div>
        <button :disabled="current <= 0 || busy" @click="current--">
          上一页</button
        ><span class="page-indicator">{{ current + 1 }} / {{ count }}</span
        ><button :disabled="current + 1 >= count || busy" @click="current++">
          下一页
        </button>
      </div>
    </footer>
  </section>
</template>
