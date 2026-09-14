<script setup lang="ts">
import { onMounted, onBeforeUnmount, provide, ref, shallowRef, nextTick } from "vue";
import { useImmersive } from "./composables/useImmersive";
import PreviewTab from "./components/PreviewTab.vue";
import SettingsPanel from "./components/SettingsPanel.vue";
import { defaults, type Settings, type PreviewFile } from "../shared/contracts";
const isPreview = new URLSearchParams(location.search).has("preview");
const immersive = useImmersive(isPreview);
const files = shallowRef<PreviewFile[]>([]);
const active = ref("");
const settings = ref<Settings>({ ...defaults });
const showSettings = ref(false);
const error = ref("");
const dragging = ref(false);
let dragDepth = 0;
let draggedTab = "";
const tabMime = "application/x-file-preview-tab";
const cleanups: Array<() => void> = [];
provide("previewFiles", files);
function startDrag(event: DragEvent, id: string) {
  draggedTab = id;
  event.dataTransfer?.setData(tabMime, id);
  if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
}
async function dropTab(event: DragEvent, before?: string) {
  const id = event.dataTransfer?.getData(tabMime) || draggedTab;
  if (!id) return false;
  if (files.value.some((f) => f.id === id)) {
    draggedTab = id;
    if (before) reorder(before);
    return true;
  }
  if (!isPreview) return true;
  try {
    const file = await window.localPreview.claim(id);
    files.value = [...files.value, file];
    active.value = id;
    await nextTick();
    try {
      await window.localPreview.accept(id);
    } catch (e) {
      files.value = files.value.filter((f) => f.id !== id);
      active.value = files.value[0]?.id || "";
      throw e;
    }
  } catch (e) {
    error.value = String(e);
  }
  return true;
}
let unsubscribe: (() => void) | undefined;
const media = matchMedia("(prefers-color-scheme: dark)");
function applyTheme() {
  document.documentElement.dataset.theme =
    settings.value.theme === "system"
      ? media.matches
        ? "dark"
        : "light"
      : settings.value.theme;
}
async function select() {
  try {
    error.value = "";
    await window.localPreview.select();
  } catch (e) {
    error.value = String(e);
  }
}
async function drop(event: DragEvent) {
  dragging.value = false;
  dragDepth = 0;
  try {
    if (await dropTab(event)) return;
    if (event.dataTransfer?.files.length)
      await window.localPreview.drop(Array.from(event.dataTransfer.files));
  } catch (e) {
    error.value = String(e);
  }
}
function enter(event: DragEvent) {
  if (event.dataTransfer?.types.includes("Files")) {
    dragDepth++;
    dragging.value = true;
  }
}
function leave() {
  if (--dragDepth <= 0) {
    dragDepth = 0;
    dragging.value = false;
  }
}
function closeTab(id: string) {
  window.localPreview.release(id);
  const index = files.value.findIndex((f) => f.id === id);
  files.value = files.value.filter((f) => f.id !== id);
  if (active.value === id)
    active.value =
      files.value[Math.min(index, files.value.length - 1)]?.id || "";
  if (!files.value.length) window.localPreview.close();
}
function reorder(id: string) {
  if (!draggedTab || draggedTab === id) return;
  const list = [...files.value];
  const from = list.findIndex((f) => f.id === draggedTab),
    to = list.findIndex((f) => f.id === id);
  if (from < 0 || to < 0) return;
  list.splice(to, 0, list.splice(from, 1)[0]);
  files.value = list;
  draggedTab = "";
}
async function save(value: Partial<Settings>) {
  try {
    settings.value = await window.localPreview.setSettings(value);
    applyTheme();
  } catch {
    error.value = "设置保存失败，请稍后重试。";
  }
}
function key(event: KeyboardEvent) {
  if (event.ctrlKey && event.key.toLowerCase() === "o") {
    event.preventDefault();
    void select();
  }
  if (event.key === "Escape") showSettings.value = false;
}
onMounted(async () => {
  window.addEventListener("keydown", key);
  media.addEventListener("change", applyTheme);
  settings.value = await window.localPreview.getSettings();
  applyTheme();
  unsubscribe = window.localPreview.onSettings((value) => {
    settings.value = value;
    applyTheme();
  });
  cleanups.push(window.localPreview.onRemove(closeTab));
  cleanups.push(window.localPreview.onPreviewPrintFile(file=>{if(!files.value.some(f=>f.id===file.id))files.value=[...files.value,file];active.value=file.id;}));
  cleanups.push(
    window.localPreview.onExport((id) => {
      const file = files.value.find((f) => f.id === id);
      if (!file) return;
      const tab = document.querySelector(`[data-file-id="${id}"]`);
      const zoom =
        Number(
          tab?.querySelector<HTMLInputElement>(".zoom-control input")?.value,
        ) || 100;
      const scroll = Array.from(
        tab?.querySelectorAll<HTMLElement>(
          ".pdf-scroll,.slide-scroll,.document-scroll,.table-wrap,.text-scroll,.image",
        ) || [],
      ).map((el) => ({ top: el.scrollTop, left: el.scrollLeft }));
      window.localPreview.supply({ ...file, view: { ...file.view, zoom, scroll } });
    }),
  );
  if (isPreview) {
    files.value = await window.localPreview.consume();
    active.value = files.value[0]?.id || "";
    if (!files.value.length) error.value = "预览已释放，请重新打开文件。";
  }
});
onBeforeUnmount(() => {
  window.removeEventListener("keydown", key);
  media.removeEventListener("change", applyTheme);
  unsubscribe?.();
  cleanups.forEach((fn) => fn());
});
</script>
<template>
  <main
    @dragenter.prevent="enter"
    @dragleave.prevent="leave"
    @dragover.prevent
    @drop.prevent="drop"
  >
    <header class="app-header">
      <button
        class="settings-button"
        aria-label="设置"
        @click="showSettings = true"
      >
        ⚙
      </button>
    </header>
    <section v-if="!isPreview" class="welcome">
      <button class="dropzone" @click="select">
        <span class="file-icon">↥</span><strong>拖入文件或点击打开</strong>
      </button>
      <div class="formats">
        <span>Word</span><span>Excel</span><span>PowerPoint</span
        ><span>PDF</span><span>图片</span><span>文本</span>
      </div>
    </section>
    <template v-else
      ><nav v-if="files.length" class="tabs" aria-label="文件标签">
        <div
          v-for="file in files"
          :key="file.id"
          class="tab"
          :class="{ active: file.id === active }"
          draggable="true"
          @dragstart="startDrag($event, file.id)"
          @dragend="draggedTab = ''"
          @dragover.prevent
          @drop.stop.prevent="dropTab($event, file.id)"
        >
          <button :title="file.name" @click="active = file.id">
            {{ file.name }}</button
          ><button
            class="tab-close"
            :aria-label="'关闭 ' + file.name"
            @click="closeTab(file.id)"
          >
            ×
          </button>
        </div>
      </nav>
      <PreviewTab
        v-for="file in files"
        v-show="file.id === active"
        :key="file.id"
        :file="file"
        :initial-zoom="settings.defaultZoom"
        :immersive="immersive"
    /></template>
    <div v-if="error" class="action-error" role="alert">
      {{ error }}<button @click="error = ''">关闭</button>
    </div>
    <div v-if="dragging" class="drag-overlay">松开鼠标，打开文件</div>
    <SettingsPanel
      v-if="showSettings"
      :settings="settings"
      @close="showSettings = false"
      @change="save"
    />
  </main>
</template>
