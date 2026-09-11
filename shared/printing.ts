import type { PreviewFile } from "./contracts";
export interface Printer {
  name: string;
  displayName: string;
  isDefault: boolean;
}
export interface PdfPrintOptions {
  deviceName: string;
  copies: number;
  paper: "A4" | "A3" | "A5" | "A6" | "Letter" | "Legal";
  landscape: boolean;
  color: boolean;
  duplex: "simplex" | "longEdge" | "shortEdge";
  range: string;
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
};
export function validatePrintOptions(value: PdfPrintOptions): PdfPrintOptions {
  if (
    !value ||
    typeof value.deviceName !== "string" ||
    !value.deviceName ||
    !Number.isInteger(value.copies) ||
    value.copies < 1 ||
    value.copies > 99 ||
    !["A4", "A3", "A5", "A6", "Letter", "Legal"].includes(value.paper) ||
    !["simplex", "longEdge", "shortEdge"].includes(value.duplex) ||
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
