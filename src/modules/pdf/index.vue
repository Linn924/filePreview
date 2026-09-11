<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy, type RenderTask } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { PreviewFile } from '../../types'
GlobalWorkerOptions.workerSrc = workerUrl
const props = defineProps<{ file: PreviewFile; zoom: number }>()
const emit = defineEmits<{ ready: []; error: [message: string] }>()
const canvas = ref<HTMLCanvasElement>()
const scroll = ref<HTMLElement>()
const current = ref(1)
const pages = ref(0)
const rendering = ref(false)
let pdf: PDFDocumentProxy | undefined
let task: RenderTask | undefined
let revision = 0
let disposed = false
let observer: ResizeObserver | undefined
let timer: ReturnType<typeof setTimeout>
const base = new URL('./pdf-assets/', location.href).href
const load = getDocument({ data: props.file.bytes.slice(), cMapUrl: base + 'cmaps/', cMapPacked: true, standardFontDataUrl: base + 'standard_fonts/', wasmUrl: base + 'wasm/', useSystemFonts: true })
async function render() {
  if (!pdf || !canvas.value || disposed) return
  const token = ++revision
  task?.cancel()
  rendering.value = true
  try {
    const page = await pdf.getPage(current.value)
    if (token !== revision || disposed) return
    const original = page.getViewport({ scale: 1 })
    const available = Math.max(200, (scroll.value?.clientWidth || 850) - 60)
    const scale = Math.min(available / original.width, 1.5) * props.zoom / 100
    const ratio = Math.min(devicePixelRatio, 2)
    const viewport = page.getViewport({ scale: scale * ratio })
    canvas.value.width = Math.ceil(viewport.width); canvas.value.height = Math.ceil(viewport.height)
    canvas.value.style.width = viewport.width / ratio + 'px'; canvas.value.style.height = viewport.height / ratio + 'px'
    task = page.render({ canvas: canvas.value, viewport })
    await task.promise
    if (token === revision && !disposed) { emit('ready'); rendering.value = false }
  } catch (e) { if (token === revision && !disposed && !(e instanceof Error && e.name === 'RenderingCancelledException')) emit('error', 'PDF 页面无法显示。' + String(e)) }
}
onMounted(async () => {
  try { pdf = await load.promise; pages.value = pdf.numPages; await render(); observer = new ResizeObserver(() => { clearTimeout(timer); timer = setTimeout(() => void render(), 120) }); observer.observe(scroll.value!) }
  catch (e) { if (!disposed) emit('error', e instanceof Error && e.name === 'PasswordException' ? '此 PDF 已加密，当前版本不支持加密文件。' : '无法打开 PDF，文件可能损坏。') }
})
watch([current, () => props.zoom], () => { if (scroll.value) scroll.value.scrollTop = 0; void render() })
onBeforeUnmount(() => { disposed = true; revision++; clearTimeout(timer); observer?.disconnect(); task?.cancel(); void load.destroy() })
</script>
<template><section class="pdf-pane"><div ref="scroll" class="pdf-scroll"><canvas ref="canvas" aria-label="PDF 页面"></canvas></div><footer class="page-nav"><span>{{ rendering ? '正在绘制…' : 'PDF 预览' }}</span><div><button :disabled="current <= 1" @click="current--">上一页</button><label><input v-model.number.lazy="current" type="number" min="1" :max="pages" aria-label="页码" @change="current = Math.max(1, Math.min(pages, Math.floor(current) || 1))"> / {{ pages }}</label><button :disabled="current >= pages" @click="current++">下一页</button></div></footer></section></template>
