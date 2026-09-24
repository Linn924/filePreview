<script setup lang="ts">
import type {PdfTemporaryMark} from '../../../shared/contracts';
defineProps<{notes:PdfTemporaryMark[]}>();
const emit=defineEmits<{jump:[page:number];remove:[id:string]}>();
</script>
<template><aside class="pdf-notes" aria-label="本次批注"><h3>本次批注 <span>{{notes.length}}</span></h3><p v-if="!notes.length" class="pdf-notes-empty">先选中文字，再点“高亮”或“写备注”。关闭文件后批注会清空。</p><article v-for="mark in notes" :key="mark.id" class="pdf-note"><div class="pdf-note-head"><button type="button" @click="emit('jump',mark.page)">第 {{mark.page}} 页 · {{mark.kind==='note'?'备注':'高亮'}}</button><button type="button" :aria-label="'删除第 '+mark.page+' 页批注'" @click="emit('remove',mark.id)">删除</button></div><p :title="mark.quote">{{mark.quote}}</p><textarea v-if="mark.kind==='note'" v-model="mark.content" aria-label="批注内容" placeholder="写下备注（仅保存在本次预览）"></textarea></article></aside></template>
