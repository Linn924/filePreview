export interface PreviewFile {
  id: string;
  name: string;
  size: number;
  ext: string;
  bytes: Uint8Array;
  error: string;
}
export type Theme = "light" | "dark" | "system";
export interface Settings {
  theme: Theme;
  closeAction: "ask" | "quit" | "tray";
  multiFileMode: "ask" | "tabs" | "windows";
  defaultZoom: number;
  maximizePreview: boolean;
  wheelZoom: boolean;
}
export const defaults: Settings = {
  theme: "light",
  closeAction: "ask",
  multiFileMode: "ask",
  defaultZoom: 100,
  maximizePreview: true,
  wheelZoom: true,
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
    wheelZoom:
      typeof input.wheelZoom === "boolean" ? input.wheelZoom : base.wheelZoom,
  };
}
export interface DesktopBridge {
  select(): Promise<void>;
  drop(files: File[]): Promise<void>;
  consume(): Promise<PreviewFile[]>;
  close(): void;
  getSettings(): Promise<Settings>;
  setSettings(settings: Partial<Settings>): Promise<Settings>;
  onSettings(handler: (settings: Settings) => void): () => void;
}
