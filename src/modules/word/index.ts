import "./style.css";
import { defineAsyncComponent } from "vue";
import type { PreviewModule } from "../types";
export default {
  id: "word",
  extensions: ["docx", "doc"],
  component: defineAsyncComponent(() => import("./index.vue")),
} satisfies PreviewModule;
