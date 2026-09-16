<script setup lang="ts">
defineProps<{ current: number; total: number; label?: string }>();
const emit = defineEmits<{ jump: [page: number] }>();
function jump(event: Event) {
  emit("jump", Number((event.target as HTMLInputElement).value) || 1);
}
</script>
<template>
  <footer class="page-nav">
    <span v-if="label" class="page-nav-label">{{ label }}</span>
    <div>
      <button :disabled="current <= 1" @click="emit('jump', current - 1)">
        上一页</button
      ><label class="page-indicator"
        ><input
          aria-label="页码"
          type="number"
          min="1"
          :max="total"
          :value="current"
          @change="jump"
          @keydown.enter="($event.target as HTMLInputElement).blur()"
        />
        / {{ total }}</label
      ><button :disabled="current >= total" @click="emit('jump', current + 1)">
        下一页
      </button>
    </div>
  </footer>
</template>
