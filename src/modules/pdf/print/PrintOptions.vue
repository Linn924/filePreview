<script setup lang="ts">
import type { PdfPrintOptions } from "../../../../shared/printing";
defineProps<{ modelValue: PdfPrintOptions; busy: boolean }>();
</script>
<template>
  <div class="print-options">
    <label
      >纸张<select
        v-model="modelValue.paper"
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
      >方向<select v-model="modelValue.landscape" :disabled="busy">
        <option :value="false">纵向</option>
        <option :value="true">横向</option>
      </select></label
    ><label
      >份数<input
        v-model.number="modelValue.copies"
        type="number"
        min="1"
        max="99"
        :disabled="busy" /></label
    ><label
      >单双面<select v-model="modelValue.duplex" :disabled="busy">
        <option value="simplex">单面</option>
        <option value="longEdge">双面（长边翻转）</option>
        <option value="shortEdge">双面（短边翻转）</option>
      </select></label
    ><label
      >颜色<select v-model="modelValue.color" :disabled="busy">
        <option :value="true">彩色</option>
        <option :value="false">黑白</option>
      </select></label
    ><label class="print-range"
      >页码范围<input
        v-model="modelValue.range"
        placeholder="留空打印全部，例如 1-3,5"
        :disabled="busy"
      /><small>仅用于此文件；留空表示全部页。</small></label
    >
  </div>
</template>
