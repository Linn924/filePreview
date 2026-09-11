import { onMounted, onBeforeUnmount, type Ref } from "vue";
import { wheelZoom } from "./zoom";
interface WheelOptions {
  zoom: () => number;
  enabled: () => boolean;
  update: (zoom: number) => void;
  page?: (direction: number) => void;
}
export function useWheelPreview(
  root: Ref<HTMLElement | undefined>,
  options: WheelOptions,
) {
  let lastPage = 0;
  const listener = (event: WheelEvent) => {
    if (
      event
        .composedPath()
        .some(
          (el) =>
            el instanceof HTMLElement &&
            ["INPUT", "SELECT", "TEXTAREA"].includes(el.tagName),
        )
    )
      return;
    const inside = event
      .composedPath()
      .some(
        (el) =>
          el instanceof Element && el.classList.contains("preview-content"),
      );
    if (inside && options.enabled()) {
      event.preventDefault();
      options.update(wheelZoom(options.zoom(), event.deltaY));
      return;
    }
    if (!inside && options.page && Math.abs(event.deltaY) > 3) {
      event.preventDefault();
      if (Date.now() - lastPage < 220) return;
      lastPage = Date.now();
      options.page(event.deltaY > 0 ? 1 : -1);
    }
  };
  let el: HTMLElement | undefined;
  onMounted(() => {
    el = root.value;
    el?.addEventListener("wheel", listener, { passive: false });
  });
  onBeforeUnmount(() => el?.removeEventListener("wheel", listener));
}
