<script setup lang="ts">
import { defineAsyncComponent, onMounted, onBeforeUnmount, ref, shallowRef } from 'vue'
import { fileSize, type PreviewFile } from './types'
const DocumentPreview = defineAsyncComponent(() => import('./components/DocumentPreview.vue'))
const SpreadsheetPreview = defineAsyncComponent(() => import('./components/SpreadsheetPreview.vue'))
const PresentationPreview = defineAsyncComponent(() => import('./components/PresentationPreview.vue'))
const PdfPreview = defineAsyncComponent(() => import('./components/PdfPreview.vue'))
const TextPreview = defineAsyncComponent(() => import('./components/TextPreview.vue'))
const ImagePreview = defineAsyncComponent(() => import('./components/ImagePreview.vue'))
const isPreview = new URLSearchParams(location.search).has('preview')
const file = shallowRef<PreviewFile>()
const error = ref('')
const actionError = ref('')
const dragging = ref(false)
let dragDepth = 0
const zoom = ref(100)
const ready = ref(false)
async function select() { try { actionError.value = ''; await window.localPreview.select() } catch (e) { actionError.value = String(e).replace(/^Error:.*?: /, '') } }
async function drop(event: DragEvent) {
  dragging.value = false; dragDepth = 0
  try { actionError.value = ''; await window.localPreview.drop(Array.from(event.dataTransfer?.files || [])) }
  catch (e) { actionError.value = String(e) }
}
function enter(event: DragEvent) { if (event.dataTransfer?.types.includes('Files')) { dragDepth++; dragging.value = true } }
function leave() { if (--dragDepth <= 0) { dragDepth = 0; dragging.value = false } }
function key(event: KeyboardEvent) { if (event.ctrlKey && event.key.toLowerCase() === 'o') { event.preventDefault(); void select() } }
onMounted(async () => {
  window.addEventListener('keydown', key)
  if (isPreview) {
    file.value = await window.localPreview.consume()
    if (!file.value) error.value = '此预览已释放。请重新选择文件。'
    else if (file.value.error) error.value = file.value.error
  }
})
onBeforeUnmount(() => window.removeEventListener('keydown', key))
function failed(message: string) { error.value = message; ready.value = true }
</script>
<template>
  <main @dragenter.prevent="enter" @dragleave.prevent="leave" @dragover.prevent @drop.prevent="drop">
    <header v-if="!isPreview"><div class="brand"><span class="logo">▤</span><div><h1>File Preview</h1><p>FILE PREVIEW</p></div></div><span class="privacy"><i></i> 离线 · 只读</span><button class="primary" @click="select">选择文件</button></header>
    <section v-if="!isPreview" class="welcome"><div class="eyebrow">只看文件，简单一点</div><h2>打开文件，<br>在独立窗口中预览。</h2><p>保留文档原有的文字、图片与排版。</p><button class="dropzone" @click="select"><span class="file-icon">↥</span><strong>拖拽文件到这里</strong><span>或点击选择文件 · Ctrl + O</span><small>支持多文件，每个文件在新窗口中打开</small></button><div class="formats"><span>▤ Word</span><span>▦ Excel</span><span>▧ PPT</span><span>▥ PDF</span><span>▣ 图片</span><span>≡ 文本</span></div></section>
    <template v-else>
      <section class="filebar"><span class="badge">{{ file?.ext.toUpperCase() || 'FILE' }}</span><div class="filename"><strong :title="file?.name">{{ file?.name || '正在打开…' }}</strong><small v-if="file">{{ fileSize(file.size) }} · 只读预览</small></div><label v-if="file && !error" class="zoom-label">缩放 <select v-model.number="zoom" aria-label="缩放"><option v-for="z in [50, 75, 100, 125, 150, 200]" :key="z" :value="z">{{ z }}%</option></select></label><button class="quiet" @click="select">打开其他文件</button></section>
      <div v-if="error" class="error" role="alert"><strong>暂时无法预览</strong><p>{{ error }}</p><button @click="select">选择其他文件</button></div>
      <template v-else-if="file">
        <div v-if="!ready" class="loading" role="status">正在解析文件…</div>
        <DocumentPreview v-if="['docx', 'doc'].includes(file.ext)" :file="file" :zoom="zoom" @ready="ready = true" @error="failed" />
        <SpreadsheetPreview v-else-if="['xlsx', 'xls', 'csv', 'tsv'].includes(file.ext)" :file="file" :zoom="zoom" @ready="ready = true" @error="failed" />
        <PresentationPreview v-else-if="['pptx', 'ppt'].includes(file.ext)" :file="file" :zoom="zoom" @ready="ready = true" @error="failed" />
        <PdfPreview v-else-if="file.ext === 'pdf'" :file="file" :zoom="zoom" @ready="ready = true" @error="failed" />
        <TextPreview v-else-if="['txt', 'text', 'json', 'md', 'log', 'xml'].includes(file.ext)" :file="file" :zoom="zoom" @ready="ready = true" @error="failed" />
        <ImagePreview v-else :file="file" :zoom="zoom" @ready="ready = true" @error="failed" />
      </template>
    </template>
    <div v-if="actionError" class="action-error" role="alert">{{ actionError }} <button @click="actionError = ''">关闭</button></div><div v-if="dragging" class="drag-overlay">松开鼠标，在新窗口中预览</div><div class="statusbar"><span>● 仅在本机处理 · 不保存文件和预览记录</span><span>{{ isPreview ? '关闭窗口即可释放预览' : '无需 Office · 无需联网' }}</span></div>
  </main>
</template>
