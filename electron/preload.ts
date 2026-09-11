import { contextBridge, ipcRenderer, webUtils } from "electron";
import type { DesktopBridge, Settings } from "../shared/contracts";
const bridge: DesktopBridge = {
  printers: () => ipcRenderer.invoke("print:printers"),
  selectPrintPdfs: () => ipcRenderer.invoke("print:select"),
  printPdf: (job) => ipcRenderer.invoke("print:submit", job),
  consumePrint: () => ipcRenderer.invoke("print:consume"),
  printReady: (error) => ipcRenderer.invoke("print:ready", error),
  setFullscreen: (value) => ipcRenderer.invoke("window:fullscreen", value),
  onFullscreen: (handler) => {
    const listener = (_e: Electron.IpcRendererEvent, value: boolean) =>
      handler(value);
    ipcRenderer.on("window:fullscreen", listener);
    return () => ipcRenderer.removeListener("window:fullscreen", listener);
  },
  claim: (id) => ipcRenderer.invoke("tabs:claim", id),
  accept: (id) => ipcRenderer.invoke("tabs:accept", id),
  release: (id) => ipcRenderer.send("tabs:release", id),
  supply: (file) => ipcRenderer.send("tabs:supply", file),
  onExport: (handler) => {
    const listener = (_event: Electron.IpcRendererEvent, id: string) =>
      handler(id);
    ipcRenderer.on("tabs:export", listener);
    return () => ipcRenderer.removeListener("tabs:export", listener);
  },
  onRemove: (handler) => {
    const listener = (_event: Electron.IpcRendererEvent, id: string) =>
      handler(id);
    ipcRenderer.on("tabs:remove", listener);
    return () => ipcRenderer.removeListener("tabs:remove", listener);
  },
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
