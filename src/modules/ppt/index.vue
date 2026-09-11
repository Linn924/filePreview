<script setup lang="ts">
import { fitScale } from "../../composables/fit";
import { onMounted, onBeforeUnmount, ref, watch, nextTick } from "vue";
import type { PreviewProps } from "../types";
import { openSlides, type SlidesRenderer } from "./renderer";
import { snapshotSlide } from "./snapshot";
import PageNavigation from "../../components/PageNavigation.vue";
import { useContinuousPages } from "../../composables/useContinuousPages";
const props = defineProps<PreviewProps>();
const emit = defineEmits<{
  ready: [];
  error: [message: string];
  "update:zoom": [value: number];
}>();
const viewport = ref<HTMLElement>(),
  host = ref<HTMLElement>();
const count = ref(0);
let renderer: SlidesRenderer | undefined,
  observer: ResizeObserver | undefined,
  disposed = false;
let stage: HTMLElement;
let pageElements: HTMLElement[] = [];
const { current, sync, jump } = useContinuousPages(
  viewport,
  () => pageElements,
);
function fit() {
  if (!renderer || !viewport.value?.clientWidth) return;
  const scale =
    (fitScale(
      renderer.width,
      renderer.height,
      viewport.value.clientWidth - 48,
      viewport.value.clientHeight - 48,
      props.fitMode || "original",
      Math.min(
        (viewport.value.clientWidth - 48) / renderer.width,
        (viewport.value.clientHeight - 48) / renderer.height,
      ),
    ) *
      props.zoom) /
    100;
  for (const el of pageElements) {
    el.style.width = renderer.width * scale + "px";
    el.style.height = renderer.height * scale + "px";
    const body = el.firstElementChild as HTMLElement;
    body.style.width = renderer.width + "px";
    body.style.height = renderer.height + "px";
    body.style.transform = `scale(${scale})`;
    body.style.transformOrigin = "top left";
  }
}
onMounted(async () => {
  try {
    const shadow = host.value!.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent =
      "*{box-sizing:border-box;scrollbar-width:none}::-webkit-scrollbar{display:none}a{pointer-events:none}.slide-page{position:relative;margin:0 auto 24px;background:white;overflow:hidden;box-shadow:0 3px 18px #0002}.render-stage{position:absolute;left:-100000px;top:0;visibility:hidden}";
    shadow.append(style);
    stage = document.createElement("div");
    stage.className = "render-stage";
    shadow.append(stage);
    renderer = await openSlides(props.file.bytes, props.file.ext, stage);
    if (disposed) {
      renderer.dispose();
      return;
    }
    count.value = renderer.count;
    for (let i = 0; i < count.value; i++) {
      await renderer.render(i);
      if (disposed) return;
      const page = document.createElement("div");
      page.className = "slide-page preview-content";
      page.dataset.page = String(i);
      const copy = snapshotSlide(stage, i);
      page.append(copy);
      shadow.insertBefore(page, stage);
      pageElements.push(page);
      fit();
      await nextTick();
    }
    observer = new ResizeObserver(fit);
    observer.observe(viewport.value!);
    fit();
    emit("ready");
  } catch (e) {
    if (!disposed) emit("error", "无法解析演示文稿：" + String(e));
  }
});
watch(() => props.zoom, fit);
watch(
  () => props.fitMode,
  async () => {
    const page = current.value;
    fit();
    await nextTick();
    jump(page);
  },
);
onBeforeUnmount(() => {
  disposed = true;
  observer?.disconnect();
  renderer?.dispose();
  pageElements = [];
  host.value?.shadowRoot?.replaceChildren();
});
</script>
<template>
  <section class="presentation-pane">
    <div ref="viewport" class="slide-scroll" @scroll.passive="sync">
      <div ref="host" class="slide-host"></div>
    </div>
    <PageNavigation
      :current="current"
      :total="count"
      label="幻灯片"
      @jump="jump"
    />
  </section>
</template>
