<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch, toRaw, computed } from "vue";
import type { PreviewFile } from "../../../../shared/contracts";
import type { Printer } from "../../../../shared/printing";
import PageDimensions from "./PageDimensions.vue";
import PaperPreview from "./PaperPreview.vue";
import PrintOptions from "./PrintOptions.vue";
import { usePrintQueue } from "./usePrintQueue";
import { printError } from "./errorMessage";

const {
  files,
  deviceName,
  busy,
  stop,
  selectedCount,
  add,
  applyAll,
  move,
  start,
} = usePrintQueue();
let incomingCleanup: (() => void) | undefined;
let themeCleanup: (() => void) | undefined;
const pending: PreviewFile[] = [];
async function receive() {
  const incoming = await window.localPreview.printPanelFiles();
  if (busy.value) pending.push(...incoming);
  else add(incoming);
}
watch(busy, (value) => {
  window.localPreview.printPanelBusy(value);
  if (!value && pending.length) add(pending.splice(0));
});
async function preview(file: PreviewFile) {
  try {
    await window.localPreview.previewPrintFile(toRaw(file));
  } catch (e) {
    error.value = printError(e);
  }
}
function arrange() {
  void window.localPreview.arrangePrintWindows();
}
async function openQueue() {
  try {
    const msg = await window.localPreview.openPrintQueue();
    queueNote.value = msg;
  } catch (e) {
    error.value = printError(e);
  }
}
onBeforeUnmount(() => {
  incomingCleanup?.();
  themeCleanup?.();
});
async function dropFiles(event: DragEvent) {
  if (busy.value) return;
  try {
    if (event.dataTransfer?.files.length)
      add(
        await window.localPreview.dropPrintPdfs(
          Array.from(event.dataTransfer.files),
        ),
      );
    error.value = "";
  } catch (e) {
    error.value = printError(e);
  }
}
const printers = ref<Printer[]>([]),
  error = ref(""),
  queueNote = ref("");

/** Best-effort hints from driver strings; never blocks printing. */
const capabilities = computed(() => {
  const p = printers.value.find((x) => x.name === deviceName.value);
  const blob = `${p?.description || ""} ${p?.status || ""} ${p?.displayName || ""}`.toLowerCase();
  const hasDuplex =
    /duplex|双面|long.?edge|short.?edge/.test(blob) ||
    /pdf|virtual|虚拟/.test(p?.name?.toLowerCase() || "");
  const hasColor =
    !/mono|黑白|black.?only/.test(blob) &&
    (blob.includes("color") || /pdf|virtual|虚拟/.test(p?.name?.toLowerCase() || "") || !blob);
  return {
    duplex: hasDuplex,
    color: hasColor,
    note: !/duplex|双面/.test(blob)
      ? "驱动未声明双面，单面通常可用"
      : "驱动可能支持双面",
  };
});

onMounted(async () => {
  document.title = "打印设置";
  incomingCleanup = window.localPreview.onPrintIncoming(() => void receive());
  await receive();
  const apply = (s: import("../../../../shared/contracts").Settings) => {
    document.documentElement.dataset.theme =
      s.theme === "system"
        ? matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : s.theme;
  };
  apply(await window.localPreview.getSettings());
  themeCleanup = window.localPreview.onSettings(apply);
  try {
    printers.value = await window.localPreview.printers();
    deviceName.value = printers.value[0]?.name || "";
  } catch (e) {
    error.value = printError(e);
  }
});
async function choose() {
  try {
    add(await window.localPreview.selectPrintPdfs());
    error.value = "";
  } catch (e) {
    error.value = printError(e);
  }
}
const scaleLabel = (s?: string) =>
  ({ fit: "适合纸张", actual: "实际大小", shrink: "仅缩小" })[s || "fit"] ||
  "适合纸张";
const orderLabel = (o?: string) =>
  ({ reverse: "逆序", odd: "奇数页", even: "偶数页" })[o || "forward"] ||
  "顺序";
