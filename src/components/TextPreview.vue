<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import type { PreviewFile } from '../types'
const props = defineProps<{ file: PreviewFile; zoom: number }>()
const emit = defineEmits<{ ready: []; error: [message: string] }>()
const bytes = props.file.bytes
const encoding = ref(bytes[0] === 255 && bytes[1] === 254 ? 'utf-16le' : bytes[0] === 254 && bytes[1] === 255 ? 'utf-16be' : 'utf-8')
try { if (encoding.value === 'utf-8') new TextDecoder('utf-8', { fatal: true }).decode(bytes) } catch { encoding.value = 'gb18030' }
const raw = computed(() => new TextDecoder(encoding.value).decode(bytes))
const pretty = computed(() => { if (props.file.ext === 'json') { try { return JSON.stringify(JSON.parse(raw.value), null, 2) } catch { return raw.value } } return raw.value })
const invalidJson = computed(() => { if (props.file.ext !== 'json') return false; try { JSON.parse(raw.value); return false } catch { return true } })
const html = computed(() => props.file.ext === 'md' ? DOMPurify.sanitize(marked.parse(raw.value, { async: false }), { FORBID_TAGS: ['iframe', 'object', 'embed', 'form', 'input', 'button', 'style'], FORBID_ATTR: ['srcset'] }) : '')
onMounted(() => emit('ready'))
</script>
<template><section class="text"><div class="text-tools"><label>文本编码 <select v-model="encoding"><option value="utf-8">UTF-8</option><option value="gb18030">GB18030 / GBK</option><option value="utf-16le">UTF-16 LE</option><option value="utf-16be">UTF-16 BE</option></select></label><span>{{ raw.length.toLocaleString() }} 字符</span></div><div v-if="invalidJson" class="notice">JSON 格式不完整，按原始文本显示。</div><div class="text-scroll"><article v-if="file.ext === 'md'" class="markdown" :style="{ fontSize: 15 * zoom / 100 + 'px' }" @click.prevent v-html="html"></article><pre v-else :style="{ fontSize: 14 * zoom / 100 + 'px' }">{{ pretty || '（空文件）' }}</pre></div></section></template>
