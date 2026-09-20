import { BrowserWindow, dialog } from "electron";
import type { Suite } from "../context";
const suite: Suite = async (c) => {
  const original = dialog.showOpenDialog;
  try {
    c.program.updateSettings({ multiFileMode: "tabs", maximizePreview: false });
    dialog.showOpenDialog = (async () => ({
      canceled: false,
      filePaths: Array(13).fill(c.fixture("text.txt")),
    })) as typeof dialog.showOpenDialog;
    await c.evaluate(c.home, "window.localPreview.select()");
    const tabs = BrowserWindow.getAllWindows().find((w) => w.id !== c.home.id)!;
    await c.check(
      tabs,
      "file picker accepts more than twelve files",
      "document.querySelectorAll('.tab').length===13",
    );
    await c.check(tabs,'only the active file mounts a preview',"document.querySelectorAll('.preview-tab').length===1");
    c.close(tabs);
    const windows = await c.program.openPaths(
      Array(26).fill(c.fixture("text.txt")),
      "windows",
    );
    if (windows.length !== 26)
      throw Error("Separate-window count was restricted");
    windows.forEach(c.close);
    c.pass("more than twenty-five preview windows accepted");
  } finally {
    dialog.showOpenDialog = original;
    c.program.updateSettings({ maximizePreview: true });
  }
};
export default suite;
