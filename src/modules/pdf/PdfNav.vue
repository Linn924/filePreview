<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import type { PDFDocumentProxy } from "pdfjs-dist";

const props = defineProps<{
  pdf: PDFDocumentProxy | undefined;
  current: number;
}>();
const emit = defineEmits<{ jump: [page: number] }>();
const tab = ref<"outline" | "thumbs">("outline");
interface OutlineItem {
  title: string;
  page: number;
  depth: number;
}
const outline = ref<OutlineItem[]>([]);
const thumbs = ref<Array<{ page: number; width: number; height: number }>>([]);
const thumbCanvases = new Map<number, HTMLCanvasElement>();

async function loadOutline() {
  outline.value = [];
  if (!props.pdf) return;
  try {
    const items = await props.pdf.getOutline();
    if (!items) return;
    const dests = (await props.pdf.getDestinations()) as
      | Map<string, unknown>
      | Record<string, unknown>;
    const destOf = (name: string) =>
      dests instanceof Map ? dests.get(name) : dests[name];
    const flatten = async (
      list: NonNullable<Awaited<ReturnType<PDFDocumentProxy["getOutline"]>>>,
      depth: number,
    ) => {
      for (const item of list) {
        let page = 0;
        try {
          const dest =
            typeof item.dest === "string" ? destOf(item.dest) : item.dest;
          if (Array.isArray(dest) && dest[0] != null) {
            const ref = dest[0];
            if (typeof ref === "number") page = ref + 1;
            else page = (await props.pdf!.getPageIndex(ref as never)) + 1;
          }
        } catch {
          page = 0;
        }
        outline.value.push({ title: item.title || "未命名", page, depth });
        if (item.items?.length) await flatten(item.items, depth + 1);
      }
    };
    await flatten(items, 0);
  } catch {
    outline.value = [];
  }
}

async function loadThumbs() {
  thumbs.value = [];
  if (!props.pdf) return;
  const max = Math.min(props.pdf.numPages, 30);
  for (let n = 1; n <= max; n++) {
    const page = await props.pdf.getPage(n);
    const v = page.getViewport({ scale: 0.2 });
    thumbs.value.push({ page: n, width: v.width, height: v.height });
  }
}

async function paint(el: Element, page: number) {
  const canvas = el.querySelector("canvas");
  if (!canvas || !props.pdf || thumbCanvases.get(page) === canvas) return;
  const doc = page;
  const p = await props.pdf.getPage(doc);
  const v = p.getViewport({ scale: 0.28 * devicePixelRatio });
  canvas.width = Math.ceil(v.width);
  canvas.height = Math.ceil(v.height);
  await p.render({ canvas, viewport: v }).promise;
  thumbCanvases.set(page, canvas);
}

onMounted(async () => {
  await loadOutline();
  await loadThumbs();
});
const hasOutline = computed(() => outline.value.length > 0);
</script>
<template>
  <aside class="pdf-nav" aria-label="PDF 导航">
    <div class="pdf-nav-tabs">
      <button
        :class="{ active: tab === 'outline' }"
        :disabled="!hasOutline && tab !== 'outline'"
        @click="tab = 'outline'"
      >
        目录</button
      ><button :class="{ active: tab === 'thumbs' }" @click="tab = 'thumbs'">
        缩略图
      </button>
    </div>
    <div v-if="tab === 'outline'" class="pdf-outline">
      <p v-if="!hasOutline" class="pdf-nav-empty">本文档没有目录/书签</p>
      <button
        v-for="(item, i) in outline"
        :key="i"
        class="outline-item"
        :style="{ paddingLeft: 8 + item.depth * 12 + 'px' }"
        :disabled="!item.page"
        :class="{ current: item.page === current }"
        @click="item.page && emit('jump', item.page)"
      >
        {{ item.title }}
        <small v-if="item.page">p.{{ item.page }}</small>
      </button>
    </div>
    <div v-else class="pdf-thumbs">
      <button
        v-for="t in thumbs"
        :key="t.page"
        class="thumb"
        :class="{ current: t.page === current }"
        :aria-label="'第 ' + t.page + ' 页缩略图'"
        @click="emit('jump', t.page)"
      >
        <canvas
          :style="{
            width: t.width + 'px',
            height: t.height + 'px',
          }"
          @vue:mounted="({ el }: { el: Element }) => paint(el, t.page)"
        ></canvas>
        <span>{{ t.page }}</span>
      </button>
    </div>
  </aside>
</template>
