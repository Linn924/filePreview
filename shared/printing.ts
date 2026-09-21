import type { PreviewFile } from "./contracts";
export interface Printer {
  name: string;
  displayName: string;
  isDefault: boolean;
  /** Best-effort driver status string when Electron exposes it. */
  status?: string;
  description?: string;
}
export type PrintScale = "fit" | "actual" | "shrink";
export type PrintPageOrder = "forward" | "reverse" | "odd" | "even";
export type PaperHintLevel = "info" | "warn" | null;
export interface PaperSupportHint {
  level: NonNullable<PaperHintLevel>;
  text: string;
}
/**
 * Best-effort paper support warning before submit. Never blocks printing.
 * Does not call the printer; uses paper choice + driver name heuristics.
 */
export function paperSupportHint(
  paper: PdfPrintOptions["paper"],
  printer?: {
    name?: string;
    displayName?: string;
    description?: string;
    status?: string;
  },
): PaperSupportHint | null {
  if (!paper || paper === "A4") return null;
  const blob =
    `${printer?.name || ""} ${printer?.displayName || ""} ${printer?.description || ""} ${printer?.status || ""}`.toLowerCase();
  if (/pdf|virtual|foxit|wps|one.?note|xps|print to/.test(blob))
    return {
      level: "warn",
      text: `当前打印机多为虚拟打印设备，可能不支持 ${paper}。建议改用 A4，或在系统打印机首选项中启用 ${paper} 后再打印。`,
    };
  if (paper === "A3" || paper === "A6")
    return {
      level: "warn",
      text: `${paper} 非常用办公纸张，打印机可能不支持。失败时请改用 A4，或在驱动中启用 ${paper}。`,
    };
  return {
    level: "info",
    text: `已选择 ${paper}。若提交失败，说明打印机可能不支持 ${paper}，请改用 A4 或在驱动中启用该尺寸。`,
  };
}
export interface PdfPrintOptions {
  deviceName: string;
  copies: number;
  paper: "A4" | "A3" | "A5" | "A6" | "Letter" | "Legal";
  landscape: boolean;
  color: boolean;
  duplex: "simplex" | "longEdge" | "shortEdge";
  range: string;
  /** fit = scale to paper (may enlarge); actual = 100%; shrink = only shrink if larger. */
  scale: PrintScale;
  /** Page sequence after range filter. */
  pageOrder: PrintPageOrder;
}
export interface PdfPrintJob {
  file: PreviewFile;
  options: PdfPrintOptions;
}
export const printDefaults: PdfPrintOptions = {
  deviceName: "",
  copies: 1,
  paper: "A4",
  landscape: false,
  color: true,
  duplex: "simplex",
  range: "",
  scale: "fit",
  pageOrder: "forward",
};
const papers = ["A4", "A3", "A5", "A6", "Letter", "Legal"] as const;
const duplexes = ["simplex", "longEdge", "shortEdge"] as const;
const scales = ["fit", "actual", "shrink"] as const;
const orders = ["forward", "reverse", "odd", "even"] as const;
export function validatePrintOptions(value: PdfPrintOptions): PdfPrintOptions {
  if (
    !value ||
    typeof value.deviceName !== "string" ||
    !value.deviceName ||
    !Number.isInteger(value.copies) ||
    value.copies < 1 ||
    value.copies > 99 ||
    !papers.includes(value.paper) ||
    !duplexes.includes(value.duplex) ||
    !scales.includes(value.scale ?? "fit") ||
    !orders.includes(value.pageOrder ?? "forward") ||
    typeof value.landscape !== "boolean" ||
    typeof value.color !== "boolean" ||
    typeof value.range !== "string" ||
    value.range.length > 500
  )
    throw Error("请检查打印机、份数和纸张设置。");
  return {
    deviceName: value.deviceName,
    copies: value.copies,
    paper: value.paper,
    landscape: value.landscape,
    color: value.color,
    duplex: value.duplex,
    range: value.range,
    scale: value.scale ?? "fit",
    pageOrder: value.pageOrder ?? "forward",
  };
}
export function selectedPages(range: string, count: number): number[] {
  if (!range.trim()) return Array.from({ length: count }, (_, i) => i + 1);
  const result = new Set<number>();
  for (const part of range.split(/[,，]/)) {
    const match = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match) throw Error("页码请填写为 1-3,5。");
    const from = Number(match[1]),
      to = Number(match[2] || match[1]);
    if (from < 1 || to < from || to > count)
      throw Error(`页码范围应在 1–${count} 之间。`);
    for (let n = from; n <= to; n++) result.add(n);
  }
  return [...result].sort((a, b) => a - b);
}
export function applyPageOrder(
  pages: number[],
  order: PrintPageOrder,
): number[] {
  if (order === "odd") return pages.filter((n) => n % 2 === 1);
  if (order === "even") return pages.filter((n) => n % 2 === 0);
  if (order === "reverse") return [...pages].reverse();
  return pages;
}
/** Content area uses ~10mm margin on each side (20mm total). */
export function contentBoxMm(paper: { width: number; height: number }) {
  return { width: paper.width - 20, height: paper.height - 20 };
}
export function printScaleFactor(
  originalPt: { width: number; height: number },
  paperMm: { width: number; height: number },
  mode: PrintScale,
): number {
  const box = contentBoxMm(paperMm);
  const boxW = (box.width * 72) / 25.4;
  const boxH = (box.height * 72) / 25.4;
  const fit = Math.min(
    boxW / (originalPt.width || 1),
    boxH / (originalPt.height || 1),
  );
  if (mode === "actual") return 1;
  if (mode === "shrink") return Math.min(1, fit);
  return fit;
}
export function paperSize(options: PdfPrintOptions) {
  let [width, height] =
    options.paper === "A3"
      ? [297, 420]
      : options.paper === "A5"
        ? [148, 210]
        : options.paper === "A6"
          ? [105, 148]
          : options.paper === "Letter"
            ? [215.9, 279.4]
            : options.paper === "Legal"
              ? [215.9, 355.6]
              : [210, 297];
  if (options.landscape) [width, height] = [height, width];
  return { width, height };
}
