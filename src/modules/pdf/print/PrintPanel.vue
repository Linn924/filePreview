<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch, toRaw } from "vue";
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
onMounted(async () => {
  document.title = "PDF 打印设置";
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
      <header>
        <h2>PDF 批量打印</h2>
        <span
          ><button @click="arrange">并排查看</button
          ><button class="open-print-queue" @click="openQueue">
            系统打印机/队列
          </button></span
        >
      </header>
      <label class="batch-printer"
        >打印机<select v-model="deviceName" :disabled="busy">
          <option
            v-for="printer in printers"
            :key="printer.name"
            :value="printer.name"
          >
            {{ printer.displayName
            }}{{ printer.status ? " · " + printer.status : "" }}
          </option>
        </select></label
      >
      <p>拖入 PDF 或点击“添加 PDF”；在每个文件下设置参数并勾选打印。</p>
      <p v-if="!printers.length">未找到打印机，请先在 Windows 中配置打印机。</p>
      <p v-if="queueNote" class="queue-note" role="status">{{ queueNote }}</p>
      <p v-else class="queue-hint">
        提交成功仅表示进入系统打印队列，是否出纸请打开「系统打印机/队列」查看。
        纸张、双面、彩色等能力取决于打印机驱动，本软件无法保证全部支持。
      </p>
      <ol class="print-files">
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
            {{ row.options.paper }} ·
            {{ row.options.landscape ? "横向" : "纵向" }} ·
            {{ row.options.copies }} 份 · {{ row.options.range || "全部页"
            }}<template v-if="row.options.scale">
              · {{ { fit: "适合纸张", actual: "实际大小", shrink: "仅缩小" }[row.options.scale] }}</template
            ><template v-if="row.options.pageOrder && row.options.pageOrder !== 'forward'">
              ·
              {{ { reverse: "逆序", odd: "奇数页", even: "偶数页" }[row.options.pageOrder] }}</template
            ><button
              class="toggle-print-options"
              :aria-expanded="row.expanded"
              @click="row.expanded = !row.expanded"
            >
              {{ row.expanded ? "收起设置" : "展开设置" }}
            </button>
          </div>
          <PageDimensions
            :file="row.file"
            :options="row.options"
          /><PaperPreview
            class="print-paper-preview"
            :file="row.file"
            :options="row.options"
          /><PrintOptions
            v-if="row.expanded"
            :model-value="row.options"
            :busy="busy"
          />
          <div class="print-file-bottom">
            <span class="print-status">{{ row.status }}</span
            ><button
              class="apply-print-all"
              :disabled="busy"
              @click="applyAll(row)"
            >
              将此设置应用到全部
            </button>
          </div>
        </li>
      </ol>
      <p v-if="error" role="alert">{{ error }}</p>
      <p class="print-note">
        按列表顺序使用每个文件自己的设置。“已提交”表示交给系统队列；停止后续任务不会取消已提交的任务。
      </p>
      <footer>
        <button :disabled="busy" @click="choose">添加 PDF</button
        ><button v-if="busy" @click="stop = true" :disabled="stop">
          {{ stop ? "将在当前任务后停止" : "停止后续任务" }}</button
        ><button
          v-else
          class="primary"
          :disabled="!selectedCount || !deviceName"
          @click="start"
        >
          打印所选文件（{{ selectedCount }}）
        </button>
      </footer>
    </section>
  </div>
</template>
