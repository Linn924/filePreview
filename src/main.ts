import { createApp } from "vue";
import App from "./App.vue";
import "./style.css";
if (new URLSearchParams(location.search).has("print")) {
  void import("./modules/pdf/print/PrintView.vue").then(({ default: View }) =>
    createApp(View).mount("#app"),
  );
} else createApp(App).mount("#app");
