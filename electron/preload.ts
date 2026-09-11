import { contextBridge, ipcRenderer, webUtils } from "electron";
import type { DesktopBridge, Settings } from "../shared/contracts";
const bridge: DesktopBridge = {
  select: () => ipcRenderer.invoke("preview:select"),
  drop: (files) =>
    ipcRenderer.invoke(
      "preview:drop",
      files.map((file) => webUtils.getPathForFile(file)),
    ),
  consume: () => ipcRenderer.invoke("preview:consume"),
  close: () => ipcRenderer.send("preview:close"),
  getSettings: () => ipcRenderer.invoke("settings:get"),
  setSettings: (settings) => ipcRenderer.invoke("settings:set", settings),
  onSettings: (handler) => {
    const listener = (_event: Electron.IpcRendererEvent, settings: Settings) =>
      handler(settings);
    ipcRenderer.on("settings:changed", listener);
    return () => ipcRenderer.removeListener("settings:changed", listener);
  },
};
contextBridge.exposeInMainWorld("localPreview", bridge);
