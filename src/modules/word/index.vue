<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'
import type { PreviewFile } from '../../types'
const props = defineProps<{ file: PreviewFile; zoom: number }>()
const emit = defineEmits<{ ready: []; error: [message: string] }>()
const host = ref<HTMLElement>()
const warning = ref('')
let destroyed = false
onMounted(async () => {
  try {
    const shadow = host.value!.attachShadow({ mode: 'open' })
    const body = document.createElement('div')
    shadow.append(body)
    body.addEventListener('click', e => { if ((e.target as HTMLElement).closest('a')) e.preventDefault() })
    if (props.file.ext === 'docx') {
      const { renderAsync } = await import('docx-preview')
      if (destroyed) return
      await renderAsync(props.file.bytes, body, body, { useBase64URL: true, renderAltChunks: false, breakPages: true, renderHeaders: true, renderFooters: true, renderFootnotes: true, renderEndnotes: true, ignoreLastRenderedPageBreak: false })
    } else {
      const { parseMsDocToHtml, mountMsDoc } = await import('@file-viewer/doc')
      const rendered = await parseMsDocToHtml(props.file.bytes, { renderOptions: { externalLinkPolicy: 'block', externalResourcePolicy: 'block' } })
      if (destroyed) return
      mountMsDoc(body, rendered)
      if (rendered.warnings.length) warning.value = '部分旧版 Word 元素无法完整还原，已显示可解析的内容。'
    }
    if (!destroyed) emit('ready')
  } catch (e) { if (!destroyed) emit('error', '无法解析 Word 文件，文件可能损坏、加密或不兼容。' + (e instanceof Error ? ` ${e.message}` : '')) }
})
onBeforeUnmount(() => { destroyed = true; host.value?.shadowRoot?.replaceChildren() })
</script>
<template><section class="document-pane"><div v-if="warning" class="notice">{{ warning }}</div><div class="document-scroll"><div ref="host" class="word-host" :style="{ zoom: zoom / 100 }"></div></div></section></template>
