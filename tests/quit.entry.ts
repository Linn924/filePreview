import { app, dialog } from "electron";
import { mkdirSync } from "node:fs";
import path from "node:path";
const profile = path.resolve("work/test-profiles/quit-" + process.pid);
mkdirSync(profile, { recursive: true });
app.setPath("userData", profile);
const program =
  require("../electron-dist/main.cjs") as typeof import("../electron/main");
program.ready.then(async (home) => {
  if (!home) app.exit(1);
  program.updateSettings({ closeAction: "ask" });
  dialog.showMessageBox = (async () => ({
    response: 0,
    checkboxChecked: true,
  })) as typeof dialog.showMessageBox;
  app.once("before-quit", () =>
    console.log("PASS chosen quit requests application exit"),
  );
  home!.close();
  setTimeout(() => {
    console.error("Application did not exit");
    app.exit(1);
  }, 5000);
});
