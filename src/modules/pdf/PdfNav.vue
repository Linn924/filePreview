<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
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
const thumbHost = ref<HTMLElement>();
const painted = new Set<number>();
let renderToken = 0;

async function loadOutline() {
  outline.value = [];
  if (!props.pdf) return;
  try {
    const items = await props.pdf.getOutline();
    if (!items?.length) return;
    const dests = (await props.pdf.getDestinations()) as
      | Map<string, unknown>
      | Record<string, unknown>;
    const destOf = (name: string) =>
      dests instanceof Map ? dests.get(name) : (dests as Record<string, unknown>)[name];
    const walk = async (
      list: typeof items,
      depth: number,
    ): Promise<void> => {
      for (const item of list) {
        let page = 0;
        try {
          const dest =
            typeof item.dest === "string" ? destOf(item.dest) : item.dest;
          if (Array.isArray(dest) && dest[0] != null) {
            const refObj = dest[0];
            page =
              typeof refObj === "number"
                ? refObj + 1
                : (await props.pdf!.getPageIndex(refObj as never)) + 1;
          }
        } catch {
          page = 0;
        }
        outline.value.push({ title: item.title || "未命名", page, depth });
        if (item.items?.length) await walk(item.items, depth + 1);
      }
    };
    await walk(items, 0);
  } catch {
    outline.value = [];
  }
}

async function loadThumbs() {
  thumbs.value = [];
  painted.clear();
  if (!props.pdf) return;
  const max = Math.min(props.pdf.numPages, 40);
  for (let n = 1; n <= max; n++) {
    const page = await props.pdf.getPage(n);
    const v = page.getViewport({ scale: 1 });
    const w = 112;
    const h = Math.round((v.height / v.width) * w) || 140;
    thumbs.value.push({ page: n, width: w, height: h });
    page.cleanup();
  }
}

async function paintVisibleThumbs() {
  if (tab.value !== "thumbs" || !props.pdf || !thumbHost.value) return;
  const token = ++renderToken;
  const host = thumbHost.value;
  const nodes = Array.from(host.querySelectorAll<HTMLElement>(".thumb"));
  for (const node of nodes) {
    if (token !== renderToken) return;
    const page = Number(node.dataset.page);
    if (!page || painted.has(page)) continue;
    const canvas = node.querySelector("canvas");
    if (!canvas) continue;
    const rect = node.getBoundingClientRect();
    // Skip far-offscreen thumbs to keep panel responsive.
    if (
      rect.bottom < host.getBoundingClientRect().top - 400 ||
      rect.top > host.getBoundingClientRect().bottom + 400
    )
      continue;
    try {
      const pdfPage = await props.pdf.getPage(page);
      const base = pdfPage.getViewport({ scale: 1 });
      const scale = (canvas.clientWidth || node.clientWidth || 112) / base.width;
      const viewport = pdfPage.getViewport({
        scale: scale * Math.min(devicePixelRatio, 2),
      });
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await pdfPage.render({ canvas, viewport }).promise;
      painted.add(page);
      node.classList.add("thumb-painted");
      pdfPage.cleanup();
    } catch {
      /* keep placeholder */
    }
  }
}

watch(tab, async (value) => {
  if (value !== "thumbs") return;
  await nextTick();
  void paintVisibleThumbs();
});
watch(thumbs, async () => {
  await nextTick();
  void paintVisibleThumbs();
});
onMounted(async () => {
  await loadOutline();
  await loadThumbs();
});
const hasOutline = computed(() => outline.value.length > 0);
</script>
<template>
  <aside class="pdf-nav" aria-label="PDF 导航">
    <div class="pdf-nav-tabs" role="tablist">
      <button
        type="button"
        role="tab"
        class="pdf-nav-tab"
        :class="{ active: tab === 'outline' }"
        :aria-selected="tab === 'outline'"
        @click="tab = 'outline'"
      >
        目录</button
      ><button
        type="button"
        role="tab"
        class="pdf-nav-tab"
        :class="{ active: tab === 'thumbs' }"
        :aria-selected="tab === 'thumbs'"
        @click="tab = 'thumbs'"
      >
        缩略图
      </button>
    </div>
    <div
      v-if="tab === 'outline'"
      class="pdf-outline"
      role="tabpanel"
      aria-label="目录"
    >
      <p v-if="!hasOutline" class="pdf-nav-empty">本文档没有目录/书签</p>
      <button
        v-for="(item, i) in outline"
        :key="i"
        type="button"
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
    <div
      v-else
      ref="thumbHost"
      class="pdf-thumbs"
      role="tabpanel"
      aria-label="缩略图"
      @scroll.passive="void paintVisibleThumbs()"
    >
      <div
        v-for="t in thumbs"
        :key="t.page"
        class="thumb"
        :data-page="t.page"
        :class="{ current: t.page === current }"
        role="button"
        tabindex="0"
        :aria-label="'第 ' + t.page + ' 页缩略图'"
        @click="emit('jump', t.page)"
        @keydown.enter="emit('jump', t.page)"
      >
        <canvas :style="{ width: t.width + 'px', height: t.height + 'px' }"></canvas>
        <span>{{ t.page }}</span>
      </div>
    </div>
  </aside>
</template>
