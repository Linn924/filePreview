<script setup lang="ts">
import { printError } from "./errorMessage";
import { onMounted, ref, toRaw } from "vue";
import type { PreviewFile } from "../../../../shared/contracts";
import {
  printDefaults,
  type Printer,
  type PdfPrintOptions,
} from "../../../../shared/printing";
const props = defineProps<{ file: PreviewFile }>();
const emit = defineEmits<{ close: [] }>();
const printers = ref<Printer[]>([]),
  options = ref<PdfPrintOptions>({ ...printDefaults }),
  error = ref(""),
  busy = ref(false),
  stop = ref(false);
const files = ref<Array<{ file: PreviewFile; status: string }>>([
  { file: props.file, status: "等待" },
]);
onMounted(async () => {
  try {
    printers.value = await window.localPreview.printers();
    options.value.deviceName =
      (printers.value.find((p) => p.isDefault) || printers.value[0])?.name ||
      "";
  } catch (e) {
    error.value = printError(e);
  }
});
async function add() {
  try {
    const extra = await window.localPreview.selectPrintPdfs();
    if (files.value.length + extra.length > 12)
      throw Error("一批最多 12 个 PDF。");
    files.value.push(
      ...extra.map((file) => ({ file, status: file.error || "等待" })),
    );
  } catch (e) {
    error.value = printError(e);
  }
}
function move(index: number, offset: number) {
  const next = index + offset;
  if (next < 0 || next >= files.value.length) return;
  const list = files.value;
  [list[index], list[next]] = [list[next], list[index]];
}
async function start() {
  busy.value = true;
  stop.value = false;
  error.value = "";
  for (const row of files.value) row.status = "等待";
  try {
    for (const row of files.value) {
      if (stop.value) {
        row.status = "未提交";
        continue;
      }
      if (row.file.error) {
        row.status = "失败：" + row.file.error;
        continue;
      }
      row.status = "正在准备并提交";
      try {
        await window.localPreview.printPdf({
          file: toRaw(row.file),
          options: { ...toRaw(options.value) },
        });
        row.status = "已提交到打印队列";
      } catch (e) {
        row.status = "失败：" + printError(e);
      }
    }
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <Teleport to="body"
    ><div class="modal-backdrop pdf-print-backdrop">
      <section class="pdf-print-panel" role="dialog" aria-label="PDF 打印">
        <header>
          <h2>PDF 打印</h2>
          <button :disabled="busy" aria-label="关闭打印" @click="emit('close')">
            ×
          </button>
        </header>
        <p>选择纸张和方向后，页面会保持比例缩放到纸张内。</p>
        <div class="print-options">
          <label
            >打印机<select v-model="options.deviceName" :disabled="busy">
              <option
                v-for="printer in printers"
                :key="printer.name"
                :value="printer.name"
              >
                {{ printer.displayName }}
              </option>
            </select></label
          ><label
            >纸张<select
              v-model="options.paper"
              aria-label="打印纸张"
              :disabled="busy"
            >
              <option
                v-for="size in ['A3', 'A4', 'A5', 'A6', 'Letter', 'Legal']"
                :key="size"
              >
                {{ size }}
              </option>
            </select></label
          ><label
            >方向<select v-model="options.landscape" :disabled="busy">
              <option :value="false">纵向</option>
              <option :value="true">横向</option>
            </select></label
          ><label
            >份数<input
              v-model.number="options.copies"
              type="number"
              min="1"
              max="99"
              :disabled="busy" /></label
          ><label
            >单双面<select v-model="options.duplex" :disabled="busy">
              <option value="simplex">单面</option>
              <option value="longEdge">双面（长边翻转）</option>
              <option value="shortEdge">双面（短边翻转）</option>
            </select></label
          ><label
            >颜色<select v-model="options.color" :disabled="busy">
              <option :value="true">彩色</option>
              <option :value="false">黑白</option>
            </select></label
          ><label class="print-range"
            >页码范围<input
              v-model="options.range"
              placeholder="留空打印全部，例如 1-3,5"
              :disabled="busy"
            /><small
              >分别应用于每个 PDF；超出页数的文件会显示失败。</small
            ></label
          >
        </div>
        <p v-if="!printers.length">
          未找到打印机，请先在 Windows 中配置打印机。
        </p>
        <ol class="print-files">
          <li v-for="(row, index) in files" :key="row.file.id">
            <span :title="row.file.name"
              >{{ row.file.name }}<small>{{ row.status }}</small></span
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
          </li>
        </ol>
        <p v-if="error" role="alert">{{ error }}</p>
        <p class="print-note">
          “已提交”表示交给系统打印队列，不代表纸张已打印完成。停止后续任务不会取消已提交的任务。
        </p>
        <footer>
          <button :disabled="busy" @click="add">添加 PDF</button
          ><button v-if="busy" @click="stop = true" :disabled="stop">
            {{ stop ? "将在当前任务后停止" : "停止后续任务" }}</button
          ><button
            v-else
            class="primary"
            :disabled="!files.length || !options.deviceName"
            @click="start"
          >
            开始打印（{{ files.length }} 个文件）
          </button>
        </footer>
      </section>
    </div></Teleport
  >
</template>
