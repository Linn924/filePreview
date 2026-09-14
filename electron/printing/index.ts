import { BrowserWindow, ipcMain, dialog, shell, type Session } from "electron";
import path from "node:path";
import { trusted, protectWindow } from "../security";
import { readPreviewFile } from "../files";
import { validatePrintOptions, type PdfPrintJob } from "../../shared/printing";
interface ActiveJob {
  owner: number;
  job?: PdfPrintJob;
  resolve: () => void;
  reject: (e: Error) => void;
  window: BrowserWindow;
  timer: ReturnType<typeof setTimeout>;
}
const jobs = new Map<number, ActiveJob>();
let queue = Promise.resolve();
export function setupPrinting(local: Session) {
  ipcMain.handle("print:drop",async(event,paths:unknown)=>{trusted(event);if(!Array.isArray(paths)||paths.some(p=>typeof p!=="string"||!path.isAbsolute(p)||path.extname(p).toLowerCase()!==".pdf"))throw Error("请只拖入 PDF 文件。");const files=[];for(const name of paths)files.push(await readPreviewFile(name));return files;});
  ipcMain.handle("print:printers", async (event) => {
    trusted(event);
    const list = await event.sender.getPrintersAsync();
    return list.map((p) => ({
      name: p.name,
      displayName: p.displayName || p.name,
      isDefault: Boolean((p as { isDefault?: boolean }).isDefault),
      status: (p as { status?: string | number }).status
        ? String((p as { status?: string | number }).status)
        : undefined,
      description: (p as { description?: string }).description || undefined,
    }));
  });
  // Open OS printer settings / queue. Never submits a job from this handler.
  ipcMain.handle("print:open-queue", async (event) => {
    trusted(event);
    try {
      await shell.openExternal("ms-settings:printers");
      return "已打开系统打印机设置；打印队列请在对应打印机图标中查看。";
    } catch (e) {
      throw Error(
        "无法打开系统打印机设置：" +
          (e instanceof Error ? e.message : String(e)),
      );
    }
  });
  ipcMain.handle("print:select", async (event) => {
    trusted(event);
    const result = await dialog.showOpenDialog(
      BrowserWindow.fromWebContents(event.sender)!,
      {
        title: "选择要打印的 PDF",
        properties: ["openFile", "multiSelections"],
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      },
    );
    if (result.canceled) return [];
    const files=[];
    for(const path of result.filePaths)files.push(await readPreviewFile(path));
    return files;
  });
  ipcMain.handle("print:submit", async (event, value: PdfPrintJob) => {
    trusted(event);
    const options = validatePrintOptions(value?.options);
    const file = value?.file;
    if (
      !file ||
      file.ext !== "pdf" ||
      !(file.bytes instanceof Uint8Array) ||
      file.bytes.length > 100 * 1024 * 1024 ||
      new TextDecoder().decode(file.bytes.slice(0, 1024)).indexOf("%PDF-") < 0
    )
      throw Error("只支持有效的 PDF 文件。");
    const printers = await event.sender.getPrintersAsync();
    if (!printers.some((p) => p.name === options.deviceName))
      throw Error("打印机不可用，请重新选择。");
    const owner = event.sender;
    const run = queue.then(
      () =>
        new Promise<void>((resolve, reject) => {
          if (owner.isDestroyed()) {
            reject(Error("预览窗口已关闭。"));
            return;
          }
          const win = new BrowserWindow({
            show: false,
            width: 1000,
            height: 800,
            webPreferences: {
              preload: path.join(__dirname, "preload.cjs"),
              session: local,
              contextIsolation: true,
              nodeIntegration: false,
              sandbox: true,
              backgroundThrottling: false,
            },
          });
          protectWindow(win);
          const id = win.webContents.id;
          const abort = () =>
            finish(id, Error("预览窗口已关闭，停止准备打印。"));
          owner.once("destroyed", abort);
          const timer = setTimeout(
            () => finish(id, Error("打印准备超时，请减少页数后重试。")),
            180000,
          );
          preparedOptions.set(id, options);
          jobs.set(id, {
            owner: owner.id,
            job: { file, options },
            window: win,
            timer,
            resolve: () => {
              owner.removeListener("destroyed", abort);
              resolve();
            },
            reject: (e) => {
              owner.removeListener("destroyed", abort);
              reject(e);
            },
          });
          win.on("closed", () => {
            if (jobs.has(id)) finish(id, Error("打印窗口已关闭。"));
          });
          void win
            .loadURL("preview://local/index.html?print=1")
            .catch((e) => finish(id, e));
        }),
    );
    queue = run.catch(() => {});
    await run;
    return "submitted";
  });
  ipcMain.handle("print:consume", (event) => {
    trusted(event);
    const entry = jobs.get(event.sender.id);
    if (!entry?.job) throw Error("打印任务已释放。");
    const job = entry.job;
    entry.job = undefined;
    return job;
  });
  ipcMain.handle("print:ready", async (event, error?: string) => {
    trusted(event);
    const entry = jobs.get(event.sender.id);
    if (!entry) return;
    if (error) {
      finish(event.sender.id, Error(error));
      return;
    }
    // Options are retained separately in the print window's prepared payload.
    const options = preparedOptions.get(event.sender.id);
    if (!options) {
      finish(event.sender.id, Error("打印设置已释放。"));
      return;
    }
    event.sender.print(
      {
        silent: true,
        deviceName: options.deviceName,
        copies: options.copies,
        pageSize: options.paper,
        landscape: options.landscape,
        color: options.color,
        duplexMode: options.duplex,
        printBackground: true,
        margins: { marginType: "none" },
      },
      (success, reason) =>
        finish(
          event.sender.id,
          success
            ? undefined
            : Error(
                reason === "Print job canceled"
                  ? "打印已取消。"
                  : reason === "Invalid printer settings"
                    ? "打印设置不受支持，请检查纸张和打印机。"
                    : "打印任务提交失败，请检查打印机状态。",
              ),
        ),
    );
  });
}
import type { PdfPrintOptions } from "../../shared/printing";
const preparedOptions = new Map<number, PdfPrintOptions>();
function finish(id: number, error?: Error) {
  const entry = jobs.get(id);
  if (!entry) return;
  jobs.delete(id);
  preparedOptions.delete(id);
  clearTimeout(entry.timer);
  if (!entry.window.isDestroyed()) entry.window.destroy();
  error ? entry.reject(error) : entry.resolve();
}
