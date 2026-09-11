<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import DOMPurify from 'dompurify'
import type { PreviewFile } from '../types'
const props = defineProps<{ file: PreviewFile; zoom: number }>()
const emit = defineEmits<{ ready: []; error: [message: string] }>()
const types: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', svg: 'image/svg+xml', png: 'image/png', webp: 'image/webp', gif: 'image/gif', bmp: 'image/bmp' }
const bytes = props.file.bytes.slice().buffer
const data = props.file.ext === 'svg' ? DOMPurify.sanitize(new TextDecoder().decode(bytes), { USE_PROFILES: { svg: true, svgFilters: true } }) : bytes
const url = URL.createObjectURL(new Blob([data], { type: types[props.file.ext] }))
const dimensions = ref('')
function loaded(event: Event) { const img = event.target as HTMLImageElement; dimensions.value = `${img.naturalWidth} × ${img.naturalHeight}`; emit('ready') }
const style = computed(() => props.zoom === 100 ? { maxWidth: '100%', maxHeight: '100%' } : { maxWidth: 'none', maxHeight: 'none', zoom: props.zoom / 100 })
onBeforeUnmount(() => URL.revokeObjectURL(url))
</script>
<template><section class="image-pane"><div class="image"><img :src="url" :alt="file.name" :style="style" @load="loaded" @error="emit('error', '无法解码图片，文件可能损坏或格式不受支持。')"></div><div class="pane-footer">{{ dimensions }} <span>100% 时适配窗口</span></div></section></template>
