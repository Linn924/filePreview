<script setup lang="ts">
import { ref, watch } from "vue";
import { clampZoom } from "../composables/zoom";
const props = defineProps<{ modelValue: number }>();
const emit = defineEmits<{ "update:modelValue": [value: number] }>();
const draft = ref(String(props.modelValue));
watch(
  () => props.modelValue,
  (v) => (draft.value = String(v)),
);
function apply() {
  const number = Number(draft.value);
  const value =
    Number.isFinite(number) && draft.value.trim()
      ? clampZoom(number)
      : props.modelValue;
  draft.value = String(value);
  emit("update:modelValue", value);
}
</script>
<template>
  <div class="zoom-control">
    <button
      aria-label="缩小"
      @click="emit('update:modelValue', clampZoom(modelValue - 10))"
    >
      −</button
    ><label
      ><input
        :value="draft"
        @input="draft = ($event.target as HTMLInputElement).value"
        inputmode="decimal"
        type="number"
        min="25"
        max="400"
        aria-label="缩放比例"
        @change="apply"
        @blur="apply"
        @keydown.enter.prevent="apply"
      />%</label
    ><button
      aria-label="放大"
      @click="emit('update:modelValue', clampZoom(modelValue + 10))"
    >
      ＋</button
    ><button class="fit-button" @click="emit('update:modelValue', 100)">
      适配
    </button>
  </div>
</template>
