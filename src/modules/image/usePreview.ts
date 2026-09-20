import { fitScale } from "../../composables/fit";
import { createSafeResizeObserver } from "../../composables/safeResizeObserver";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import DOMPurify from "dompurify";
import type { PreviewProps, PreviewEmit } from "../types";

/**
 * 从 JPEG 字节中读取 EXIF Orientation 标签（0x0112）。
 * 返回值 1=正常, 3=180°, 6=90°CW, 8=90°CCW；其余或解析失败返回 1。
 */
function readJpegOrientation(bytes: Uint8Array): number {
  // JPEG SOI
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return 1;
  let pos = 2;
  while (pos + 3 < bytes.length) {
    if (bytes[pos] !== 0xff) break;
    const marker = bytes[pos + 1];
    const segLen = (bytes[pos + 2] << 8) | bytes[pos + 3];
    // APP1 marker = 0xE1
    if (marker === 0xe1 && segLen >= 6) {
      // Check "Exif\0\0"
      const hdr = String.fromCharCode(
        bytes[pos + 4], bytes[pos + 5], bytes[pos + 6],
        bytes[pos + 7], bytes[pos + 8], bytes[pos + 9],
      );
      if (hdr === "Exif\0\0") {
        const tiff = pos + 10;
        // Byte order: "II" (little-endian) or "MM" (big-endian)
        const le =
          bytes[tiff] === 0x49 && bytes[tiff + 1] === 0x49;
        const read16 = (o: number) =>
          le
            ? bytes[tiff + o] | (bytes[tiff + o + 1] << 8)
            : (bytes[tiff + o] << 8) | bytes[tiff + o + 1];
        const read32 = (o: number) =>
          le
            ? bytes[tiff + o] |
              (bytes[tiff + o + 1] << 8) |
              (bytes[tiff + o + 2] << 16) |
              (bytes[tiff + o + 3] << 24)
            : (bytes[tiff + o] << 24) |
              (bytes[tiff + o + 1] << 16) |
              (bytes[tiff + o + 2] << 8) |
              bytes[tiff + o + 3];
        const ifd0 = read32(4);
        const count = read16(ifd0);
        for (let i = 0; i < count; i++) {
          const entry = ifd0 + 2 + i * 12;
          if (read16(entry) === 0x0112) {
            // Orientation tag found; value is SHORT (type=3)
            return read16(entry + 8);
          }
        }
      }
    }
    // End-of-image or not an APP segment we care about
    if (marker === 0xda || marker === 0xd9) break;
    pos += 2 + segLen;
  }
  return 1;
}

/** EXIF Orientation → 顺时针旋转角度 */
function orientationToDegrees(orientation: number): 0 | 90 | 180 | 270 {
  if (orientation === 3) return 180;
  if (orientation === 6) return 90;
  if (orientation === 8) return 270;
  return 0;
}

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

  // 自动从 EXIF 读取初始方向（仅 JPEG）
  const exifDeg =
    props.file.ext === "jpg" || props.file.ext === "jpeg"
      ? orientationToDegrees(readJpegOrientation(props.file.bytes))
      : 0;
  const rotate = ref<0 | 90 | 180 | 270>(exifDeg);

  const originalPixels = ref(false);
  let observer: ResizeObserver | undefined;
  onMounted(() => {
    const surface = pane.value?.querySelector(".image");
    if (!surface) return;
    observer = createSafeResizeObserver(() => {
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
