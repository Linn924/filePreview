import "./style.css";
import { defineAsyncComponent } from "vue";
import type { PreviewModule } from "../types";
export default {
  pageFit: true,
  toolbar: defineAsyncComponent(() => import("./print/PrintButton.vue")),
  id: "pdf",
  extensions: ["pdf"],
  component: defineAsyncComponent(() => import("./index.vue")),
} satisfies PreviewModule;
