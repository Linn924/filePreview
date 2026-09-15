import "./style.css";
import { defineAsyncComponent } from "vue";
import type { PreviewModule } from "../types";
export default {
  id: "text",
  extensions: [
    "txt",
    "text",
    "json",
    "md",
    "log",
    "xml",
    "js",
    "ts",
    "css",
    "ini",
    "yaml",
    "yml",
    "toml",
  ],
  component: defineAsyncComponent(() => import("./index.vue")),
} satisfies PreviewModule;