</script>
<template>
  <div class="print-workspace">
    <section
      @dragover.prevent
      @drop.prevent.stop="dropFiles"
      class="pdf-print-panel"
      role="dialog"
      aria-label="PDF 打印"
    >
      <header class="print-top">
        <div>
          <h2>打印</h2>
          <p class="print-sub">PDF · 图片 · DOCX · 按列表顺序提交到系统队列</p>
        </div>
        <div class="print-top-actions">
          <button type="button" @click="arrange">并排查看</button>
          <button type="button" class="open-print-queue" @click="openQueue">
            系统打印机/队列
          </button>
        </div>
      </header>

      <div class="print-printer-bar">
        <label class="batch-printer">
          <span>打印机</span>
          <select v-model="deviceName" :disabled="busy">
            <option
              v-for="printer in printers"
              :key="printer.name"
              :value="printer.name"
            >
              {{ printer.displayName
              }}{{ printer.status ? " · " + printer.status : "" }}
            </option>
          </select>
        </label>
        <div class="capability-chips" aria-label="打印机能力提示">
          <span class="chip" :class="{ on: capabilities.color }">彩色</span>
          <span class="chip" :class="{ on: capabilities.duplex }">双面</span>
          <span class="chip muted">{{ capabilities.note }}</span>
        </div>
      </div>

      <p v-if="!printers.length" class="print-empty-warn">
        未找到打印机，请先在 Windows 中添加打印机或使用“导出为 PDF”类虚拟打印机。
      </p>
      <p v-if="queueNote" class="queue-note" role="status">{{ queueNote }}</p>
      <p v-else class="queue-hint">
        选好纸张后点右下角「打印所选文件」。提交成功 ≠ 已出纸，可在「系统打印机/队列」查看。
      </p>

      <div v-if="!files.length" class="print-dropzone">
        <p>把 PDF / 图片 / DOCX 拖到这里</p>
        <button type="button" class="primary" @click="choose">添加文件</button>
      </div>

      <ol v-else class="print-files">
        <li
          v-for="(row, index) in files"
          :key="row.file.id"
          class="print-file-card"
        >
          <div class="print-file-heading">
            <input
              type="checkbox"
              class="print-selected"
              v-model="row.selected"
              :disabled="busy"
              :aria-label="'打印 ' + row.file.name"
            /><button
              class="preview-print-file"
              :title="row.file.name"
              @click="preview(row.file)"
            >
              {{ row.file.name }}</button
            ><span class="file-type-badge">{{ row.file.ext }}</span
            ><button :disabled="busy || index === 0" @click="move(index, -1)">
              ↑</button
            ><button
              :disabled="busy || index === files.length - 1"
              @click="move(index, 1)"
            >
              ↓</button
            ><button :disabled="busy" @click="files.splice(index, 1)">
              移除
            </button>
          </div>
          <div class="print-file-summary">
            <span class="summary-chip">{{ row.options.paper }}</span>
            <span class="summary-chip">{{
              row.options.landscape ? "横向" : "纵向"
            }}</span>
            <span class="summary-chip">{{ row.options.copies }} 份</span>
            <span class="summary-chip">{{
              row.options.range || "全部页"
            }}</span>
            <span class="summary-chip">{{ scaleLabel(row.options.scale) }}</span>
            <span
              v-if="row.options.pageOrder && row.options.pageOrder !== 'forward'"
              class="summary-chip"
              >{{ orderLabel(row.options.pageOrder) }}</span
            >
            <button
              class="toggle-print-options"
              :aria-expanded="row.expanded"
              @click="row.expanded = !row.expanded"
            >
              {{ row.expanded ? "收起设置" : "详细设置" }}
            </button>
          </div>
          <div class="print-file-body">
            <div class="print-side">
              <PaperPreview
                class="print-paper-preview"
                :file="row.file"
                :options="row.options"
              />
              <PageDimensions :file="row.file" :options="row.options" />
            </div>
            <div class="print-options-pane">
              <PrintOptions
                v-if="row.expanded"
                :model-value="row.options"
                :busy="busy"
              />
              <p v-else class="options-collapsed-hint">
                展开「详细设置」可改纸张、方向、份数、缩放、页序与页码。
              </p>
            </div>
          </div>
          <div class="print-file-bottom">
            <span class="print-status">{{ row.status }}</span
            ><button
              class="apply-print-all"
              :disabled="busy"
              @click="applyAll(row)"
            >
              应用到全部
            </button>
          </div>
        </li>
      </ol>

      <p v-if="error" role="alert">{{ error }}</p>
      <footer class="print-footer">
        <button type="button" :disabled="busy" @click="choose">添加文件</button>
        <button v-if="busy" type="button" @click="stop = true" :disabled="stop">
          {{ stop ? "将在当前任务后停止" : "停止后续任务" }}
        </button>
        <button
          v-else
          type="button"
          class="primary print-go"
          :disabled="!selectedCount || !deviceName"
          @click="start"
        >
          打印所选文件（{{ selectedCount }}）
        </button>
      </footer>
    </section>
  </div>
</template>
