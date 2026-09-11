import "./style.css";
import { defineAsyncComponent } from "vue";
import type { PreviewModule } from "../types";
export default {
  id: "excel",
  extensions: ["xlsx", "xls", "csv", "tsv"],
  component: defineAsyncComponent(() => import("./index.vue")),
} satisfies PreviewModule;
