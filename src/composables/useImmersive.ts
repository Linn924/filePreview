import { ref, onMounted, onBeforeUnmount } from "vue";
export function useImmersive(enabled: boolean) {
  const immersive = ref(false);
  let cleanup: (() => void) | undefined;
  const key = (event: KeyboardEvent) => {
    if (enabled && event.key === "F11") {
      event.preventDefault();
      void window.localPreview.setFullscreen(!immersive.value);
    }
  };
  onMounted(() => {
    cleanup = window.localPreview.onFullscreen((value) => {
      immersive.value = value;
      document.documentElement.classList.toggle("immersive", value);
    });
    window.addEventListener("keydown", key);
  });
  onBeforeUnmount(() => {
    cleanup?.();
    window.removeEventListener("keydown", key);
  });
  return immersive;
}
