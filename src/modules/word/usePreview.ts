import { useWheelPreview } from "../../composables/useWheelPreview";
import { onMounted, onBeforeUnmount, ref } from "vue";
import { attachTableResize } from "../../composables/resizeTable";
import type { PreviewFile } from "../../types";
import type { PreviewProps, PreviewEmit } from "../types";
export function usePreview(props: PreviewProps, emit: PreviewEmit) {
  const pane = ref<HTMLElement>();
  useWheelPreview(pane, {
    zoom: () => props.zoom,
    enabled: () => props.wheelZoom !== false,
    update: (value) => emit("update:zoom", value),
    page: (direction) => goPage(direction),
  });
  const host = ref<HTMLElement>();
  const warning = ref("");
  let destroyed = false;
  let cleanupResize: (() => void) | undefined;
  const page = ref(1),
    pageCount = ref(1);
  let pages: HTMLElement[] = [];
  let scroller: HTMLElement | undefined;
  function syncPage() {
    if (!scroller) return;
    const top = scroller.getBoundingClientRect().top;
    let best = 0,
      distance = Infinity;
    pages.forEach((p, i) => {
      const d = Math.abs(p.getBoundingClientRect().top - top - 25);
      if (d < distance) {
        distance = d;
        best = i;
      }
    });
    page.value = best + 1;
  }
  function goPage(direction: number) {
    const next = Math.max(
      0,
      Math.min(pages.length - 1, page.value - 1 + direction),
    );
    pages[next]?.scrollIntoView({ block: "start" });
    page.value = next + 1;
  }
  onMounted(async () => {
    try {
      const shadow = host.value!.attachShadow({ mode: "open" });
      const body = document.createElement("div");
      shadow.append(body);
      body.addEventListener("click", (e) => {
        if ((e.target as HTMLElement).closest("a")) e.preventDefault();
      });
      if (props.file.ext === "docx") {
        const { renderAsync } = await import("docx-preview");
        if (destroyed) return;
        await renderAsync(props.file.bytes, body, body, {
          useBase64URL: true,
          renderAltChunks: false,
          breakPages: true,
          renderHeaders: true,
          renderFooters: true,
          renderFootnotes: true,
          renderEndnotes: true,
          ignoreLastRenderedPageBreak: false,
        });
      } else {
        const { parseMsDocToHtml, mountMsDoc } = await import(
          "@file-viewer/doc"
        );
        const rendered = await parseMsDocToHtml(props.file.bytes, {
          renderOptions: {
            externalLinkPolicy: "block",
            externalResourcePolicy: "block",
          },
        });
        if (destroyed) return;
        mountMsDoc(body, rendered);
        if (rendered.warnings.length)
          warning.value =
            "部分旧版 Word 元素无法完整还原，已显示可解析的内容。";
      }
      if (!destroyed) {
        const style = document.createElement("style");
        style.textContent =
          ".docx-wrapper{background:transparent!important;padding:24px!important}section.docx{overflow:visible!important}table{overflow:visible}";
        shadow.append(style);
        pages = Array.from(
          shadow.querySelectorAll<HTMLElement>("section.docx"),
        );
        if (!pages.length) pages = [body];
        for (const pageElement of pages)
          pageElement.classList.add("preview-content");
        pageCount.value = pages.length;
        scroller = pane.value?.querySelector(".document-scroll") as HTMLElement;
        scroller?.addEventListener("scroll", syncPage, { passive: true });
        cleanupResize = attachTableResize(shadow);
        emit("ready");
      }
    } catch (e) {
      if (!destroyed)
        emit(
          "error",
          "无法解析 Word 文件，文件可能损坏、加密或不兼容。" +
            (e instanceof Error ? ` ${e.message}` : ""),
        );
    }
  });
  onBeforeUnmount(() => {
    destroyed = true;
    cleanupResize?.();
    scroller?.removeEventListener("scroll", syncPage);
    host.value?.shadowRoot?.replaceChildren();
  });

  return { pane, host, warning, page, pageCount, goPage };
}
