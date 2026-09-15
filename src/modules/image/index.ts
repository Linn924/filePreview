import "./style.css";
import { defineAsyncComponent } from "vue";
import type { PreviewModule } from "../types";
export default {
  pageFit: true,
  id: "image",
  extensions: ["png", "jpg", "jpeg", "webp", "gif", "bmp", "svg"],
  toolbar: defineAsyncComponent(
    () => import("../../components/FilePrintButton.vue"),
  ),
  component: defineAsyncComponent(() => import("./index.vue")),
} satisfies PreviewModule;
