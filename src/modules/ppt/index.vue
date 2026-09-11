<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import type { PptxViewer } from '@aiden0z/pptx-renderer'
import type { Presentation } from '@web-ppt/core'
import DOMPurify from 'dompurify'
import type { PreviewFile } from '../../types'
const props = defineProps<{ file: PreviewFile; zoom: number }>()
const emit = defineEmits<{ ready: []; error: [message: string] }>()
const host = ref<HTMLElement>()
const current = ref(0)
const count = ref(0)
const busy = ref(false)
let viewer: PptxViewer | undefined
let legacy: Presentation | undefined
let renderLegacy: typeof import('@web-ppt/core').renderSlideToSvg
let disposed = false
let observer: ResizeObserver | undefined
function fit() {
  if (!host.value || (!viewer && !legacy)) return
  const container = host.value.parentElement!
  const availableWidth = container.clientWidth - 48
  const availableHeight = container.clientHeight - 48
  const width = viewer?.slideWidth || legacy!.width
  const height = viewer?.slideHeight || legacy!.height
  host.value.style.width = Math.max(200, Math.min(availableWidth, availableHeight * width / height)) + 'px'
}
async function render() {
  if (disposed || !host.value) return
  busy.value = true
  try {
    if (viewer) { await viewer.goToSlide(current.value); await viewer.setZoom(props.zoom) }
    else if (legacy) {
      // Only static content; strip active/interactive elements from imported slides.
      host.value.innerHTML = DOMPurify.sanitize(renderLegacy(legacy, legacy.slides[current.value], { media: 'badge', textMode: 'svg' }), { USE_PROFILES: { svg: true, svgFilters: true }, FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'audio', 'video'] })
      const svg = host.value.querySelector('svg')
      if (svg) { svg.style.width = props.zoom + '%'; svg.style.height = 'auto'; svg.style.display = 'block' }
    }
  } catch (e) { emit('error', '无法绘制幻灯片：' + String(e)) }
  finally { busy.value = false }
}
onMounted(async () => {
  try {
    host.value!.addEventListener('click', event => { if ((event.target as Element).closest('a')) event.preventDefault() })
    if (props.file.ext === 'pptx') {
      const { PptxViewer, RECOMMENDED_ZIP_LIMITS } = await import('@aiden0z/pptx-renderer')
      if (disposed) return
      viewer = await PptxViewer.open(props.file.bytes.slice().buffer, host.value!, { renderMode: 'slide', fitMode: 'contain', zipLimits: RECOMMENDED_ZIP_LIMITS, lazySlides: true, lazyMedia: true, pdfjs: false })
      count.value = viewer.slideCount
      fit()
      observer = new ResizeObserver(() => fit())
      observer.observe(host.value!.parentElement!)
    } else {
      const engine = await import('@web-ppt/core')
      renderLegacy = engine.renderSlideToSvg
      legacy = await engine.parse(props.file.bytes)
      count.value = legacy.slides.length
      fit()
      observer = new ResizeObserver(() => fit())
      observer.observe(host.value!.parentElement!)
      await render()
    }
    if (!count.value) throw new Error('文稿中没有可显示的幻灯片。')
    if (!disposed) emit('ready')
  } catch (e) { if (!disposed) emit('error', '无法解析演示文稿，文件可能损坏、加密或不兼容。' + (e instanceof Error ? ` ${e.message}` : '')) }
})
watch([current, () => props.zoom], () => void render())
onBeforeUnmount(() => { disposed = true; observer?.disconnect(); viewer?.destroy(); legacy?.dispose?.() })
</script>
<template><section class="presentation-pane"><div class="slide-scroll"><div ref="host" class="slide-host"></div></div><footer class="page-nav"><span>{{ busy ? '正在绘制…' : '幻灯片预览' }}</span><div><button :disabled="current <= 0 || busy" @click="current--">上一页</button><span>{{ current + 1 }} / {{ count }}</span><button :disabled="current + 1 >= count || busy" @click="current++">下一页</button></div></footer></section></template>
