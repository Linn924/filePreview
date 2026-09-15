import "./style.css";
import { defineAsyncComponent } from "vue";
import type { PreviewModule } from "../types";
export default {
  pageFit: true,
  id: "word",
  extensions: ["docx", "doc"],
  toolbar: defineAsyncComponent(
    () => import("../../components/FilePrintButton.vue"),
  ),
  component: defineAsyncComponent(() => import("./index.vue")),
} satisfies PreviewModule;
