export interface PreviewFile {
  id: string;
  name: string;
  size: number;
  ext: string;
  bytes: Uint8Array;
  error: string;
  view?: { zoom: number; scroll: Array<{ top: number; left: number }>; fit?: 'original' | 'width' | 'page'; encoding?: string; excel?: { sheet: string; columns: number; rows: number; widths: Record<string, number> } };
}
export type Theme = "light" | "dark" | "system";
export interface Settings {
  theme: Theme;
  closeAction: "ask" | "quit" | "tray";
  multiFileMode: "ask" | "tabs" | "windows";
  defaultZoom: number;
  maximizePreview: boolean;
}
export const defaults: Settings = {
  theme: "light",
  closeAction: "ask",
  multiFileMode: "ask",
  defaultZoom: 100,
  maximizePreview: true,
};
export const extensions = [
  "docx",
  "doc",
  "txt",
  "text",
  "json",
  "md",
  "log",
  "xml",
  "xlsx",
  "xls",
  "csv",
  "tsv",
  "pptx",
  "ppt",
  "pdf",
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
  "bmp",
  "svg",
];
export function normalizeSettings(
  input: Partial<Settings> = {},
  base: Settings = defaults,
): Settings {
  return {
    theme: ["light", "dark", "system"].includes(input.theme ?? "")
      ? input.theme!
      : base.theme,
    closeAction: ["ask", "quit", "tray"].includes(input.closeAction ?? "")
      ? input.closeAction!
      : base.closeAction,
    multiFileMode: ["ask", "tabs", "windows"].includes(
      input.multiFileMode ?? "",
    )
      ? input.multiFileMode!
      : base.multiFileMode,
    defaultZoom: Number.isFinite(input.defaultZoom)
      ? Math.min(400, Math.max(25, Math.round(input.defaultZoom!)))
      : base.defaultZoom,
    maximizePreview:
      typeof input.maximizePreview === "boolean"
        ? input.maximizePreview
        : base.maximizePreview,
  };
}
export interface DesktopBridge {
  openPrintPanel(file:PreviewFile):Promise<void>;
  printPanelFiles():Promise<PreviewFile[]>;
  onPrintIncoming(handler:()=>void):()=>void;
  previewPrintFile(file:PreviewFile):Promise<void>;
  onPreviewPrintFile(handler:(file:PreviewFile)=>void):()=>void;
  arrangePrintWindows():Promise<void>;
  printPanelBusy(value:boolean):void;
  printers(): Promise<import("./printing").Printer[]>;
  dropPrintPdfs(files:File[]):Promise<PreviewFile[]>;
  selectPrintPdfs(): Promise<PreviewFile[]>;
  printPdf(job: import("./printing").PdfPrintJob): Promise<string>;
  consumePrint(): Promise<import("./printing").PdfPrintJob>;
  printReady(error?: string): Promise<void>;
  setFullscreen(value: boolean): Promise<boolean>;
  onFullscreen(handler: (value: boolean) => void): () => void;
  claim(id: string): Promise<PreviewFile>;
  accept(id: string): Promise<void>;
  release(id: string): void;
  supply(file: PreviewFile): void;
  onExport(handler: (id: string) => void): () => void;
  onRemove(handler: (id: string) => void): () => void;
  select(): Promise<void>;
  drop(files: File[]): Promise<void>;
  consume(): Promise<PreviewFile[]>;
  close(): void;
  getSettings(): Promise<Settings>;
  setSettings(settings: Partial<Settings>): Promise<Settings>;
  onSettings(handler: (settings: Settings) => void): () => void;
}
