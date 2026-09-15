import { fitScale } from "../../composables/fit";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import DOMPurify from "dompurify";
import type { PreviewProps, PreviewEmit } from "../types";
export function usePreview(props: PreviewProps, emit: PreviewEmit) {
  const pane = ref<HTMLElement>();
  const types: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    svg: "image/svg+xml",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    bmp: "image/bmp",
  };
  const bytes = props.file.bytes.slice().buffer;
  const data =
    props.file.ext === "svg"
      ? DOMPurify.sanitize(new TextDecoder().decode(bytes), {
          USE_PROFILES: { svg: true, svgFilters: true },
        })
      : bytes;
  const url = URL.createObjectURL(
    new Blob([data], { type: types[props.file.ext] }),
  );
  const dimensions = ref("");
  const natural = ref({ width: 0, height: 0 });
  const available = ref({ width: 0, height: 0 });
  const rotate = ref<0 | 90 | 180 | 270>(0);
  const originalPixels = ref(false);
  let observer: ResizeObserver | undefined;
  let frame = 0;
  onMounted(() => {
    const surface = pane.value?.querySelector(".image");
    if (!surface) return;
    observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        available.value = {
          width: surface.clientWidth - 50,
          height: surface.clientHeight - 50,
        };
      });
    });
    observer.observe(surface);
  });
  function loaded(event: Event) {
    const img = event.target as HTMLImageElement;
    natural.value = { width: img.naturalWidth, height: img.naturalHeight };
    dimensions.value = `${img.naturalWidth} × ${img.naturalHeight}`;
    emit("ready");
  }
  function cycleRotate() {
    rotate.value = (((rotate.value + 90) % 360) as 0 | 90 | 180 | 270);
  }
  function toggleOriginal() {
    originalPixels.value = !originalPixels.value;
    if (originalPixels.value) emit("update:zoom", 100);
  }
  const fitLabel = computed(() =>
    originalPixels.value ? "原始像素 100%" : "适合窗口",
  );
  const style = computed(() => {
    const { width, height } = natural.value;
    if (originalPixels.value)
      return {
        maxWidth: "none",
        maxHeight: "none",
        width: (width * props.zoom) / 100 + "px",
        height: (height * props.zoom) / 100 + "px",
      };
    const fit =
      width && height
        ? fitScale(
            width,
            height,
            available.value.width,
            available.value.height,
            props.fitMode || "original",
            Math.min(
              1,
              Math.max(1, available.value.width) / width,
              Math.max(1, available.value.height) / height,
            ),
          )
        : 1;
    return {
      maxWidth: "none",
      maxHeight: "none",
      width: (width * fit * props.zoom) / 100 + "px",
      height: (height * fit * props.zoom) / 100 + "px",
    };
  });
  onBeforeUnmount(() => {
    observer?.disconnect();
    cancelAnimationFrame(frame);
    URL.revokeObjectURL(url);
  });

  return {
    pane,
    url,
    style,
    dimensions,
    loaded,
    rotate,
    cycleRotate,
    originalPixels,
    toggleOriginal,
    fitLabel,
  };
}
