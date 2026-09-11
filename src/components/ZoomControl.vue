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
  if (Number.isFinite(number) && draft.value.trim())
    emit("update:modelValue", clampZoom(number));
  draft.value = String(props.modelValue);
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
        v-model="draft"
        inputmode="decimal"
        type="number"
        min="25"
        max="400"
        aria-label="缩放比例"
        @change="apply"
        @keydown.enter="apply"
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
