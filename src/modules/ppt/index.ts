import "./style.css";
import { defineAsyncComponent } from "vue";
import type { PreviewModule } from "../types";
export default {
  pageFit: true,
  id: "ppt",
  extensions: ["pptx", "ppt"],
  component: defineAsyncComponent(() => import("./index.vue")),
} satisfies PreviewModule;
