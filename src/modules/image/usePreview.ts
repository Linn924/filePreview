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
  let observer: ResizeObserver | undefined;
  onMounted(() => {
    const surface = pane.value?.querySelector(".image");
    if (!surface) return;
    observer = new ResizeObserver(() => {
      available.value = {
        width: surface.clientWidth - 50,
        height: surface.clientHeight - 50,
      };
    });
    observer.observe(surface);
  });
  function loaded(event: Event) {
    const img = event.target as HTMLImageElement;
    natural.value = { width: img.naturalWidth, height: img.naturalHeight };
    dimensions.value = `${img.naturalWidth} × ${img.naturalHeight}`;
    emit("ready");
  }
  const style = computed(() => {
    const { width, height } = natural.value;
    const fit =
      width && height
        ? Math.min(
            1,
            Math.max(1, available.value.width) / width,
            Math.max(1, available.value.height) / height,
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
    URL.revokeObjectURL(url);
  });

  return { pane, url, style, dimensions, loaded };
}
